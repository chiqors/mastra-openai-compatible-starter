#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const repoRoot = resolve(process.cwd());
const mastraRepo = resolve(process.env.MASTRA_FORK_DIR || '../mastra');
const outputDir = resolve(process.env.MASTRA_RELEASE_OUTPUT_DIR || join(repoRoot, '.local-packs'));
const releaseTag =
  process.env.MASTRA_RELEASE_TAG ||
  process.argv.find(arg => arg.startsWith('--tag='))?.slice('--tag='.length) ||
  null;
const upload = process.env.MASTRA_RELEASE_UPLOAD === '1' || process.argv.includes('--upload');
const githubRepo = process.env.MASTRA_GITHUB_REPO || 'chiqors/mastra';

const packagesToPack = [
  { filter: './packages/core', baseFilename: 'mastra-core-1.48.0' },
  { filter: './packages/cli', baseFilename: 'mastra-1.17.0' },
];

function canRun(command, args = []) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: process.env,
  });

  return !result.error;
}

function detectPnpmCommand() {
  const candidates = [
    process.env.PNPM_BIN,
    process.env.npm_execpath?.includes('pnpm') ? process.env.npm_execpath : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate) && canRun(candidate, ['--version'])) {
      return [candidate, []];
    }
  }

  const whichResult = spawnSync('bash', ['-lc', 'command -v pnpm'], {
    encoding: 'utf8',
    env: process.env,
  });

  if (whichResult.status === 0) {
    const resolved = whichResult.stdout.trim();
    if (resolved && canRun(resolved, ['--version'])) {
      return [resolved, []];
    }
  }

  if (canRun('pnpm', ['--version'])) {
    return ['pnpm', []];
  }

  if (canRun('corepack', ['pnpm', '--version'])) {
    return ['corepack', ['pnpm']];
  }

  if (canRun('bun', ['x', 'pnpm', '--version'])) {
    return ['bun', ['x', 'pnpm']];
  }

  console.error(
    'Unable to find a working pnpm command. Install pnpm, enable Corepack, or make sure `bun x pnpm` is available before running mastra:release-fork.',
  );
  process.exit(1);
}

const [pnpmCommand, pnpmPrefixArgs] = detectPnpmCommand();

function shortHashForFile(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex').slice(0, 10);
}

function run(command, args, cwd, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });

  if (result.error) {
    console.error(`\nCommand failed to start: ${command} ${args.join(' ')}`);
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\nCommand failed: ${command} ${args.join(' ')}`);
    process.exit(result.status ?? 1);
  }
}

function runCapture(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 50 * 1024 * 1024,
  });

  if (result.error) {
    console.error(`\nCommand failed to start: ${command} ${args.join(' ')}`);
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\nCommand failed: ${command} ${args.join(' ')}`);
    if (result.stdout) {
      process.stderr.write(result.stdout);
    }
    process.stderr.write(result.stderr || '');
    process.exit(result.status ?? 1);
  }

  return result.stdout.trim();
}

if (!existsSync(mastraRepo)) {
  console.error(`Mastra fork directory not found: ${mastraRepo}`);
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });

const currentBranch = runCapture('git', ['branch', '--show-current'], mastraRepo);
const currentCommit = runCapture('git', ['rev-parse', '--short', 'HEAD'], mastraRepo);

console.log(`Packing fork from ${mastraRepo}`);
console.log(`Branch: ${currentBranch}`);
console.log(`Commit: ${currentCommit}`);
console.log(`pnpm: ${[pnpmCommand, ...pnpmPrefixArgs].join(' ')}`);

console.log('\nBuilding fork packages needed for Studio...');
run(pnpmCommand, [...pnpmPrefixArgs, '--filter', './packages/core', 'build:lib'], mastraRepo);
run(pnpmCommand, [...pnpmPrefixArgs, '--filter', '@internal/playground', 'build'], mastraRepo);
run(pnpmCommand, [...pnpmPrefixArgs, '--filter', './packages/cli', 'build:lib'], mastraRepo);

const packagedFiles = [];

for (const { filter, baseFilename } of packagesToPack) {
  run(pnpmCommand, [...pnpmPrefixArgs, '--filter', filter, 'pack', '--pack-destination', outputDir], mastraRepo);

  const originalFile = join(outputDir, `${baseFilename}.tgz`);

  if (!existsSync(originalFile)) {
    console.error(`Expected tarball not found after packing: ${originalFile}`);
    process.exit(1);
  }

  const contentHash = shortHashForFile(originalFile);
  const versionedFile = join(outputDir, `${baseFilename}-${currentCommit}-${contentHash}.tgz`);
  renameSync(originalFile, versionedFile);
  packagedFiles.push({ baseFilename, filename: `${baseFilename}-${currentCommit}-${contentHash}.tgz` });
}

const tarballs = packagedFiles
  .map(({ filename }) => {
    const file = join(outputDir, filename);
    if (!existsSync(file)) {
      console.error(`Expected tarball not found: ${file}`);
      process.exit(1);
    }
    return file;
  })
  .filter(Boolean);

console.log('\nPacked tarballs:');
for (const tarball of tarballs) {
  console.log(`- ${tarball}`);
}

const manifest = {
  branch: currentBranch,
  commit: currentCommit,
  generatedAt: new Date().toISOString(),
  packages: {
    mastra: packagedFiles.find(pkg => pkg.baseFilename === 'mastra-1.17.0')?.filename,
    '@mastra/core': packagedFiles.find(pkg => pkg.baseFilename === 'mastra-core-1.48.0')?.filename,
  },
};

const manifestPath = join(outputDir, 'mastra-fork-manifest.json');
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Manifest: ${manifestPath}`);

if (!upload) {
  console.log('\nSkipping GitHub release upload. Re-run with --upload and MASTRA_RELEASE_TAG=<tag> to upload.');
  process.exit(0);
}

if (!releaseTag) {
  console.error('Release upload requested, but no tag was provided. Set MASTRA_RELEASE_TAG or pass --tag=<tag>.');
  process.exit(1);
}

const releaseView = spawnSync('gh', ['release', 'view', releaseTag, '--repo', githubRepo], {
  cwd: mastraRepo,
  encoding: 'utf8',
  env: process.env,
});

if (releaseView.status !== 0) {
  run(
    'gh',
    [
      'release',
      'create',
      releaseTag,
      '--repo',
      githubRepo,
      '--target',
      currentBranch,
      '--title',
      releaseTag,
      '--notes',
      `Fork build from ${currentBranch} (${currentCommit}).`,
    ],
    mastraRepo,
  );
}

run('gh', ['release', 'upload', releaseTag, '--repo', githubRepo, '--clobber', ...tarballs], mastraRepo);

console.log(`\nUploaded assets to https://github.com/${githubRepo}/releases/tag/${releaseTag}`);
