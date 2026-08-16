const { chmodSync } = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const runtimePath = path.join(
    context.appOutDir,
    appName,
    'Contents',
    'Resources',
    'scheduler-runtime',
    'scheduler-server',
  );
  chmodSync(runtimePath, 0o755);
};
