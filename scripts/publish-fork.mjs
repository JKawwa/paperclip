#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, cpSync, rmSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const FORK_SCOPE = '@jkawwa';
const FORK_PREFIX = 'paperclipai-';
const DIST_ROOT = join(REPO_ROOT, 'dist');
const STAGING_ROOT = join(DIST_ROOT, 'fork-staging');
const TARBALL_DIR = join(DIST_ROOT, 'tarballs');

const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'scripts/release-package-manifest.json'), 'utf8'));

const args = process.argv.slice(2);
const FORK_VERSION = args.find(a => !a.startsWith('--'));
const skipBuild = args.includes('--skip-build');
const doPublish = args.includes('--publish');
const forcePublish = args.includes('--force');
const otpIndex = args.indexOf('--otp');
const otp = otpIndex >= 0 ? args[otpIndex + 1] : null;

if (!FORK_VERSION) {
  console.error('Usage: node scripts/publish-fork.mjs <fork-version> [--skip-build] [--publish] [--force] [--otp <code>]');
  console.error('');
  console.error('Default behavior: build (if needed), copy, rewrite scope, and npm pack.');
  console.error('Output: .fork-publish/tarballs/*.tgz');
  process.exit(1);
}

const packages = manifest.map(entry => ({
  ...entry,
  pkg: JSON.parse(readFileSync(join(REPO_ROOT, entry.dir, 'package.json'), 'utf8'))
}));

function topoSort(packages) {
  const byName = new Map(packages.map(p => [p.name, p]));
  const visited = new Set();
  const result = [];

  function visit(pkg) {
    if (visited.has(pkg.name)) return;
    visited.add(pkg.name);
    const deps = { ...pkg.pkg.dependencies, ...pkg.pkg.devDependencies };
    for (const depName of Object.keys(deps)) {
      const dep = byName.get(depName);
      if (dep) visit(dep);
    }
    result.push(pkg);
  }

  for (const pkg of packages) visit(pkg);
  return result;
}

const ordered = topoSort(packages);

console.log(`Fork publish: ${ordered.length} packages as ${FORK_SCOPE}/${FORK_PREFIX}*, version ${FORK_VERSION}\n`);

// ── Build step ──
if (!skipBuild) {
  for (const entry of ordered) {
    const buildScript = entry.pkg.scripts?.build;
    if (!buildScript) {
      console.log(`  ${entry.name}: no build script, skipping.`);
      continue;
    }

    console.log(`==> Building ${entry.name}...`);
    if (entry.name === 'paperclipai') {
      const cliDir = join(REPO_ROOT, 'cli');
      execSync(
        `node --input-type=module -e "import esbuild from 'esbuild'; import config from './esbuild.config.mjs'; await esbuild.build(config);"`,
        { cwd: cliDir, stdio: 'inherit' }
      );
    } else {
      execSync(`pnpm --filter "${entry.name}" build`, { cwd: REPO_ROOT, stdio: 'inherit' });
    }
  }
} else {
  console.log('Build step skipped (--skip-build).\n');
}

// ── Stage + rewrite + pack ──
function rewriteScopeInFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const updated = content.replace(/@paperclipai\//g, `${FORK_SCOPE}/${FORK_PREFIX}`);
  if (content !== updated) {
    writeFileSync(filePath, updated);
    return true;
  }
  return false;
}

function collectPublishFiles(pkgDir) {
  const absDir = join(REPO_ROOT, pkgDir);
  const pkgJson = JSON.parse(readFileSync(join(absDir, 'package.json'), 'utf8'));
  const filePatterns = pkgJson.publishConfig?.files ?? pkgJson.files ?? ['dist'];
  const files = [];

  files.push('package.json');
  for (const f of ['README.md', 'LICENSE']) {
    if (existsSync(join(absDir, f))) files.push(f);
  }
  for (const pattern of filePatterns) {
    if (!pattern.includes('*') && existsSync(join(absDir, pattern))) {
      files.push(pattern);
    }
  }
  return files;
}

function walkDir(dir) {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      count += walkDir(fullPath);
    } else if (/\.(js|mjs|cjs|d\.ts)$/.test(entry.name)) {
      if (rewriteScopeInFile(fullPath)) count++;
    }
  }
  return count;
}

if (existsSync(STAGING_ROOT)) rmSync(STAGING_ROOT, { recursive: true, force: true });
mkdirSync(TARBALL_DIR, { recursive: true });

for (const entry of ordered) {
  const { dir: pkgDir, name: origName } = entry;
  const absDir = join(REPO_ROOT, pkgDir);
  const stagingDir = join(STAGING_ROOT, pkgDir);

  console.log(`\n==> ${origName}`);

  // For server: prepare ui-dist/ before staging
  if (origName === '@paperclipai/server') {
    console.log('  Preparing ui-dist...');
    execSync(`node "${join(REPO_ROOT, 'scripts/prepare-server-ui-dist.mjs')}"`, {
      cwd: absDir, stdio: 'inherit', env: { ...process.env }
    });
  }

  // Stage files
  const filesToPublish = collectPublishFiles(pkgDir);
  mkdirSync(stagingDir, { recursive: true });
  for (const file of filesToPublish) {
    const src = join(absDir, file);
    const dest = join(stagingDir, file);
    if (existsSync(src)) cpSync(src, dest, { recursive: true });
  }

  // Rewrite package.json
  const stagingPkg = JSON.parse(readFileSync(join(stagingDir, 'package.json'), 'utf8'));

  if (origName.startsWith('@paperclipai/')) {
    const base = origName.replace('@paperclipai/', '');
    stagingPkg.name = `${FORK_SCOPE}/${FORK_PREFIX}${base}`;
  } else if (origName === 'paperclipai') {
    stagingPkg.name = `${FORK_SCOPE}/paperclipai`;
  }
  stagingPkg.version = FORK_VERSION;

  const hadPluginSdkDep = stagingPkg.dependencies?.['@paperclipai/plugin-sdk'] ||
    stagingPkg.dependencies?.['@paperclipai/shared'];
  const hadPluginSdkPeerDep = stagingPkg.peerDependencies?.['@paperclipai/plugin-sdk'] ||
    stagingPkg.peerDependencies?.['@paperclipai/shared'];

  for (const depType of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    const deps = stagingPkg[depType];
    if (!deps) continue;
    for (const [depName, depVer] of Object.entries(deps)) {
      if (depName.startsWith('@paperclipai/')) {
        const base = depName.replace('@paperclipai/', '');
        const newName = `${FORK_SCOPE}/${FORK_PREFIX}${base}`;
        delete deps[depName];
        deps[newName] = depVer.startsWith('workspace:') ? FORK_VERSION : depVer;
      }
    }
  }

  // Inject reverse npm aliases so non-forked plugins (which import from
  // @paperclipai/plugin-sdk and @paperclipai/shared) resolve correctly.
  // Only needed on packages that are top-level installs (CLI, server) or
  // that already peer-depended on the SDK packages (plugin-sdk, shared).
  const needsReverseAliases =
    origName === 'paperclipai' ||
    origName === '@paperclipai/server' ||
    origName === '@paperclipai/plugin-sdk' ||
    origName === '@paperclipai/shared' ||
    hadPluginSdkDep ||
    hadPluginSdkPeerDep;

  if (needsReverseAliases) {
    const revAliases = {};
    // CLI and server always get both aliases — they're the host runtime that
    // plugins resolve @paperclipai/plugin-sdk and @paperclipai/shared against.
    // Other packages only get aliases for SDK packages they directly depend on.
    const isHost = origName === 'paperclipai' || origName === '@paperclipai/server';
    if (isHost) {
      revAliases['@paperclipai/plugin-sdk'] = `npm:${FORK_SCOPE}/${FORK_PREFIX}plugin-sdk@${FORK_VERSION}`;
      revAliases['@paperclipai/shared'] = `npm:${FORK_SCOPE}/${FORK_PREFIX}shared@${FORK_VERSION}`;
    } else {
      const reverseMap = {
        [`${FORK_SCOPE}/${FORK_PREFIX}plugin-sdk`]: '@paperclipai/plugin-sdk',
        [`${FORK_SCOPE}/${FORK_PREFIX}shared`]: '@paperclipai/shared',
      };
      for (const [forkName, upstreamName] of Object.entries(reverseMap)) {
        const alreadyDep = stagingPkg.dependencies?.[forkName];
        const alreadyPeer = stagingPkg.peerDependencies?.[forkName];
        if (alreadyDep || alreadyPeer) {
          revAliases[upstreamName] = `npm:${forkName}@${FORK_VERSION}`;
        }
      }
    }
    if (Object.keys(revAliases).length > 0) {
      stagingPkg.dependencies ??= {};
      Object.assign(stagingPkg.dependencies, revAliases);
      console.log(`  Added reverse aliases: ${Object.keys(revAliases).join(', ')}`);
    }
  }

  // Strip lifecycle scripts that reference monorepo-relative paths
  if (stagingPkg.scripts) {
    const lifecycleHooks = ['prepack', 'postpack', 'prepare', 'prepare:ui-dist', 'prepublish', 'postinstall'];
    for (const hook of lifecycleHooks) {
      delete stagingPkg.scripts[hook];
    }
    // Strip any script whose body contains a relative path pointing outside the package
    for (const [name, body] of Object.entries(stagingPkg.scripts)) {
      if (typeof body === 'string' && body.includes('../')) {
        delete stagingPkg.scripts[name];
      }
    }
    if (Object.keys(stagingPkg.scripts).length === 0) {
      delete stagingPkg.scripts;
    }
  }

  // Promote publishConfig fields to root (npm pack doesn't read publishConfig.exports etc.)
  if (stagingPkg.publishConfig) {
    const { access, registry, tag, ...overrides } = stagingPkg.publishConfig;
    Object.assign(stagingPkg, overrides);
    stagingPkg.publishConfig = { access };
    if (registry) stagingPkg.publishConfig.registry = registry;
    if (tag) stagingPkg.publishConfig.tag = tag;
  }

  writeFileSync(join(stagingDir, 'package.json'), JSON.stringify(stagingPkg, null, 2) + '\n');

  // Rewrite scope in compiled files
  const distDir = join(stagingDir, 'dist');
  if (existsSync(distDir)) {
    const count = walkDir(distDir);
    if (count > 0) console.log(`  Rewrote ${count} compiled files`);
  }

  // Pack
  if (doPublish) {
    const publishArgs = ['publish', '--access', 'public'];
    if (otp) publishArgs.push('--otp', otp);
    if (forcePublish) publishArgs.push('--force');
    console.log(`  Publishing...`);
    execSync(`npm ${publishArgs.join(' ')}`, { cwd: stagingDir, stdio: 'inherit' });
    console.log(`  ✓ Published`);
  } else {
    const result = execSync('npm pack', { cwd: stagingDir, encoding: 'utf8' });
    const tarball = result.trim();
    const tarballPath = join(stagingDir, tarball);
    if (existsSync(tarballPath)) {
      renameSync(tarballPath, join(TARBALL_DIR, tarball));
      console.log(`  ✓ Packed: ${tarball}`);
    }
  }

  // Clean up server/ui-dist if it was created
  if (origName.startsWith('@paperclipai/') && origName.includes('server')) {
    const serverUiDist = join(absDir, 'ui-dist');
    if (existsSync(serverUiDist)) rmSync(serverUiDist, { recursive: true, force: true });
  }
}

if (!doPublish) {
  console.log(`\nAll tarballs in ${TARBALL_DIR}:`);
  for (const f of readdirSync(TARBALL_DIR).sort()) {
    const stat = readFileSync ? '  ' + f : '';
    console.log(`  ${f}`);
  }
  console.log(`\nTo publish to npm: node scripts/publish-fork.mjs ${FORK_VERSION} --publish [--otp <code>]`);
}

// Keep staging dir around so user can inspect if needed
console.log(`\nStaging dir: ${STAGING_ROOT} (delete manually when done)`);
