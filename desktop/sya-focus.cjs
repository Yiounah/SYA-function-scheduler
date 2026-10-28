// Native-only source-app handoff. The renderer supplies only taskId/minutes.
const fs = require('node:fs');
const path = require('node:path');

function focusRequest(url, origin, frameUrl, initiatorUrl) {
  try {
    const target = new URL(url);
    if (target.origin !== origin || target.pathname !== '/sya-focus' || new URL(frameUrl || initiatorUrl || '').origin !== origin || (initiatorUrl && new URL(initiatorUrl).origin !== origin)) return null;
    if (target.hash || target.username || target.password || [...target.searchParams.keys()].some(key => !['taskId', 'minutes'].includes(key))) return null;
    if (target.searchParams.getAll('taskId').length !== 1 || target.searchParams.getAll('minutes').length !== 1) return null;
    const taskId = target.searchParams.get('taskId'), rawMinutes = target.searchParams.get('minutes');
    if (!taskId || taskId !== taskId.trim() || taskId.length > 128 || /[\u0000-\u001f\u007f]/.test(taskId) || !/^\d{1,4}$/.test(rawMinutes || '')) return null;
    const minutes = Number(rawMinutes);
    return minutes >= 1 && minutes <= 1440 ? {taskId, minutes} : null;
  } catch { return null; }
}

function findSyaApp(schedulerRoot, override) {
  const candidates = [];
  if (override) {
    if (!path.isAbsolute(override)) throw new Error('SYA_UI_ROOT must be an absolute app directory.');
    candidates.push(override);
  } else {
    let current = path.resolve(schedulerRoot);
    for (let depth = 0; depth < 6; depth++) {
      candidates.push(path.join(current, 'SYA-UI', 'app'), path.join(current, 'app'));
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  for (const candidate of candidates) {
    try {
      const directory = fs.realpathSync(candidate);
      const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
      if (manifest.name === 'sya-ui' && manifest.main === 'dist-electron/main.js' && fs.statSync(path.join(directory, 'scripts/electron-dev.mjs')).isFile()) return directory;
    } catch { /* Try only the known local source layouts. */ }
  }
  throw new Error('No local SYA-UI source app was found.');
}

function hostUserDataDirectory(value) {
  if (!value) return undefined;
  if (!path.isAbsolute(value)) throw new Error('SYA_UI_USER_DATA_DIR must be an absolute directory.');
  return path.resolve(value);
}

module.exports = {focusRequest, findSyaApp, hostUserDataDirectory};
