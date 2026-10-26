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
import { cp, mkdtemp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

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
const work = await mkdtemp(join(tmpdir(), 'scheduler-electron-'));
const isolated = join(work, 'app');
const profile = join(work, 'profile');
const data = join(work, 'data');
const evidence = join(work, 'evidence');
await mkdir(isolated);
await mkdir(evidence);
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
const launchedPids = new Set();
let app;
let page;
let baseURL;

function fixtureTree(goal) {
  const prefix = `fixture-${++sequence}`;
  const leaf = (suffix, title) => ({ task_id: `${prefix}-${suffix}`, title, estimated_time: 1, status: 'PENDING', children: [] });
  return { task_id: `${prefix}-root`, title: goal || 'Electron acceptance project', estimated_time: 4, status: 'PENDING', children: [
    { task_id: `${prefix}-stage`, title: '收集证据', estimated_time: 4, status: 'PENDING', children: [
      { task_id: `${prefix}-task`, title: '准备实验方案', estimated_time: 4, status: 'PENDING', children: [leaf('a', '阅读基线方法'), leaf('b', '比较可行方案'), leaf('c', '设计最小实验'), leaf('d', '整理复现清单')] },
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

function descendants(rootPid) {
  const rows = execFileSync('ps', ['-axo', 'pid=,ppid='], { encoding: 'utf8' }).trim().split('\n').map((line) => line.trim().split(/\s+/).map(Number));
  const ids = new Set([rootPid]);
  for (let pass = 0; pass < 5; pass++) for (const [pid, parent] of rows) if (ids.has(parent)) ids.add(pid);
  return [...ids];
}
function isAlive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }
async function launch() {
  app = await _electron.launch({ executablePath, args: [isolated, '--disable-gpu'], cwd: isolated, env, timeout: 40_000 });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 1020));
  page.setDefaultTimeout(15_000);
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.waitForURL(/http:\/\/127\.0\.0\.1:\d+\//);
  baseURL = page.url().replace(/\/$/, '');
  for (const pid of descendants(app.process().pid)) launchedPids.add(pid);
  await expect(page.locator('#open-modal-top')).toBeVisible();
}
async function stop() {
  if (!app) return;
  const old = app;
  app = null;
  for (const pid of descendants(old.process().pid)) launchedPids.add(pid);
  await old.close();
  await expect.poll(() => [...launchedPids].filter(isAlive), { timeout: 10_000 }).toEqual([]);
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
async function closeSuggestions() {
  for (const id of ['focus-keep', 'grain-suggest-keep']) if (await page.locator(`#${id}`).isVisible()) await page.locator(`#${id}`).click();
}
async function openPlan(goal, source = 'model') {
  await closeSuggestions();
  await page.locator('#open-modal-top').click();
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
  await page.locator('.content').evaluate((element) => element.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: join(evidence, `${name}.png`) });
}

try {
  await launch();
  for (const asset of ['app.js', 'styles.css']) {
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
  await expect(page.locator('#subtask-detail input[data-task-id]')).toHaveCount(4);
  for (const nav of ['timeline', 'calendar', 'day']) {
    await page.locator(`.sidebar [data-nav="${nav}"]`).click();
    assert.deepEqual(await slots(), initialSlots);
    assert.equal((await projects()).length, 1);
    await screenshot(`02-view-${nav}`);
  }
  await record('Confirmed four-level plan; day/week/month share unchanged stored slots');

  const first = leaves(current.tree)[0].task_id;
  const stale = await api('/api/scheduler/granularity/preview', { method: 'POST', body: JSON.stringify({ projectId: current.tree.task_id, taskId: current.tree.task_id, level: 'finer' }) });
  await page.locator(`#subtask-detail input[data-task-id="${first}"]`).check();
  await expect.poll(async () => leaves((await projects())[0].tree)[0].status).toBe('DONE');
  await expect(page.locator(`#subtask-detail input[data-task-id="${first}"]`)).toBeChecked();
  const refused = await api(`/api/scheduler/plans/${stale.draftId}/commit`, { method: 'POST', body: JSON.stringify({ expectedRevision: stale.baseRevision, requestId: 'electron-stale-check' }) });
  assert.equal(refused.httpStatus, 409);
  assert.equal(refused.error.code, 'STALE_DRAFT');
  await record('Checklist completion persists and rejects an older draft');

  await closeSuggestions();
  await page.locator('#open-day-grain').click();
  await page.locator('#grain-target').selectOption(current.tree.task_id);
  await page.locator('[data-grain="fine"]').click();
  await page.locator('#grain-target-minutes').fill('20');
  await screenshot('03-granularity-controls');
  const beforeGrain = (await projects())[0].tree;
  await page.locator('#grain-apply').click();
  await expectDraft();
  await expect(page.locator('#draft-impact')).toContainText('20');
  await screenshot('04-granularity-preview');
  assert.deepEqual((await projects())[0].tree, beforeGrain);
  await page.locator('#draft-cancel').click();
  assert.deepEqual((await projects())[0].tree, beforeGrain);
  await page.locator('#grain-apply').click();
  await expectDraft();
  await commit();
  await expect.poll(async () => leaves((await projects())[0].tree).length).toBeGreaterThan(4);
  await expect(page.locator('#open-day-grain')).toContainText('更细');
  const refined = (await projects())[0].tree;
  assert.deepEqual(leaves(refined).find((node) => node.task_id === first), leaves(beforeGrain).find((node) => node.task_id === first));
  assert.ok(leaves(refined).filter((node) => node.status === 'PENDING').every((node) => Math.round(node.estimated_time * 60) <= 20));
  assert.equal(leaves(refined).reduce((sum, node) => sum + Math.round(node.estimated_time * 60), 0), 240);
  const depths = (node, depth = 0) => node.children?.length ? node.children.flatMap((child) => depths(child, depth + 1)) : [depth];
  assert.deepEqual([...new Set(depths(refined))], [3]);
  await record('Finer draft cancels safely, confirms real leaves, and preserves completed nodes and four levels');

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
  await record('20-minute target is enforced; repeated fine preview is a no-op; 60-minute coarser preview cancels safely');

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
  await expect(page.locator('.break-item').first()).toBeVisible();
  assert.equal(await page.locator('.break-item input').count(), 0);
  await screenshot('07-overview-with-breaks');
  await record('Routine preview lists affected work; cancel preserves and confirmation saves the change');

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
  await page.waitForLoadState('networkidle');
  const beforeRestart = await snapshot();
  await screenshot('06-before-restart');
  await stop();
  await launch();
  await expect(page.locator('#entry-modal')).not.toBeVisible();
  await expect(page.locator('#open-day-grain')).toContainText('更细 20m');
  await expect.poll(async () => (await projects()).length).toBe(beforeRestart.projects.length);
  const afterRestart = await snapshot();
  assert.deepEqual(afterRestart, beforeRestart);
  assert.equal((await api('/api/scheduler/config')).focusMinutes, 25);
  assert.equal((await api('/api/scheduler/config')).todayGrain.targetMinutes, 20);
  assert.ok((await api('/api/scheduler/timeline?projectId=all')).breaks.length > 0);
  await screenshot('07-after-restart');
  await record('True Electron exit and restart restore projects, progress, routine and stable slots');

  // CAP-8 uses real status actions at the current local time, never a fake clock
  // or a seeded observation. Clear only this test's earlier observation metadata.
  await closeSuggestions();
  await page.locator('#open-schedule').click();
  const localHour = await page.evaluate(() => new Date().getHours());
  const outsideStart = localHour === 2 ? '04:00' : '02:00';
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
  const workIds = leaves((await projects()).find((project) => project.tree.task_id === current.tree.task_id).tree)
    .filter((node) => node.status === 'PENDING').slice(0, 2).map((node) => node.task_id);
  assert.equal(workIds.length, 2);
  for (const [index, id] of workIds.entries()) {
    await page.locator(`#subtask-detail select[data-status-task-id="${id}"]`).selectOption('IN_PROGRESS');
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
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ ok: true, checks, modelFixture: true, liveModelTested: false, repository, evidence, pageErrors }, null, 2));
  console.log(JSON.stringify({ ok: true, checks: checks.length, evidence }));
} catch (error) {
  if (page && !page.isClosed()) await screenshot('failure').catch(() => {});
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ ok: false, checks, error: error.stack, pageErrors, evidence }, null, 2));
  console.error(error.stack);
  console.error(`Evidence: ${evidence}`);
  process.exitCode = 1;
} finally {
  fixtureMode = 'success';
  pending.splice(0).forEach((reply) => reply());
  await stop().catch((error) => { console.error(`Cleanup: ${error.message}`); process.exitCode = 1; });
  provider.closeAllConnections();
  await new Promise((resolveClose) => provider.close(resolveClose));
}
