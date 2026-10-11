import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(process.argv[2] || scriptRoot);
const plannedWrites = new Map();

function normalize(relativePath, replacements) {
  const filePath = path.join(root, relativePath);
  let contents = fs.readFileSync(filePath, 'utf8');
  const original = contents;

  for (const { generated, normalized } of replacements) {
    const generatedCount = contents.split(generated).length - 1;
    const normalizedCount = contents.split(normalized).length - 1;
    if (generatedCount === 0 && normalizedCount === 1) continue;
    if (generatedCount !== 1 || normalizedCount !== 0) {
      throw new Error(
        `${relativePath}: expected exactly one generated or normalized value for ${generated}`
      );
    }
    contents = contents.replace(generated, normalized);
  }

  if (contents !== original) plannedWrites.set(filePath, contents);
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

function refreshManifestHashes(relativePaths) {
  const manifestPath = path.join(root, '_bmad/_config/files-manifest.csv');
  const expectedHashes = new Map(
    relativePaths.map((relativePath) => {
      const filePath = path.join(root, '_bmad', relativePath);
      const contents = plannedWrites.get(filePath) || fs.readFileSync(filePath);
      return [relativePath, crypto.createHash('sha256').update(contents).digest('hex')];
    })
  );
  const refreshed = new Set();
  const original = fs.readFileSync(manifestPath, 'utf8');
  const lines = original.split('\n').map((line, index) => {
    if (index === 0 || !line) return line;
    const fields = parseCsvLine(line);
    if (!expectedHashes.has(fields[3])) return line;
    fields[4] = expectedHashes.get(fields[3]);
    refreshed.add(fields[3]);
    return fields.map((field) => `"${field.replaceAll('"', '""')}"`).join(',');
  });

  const missing = [...expectedHashes.keys()].filter((relativePath) => !refreshed.has(relativePath));
  if (missing.length) throw new Error(`files-manifest.csv: missing config records: ${missing.join(', ')}`);
  const normalized = lines.join('\n');
  if (normalized !== original) plannedWrites.set(manifestPath, normalized);
}

function commitPlannedWrites() {
  const staged = [];
  try {
    let index = 0;
    for (const [filePath, contents] of plannedWrites) {
      const temporaryPath = `${filePath}.sya-normalize-${process.pid}-${index}`;
      fs.writeFileSync(temporaryPath, contents, { mode: fs.statSync(filePath).mode });
      staged.push([temporaryPath, filePath]);
      index += 1;
    }
    for (const [temporaryPath, filePath] of staged) fs.renameSync(temporaryPath, filePath);
  } finally {
    for (const [temporaryPath] of staged) {
      if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath);
    }
  }
}

normalize('_bmad/config.toml', [
  {
    generated: 'project_knowledge = "docs/bmad-project-knowledge"',
    normalized: 'project_knowledge = "{project-root}/docs/bmad-project-knowledge"',
  },
  {
    generated: 'tea_use_playwright_utils = "false"',
    normalized: 'tea_use_playwright_utils = false',
  },
  {
    generated: 'tea_use_pactjs_utils = "false"',
    normalized: 'tea_use_pactjs_utils = false',
  },
]);

normalize('_bmad/bmm/config.yaml', [
  {
    generated: 'project_knowledge: docs/bmad-project-knowledge',
    normalized: 'project_knowledge: "{project-root}/docs/bmad-project-knowledge"',
  },
]);

normalize('_bmad/tea/config.yaml', [
  {
    generated: 'tea_use_playwright_utils: "false"',
    normalized: 'tea_use_playwright_utils: false',
  },
  {
    generated: 'tea_use_pactjs_utils: "false"',
    normalized: 'tea_use_pactjs_utils: false',
  },
]);

// BMAD writes its file manifest before --set normalization completes. Keep its
// integrity records aligned with the generated configuration consumers read.
refreshManifestHashes(['config.toml', 'core/config.yaml', 'bmm/config.yaml', 'tea/config.yaml']);
commitPlannedWrites();
