import fs from 'fs';
import path from 'path';
import { execSync, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(REPO_ROOT, 'server');
const SERVER_PACKAGE_PATH = path.join(SERVER_DIR, 'package.json');

function run() {
  console.log('📦 Running platform-agnostic server packaging...');

  const UI_PACKAGE_PATH = path.join(REPO_ROOT, 'ui', 'package.json');
  let currentVersion = '1.0.0';
  try {
    const uiPackage = JSON.parse(fs.readFileSync(UI_PACKAGE_PATH, 'utf8'));
    currentVersion = uiPackage.version || '1.0.0';
  } catch (e) {
    console.log('⚠️ Using fallback version 1.0.0');
  }

  const originalServerPackageText = fs.readFileSync(SERVER_PACKAGE_PATH, 'utf8');
  const serverPackage = JSON.parse(originalServerPackageText);

  try {
    // 1. Resolve monorepo workspace dependencies in memory
    if (serverPackage.dependencies) {
      Object.keys(serverPackage.dependencies).forEach((dep) => {
        if (serverPackage.dependencies[dep].startsWith('workspace:')) {
          serverPackage.dependencies[dep] = `^${currentVersion}`;
        }
      });
    }

    // 2. Direct the lifecycle hook to our native, platform-independent script
    if (serverPackage.scripts) {
      serverPackage.scripts.prepare = 'node ../scripts/prepare-server-ui-dist.mjs';
    }

    fs.writeFileSync(SERVER_PACKAGE_PATH, JSON.stringify(serverPackage, null, 2));

    // 3. Run `npm pack` in a cross-platform way. On Windows some npm
    // shims (npm.exe) can be incompatible; prefer invoking npm's
    // `npm-cli.js` directly with Node when it's available.
    const env = { ...process.env };

    // Candidate locations for npm-cli.js
    const candidates = [
      // global sibling to node.exe
      path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
      // monorepo-installed npm
      path.join(REPO_ROOT, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    ];

    let usedFallback = false;
    const npmCli = candidates.find((p) => fs.existsSync(p));

    console.log('🗜️ Executing package compression...');

    try {
      if (npmCli) {
        // Run `node <npm-cli.js> pack` to avoid invoking platform native shims
        execFileSync(process.execPath, [npmCli, 'pack'], { cwd: SERVER_DIR, stdio: 'inherit', env });
      } else {
        // Fallback: attempt to run `npm pack` directly without a shell.
        // This avoids shell wrappers and usually works cross-platform.
        usedFallback = true;
        execFileSync('npm', ['pack'], { cwd: SERVER_DIR, stdio: 'inherit', env });
      }

      console.log('✅ Server tarball built successfully!');
      if (usedFallback) console.log('⚠️ Used fallback `npm` invocation; consider installing npm locally to prefer Node-driven execution.');
    } catch (err) {
      console.error('❌ Build failed:', err && err.message ? err.message : String(err));
    }

  } catch (error) {
    console.error('❌ Build failed:', error.message);
  } finally {
    fs.writeFileSync(SERVER_PACKAGE_PATH, originalServerPackageText);
    console.log('♻️ Restored original server package.json workspace notations.');
  }
}

run();