import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Environment Setup ────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CLI_DIR = path.join(REPO_ROOT, 'cli');
const DIST_DIR = path.join(CLI_DIR, 'dist');

// Parse CLI flags
const args = process.argv.slice(2);
const skip_checks = args.includes('--skip-checks');
const skip_typecheck = args.includes('--skip-typecheck');

console.log('==> Building paperclipai for npm');

try {
  // ── Step 1: Forbidden token check ──────────────────────────────────────────
  if (!skip_checks) {
    console.log('  [1/6] Running forbidden token check...');
    execSync(`node "${path.join(REPO_ROOT, 'scripts/check-forbidden-tokens.mjs')}"`, { stdio: 'inherit' });
  } else {
    console.log('  [1/6] Skipping forbidden token check (--skip-checks)');
  }

  // ── Step 2: TypeScript type-check ──────────────────────────────────────────
  if (!skip_typecheck) {
    console.log('  [2/6] Type-checking...');
    execSync('pnpm -r typecheck', { cwd: REPO_ROOT, stdio: 'inherit' });
  } else {
    console.log('  [2/6] Skipping type-check (--skip-typecheck)');
  }

  // ── Step 3: Bundle CLI with esbuild ────────────────────────────────────────
  console.log('  [3/6] Bundling CLI with esbuild...');
  
  // Cross-platform directory removal and replacement
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }

  // Execute the project's native esbuild configurations via Node
  execSync('node --input-type=module -e "import esbuild from \'esbuild\'; import config from \'./esbuild.config.mjs\'; await esbuild.build(config);"', { 
    cwd: CLI_DIR, 
    stdio: 'inherit' 
  });

  // Windows file permission safety layer
  const indexJsPath = path.join(DIST_DIR, 'index.js');
  if (process.platform !== 'win32') {
    fs.chmodSync(indexJsPath, 0o755); // chmod +x equivalent on unix targets
  }

  // ── Step 4: Validate bundled entrypoint syntax ─────────────────────────────
  console.log('  [4/6] Verifying bundled entrypoint syntax...');
  execSync(`node --check "${indexJsPath}"`, { stdio: 'inherit' });

  // ── Step 5: Back up dev package.json, generate publishable one ─────────────
  console.log('  [5/6] Generating publishable package.json...');
  fs.copyFileSync(path.join(CLI_DIR, 'package.json'), path.join(CLI_DIR, 'package.dev.json'));
  
  execSync(`node "${path.join(REPO_ROOT, 'scripts/generate-npm-package-json.mjs')}"`, { stdio: 'inherit' });

  // Copy root README so npm shows the repo README on the package page
  fs.copyFileSync(path.join(REPO_ROOT, 'README.md'), path.join(CLI_DIR, 'README.md'));

  // ── Step 6: Summary ────────────────────────────────────────────────────────
  const stats = fs.statSync(indexJsPath);
  const BUNDLE_SIZE = stats.size;

  console.log('  [6/6] Build verification...');
  console.log('\nBuild complete.');
  console.log(`  Bundle: cli/dist/index.js (${BUNDLE_SIZE} bytes)`);
  console.log('  Source map: cli/dist/index.js.map\n');
  console.log('To preview:   cd cli && npm pack --dry-run');
  console.log('To publish:   cd cli && npm publish --access public');
  console.log('To restore:   node -e "import fs from \'fs\'; fs.renameSync(\'cli/package.dev.json\', \'cli/package.json\')"');

} catch (error) {
  console.error('\n❌ Build script failed execution.');
  process.exit(1);
}
