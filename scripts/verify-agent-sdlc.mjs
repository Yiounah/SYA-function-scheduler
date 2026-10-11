import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliArguments = process.argv.slice(2);
const rootArgument = cliArguments.find((argument) => argument !== '--strict-tracked');
const root = path.resolve(rootArgument || scriptRoot);
const strictTracked = process.env.CI === 'true' || cliArguments.includes('--strict-tracked');
const failures = [];
const notes = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function read(relativePath) {
  const filePath = path.join(root, relativePath);
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    failures.push(`${relativePath}: ${error.message}`);
    return '';
  }
}

function readJson(relativePath) {
  const contents = read(relativePath);
  if (!contents) return null;
  try {
    return JSON.parse(contents);
  } catch (error) {
    failures.push(`${relativePath}: invalid JSON (${error.message})`);
    return null;
  }
}

function readYaml(relativePath, pyyamlVersion) {
  const parser = `
import json
import sys
import yaml

class UniqueKeyLoader(yaml.SafeLoader):
    pass

def construct_mapping(loader, node, deep=False):
    mapping = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in mapping:
            raise yaml.constructor.ConstructorError(
                "while constructing a mapping", node.start_mark,
                f"duplicate key: {key}", key_node.start_mark,
            )
        mapping[key] = loader.construct_object(value_node, deep=deep)
    return mapping

UniqueKeyLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,
    construct_mapping,
)

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    json.dump(yaml.load(handle, Loader=UniqueKeyLoader), sys.stdout)
`;
  try {
    const output = execFileSync(
      'uv',
      [
        'run',
        '--quiet',
        '--isolated',
        '--no-project',
        '--no-config',
        '--no-env-file',
        '--with',
        `PyYAML==${pyyamlVersion}`,
        'python',
        '-I',
        '-c',
        parser,
        path.join(root, relativePath),
      ],
      { cwd: root, encoding: 'utf8' }
    );
    return JSON.parse(output);
  } catch (error) {
    failures.push(`${relativePath}: strict YAML parsing failed (${error.message})`);
    return null;
  }
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function listFiles(relativeRoot) {
  const base = path.join(root, relativeRoot);
  if (!fs.existsSync(base)) return [];
  const files = [];

  function walk(directory, relativeDirectory = '') {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    for (const entry of entries) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolutePath, relativePath);
      else if (entry.isFile()) files.push(relativePath);
      else failures.push(`${relativeRoot}/${relativePath}: unsupported non-file entry`);
    }
  }

  walk(base);
  return files;
}

function hashFileTree(relativeRoot) {
  const files = listFiles(relativeRoot);
  const digest = crypto.createHash('sha256');
  for (const relativePath of files) {
    digest.update(relativePath);
    digest.update('\0');
    digest.update(fs.readFileSync(path.join(root, relativeRoot, relativePath)));
    digest.update('\0');
  }
  return { files, sha256: digest.digest('hex') };
}

function parseFlatYaml(relativePath) {
  const values = new Map();
  const contents = read(relativePath);
  for (const [index, rawLine] of contents.split('\n').entries()) {
    const line = rawLine.replace(/\r$/, '');
    if (!line || /^\s*#/.test(line)) continue;
    const match = line.match(/^([A-Za-z0-9_]+):\s*(.*?)\s*$/);
    if (!match) {
      failures.push(`${relativePath}:${index + 1}: expected a flat YAML scalar`);
      continue;
    }
    const [, key, serialized] = match;
    if (values.has(key)) {
      failures.push(`${relativePath}:${index + 1}: duplicate key ${key}`);
      continue;
    }
    let value = serialized;
    try {
      if (serialized.startsWith('"')) value = JSON.parse(serialized);
      else if (serialized.startsWith("'") && serialized.endsWith("'")) {
        value = serialized.slice(1, -1).replaceAll("''", "'");
      } else if (serialized === 'true' || serialized === 'false') value = serialized === 'true';
      else if (/^-?\d+(?:\.\d+)?$/.test(serialized)) value = Number(serialized);
    } catch (error) {
      failures.push(`${relativePath}:${index + 1}: invalid scalar (${error.message})`);
    }
    values.set(key, value);
  }
  return values;
}

function parseTomlScalarSection(contents, sectionName, relativePath) {
  const sectionPattern = new RegExp(`^\\[${escapeRegex(sectionName)}\\]\\s*$`, 'gm');
  const sectionMatches = [...contents.matchAll(sectionPattern)];
  check(sectionMatches.length === 1, `${relativePath}: expected exactly one [${sectionName}] section`);
  const values = new Map();
  const section = tomlSection(contents, sectionName);
  for (const [index, rawLine] of section.split('\n').entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (!match) {
      failures.push(`${relativePath} [${sectionName}] line ${index + 1}: expected a scalar assignment`);
      continue;
    }
    const [, key, serialized] = match;
    if (values.has(key)) {
      failures.push(`${relativePath} [${sectionName}]: duplicate key ${key}`);
      continue;
    }
    let value = serialized;
    try {
      if (serialized.startsWith('"')) value = JSON.parse(serialized);
      else if (serialized === 'true' || serialized === 'false') value = serialized === 'true';
      else if (/^-?\d+(?:\.\d+)?$/.test(serialized)) value = Number(serialized);
    } catch (error) {
      failures.push(`${relativePath} [${sectionName}]: invalid ${key} (${error.message})`);
    }
    values.set(key, value);
  }
  return values;
}

function checkExpectedValues(actual, expected, label) {
  for (const [key, value] of Object.entries(expected)) {
    check(actual.get(key) === value, `${label}: invalid ${key}`);
  }
}

function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

function yamlJobBlock(contents, jobId) {
  const lines = contents.split('\n');
  const start = lines.findIndex((line) => line === `  ${jobId}:`);
  if (start === -1) return '';
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^  [a-z0-9-]+:\s*$/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tomlSection(contents, name) {
  const marker = `[${name}]`;
  const markerIndex = contents.indexOf(marker);
  if (markerIndex === -1) return '';
  const bodyStart = contents.indexOf('\n', markerIndex) + 1;
  if (bodyStart === 0) return '';
  const remaining = contents.slice(bodyStart);
  const nextSection = remaining.search(/^\s*\[\[?[^\]]+\]\]?\s*$/m);
  return nextSection === -1 ? remaining : remaining.slice(0, nextSection);
}

const lock = readJson('agent-sdlc.lock.json');
check(lock?.schemaVersion === 1, 'agent-sdlc.lock.json: schemaVersion must be 1');
check(/^\d+\.\d+\.\d+$/.test(lock?.bmad?.version || ''), 'agent-sdlc.lock.json: invalid BMAD version');
check(/^sha512-[A-Za-z0-9+/=]+$/.test(lock?.bmad?.npmIntegrity || ''), 'agent-sdlc.lock.json: invalid BMAD npm integrity');
const expectedBmadFiles = Array.isArray(lock?.bmad?.installedFiles) ? [...lock.bmad.installedFiles].sort() : [];
check(expectedBmadFiles.length > 0, 'agent-sdlc.lock.json: BMAD installed file inventory is missing');
const installedBmadFiles = listFiles('_bmad')
  .filter((relativePath) => (
    relativePath !== 'config.user.toml' &&
    !relativePath.endsWith('.bak') &&
    !/^custom\/.*\.user\.toml$/.test(relativePath) &&
    (relativePath === 'render/.gitignore' || !relativePath.startsWith('render/'))
  ))
  .sort();
check(
  JSON.stringify(installedBmadFiles) === JSON.stringify(expectedBmadFiles),
  `BMAD installed file inventory differs from the lock (${installedBmadFiles.length} files)`
);
check(/^v\d+\.\d+\.\d+$/.test(lock?.tea?.version || ''), 'agent-sdlc.lock.json: invalid TEA version');
check(/^[0-9a-f]{40}$/.test(lock?.tea?.commit || ''), 'agent-sdlc.lock.json: invalid TEA commit');
check(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/.test(lock?.tea?.repository || ''), 'agent-sdlc.lock.json: invalid TEA repository');
check(/^\d+\.\d+\.\d+$/.test(lock?.opencode?.version || ''), 'agent-sdlc.lock.json: invalid OpenCode version');
check(/^sha512-[A-Za-z0-9+/=]+$/.test(lock?.opencode?.npmIntegrity || ''), 'agent-sdlc.lock.json: invalid OpenCode npm integrity');
check(Number.isInteger(lock?.opencode?.skillFileCount) && lock.opencode.skillFileCount > 0, 'agent-sdlc.lock.json: invalid skill file count');
check(/^[0-9a-f]{64}$/.test(lock?.opencode?.skillPayloadSha256 || ''), 'agent-sdlc.lock.json: invalid skill payload SHA-256');
check(
  lock?.opencode?.skillCount === lock?.opencode?.skills?.length,
  'agent-sdlc.lock.json: skill count does not match the locked inventory'
);
for (const [name, action] of Object.entries(lock?.githubActions || {})) {
  check(/^v\d+$/.test(action?.version || ''), `agent-sdlc.lock.json: invalid ${name} action version`);
  check(/^[0-9a-f]{40}$/.test(action?.commit || ''), `agent-sdlc.lock.json: invalid ${name} action commit`);
}
check(Object.keys(lock?.githubActions || {}).length === 4, 'agent-sdlc.lock.json: expected four GitHub Action pins');
check(/^\d+\.\d+\.\d+$/.test(lock?.githubActions?.setupUv?.toolVersion || ''), 'agent-sdlc.lock.json: invalid uv tool version');
check(/^\d+\.\d+\.\d+$/.test(lock?.verification?.pyyamlVersion || ''), 'agent-sdlc.lock.json: invalid PyYAML version');

const manifest = read('_bmad/_config/manifest.yaml');
const bmadVersion = escapeRegex(lock?.bmad?.version || '__missing__');
const teaVersion = escapeRegex(lock?.tea?.version || '__missing__');
const teaCommit = escapeRegex(lock?.tea?.commit || '__missing__');
check(new RegExp(`installation:\\s*\\n\\s+version: ${bmadVersion}\\b`).test(manifest), 'BMAD installation version differs from the lock');
check(new RegExp(`- name: bmm\\s*\\n\\s+version: ${bmadVersion}\\b`).test(manifest), 'BMM version differs from the lock');
check(new RegExp(`- name: tea\\s*\\n\\s+version: ${teaVersion}\\b`).test(manifest), 'TEA version differs from the lock');
check(/\n\s+channel: pinned\b/.test(manifest), 'TEA channel is not pinned');
check(new RegExp(`\\n\\s+sha: ${teaCommit}\\b`).test(manifest), 'TEA manifest commit differs from the lock');
check(/ides:\s*\n\s+- opencode\b/.test(manifest), 'OpenCode is not registered in the BMAD manifest');

const filesManifest = read('_bmad/_config/files-manifest.csv');
const manifestRecords = filesManifest.split('\n').slice(1).filter(Boolean).map(parseCsvLine);
const manifestPaths = new Set();
const installedIntegrityPaths = new Set(['config.toml', 'bmm/config.yaml', 'tea/config.yaml']);
const verifiedIntegrityPaths = new Set();
for (const record of manifestRecords) {
  check(record.length === 5, '_bmad/_config/files-manifest.csv: invalid record');
  if (record.length !== 5) continue;
  const relativePath = record[3];
  check(!manifestPaths.has(relativePath), `_bmad/_config/files-manifest.csv: duplicate path ${relativePath}`);
  manifestPaths.add(relativePath);
  check(/^[0-9a-f]{64}$/.test(record[4]), `_bmad/_config/files-manifest.csv: invalid hash for ${relativePath}`);
  const installedPath = path.join(root, '_bmad', relativePath);
  if (!fs.existsSync(installedPath)) {
    if (installedIntegrityPaths.has(relativePath)) {
      failures.push(`_bmad/${relativePath}: required file listed by the BMAD manifest is missing`);
    }
    continue;
  }
  if (relativePath === 'config.user.toml') continue;
  if (installedIntegrityPaths.has(relativePath)) verifiedIntegrityPaths.add(relativePath);
  const actualHash = crypto.createHash('sha256').update(fs.readFileSync(installedPath)).digest('hex');
  check(actualHash === record[4], `_bmad/${relativePath}: content differs from the BMAD file manifest`);
}
for (const relativePath of installedIntegrityPaths) {
  check(verifiedIntegrityPaths.has(relativePath), `_bmad/_config/files-manifest.csv: missing ${relativePath}`);
}

const skillsRoot = path.join(root, '.agents', 'skills');
const skillNames = exists('.agents/skills')
  ? fs.readdirSync(skillsRoot).filter((name) => exists(path.join('.agents/skills', name, 'SKILL.md'))).sort()
  : [];
const expectedSkillNames = Array.isArray(lock?.opencode?.skills)
  ? [...lock.opencode.skills].sort()
  : [];
check(
  JSON.stringify(skillNames) === JSON.stringify(expectedSkillNames),
  `OpenCode skill inventory differs from the ${expectedSkillNames.length}-skill lock`
);
const skillPayload = hashFileTree('.agents/skills');
check(
  skillPayload.files.length === lock?.opencode?.skillFileCount,
  `OpenCode skill payload file count differs from the lock (actual ${skillPayload.files.length})`
);
check(
  skillPayload.sha256 === lock?.opencode?.skillPayloadSha256,
  `OpenCode skill payload SHA-256 differs from the lock (actual ${skillPayload.sha256})`
);

for (const skillName of expectedSkillNames) {
  const skill = read(path.join('.agents/skills', skillName, 'SKILL.md'));
  check(new RegExp(`^name: ${skillName}$`, 'm').test(skill), `invalid or missing skill: ${skillName}`);
}

for (const commandDirectory of ['.opencode/command', '.opencode/commands']) {
  for (const relativePath of listFiles(commandDirectory)) {
    if (/^bmad-.*\.md$/.test(path.basename(relativePath))) {
      failures.push(`OpenCode command shadows a native BMAD skill: ${commandDirectory}/${relativePath}`);
    }
  }
}

const agents = read('AGENTS.md');
check(agents.includes('<!-- bmad:context -->') && agents.includes('<!-- /bmad:context -->'), 'AGENTS.md: managed BMAD context block is missing');
check(exists('docs/bmad-project-knowledge/README.md'), 'curated BMAD project knowledge is missing');

const customConfig = read('_bmad/custom/config.toml');
checkExpectedValues(
  parseTomlScalarSection(customConfig, 'modules.bmm', '_bmad/custom/config.toml'),
  { project_knowledge: '{project-root}/docs/bmad-project-knowledge' },
  '_bmad/custom/config.toml [modules.bmm]'
);
const expectedTeaConfig = {
  test_stack_type: 'fullstack',
  ci_platform: 'github-actions',
  test_framework: 'playwright',
  tea_use_playwright_utils: false,
  tea_use_pactjs_utils: false,
  tea_pact_mcp: 'none',
  risk_threshold: 'p1',
};
checkExpectedValues(
  parseTomlScalarSection(customConfig, 'modules.tea', '_bmad/custom/config.toml'),
  expectedTeaConfig,
  '_bmad/custom/config.toml [modules.tea]'
);

const generatedCentralConfig = read('_bmad/config.toml');
checkExpectedValues(
  parseTomlScalarSection(generatedCentralConfig, 'modules.bmm', '_bmad/config.toml'),
  { project_knowledge: '{project-root}/docs/bmad-project-knowledge' },
  '_bmad/config.toml [modules.bmm]'
);
checkExpectedValues(
  parseTomlScalarSection(generatedCentralConfig, 'modules.tea', '_bmad/config.toml'),
  expectedTeaConfig,
  '_bmad/config.toml [modules.tea]'
);

checkExpectedValues(
  parseFlatYaml('_bmad/bmm/config.yaml'),
  { project_knowledge: '{project-root}/docs/bmad-project-knowledge', user_name: 'SYA Team' },
  '_bmad/bmm/config.yaml'
);
checkExpectedValues(
  parseFlatYaml('_bmad/tea/config.yaml'),
  { ...expectedTeaConfig, user_name: 'SYA Team' },
  '_bmad/tea/config.yaml'
);
for (const configPath of ['_bmad/core/config.yaml', '_bmad/bmm/config.yaml', '_bmad/tea/config.yaml']) {
  check(parseFlatYaml(configPath).get('user_name') === 'SYA Team', `${configPath}: expected team-neutral user name`);
}

for (const agentName of [
  'bmad-agent-analyst',
  'bmad-agent-pm',
  'bmad-agent-ux-designer',
  'bmad-agent-architect',
  'bmad-agent-dev',
  'bmad-tea',
]) {
  const customization = read(`_bmad/custom/${agentName}.toml`);
  const agentSection = tomlSection(customization, 'agent');
  check(
    /persistent_facts\s*=\s*\[[\s\S]*"file:\{project-root\}\/docs\/bmad-project-knowledge\/README\.md"[\s\S]*\]/m.test(agentSection),
    `${agentName}: project knowledge is not loaded`
  );
}

checkExpectedValues(
  parseTomlScalarSection(customConfig, 'core', '_bmad/custom/config.toml'),
  { project_name: 'FocusFlow' },
  '_bmad/custom/config.toml [core]'
);
checkExpectedValues(
  parseTomlScalarSection(generatedCentralConfig, 'core', '_bmad/config.toml'),
  { project_name: 'FocusFlow' },
  '_bmad/config.toml [core]'
);
for (const configPath of ['_bmad/core/config.yaml', '_bmad/bmm/config.yaml', '_bmad/tea/config.yaml']) {
  check(parseFlatYaml(configPath).get('project_name') === 'FocusFlow', `${configPath}: expected FocusFlow project name`);
}

const product = lock?.product || {};
check(product.name === 'FocusFlow', 'agent-sdlc.lock.json: product name must be FocusFlow');
check(product.moduleId === 'scheduler', 'agent-sdlc.lock.json: module id must be scheduler');
const contractPaths = Array.isArray(product.contracts) ? product.contracts : [];
const acceptedSpecs = Array.isArray(product.acceptedSpecs) ? product.acceptedSpecs : [];
const acceptedRequirementIds = Array.isArray(product.acceptedRequirementIds) ? product.acceptedRequirementIds : [];
const localCapabilities = Array.isArray(product.localCapabilities) ? product.localCapabilities : [];
check(contractPaths.length > 0, 'agent-sdlc.lock.json: contract inventory is missing');
check(acceptedSpecs.includes('docs/research-timeline-ui/SPEC.md'), 'agent-sdlc.lock.json: accepted spec inventory is incomplete');
check(
  JSON.stringify(acceptedRequirementIds) === JSON.stringify(['SCH-001', 'SCH-002', 'SCH-003']),
  'agent-sdlc.lock.json: accepted scheduler requirement IDs changed'
);
check(
  JSON.stringify(localCapabilities) === JSON.stringify(['CAP-1', 'CAP-2', 'CAP-3', 'CAP-4', 'CAP-5']),
  'agent-sdlc.lock.json: local capability IDs changed'
);

for (const relativePath of [...contractPaths, ...acceptedSpecs, 'docs/bmad-project-knowledge/README.md', 'docs/agent-sdlc.md', 'AGENTS.md']) {
  check(exists(relativePath), `required product document is missing: ${relativePath}`);
}
const spec = read('docs/research-timeline-ui/SPEC.md');
for (const requirementId of [...acceptedRequirementIds, ...localCapabilities]) {
  check(spec.includes(requirementId), `accepted spec is missing ${requirementId}`);
}
const knowledge = read('docs/bmad-project-knowledge/README.md');
for (const phrase of ['api.openapi.json', 'manifest.json', 'docs/research-timeline-ui/SPEC.md', 'local-http']) {
  check(knowledge.includes(phrase), `project knowledge is missing ${phrase}`);
}
check(agents.includes('FocusFlow'), 'AGENTS.md: FocusFlow project context is missing');
check(agents.includes('docs/bmad-project-knowledge/README.md'), 'AGENTS.md: project knowledge path is missing');

const packageJson = readJson('package.json');
const moduleJson = readJson('module.json');
const functionManifest = readJson('manifest.json');
const openApi = readJson('api.openapi.json');
check(packageJson?.private === true, 'package.json: private must be true');
check(packageJson?.name === '@sya/function-scheduler', 'package.json: package name changed');
check(moduleJson?.name === 'scheduler', 'module.json: name must be scheduler');
check(functionManifest?.id === 'scheduler', 'manifest.json: id must be scheduler');
check(functionManifest?.runtime === 'local-http', 'manifest.json: runtime must be local-http');
check(functionManifest?.entry?.command === 'bin/scheduler-server', 'manifest.json: entry command changed');
check(functionManifest?.api?.basePath === '/api/scheduler', 'manifest.json: API base path changed');
check(functionManifest?.api?.health?.method === 'GET', 'manifest.json: health method must be GET');
check(functionManifest?.api?.health?.path === '/health', 'manifest.json: health path changed');
check(exists('bin/scheduler-server'), 'bin/scheduler-server is missing');
check(exists('requirements.txt'), 'requirements.txt is missing');
check(exists('tests/test_smoke.py'), 'tests/test_smoke.py is missing');
check(/^3\.\d+\.\d+$/.test(openApi?.openapi || ''), 'api.openapi.json: OpenAPI 3.x version is required');

const httpMethods = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch']);
let operationCount = 0;
for (const [route, routeDefinition] of Object.entries(openApi?.paths || {})) {
  for (const [method, operation] of Object.entries(routeDefinition || {})) {
    const normalizedMethod = method.toLowerCase();
    if (normalizedMethod === 'trace') {
      failures.push(`api.openapi.json: TRACE ${route} is forbidden`);
      continue;
    }
    if (!httpMethods.has(normalizedMethod)) continue;
    check(method === normalizedMethod, `api.openapi.json: method key ${method} ${route} must be lowercase`);
    operationCount += 1;
    check(Boolean(operation?.operationId), `api.openapi.json: ${method.toUpperCase()} ${route} has no operationId`);
  }
}
check(operationCount > 0, 'api.openapi.json: no operations found');
const eventsPath = functionManifest?.api?.events?.path;
check(eventsPath === '/api/scheduler/events', 'manifest.json: SSE path changed');
const eventsOperation = openApi?.paths?.[eventsPath]?.get;
check(Boolean(eventsOperation?.operationId), 'api.openapi.json: manifest SSE path is not a GET operation');
check(
  Boolean(eventsOperation?.responses?.['200']?.content?.['text/event-stream']),
  'api.openapi.json: SSE operation must return text/event-stream'
);

try {
  const trackedPersonalFiles = execFileSync(
    'git',
    ['ls-files', '--', '_bmad/config.user.toml', '_bmad/custom/*.user.toml'],
    { cwd: root, encoding: 'utf8' }
  ).trim();
  check(!trackedPersonalFiles, `personal BMAD configuration is tracked: ${trackedPersonalFiles}`);
} catch (error) {
  failures.push(`cannot inspect tracked personal configuration: ${error.message}`);
}

const requiredTrackedPaths = [
  '.gitattributes',
  '.gitignore',
  '.github/pull_request_template.md',
  '.github/workflows/pr-quality.yml',
  '.nvmrc',
  'AGENTS.md',
  'agent-sdlc.lock.json',
  'api.openapi.json',
  'manifest.json',
  'module.json',
  'config.example.json',
  'package.json',
  'package-lock.json',
  'requirements.txt',
  'docs/agent-sdlc.md',
  'docs/bmad-project-knowledge/README.md',
  'docs/research-timeline-ui/SPEC.md',
  'docs/research-timeline-ui/ARCHITECTURE.md',
  'docs/research-timeline-ui/DESIGN.md',
  'docs/research-timeline-ui/EXPERIENCE.md',
  'docs/research-timeline-ui/EVIDENCE.md',
  'scripts/install-agent-sdlc.sh',
  'scripts/normalize-agent-sdlc-config.mjs',
  'scripts/verify-agent-sdlc.mjs',
  'scripts/verify-agent-sdlc.sh',
  'scripts/smoke-test.sh',
  'tests/test_smoke.py',
  'desktop/main.cjs',
];
const generatedTrackedPaths = [
  ...listFiles('.agents/skills').map((relativePath) => `.agents/skills/${relativePath}`),
  ...expectedBmadFiles.map((relativePath) => `_bmad/${relativePath}`),
];
const trackedContract = [...new Set([...requiredTrackedPaths, ...generatedTrackedPaths])].sort();
for (const relativePath of requiredTrackedPaths) {
  check(exists(relativePath), `required setup or workflow dependency is missing: ${relativePath}`);
}
try {
  const trackedFiles = new Set(
    execFileSync(
      'git',
      ['ls-files', '-z', '--', '.agents/skills', '_bmad', ...requiredTrackedPaths],
      { cwd: root, encoding: 'utf8' }
    )
      .split('\0')
      .filter(Boolean)
  );
  const untrackedDependencies = trackedContract.filter((file) => !trackedFiles.has(file));
  if (untrackedDependencies.length) {
    const examples = untrackedDependencies.slice(0, 12).join(', ');
    const message = `${untrackedDependencies.length} setup and workflow dependencies must be committed atomically (${examples}${untrackedDependencies.length > 12 ? ', ...' : ''})`;
    if (strictTracked) failures.push(message);
    else notes.push(message);
  }
} catch (error) {
  failures.push(`cannot inspect tracked setup files: ${error.message}`);
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map((item) => stableJson(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]));
  }
  return value;
}

const workflow = read('.github/workflows/pr-quality.yml');
const workflowDocument = readYaml('.github/workflows/pr-quality.yml', lock?.verification?.pyyamlVersion || '__invalid__');
const workflowTriggers = workflowDocument?.on && typeof workflowDocument.on === 'object'
  ? Object.keys(workflowDocument.on).sort()
  : [];
check(
  JSON.stringify(Object.keys(workflowDocument || {}).sort()) ===
    JSON.stringify(['concurrency', 'env', 'jobs', 'name', 'on', 'permissions']),
  'PR quality workflow: unexpected or missing top-level keys'
);
check(
  JSON.stringify(workflowTriggers) === JSON.stringify(['merge_group', 'pull_request', 'workflow_dispatch']),
  `PR quality workflow: trigger set differs (${workflowTriggers.join(', ')})`
);
for (const trigger of workflowTriggers) {
  check(workflowDocument.on[trigger] === null, `PR quality workflow: ${trigger} trigger filters are not allowed`);
}
check(
  JSON.stringify(workflowDocument?.permissions) === JSON.stringify({ contents: 'read' }),
  'PR quality workflow: permissions must be exactly contents: read'
);
check(
  JSON.stringify(workflowDocument?.env) === JSON.stringify({ CI: 'true' }),
  'PR quality workflow: top-level environment must contain only CI=true'
);
check(workflowDocument?.name === 'Pull Request Quality', 'PR quality workflow: workflow name changed');
check(
  JSON.stringify(workflowDocument?.concurrency) === JSON.stringify({
    group: 'pr-quality-${{ github.event.pull_request.number || github.ref }}',
    'cancel-in-progress': true,
  }),
  'PR quality workflow: concurrency contract differs'
);
check(/^\s*pull_request:\s*$/m.test(workflow), 'PR quality workflow: pull_request trigger is missing');
check(/^\s*merge_group:\s*$/m.test(workflow), 'PR quality workflow: merge_group trigger is missing');
for (const unsafeTrigger of ['pull_request_target', 'push', 'schedule', 'workflow_run', 'repository_dispatch']) {
  check(!new RegExp(`^\\s*${unsafeTrigger}:`, 'm').test(workflow), `PR quality workflow: unsafe trigger ${unsafeTrigger}`);
}
check(!/\bsecrets\b/i.test(workflow), 'PR quality workflow must not consume or inherit secrets');
check(!/^\s*environment:\s*/m.test(workflow), 'PR quality workflow must not target a deployment environment');
check(!/^\s*continue-on-error:\s*true\s*$/m.test(workflow), 'PR quality workflow must not suppress job failures');

const allowedActions = new Set([
  `actions/checkout@${lock?.githubActions?.checkout?.commit}`,
  `actions/setup-node@${lock?.githubActions?.setupNode?.commit}`,
  `actions/upload-artifact@${lock?.githubActions?.uploadArtifact?.commit}`,
  `astral-sh/setup-uv@${lock?.githubActions?.setupUv?.commit}`,
]);
const workflowJobs = workflowDocument?.jobs && typeof workflowDocument.jobs === 'object'
  ? workflowDocument.jobs
  : {};
const expectedJobIds = ['app-quality', 'governance', 'quality-gate'];
check(
  JSON.stringify(Object.keys(workflowJobs).sort()) === JSON.stringify(expectedJobIds),
  `PR quality workflow: job ids differ (${Object.keys(workflowJobs).join(', ')})`
);
const expectedJobs = {
  governance: {
    name: 'Agent SDLC and specification contracts',
    timeout: 15,
    steps: [
      'Check out repository',
      'Set up Node.js',
      'Set up uv and Python',
      'Verify agent and specification contracts',
    ],
  },
  'app-quality': {
    name: 'App contracts and tests',
    timeout: 20,
    steps: [
      'Check out repository',
      'Set up Node.js',
      'Set up uv and Python',
      'Install app dependencies',
      'Install Python dependencies',
      'Run app tests',
    ],
  },
  'quality-gate': {
    name: 'PR Quality Gate',
    timeout: 2,
    steps: ['Require every quality job'],
  },
};
for (const [jobId, expectedJob] of Object.entries(expectedJobs)) {
  const job = workflowJobs[jobId] || {};
  check(job.name === expectedJob.name, `PR quality workflow: ${jobId} name changed`);
  check(job['runs-on'] === 'ubuntu-latest', `PR quality workflow: ${jobId} must run on ubuntu-latest`);
  check(job['timeout-minutes'] === expectedJob.timeout, `PR quality workflow: ${jobId} timeout changed`);
  const actualSteps = Array.isArray(job.steps) ? job.steps.map((step) => step?.name) : [];
  check(
    JSON.stringify(actualSteps) === JSON.stringify(expectedJob.steps),
    `PR quality workflow: ${jobId} steps differ (${actualSteps.join(', ')})`
  );
  for (const step of Array.isArray(job.steps) ? job.steps : []) {
    if (!step?.uses) continue;
    check(allowedActions.has(step.uses), `PR quality workflow: unpinned or unexpected action ${step.uses}`);
  }
}

function stepNamed(jobId, name) {
  const steps = Array.isArray(workflowJobs[jobId]?.steps) ? workflowJobs[jobId].steps : [];
  return steps.find((step) => step?.name === name) || {};
}

function checkInputs(jobId, name, expected) {
  const actual = stepNamed(jobId, name).with || {};
  check(
    JSON.stringify(stableJson(actual)) === JSON.stringify(stableJson(expected)),
    `PR quality workflow: ${jobId}/${name} inputs differ`
  );
}

for (const jobId of ['governance', 'app-quality']) {
  checkInputs(jobId, 'Check out repository', { 'persist-credentials': false });
  check(
    stepNamed(jobId, 'Set up uv and Python').uses === `astral-sh/setup-uv@${lock?.githubActions?.setupUv?.commit}`,
    `PR quality workflow: ${jobId} uv action pin changed`
  );
  checkInputs(jobId, 'Set up uv and Python', { version: '0.12.10', 'python-version': '3.11' });
}
checkInputs('governance', 'Set up Node.js', { 'node-version-file': '.nvmrc' });
checkInputs('app-quality', 'Set up Node.js', {
  'node-version-file': '.nvmrc',
  cache: 'npm',
  'cache-dependency-path': 'package-lock.json',
});
check(
  stepNamed('governance', 'Verify agent and specification contracts').run === 'scripts/verify-agent-sdlc.sh',
  'PR quality workflow: governance command changed'
);
check(stepNamed('app-quality', 'Install app dependencies').run === 'npm ci', 'PR quality workflow: npm ci command changed');
const pythonInstall = String(stepNamed('app-quality', 'Install Python dependencies').run || '');
check(pythonInstall.includes('uv venv .venv --python 3.11'), 'PR quality workflow: Python virtualenv command changed');
check(
  pythonInstall.includes('uv pip install --python .venv/bin/python -r requirements.txt'),
  'PR quality workflow: Python dependency command changed'
);
const appTests = String(stepNamed('app-quality', 'Run app tests').run || '');
check(appTests.includes('npm test'), 'PR quality workflow: app test command changed');
check(appTests.includes('chmod +x bin/scheduler-server scripts/*.sh'), 'PR quality workflow: test preparation changed');

const qualityJob = workflowJobs['quality-gate'] || {};
check(qualityJob.if === 'always()', 'PR quality workflow: aggregate must always evaluate');
const qualityNeeds = Array.isArray(qualityJob.needs) ? [...qualityJob.needs].sort() : [];
check(
  JSON.stringify(qualityNeeds) === JSON.stringify(['app-quality', 'governance']),
  `PR quality workflow: aggregate dependencies differ (${qualityNeeds.join(', ')})`
);
const qualityStep = stepNamed('quality-gate', 'Require every quality job');
check(!qualityStep.uses, 'PR quality workflow: aggregate must not execute an action');
check(
  JSON.stringify(stableJson(qualityStep.env || {})) === JSON.stringify(stableJson({
    GOVERNANCE_RESULT: '${{ needs.governance.result }}',
    APP_RESULT: '${{ needs.app-quality.result }}',
  })),
  'PR quality workflow: aggregate environment differs'
);
const qualityScript = String(qualityStep.run || '');
check(qualityScript.includes('"$GOVERNANCE_RESULT"'), 'PR quality workflow: aggregate ignores governance');
check(qualityScript.includes('"$APP_RESULT"'), 'PR quality workflow: aggregate ignores app tests');
check(qualityScript.includes('!= "success"'), 'PR quality workflow: aggregate does not require success');
check(exists('.github/pull_request_template.md'), 'GitHub pull request template is missing');

if (notes.length) {
  for (const note of notes) console.log(`NOTE: ${note}`);
}
if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  console.error(`Agent SDLC verification failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log(`PASS: FocusFlow Agent SDLC static verification (${skillNames.length} skills).`);
