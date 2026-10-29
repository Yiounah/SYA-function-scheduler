/**
 * Real standalone Electron acceptance. No scheduler/IPC/browser API is mocked.
 * The only fixture is the external model HTTP boundary. The application source,
 * profile, logs and planner file are copied/created in a fresh temporary folder.
 * Uses installed @playwright/test and Electron from this checkout, sibling
 * SYA-UI, or the parent host checkout; PLAYWRIGHT_MODULE_PATH can override it.
 * Requires Python 3.11+ at .venv/bin/python (or TEST_PYTHON).
 * Run manually: node scripts/test-planner-electron.mjs
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { cp, mkdtemp, mkdir, readFile, writeFile, access, realpath, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dependencyRoots = [repository, resolve(repository, '../SYA-UI'), resolve(repository, '../..'), resolve(repository, '../../app')];
function installedModule(name) {
  for (const root of dependencyRoots) {
    try { return createRequire(join(root, 'package.json'))(name); }
    catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw new Error(`Install ${name} in the Scheduler or host checkout before running Electron acceptance.`);
}
const { _electron, expect } = installedModule(process.env.PLAYWRIGHT_MODULE_PATH || '@playwright/test');
const work = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-electron-')));
const isolated = join(work, 'app');
const profile = join(work, 'profile');
const data = join(work, 'data');
const evidence = join(repository, '_bmad-output', 'planner-electron', new Date().toISOString().replace(/[:.]/g, '-'));
await mkdir(isolated);
await mkdir(evidence, { recursive: true });
await mkdir(profile);
await mkdir(data);
for (const name of ['app', 'desktop', 'bin', 'package.json']) {
  await cp(join(repository, name), join(isolated, name), { recursive: true, filter: (path) => !path.includes('__pycache__') && !path.endsWith('.env') });
}
const metadata = JSON.parse(await readFile(join(isolated, 'package.json'), 'utf8'));
metadata.main = 'desktop/test-entry.cjs';
await writeFile(join(isolated, 'package.json'), JSON.stringify(metadata));
await writeFile(join(isolated, 'desktop/test-entry.cjs'), `const {app}=require('electron');\napp.setPath('userData', ${JSON.stringify(profile)});\napp.setAppLogsPath(${JSON.stringify(join(work, 'logs'))});\nrequire('./main.cjs');\n`);
const executablePath = installedModule('electron');
const python = process.env.TEST_PYTHON || join(repository, '.venv/bin/python');
await access(python);
let fixtureMode = 'success';
let modelCalls = 0;
let sequence = 0;
const pending = [];
const checks = [];
const pageErrors = [];
const launchedProcesses = new Map();
const buildHashes = {};
for (const name of ['desktop/main.cjs', 'app/static/index.html', 'app/static/app.js', 'app/static/styles.css', 'app/static/shared/sya-calendar.js', 'app/static/shared/sya-calendar.css', 'app/static/shared/source-manifest.json']) {
  const source = await readFile(join(repository, name));
  assert.deepEqual(await readFile(join(isolated, name)), source);
  buildHashes[name] = createHash('sha256').update(source).digest('hex');
}
let versions;
let app;
let page;
let baseURL;
let postponedTaskId;
let postponedDate;
let postponedTitle;

function fixtureTree(goal) {
  const prefix = `fixture-${++sequence}`;
  const leaf = (suffix, title) => ({ task_id: `${prefix}-${suffix}`, title, estimated_time: 1, status: 'PENDING', children: [] });
  return { task_id: `${prefix}-root`, title: goal || 'Electron acceptance project', estimated_time: 4, status: 'PENDING', children: [
    { task_id: `${prefix}-stage`, title: '收集证据', estimated_time: 3, status: 'PENDING', children: [
      { task_id: `${prefix}-task`, title: '准备实验方案', estimated_time: 2, status: 'PENDING', children: [leaf('a', '阅读基线方法'), leaf('b', '比较可行方案')] },
      { task_id: `${prefix}-task-next`, title: '设计实验步骤', estimated_time: 1, status: 'PENDING', children: [leaf('c', '设计最小实验')] },
    ] },
    { task_id: `${prefix}-stage-next`, title: '复现与总结', estimated_time: 1, status: 'PENDING', children: [
      { task_id: `${prefix}-task-final`, title: '整理研究材料', estimated_time: 1, status: 'PENDING', children: [leaf('d', '整理复现清单')] },
    ] },
  ] };
}
const provider = createServer(async (request, response) => {
  if (request.method !== 'POST' || request.url !== '/v1/chat/completions') { response.writeHead(404).end(); return; }
  let body = '';
  for await (const chunk of request) body += chunk;
  const payload = JSON.parse(body);
  const system = payload.messages?.[0]?.content || '';
  const prompt = payload.messages?.[1]?.content || '';
  if (system.includes('translate')) {
    const nodes = JSON.parse(prompt.slice(prompt.lastIndexOf("\n") + 1));
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(nodes) } }] }));
    return;
  }
  modelCalls++;
  const reply = () => {
    if (fixtureMode === 'failure') { response.writeHead(503).end('Fixture model unavailable'); return; }
    const goal = prompt.match(/^Goal: (.*)$/m)?.[1];
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(fixtureTree(goal)) } }] }));
  };
  if (fixtureMode === 'delay') pending.push(reply);
  else reply();
});
await new Promise((resolveListen) => provider.listen(0, '127.0.0.1', resolveListen));
const fixturePort = provider.address().port;
const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => typeof value === 'string' && !key.startsWith('SYA_') && !key.startsWith('OPENAI_') && !key.startsWith('FUNCTION_RUNTIME_') && !['PYTHONPATH', 'ELECTRON_RUN_AS_NODE'].includes(key)));
Object.assign(env, { PYTHON: python, SYA_SCHEDULER_DATA_DIR: data, SYA_OPENAI_API_KEY: 'fixture-only', SYA_OPENAI_BASE_URL: `http://127.0.0.1:${fixturePort}/v1`, SYA_OPENAI_MODEL: 'local-fixture', SYA_LLM_TIMEOUT_SECONDS: '5', TZ: 'Asia/Shanghai' });

function processRows() {
  return execFileSync('ps', ['-axo', 'pid=,ppid=,lstart=,command='], { encoding: 'utf8' }).trim().split('\n').flatMap((line) => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\S+\s+\S+\s+\d+\s+\S+\s+\d+)\s+(.*)$/);
    return match ? [{ pid: Number(match[1]), parent: Number(match[2]), started: match[3], command: match[4] }] : [];
  });
}
function rememberDescendants(rootPid) {
  const rows = processRows();
  const ids = new Set([rootPid]);
  for (let pass = 0; pass < 8; pass++) for (const row of rows) if (ids.has(row.parent)) ids.add(row.pid);
  for (const row of rows) if (ids.has(row.pid)) launchedProcesses.set(row.pid, row);
}
function survivors() {
  return processRows().filter((row) => {
    const known = launchedProcesses.get(row.pid);
    return known && row.started === known.started && row.command === known.command;
  }).map(({ pid, command }) => ({ pid, command }));
}
async function launch() {
  app = await _electron.launch({ executablePath, args: [isolated, '--disable-gpu'], cwd: isolated, env, timeout: 40_000 });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 1020));
  page.setDefaultTimeout(15_000);
  page.on('pageerror', (error) => pageErrors.push(error.message));
  // Suggestions may arrive after a background refresh. Dismiss through the
  // real UI and await its config write before the next test action/preview.
  await page.addLocatorHandler(page.locator('#grain-suggest-modal.open'),async()=>{
    const saved=page.waitForResponse(response=>response.url().endsWith('/api/scheduler/config')&&response.request().method()==='PUT');
    await page.locator('#grain-suggest-keep').click();
    assert.equal((await saved).status(),200);
  });
  await page.waitForURL(/http:\/\/127\.0\.0\.1:\d+\//);
  baseURL = page.url().replace(/\/$/, '');
  rememberDescendants(app.process().pid);
  versions = await app.evaluate(() => ({ electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node }));
  const security = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  assert.equal(security.contextIsolation, true);
  assert.equal(security.nodeIntegration, false);
  await expect(page.locator('#open-modal')).toBeVisible();
  await expect(page.locator('#open-modal-top')).toHaveCount(0);
}
async function stop() {
  if (!app) return;
  const old = app;
  rememberDescendants(old.process().pid);
  const child = old.process();
  try {
    await old.evaluate(({ app }) => { setTimeout(() => app.quit(), 10); });
    await expect.poll(() => child.exitCode !== null || child.signalCode !== null, { timeout: 10_000 }).toBe(true);
    await expect.poll(survivors, { timeout: 10_000 }).toEqual([]);
  } finally {
    // A failed assertion must not leave a test runtime behind. The PID, start
    // time and command must still match the descendants of our own launch.
    for (const { pid } of survivors()) {
      try { process.kill(pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
    app = null;
    await expect.poll(survivors, { timeout: 10_000 }).toEqual([]);
  }
}
async function api(path, options = {}) {
  const response = await fetch(`${baseURL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const value = await response.json();
  if (!response.ok || value.ok === false) return { ...value, httpStatus: response.status };
  return value.ok === true ? value.data : value;
}
async function projects() { return (await api('/api/v1/projects')).projects; }
async function slots() { const timeline = await api('/api/scheduler/timeline?projectId=all'); return timeline.slots || timeline.events; }
function leaves(node) { return node.children?.length ? node.children.flatMap(leaves) : [node]; }
async function snapshot() { return { projects: await projects(), slots: await slots(), config: await api('/api/scheduler/config') }; }
async function savedTree(projectId) { return (await projects()).find((project) => project.tree.task_id === projectId).tree; }
function unorderedTree(node) { return { ...node, children: (node.children || []).map(unorderedTree).sort((a, b) => a.task_id.localeCompare(b.task_id)) }; }
const toggle = (id) => page.locator(`[data-tree-toggle="${id}"]`);
async function treeView() { await page.locator('[data-nav="tree"]:visible').first().click(); }
async function expandNode(id) {
  if (await toggle(id).getAttribute('aria-expanded') === 'false') await toggle(id).click();
  await expect(toggle(id)).toHaveAttribute('aria-expanded', 'true');
}
async function expandTree() {
  await treeView();
  for (const section of await page.locator('article[data-tree-stage-id]').all()) await expandNode(await section.getAttribute('data-tree-stage-id'));
  for (const section of await page.locator('section[data-tree-task-id]').all()) await expandNode(await section.getAttribute('data-tree-task-id'));
}
async function moveNode(id, direction) {
  const response = page.waitForResponse((value) => value.url().endsWith('/api/scheduler/tasks/reorder') && value.request().method() === 'POST');
  await page.locator(`[data-tree-move="${id}"][data-direction="${direction}"]`).click();
  const result = await response;
  assert.equal(result.status(), 200);
  assert.equal((await result.json()).ok, true);
}
async function closeSuggestions() {
  if (await page.locator('#focus-keep').isVisible()) await page.locator('#focus-keep').click();
}
const calendar = () => page.locator('#sya-action-calendar');
async function dayView() {
  await closeSuggestions();
  await page.locator('[data-nav="day"]:visible').first().click();
  await expect(calendar().getByRole('heading', {name:'每日行动日历'})).toBeVisible();
}
async function openPlan(goal, source = 'model') {
  await closeSuggestions();
  await page.locator('#open-modal').click();
  await page.locator('#goal').fill(goal);
  await page.locator('#deadline-amount').fill('1');
  await page.locator('#deadline-unit').selectOption('day');
  await page.locator('#plan-source').selectOption(source);
  await page.locator('#init-button').click();
}
async function expectDraft() { await expect(page.locator('#draft-dialog')).toBeVisible(); }
async function commit() {
  await page.locator('#draft-commit').click();
  await expect(page.locator('#draft-dialog')).not.toBeVisible();
  await expect(page.locator('#decompose-overlay')).not.toBeVisible();
}
async function record(name) { checks.push(name); console.log(`PASS ${name}`); }
async function screenshot(name) {
  await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
  await page.evaluate(() => {
    if (document.querySelector('.sidebar [data-nav].active')?.dataset.nav !== 'tree') document.getElementById('calendar-panel').scrollIntoView({block:'start'});
    else document.querySelector('.content').scrollTo({top:0, behavior:'instant'});
  });
  await page.screenshot({ path: join(evidence, `${name}.png`) });
}

try {
  await launch();
  for (const asset of ['app.js', 'styles.css', 'shared/sya-calendar.js', 'shared/sya-calendar.css']) {
    const response = await fetch(`${baseURL}/static/${asset}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), asset.endsWith('.js') ? /javascript/ : /css/);
  }
  const deniedAsset = await fetch(`${baseURL}/static/unknown.json`);
  assert.equal(deniedAsset.status, 404);
  await expect(page.locator('#entry-modal')).toBeVisible();
  await page.locator('#enter-planner').click();
  await expectDraft();
  assert.equal((await projects()).length, 0);
  await page.locator('#draft-cancel').click();
  assert.equal((await projects()).length, 0);
  await page.locator('#enter-planner').click();
  await expectDraft();
  await commit();
  await expect(page.locator('#entry-modal')).not.toBeVisible();
  await record('Initial routine is previewed, cancelled, then explicitly confirmed');

  await openPlan('草案取消测试（合成示例）');
  await expectDraft();
  await screenshot('01-plan-draft');
  assert.equal((await projects()).length, 0);
  await page.locator('#draft-cancel').click();
  assert.equal((await projects()).length, 0);
  await page.locator('#cancel-modal').click();
  await record('New plan preview and cancellation leave saved projects empty');

  await openPlan('红鸟项目 · 资料整理（合成示例）');
  await expectDraft();
  await commit();
  await expect.poll(async () => (await projects()).length).toBe(1);
  let current = (await projects())[0];
  assert.equal(leaves(current.tree).length, 4);
  const initialSlots = await slots();
  assert.ok(initialSlots.length > 0);
  await expect(page.locator('#board.task-tree-board')).toBeVisible();
  await expect(page.locator('article[data-tree-stage-id]')).toHaveCount(2);
  await expect(page.locator('section[data-tree-task-id]')).toHaveCount(3);
  await expect(page.locator('#board input[data-task-id]')).toHaveCount(4);
  await expect(page.locator('#project-title')).toHaveText('红鸟项目 · 资料整理（合成示例）');
  const stageBounds = await page.locator('article[data-tree-stage-id]').evaluateAll((items) => items.map((item) => { const r = item.getBoundingClientRect(); return { x: r.x, y: r.y }; }));
  assert.equal(Math.round(stageBounds[0].y), Math.round(stageBounds[1].y));
  assert.ok(stageBounds[1].x > stageBounds[0].x, 'stages must be horizontal columns');
  await expect(page.locator('.workspace-intro .eyebrow')).toHaveText('SCHEDULE · 任务规划');
  await expect(page.locator('.workspace-intro h1')).toHaveText('把目标，变成今天的一小步。');
  await expect(page.locator('.workspace-intro > p:last-child')).toHaveText('先确定方向，再安排节奏。计划可以调整，每一次改变都由你确认。');
  await expect(page.locator('#calendar-panel')).not.toHaveAttribute('open');
  await page.locator('#calendar-panel > summary').focus();
  await page.locator('#calendar-panel > summary').press('Enter');
  await expect(page.locator('#sya-action-calendar')).toBeVisible();
  await expect(page.locator('#board.task-tree-board')).toBeVisible();
  await page.locator('#calendar-panel > summary').press('Space');
  await expect(page.locator('#calendar-panel')).not.toHaveAttribute('open');
  await expect(page.locator('#sya-action-calendar')).not.toBeVisible();
  await page.locator('.workspace-intro').scrollIntoViewIfNeeded();
  await screenshot('02-tree-overview');
  await record('Reference hero retained; tree remains primary while auxiliary calendar opens and closes by keyboard');
  await record('Project overview retained above horizontal stages, vertical subtasks and checklists');

  const stageId = current.tree.children[0].task_id;
  const otherStageId = current.tree.children[1].task_id;
  const taskId = current.tree.children[0].children[0].task_id;
  const otherTaskId = current.tree.children[0].children[1].task_id;
  await toggle(stageId).focus();
  await toggle(stageId).press('Enter');
  await expect(toggle(stageId)).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator(`section[data-tree-task-id="${taskId}"]`)).not.toBeVisible();
  await expect(toggle(otherStageId)).toHaveAttribute('aria-expanded', 'true');
  await toggle(stageId).press('Space');
  await expect(toggle(stageId)).toHaveAttribute('aria-expanded', 'true');
  await toggle(taskId).click();
  await expect(toggle(taskId)).toHaveAttribute('aria-expanded', 'false');
  await page.reload();
  await expect(toggle(taskId)).toHaveAttribute('aria-expanded', 'false');
  await closeSuggestions();
  await expandNode(taskId);
  await record('Stage and subtask disclosure supports keyboard control and survives refresh independently');

  for (const nav of ['timeline', 'calendar', 'day']) {
    await page.locator(`.sidebar [data-nav="${nav}"]`).click();
    await expect(page.locator('#board.task-tree-board')).toBeVisible();
    await expect(page.locator('#calendar-panel')).toHaveAttribute('open');
    assert.deepEqual(await slots(), initialSlots);
    assert.equal((await projects()).length, 1);
    await screenshot(`02-view-${nav}`);
  }
  await page.locator('.sidebar [data-nav="timeline"]').click();
  const weekStage = page.locator('#calendar-board .bar[data-milestone-id]').first();
  const linkedStage = await weekStage.getAttribute('data-milestone-id');
  await weekStage.click();
  await expect(toggle(linkedStage)).toBeFocused();
  await expect(toggle(linkedStage)).toHaveAttribute('aria-expanded', 'true');
  await page.locator('.sidebar [data-nav="calendar"]').click();
  const monthStage = page.locator('#calendar-board .month-chip').first();
  const monthLinkedStage = await monthStage.getAttribute('data-milestone-id');
  await monthStage.click();
  await expect(toggle(monthLinkedStage)).toBeFocused();
  await page.locator('.sidebar [data-nav="calendar"]').click();
  const emptyDay = page.locator('#calendar-board button.day:not(.has-ms)').first();
  const clickedDate = await emptyDay.getAttribute('data-day');
  await emptyDay.click();
  await expect(page.locator('#sya-action-calendar').getByLabel('日历日期')).toHaveValue(clickedDate);
  await page.locator('#sya-action-calendar').getByRole('button', {name:'今天', exact:true}).click();
  await page.locator('#project-list [data-project-id]').first().click();
  await expect(page.locator('.sidebar [data-nav="tree"]')).toHaveClass(/active/);
  await expect(page.locator('.project-head')).toBeInViewport();
  await record('Confirmed four-level plan; calendars share stored slots and stage, date and project links navigate to visible destinations');
  await treeView();

  const first = leaves(current.tree)[0].task_id;
  const stale = await api('/api/scheduler/granularity/preview', { method: 'POST', body: JSON.stringify({ projectId: current.tree.task_id, taskId: current.tree.task_id, level: 'finer' }) });
  await page.locator(`#board input[data-task-id="${first}"]`).check();
  await expect.poll(async () => leaves((await projects())[0].tree)[0].status).toBe('DONE');
  await expect(page.locator(`#board input[data-task-id="${first}"]`)).toBeChecked();
  const refused = await api(`/api/scheduler/plans/${stale.draftId}/commit`, { method: 'POST', body: JSON.stringify({ expectedRevision: stale.baseRevision, requestId: 'electron-stale-check' }) });
  assert.equal(refused.httpStatus, 409);
  assert.equal(refused.error.code, 'STALE_DRAFT');
  await record('Checklist completion persists and rejects an older draft');

  const beforeOrder = await savedTree(current.tree.task_id);
  const orderedLeaf = beforeOrder.children[0].children[0].children[1].task_id;
  await moveNode(orderedLeaf, -1);
  await expect.poll(async () => (await savedTree(current.tree.task_id)).children[0].children[0].children[0].task_id).toBe(orderedLeaf);
  await moveNode(otherTaskId, -1);
  await expect.poll(async () => (await savedTree(current.tree.task_id)).children[0].children[0].task_id).toBe(otherTaskId);
  await moveNode(otherStageId, -1);
  await expect.poll(async () => (await savedTree(current.tree.task_id)).children[0].task_id).toBe(otherStageId);
  assert.deepEqual(unorderedTree(await savedTree(current.tree.task_id)), unorderedTree(beforeOrder), 'sorting changes only sibling order, not identity, progress or parentage');
  await expect(page.locator(`#board input[data-task-id="${first}"]`)).toBeChecked();
  await screenshot('03-tree-reordered');
  await record('Stage, subtask and checklist sibling ordering persists without changing completed progress or parentage');

  await toggle(stageId).click();
  await expect(toggle(stageId)).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#search').fill('设计最小实验');
  await expect(page.locator(`li[data-tree-leaf-id="${current.tree.children[0].children[1].children[0].task_id}"]`)).toBeVisible();
  await page.locator('#search').fill('');
  await expect(toggle(stageId)).toHaveAttribute('aria-expanded', 'false');
  await expandNode(stageId);
  await record('Search reveals matching checklist ancestry without losing the saved collapsed state');

  await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.setMinimumSize(360, 600); window.setContentSize(760, 900); });
  await expect(page.locator('#board.task-tree-board')).toBeVisible();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'narrow window must not scroll the entire document horizontally');
  await expect(page.locator('#open-modal')).toBeVisible();
  await screenshot('04-tree-narrow');
  await page.locator('#calendar-panel > summary').click();
  await expect(page.locator('#calendar-panel')).not.toHaveAttribute('open');
  await page.locator('#calendar-panel > summary').click();
  await expect(page.locator('#sya-action-calendar')).toBeVisible();
  await page.locator('#sya-action-calendar').getByRole('button', {name: '周', exact: true}).click();
  await expect(page.locator('#calendar-board.week-board')).toBeVisible();
  await expect(page.locator('#board.task-tree-board')).toBeVisible();
  await page.locator('#calendar-panel [data-nav="calendar"]').click();
  await expect(page.locator('#calendar-board.month-grid')).toBeVisible();
  await page.locator('#calendar-panel [data-nav="day"]').click();
  await page.locator('#calendar-panel > summary').click();
  await page.locator('.workspace-intro').scrollIntoViewIfNeeded();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 1020));
  await record('Narrow window keeps the planning entry and confines horizontal stages to their scroll area');

  await closeSuggestions();
  await page.locator('#open-day-grain').click();
  await page.locator('#grain-target').selectOption(current.tree.task_id);
  for (const [choice, level, minutes] of [['fine','finer',25],['steady','standard',45],['wide','coarser',90]]) {
    // A retained custom value must never override a subsequently selected preset.
    await page.locator('#grain-target-minutes').fill('17');
    await expect(page.locator('input[name="grain-mode"][value="custom"]')).toBeChecked();
    await page.locator(`input[name="grain-mode"][value="${choice}"]`).check();
    await expect(page.locator('#grain-choices input:checked')).toHaveCount(1);
    const responsePromise=page.waitForResponse(response=>response.url().endsWith('/api/scheduler/granularity/preview')&&response.request().method()==='POST');
    await page.locator('#grain-apply').click();
    const response=await responsePromise;
    const payload=response.request().postDataJSON();
    assert.equal(payload.level,level);
    assert.equal(Object.hasOwn(payload,'targetMinutes'),false,'preset requests cannot carry a custom override');
    const preview=(await response.json()).data;
    assert.equal(preview.changeSummary.targetMinutes,minutes);
    await expectDraft();
    await page.locator('#draft-cancel').click();
    await expect(page.locator(`input[name="grain-mode"][value="${choice}"]`)).toBeChecked();
  }
  await page.locator('#grain-target-minutes').fill('121');
  await expect(page.locator('#grain-apply')).toBeDisabled();
  await page.locator('input[name="grain-mode"][value="fine"]').check();
  await expect(page.locator('#grain-apply')).toBeEnabled();
  await record('25/45/90-minute presets are mutually exclusive and never send custom target overrides');
  await page.locator('[data-grain="fine"]').click();
  await page.locator('#grain-target-minutes').fill('20');
  await expect(page.locator('input[name="grain-mode"][value="custom"]')).toBeChecked();
  await expect(page.locator('#grain-choices input:checked')).toHaveCount(1);
  await expect(page.locator('input[name="grain-mode"][value="fine"]')).not.toBeChecked();
  await screenshot('03-granularity-controls');
  const beforeGrain = (await projects())[0].tree;
  await page.locator('#grain-apply').click();
  await expectDraft();
  await expect(page.locator('#draft-impact')).toContainText('20');
  await screenshot('04-granularity-preview');
  assert.deepEqual((await projects())[0].tree, beforeGrain);
  await page.locator('#draft-cancel').click();
  assert.deepEqual((await projects())[0].tree, beforeGrain);
  await page.locator('#grain-cancel').click();

  // Hold one outgoing preference request, then forward it unchanged to the real
  // HTTP owner. No scheduler response is substituted: this only adds latency.
  let releaseDisclosure;
  const disclosureGate = new Promise((resolveGate) => { releaseDisclosure = resolveGate; });
  let disclosureHeld = false;
  let previewStarted = false;
  const observePreview = (request) => { if (request.method() === 'POST' && request.url().endsWith('/api/scheduler/granularity/preview')) previewStarted = true; };
  const delayDisclosure = async (route) => {
    const request = route.request();
    if (!disclosureHeld && request.method() === 'PUT' && request.postDataJSON()?.focusflow?.treeDisclosure) {
      disclosureHeld = true;
      await disclosureGate;
    }
    await route.continue();
  };
  await page.route('**/api/scheduler/config', delayDisclosure);
  page.on('request', observePreview);
  try {
    await toggle(stageId).click();
    await expect.poll(() => disclosureHeld).toBe(true);
    await page.locator('#open-day-grain').click();
    await page.locator('#grain-target').selectOption(current.tree.task_id);
    await page.locator('[data-grain="fine"]').click();
    await page.locator('#grain-target-minutes').fill('20');
    await page.locator('#grain-apply').click();
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
    assert.equal(previewStarted, false, 'preview must await the in-flight disclosure save');
    releaseDisclosure();
    await expectDraft();
    assert.equal(previewStarted, true);
  } finally {
    releaseDisclosure();
    page.off('request', observePreview);
    await page.unroute('**/api/scheduler/config', delayDisclosure);
  }
  await commit();
  await record('A preview waits for delayed disclosure persistence and confirms without a self-inflicted stale-draft error');
  await expect.poll(async () => leaves((await projects())[0].tree).length).toBeGreaterThan(4);
  await expect(page.locator('#open-day-grain')).toContainText('自定义');
  const refined = (await projects())[0].tree;
  assert.deepEqual(leaves(refined).find((node) => node.task_id === first), leaves(beforeGrain).find((node) => node.task_id === first));
  assert.ok(leaves(refined).filter((node) => node.status === 'PENDING').every((node) => Math.round(node.estimated_time * 60) <= 20));
  assert.equal(leaves(refined).reduce((sum, node) => sum + Math.round(node.estimated_time * 60), 0), 240);
  const depths = (node, depth = 0) => node.children?.length ? node.children.flatMap((child) => depths(child, depth + 1)) : [depth];
  assert.deepEqual([...new Set(depths(refined))], [3]);
  await record('Custom finer draft cancels safely, confirms real leaves, and preserves completed nodes and four levels');

  await closeSuggestions();
  await page.locator('#open-day-grain').click();
  await page.locator('#grain-target').selectOption(current.tree.task_id);
  await page.locator('[data-grain="fine"]').click();
  await page.locator('#grain-target-minutes').fill('20');
  await page.locator('#grain-apply').click();
  await expectDraft();
  await expect(page.locator('#draft-commit')).toBeDisabled();
  await expect(page.locator('#draft-warnings')).toContainText('无需重复');
  await page.locator('#draft-cancel').click();
  assert.deepEqual((await projects())[0].tree, refined);
  await page.locator('[data-grain="wide"]').click();
  await page.locator('#grain-target-minutes').fill('60');
  await page.locator('#grain-apply').click();
  await expectDraft();
  await expect(page.locator('#draft-commit')).toBeEnabled();
  await expect(page.locator('#draft-impact')).toContainText('60');
  await page.locator('#draft-cancel').click();
  await page.locator('#grain-cancel').click();
  assert.deepEqual((await projects())[0].tree, refined);
  await record('Custom 20-minute target is enforced; repeated preview is a no-op; custom 60-minute merge preview cancels safely');

  await closeSuggestions();
  await page.locator('#open-schedule').click();
  await page.locator('#period-start').fill('08:00');
  await page.locator('#routine-focus-minutes').fill('25');
  await page.locator('#routine-break-minutes').fill('5');
  await page.locator('#routine-recovery-minutes').fill('15');
  await page.locator('#routine-cycles').fill('4');
  await page.locator('#routine-rest').fill('短休息离开屏幕，长休息散步。');
  await screenshot('05-routine-controls');
  const beforeRoutine = await api('/api/scheduler/config');
  await page.locator('#save-schedule').click();
  await expectDraft();
  await expect(page.locator('#draft-impact')).toContainText('25');
  await expect(page.locator('#draft-impact')).toContainText('全部休息');
  await screenshot('06-routine-preview');
  assert.equal((await api('/api/scheduler/config')).workStart, beforeRoutine.workStart);
  await page.locator('#draft-cancel').click();
  assert.equal((await api('/api/scheduler/config')).workStart, beforeRoutine.workStart);
  await page.locator('#save-schedule').click();
  await expectDraft();
  await commit();
  assert.equal((await api('/api/scheduler/config')).workStart, '08:00');
  assert.equal((await api('/api/scheduler/config')).rest, '短休息离开屏幕，长休息散步。');
  assert.equal((await api('/api/scheduler/config')).focusMinutes, 25);
  assert.equal((await api('/api/scheduler/config')).breakMinutes, 5);
  assert.equal((await api('/api/scheduler/config')).recoveryMinutes, 15);
  const routineTimeline = await api('/api/scheduler/timeline?projectId=all');
  assert.ok(routineTimeline.breaks.length > 0);
  assert.ok(routineTimeline.breaks.every((slot) => !slot.taskId && ['break', 'recovery'].includes(slot.kind)));
  assert.ok(routineTimeline.events.every((slot) => slot.taskId && slot.kind === 'work'));
  const minutesOf = (slot) => (new Date(slot.endTime) - new Date(slot.startTime)) / 60000;
  assert.ok(routineTimeline.breaks.filter((slot) => slot.kind === 'break').some((slot) => minutesOf(slot) === 5));
  assert.ok(routineTimeline.breaks.some((slot) => slot.kind === 'recovery' && minutesOf(slot) === 15));
  await page.locator('.sidebar [data-nav="day"]').click();
  await expect(page.getByTestId('calendar-break-block').first()).toBeVisible();
  assert.equal(await page.getByTestId('calendar-break-block').locator('input').count(), 0);
  await screenshot('07-overview-with-breaks');
  await record('Routine preview lists affected work; cancel preserves and confirmation saves the change');

  await dayView();
  const firstBlock=calendar().getByTestId('calendar-work-block').first();
  await expect(firstBlock.getByRole('button',{name:'开始专注',exact:true})).toBeEnabled();
  await expect(firstBlock.getByRole('button',{name:'完成整个任务',exact:true})).toBeEnabled();
  const originalTitle=await firstBlock.getByRole('heading',{level:3}).innerText();
  const originalTask=(await api('/api/scheduler/tasks?projectId=all')).find(task=>task.title===originalTitle);
  assert(originalTask,'calendar task comes from the real tasks.list DTO');
  postponedTaskId=originalTask.id;
  postponedTitle=originalTitle+'（延期验收）';
  const calendarDate=await calendar().getByLabel('日历日期').inputValue();
  postponedDate=await page.evaluate(date=>{const next=new Date(date+'T12:00:00');next.setDate(next.getDate()+2);return `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;},calendarDate);
  const beforeEdit={tree:await savedTree(current.tree.task_id),slots:await slots()};
  await firstBlock.getByRole('button',{name:'调整 / 延期',exact:true}).click();
  let editor=page.getByRole('dialog',{name:'调整任务',exact:true});
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel('编辑任务内容')).toBeFocused();
  await editor.getByLabel('编辑任务内容').fill('取消的修改');
  await editor.getByLabel('任务安排日期').fill(postponedDate);
  await editor.getByRole('button',{name:'取消调整',exact:true}).click();
  await expect(editor).not.toBeVisible();
  assert.deepEqual(await savedTree(current.tree.task_id),beforeEdit.tree);
  assert.deepEqual(await slots(),beforeEdit.slots);
  await firstBlock.getByRole('button',{name:'调整 / 延期',exact:true}).click();
  editor=page.getByRole('dialog',{name:'调整任务',exact:true});
  await editor.getByLabel('编辑任务内容').fill(postponedTitle);
  await editor.getByLabel('任务安排日期').fill(postponedDate);
  await editor.getByLabel('任务截止日期').fill(postponedDate);
  if(process.platform!=='win32' && process.getuid?.()!==0) {
    // A real disk permission failure in this isolated profile, not an API mock.
    await chmod(data,0o500);
    try {
      await editor.getByRole('button',{name:'保存任务调整',exact:true}).click();
      await expect(editor.getByRole('alert')).toBeVisible();
      await expect(editor.getByLabel('编辑任务内容')).toHaveValue(postponedTitle);
      await expect(editor.getByLabel('任务安排日期')).toHaveValue(postponedDate);
      assert.deepEqual(await savedTree(current.tree.task_id),beforeEdit.tree);
    } finally {await chmod(data,0o700);}
    await record('A real task-save storage failure keeps the editor and entered values available for retry');
  }
  await editor.getByRole('button',{name:'保存任务调整',exact:true}).click();
  await expect(editor).not.toBeVisible();
  await expect.poll(async()=>(await api(`/api/scheduler/tasks/${postponedTaskId}`)).scheduledDate).toBe(postponedDate);
  assert.equal((await api(`/api/scheduler/tasks/${postponedTaskId}`)).title,postponedTitle);
  await calendar().getByLabel('日历日期').fill(postponedDate);
  await expect(calendar().getByTestId('calendar-work-block').filter({hasText:postponedTitle})).toBeVisible();
  await screenshot('08-action-calendar-postponed');
  await closeSuggestions();
  await calendar().getByRole('button',{name:'周',exact:true}).click();
  await expect(page.locator('#board-title')).toHaveText('研究周报');
  await expect(page.locator('#calendar-board.week-board .bar')).not.toHaveCount(0);
  await page.locator('[data-nav="calendar"]:visible').first().click();
  await expect(page.locator('#board-title')).toHaveText('研究月历');
  await expect(page.locator(`[data-day="${postponedDate}"]`)).toHaveClass(/has-ms/);
  const postponedTimeline=await api(`/api/scheduler/timeline?from=${postponedDate}&to=${postponedDate}&view=day&projectId=all`);
  assert(postponedTimeline.events.some(event=>event.taskId===postponedTaskId&&event.startTime.startsWith(postponedDate)));
  await record('Shared action calendar exposes Focus/Edit/Complete; visible task editor cancels safely and postponement updates the day, week and month views');
  await dayView();
  await calendar().getByRole('button',{name:'今天',exact:true}).click();

  // A model failure is a real upstream HTTP 503, not a mocked scheduler response.
  fixtureMode = 'failure';
  const countBeforeFailure = (await projects()).length;
  await openPlan('Failure and retry');
  await expect(page.locator('#generation-error')).toBeVisible();
  assert.equal((await projects()).length, countBeforeFailure);
  await screenshot('04-model-failure');
  fixtureMode = 'success';
  await page.locator('#generation-retry').click();
  await expectDraft();
  assert.equal((await projects()).length, countBeforeFailure);
  await page.locator('#draft-cancel').click();
  await page.locator('#cancel-modal').click();
  await record('External model failure is visible; retry returns an uncommitted draft');

  fixtureMode = 'delay';
  await openPlan('Cancelled while generating');
  await expect(page.locator('#decompose-overlay')).toBeVisible();
  await expect.poll(() => pending.length).toBeGreaterThan(0);
  await page.locator('#generation-cancel').click();
  await expect(page.locator('#decompose-overlay')).not.toBeVisible();
  fixtureMode = 'success';
  pending.splice(0).forEach((reply) => reply());
  await expect(page.locator('#draft-dialog')).not.toBeVisible();
  await page.locator('#cancel-modal').click();
  assert.equal((await projects()).length, countBeforeFailure);
  await record('Cancelling generation cannot commit or display a late result');

  const modelCallsBeforeSample = modelCalls;
  await openPlan('Explicit sample', 'sample');
  await expectDraft();
  await expect(page.locator('#draft-summary')).toContainText('示例');
  assert.equal(modelCalls, modelCallsBeforeSample);
  await commit();
  await expect(page.locator('#project-source')).toContainText('示例');
  await record('Explicit sample is labeled and makes no model generation request');

  // Stale-draft handling in the actual confirmation dialog.
  current = (await projects()).find((project) => project.tree.task_id === refined.task_id);
  await page.locator(`.project-item[data-project-id="${current.tree.task_id}"]`).click();
  await closeSuggestions();
  await page.locator('#open-day-grain').click();
  await page.locator('#grain-target').selectOption(current.tree.task_id);
  await page.locator('[data-grain="wide"]').click();
  await page.locator('#grain-apply').click();
  await expectDraft();
  const pendingLeaf = leaves(current.tree).find((leaf) => leaf.status === 'PENDING');
  const external = await api(`/api/v1/tasks/${pendingLeaf.task_id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'IN_PROGRESS' }) });
  assert.equal(external.accepted, true);
  await page.locator('#draft-commit').click();
  await expect(page.locator('#draft-error')).toContainText('已发生变化');
  await expect(page.locator('#draft-commit')).toBeDisabled();
  await expect(page.locator('#draft-regenerate')).toBeVisible();
  await screenshot('05-stale-draft');
  await page.locator('#draft-cancel').click();
  await page.locator('#grain-cancel').click();
  await record('Concurrent edit is explained in the UI; stale confirmation stays disabled');

  // Follow the exact Monitor task even when another project is currently selected.
  const beforeMonitor = (await projects()).map((project) => project.tree);
  await page.goto(`${baseURL}/?taskId=${encodeURIComponent(pendingLeaf.task_id)}&reason=focus-friction&focusSessionId=existing-focus-session`);
  await expect(page.locator('#grain-modal')).toBeVisible();
  await expect(page.locator('#grain-target')).toHaveValue(pendingLeaf.task_id);
  const monitorResponse = page.waitForResponse((response) => response.url().endsWith('/api/scheduler/granularity/preview') && response.request().method() === 'POST');
  await page.locator('[data-grain="fine"]').click();
  await page.locator('#grain-apply').click();
  const monitorDraft = (await (await monitorResponse).json()).data;
  await expectDraft();
  assert.equal(monitorDraft.context.taskId, pendingLeaf.task_id);
  assert.equal(monitorDraft.context.focusSessionId, 'existing-focus-session');
  await page.locator('#draft-cancel').click();
  await page.locator('#grain-cancel').click();
  assert.deepEqual((await projects()).map((project) => project.tree), beforeMonitor);
  await page.goto(`${baseURL}/?taskId=missing-task&reason=focus-friction`);
  await expect(page.locator('#grain-modal')).toBeVisible();
  await expect(page.locator('#grain-target')).toHaveValue('');
  await expect(page.locator('#grain-apply')).toBeDisabled();
  await expect(page.locator('#grain-reason')).toContainText('不可用');
  await page.locator('#grain-cancel').click();
  await page.goto(`${baseURL}/?adjust=granularity&reason=no-active-task`);
  await expect(page.locator('#grain-modal')).toBeVisible();
  await expect(page.locator('#grain-target')).toHaveValue('');
  await expect(page.locator('#grain-apply')).toBeDisabled();
  await page.locator('#grain-cancel').click();
  await page.goto(`${baseURL}/`);
  await record('Monitor preserves the exact active task/session; missing or absent tasks require explicit selection');

  await closeSuggestions();
  await page.locator(`.project-item[data-project-id="${current.tree.task_id}"]`).click();
  await expandTree();
  await toggle(taskId).click();
  await expect(toggle(taskId)).toHaveAttribute('aria-expanded', 'false');
  await toggle(stageId).click();
  await expect(toggle(stageId)).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(async () => (await api('/api/scheduler/config')).focusflow.treeDisclosure?.[current.tree.task_id]?.[stageId]).toBe(false);
  await expect.poll(async () => (await api('/api/scheduler/config')).focusflow.treeDisclosure?.[current.tree.task_id]?.[taskId]).toBe(false);
  await page.waitForLoadState('networkidle');
  const beforeRestart = await snapshot();
  await screenshot('06-before-restart');
  await stop();
  await launch();
  await expect(page.locator('#entry-modal')).not.toBeVisible();
  await expect(page.locator('#open-day-grain')).toContainText('自定义时长 20m');
  await expect.poll(async () => (await projects()).length).toBe(beforeRestart.projects.length);
  const afterRestart = await snapshot();
  assert.deepEqual(afterRestart, beforeRestart);
  assert.equal((await api('/api/scheduler/config')).focusMinutes, 25);
  assert.equal((await api('/api/scheduler/config')).todayGrain.targetMinutes, 20);
  assert.equal((await api('/api/scheduler/config')).todayGrain.level,'custom');
  assert.equal((await api(`/api/scheduler/tasks/${postponedTaskId}`)).scheduledDate,postponedDate);
  assert.equal((await api(`/api/scheduler/tasks/${postponedTaskId}`)).title,postponedTitle);
  assert.ok((await api('/api/scheduler/timeline?projectId=all')).breaks.length > 0);
  await page.locator(`.project-item[data-project-id="${current.tree.task_id}"]`).click();
  await expect(page.locator('#board.task-tree-board')).toBeVisible();
  await expect(toggle(stageId)).toHaveAttribute('aria-expanded', 'false');
  await expandNode(stageId);
  await expect(toggle(taskId)).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator(`#board input[data-task-id="${first}"]`)).not.toBeVisible();
  await expandNode(taskId);
  await expect(page.locator(`#board input[data-task-id="${first}"]`)).toBeChecked();
  assert.equal((await savedTree(current.tree.task_id)).children[0].task_id, otherStageId);
  await screenshot('07-after-restart');
  await record('True Electron exit and restart restore sibling order, project disclosure, progress, routine and stable slots');
  await closeSuggestions();
  await page.locator('#open-day-grain').click();
  await expect(page.locator('input[name="grain-mode"][value="custom"]')).toBeChecked();
  await expect(page.locator('#grain-target-minutes')).toHaveValue('20');
  await page.locator('#grain-cancel').click();
  await record('Custom selection, duration and postponed task date remain explicit after a true relaunch');

  // CAP-8 uses real status actions at the current local time, never a fake clock
  // or a seeded observation. Clear only this test's earlier observation metadata.
  await closeSuggestions();
  await page.locator('#open-schedule').click();
  const localHour = await page.evaluate(() => new Date().getHours());
  const outsideStart = localHour === 2 ? '04:00' : '02:00';
  // Keep synthetic meal reservations away from the real observation minute;
  // otherwise a run during dinner correctly has no feasible work suggestion.
  const mealHour=localHour===1?'05':'01';
  await page.locator('#schedule-modal .meal-settings summary').click();
  for(const [id,minute] of [['lunch-start','00'],['lunch-end','10'],['dinner-start','20'],['dinner-end','30']])await page.locator(`#${id}`).fill(`${mealHour}:${minute}`);
  await page.locator('#period-start').fill(outsideStart);
  await page.locator('#hours-per-day').fill('1');
  await page.locator('#save-schedule').click();
  await expectDraft();
  await commit();
  await page.waitForLoadState('networkidle');
  await api('/api/scheduler/config', { method: 'PUT', body: JSON.stringify({ focusflow: { workLog: [], focusDismissed: null } }) });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await closeSuggestions();
  await page.locator(`.project-item[data-project-id="${current.tree.task_id}"]`).click();
  await expandTree();
  const workIds = leaves((await projects()).find((project) => project.tree.task_id === current.tree.task_id).tree)
    .filter((node) => node.status === 'PENDING').slice(0, 2).map((node) => node.task_id);
  assert.equal(workIds.length, 2);
  for (const [index, id] of workIds.entries()) {
    await page.locator(`#board select[data-status-task-id="${id}"]`).selectOption('IN_PROGRESS');
    await expect.poll(async () => (await api('/api/scheduler/config')).focusflow.workLog.length).toBe(index + 1);
    if (index === 0) await expect(page.locator('#focus-modal')).not.toBeVisible();
  }
  await expect(page.locator('#focus-modal')).toBeVisible();
  assert.equal((await api('/api/scheduler/config')).workStart, outsideStart);
  const suggestionSlots = await slots();
  await page.locator('#focus-apply').click();
  await expectDraft();
  assert.equal((await api('/api/scheduler/config')).workStart, outsideStart);
  await page.locator('#draft-cancel').click();
  assert.deepEqual(await slots(), suggestionSlots);
  assert.equal((await api('/api/scheduler/config')).workStart, outsideStart);
  await page.locator('#focus-apply').click();
  await expectDraft();
  await commit();
  assert.notEqual((await api('/api/scheduler/config')).workStart, outsideStart);
  await record('Two real out-of-window status actions suggest a routine; cancel preserves it and only confirmation applies it');
  assert.deepEqual(pageErrors, []);
  await stop();
  await record('No renderer errors and no Electron/runtime child processes remain');
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ ok: true, checks, modelFixture: true, liveModelTested: false, focusHandoffTested:false, focusBoundary:'Focus action is visible and enabled here; native SYA handoff and real Focus session are covered by the host Electron suite.', repository, evidence, isolated, profile, data, executablePath, versions, buildHashes, pageErrors, survivors: survivors() }, null, 2));
  console.log(JSON.stringify({ ok: true, checks: checks.length, evidence }));
} catch (error) {
  if (page && !page.isClosed()) await screenshot('failure').catch(() => {});
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ ok: false, checks, error: error.stack, pageErrors, evidence, isolated, profile, data, executablePath, versions, buildHashes }, null, 2));
  console.error(error.stack);
  console.error(`Evidence: ${evidence}`);
  process.exitCode = 1;
} finally {
  fixtureMode = 'success';
  pending.splice(0).forEach((reply) => reply());
  let cleanupError = null;
  await stop().catch((error) => { cleanupError = error.stack; console.error(`Cleanup: ${error.message}`); process.exitCode = 1; });
  provider.closeAllConnections();
  await new Promise((resolveClose) => provider.close(resolveClose));
  const reportPath = join(evidence, 'result.json');
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  const remaining = survivors();
  await writeFile(reportPath, JSON.stringify({ ...report, ok: report.ok && !cleanupError && remaining.length === 0, cleanup: { error: cleanupError, survivors: remaining, providerClosed: true } }, null, 2));
}
