#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const packageJsonPath = resolve(repoRoot, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

const args = new Map(
  process.argv.slice(2).map(arg => {
    const [key, value = ''] = arg.split('=');
    return [key, value];
  }),
);

const mode = args.get('--mode') || process.env.MASTRA_DEP_MODE || 'local';
const githubRepo = args.get('--repo') || process.env.MASTRA_GITHUB_REPO || 'chiqors/mastra';
const releaseTag = args.get('--tag') || process.env.MASTRA_RELEASE_TAG || '';
const localPackDir = args.get('--local-dir') || process.env.MASTRA_LOCAL_PACK_DIR || '.local-packs';
const coreVersion = args.get('--core-version') || process.env.MASTRA_CORE_VERSION || '1.48.0';
const cliVersion = args.get('--cli-version') || process.env.MASTRA_CLI_VERSION || '1.17.0';
const manifestPath = resolve(repoRoot, localPackDir, 'mastra-fork-manifest.json');

function setDep(section, name, value) {
  packageJson[section] ||= {};
  packageJson[section][name] = value;
}

function latestMatchingFile(prefix) {
  const dir = resolve(repoRoot, localPackDir);
  const candidates = readdirSync(dir)
    .filter(name => name.startsWith(prefix) && name.endsWith('.tgz'))
    .sort()
    .reverse();

  return candidates[0] || null;
}

function resolveLocalPackageFiles() {
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const mastraFile = manifest?.packages?.mastra;
    const coreFile = manifest?.packages?.['@mastra/core'];

    if (mastraFile && coreFile) {
      return { mastraFile, coreFile, manifestCommit: manifest.commit || null };
    }
  }

  return {
    mastraFile: latestMatchingFile(`mastra-${cliVersion}-`),
    coreFile: latestMatchingFile(`mastra-core-${coreVersion}-`),
    manifestCommit: null,
  };
}

async function resolveReleasePackageFiles() {
  const apiUrl = `https://api.github.com/repos/${githubRepo}/releases/tags/${releaseTag}`;
  const response = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });

  if (!response.ok) {
    console.error(`Failed to load GitHub release metadata: ${apiUrl}`);
    console.error(`HTTP ${response.status} ${response.statusText}`);
    process.exit(1);
  }

  const release = await response.json();
  const assets = Array.isArray(release.assets) ? release.assets : [];

  const findBestAsset = prefix => {
    const matches = assets
      .filter(asset => typeof asset?.name === 'string' && asset.name.startsWith(prefix) && asset.name.endsWith('.tgz'))
      .sort((a, b) => {
        const aStatic = a.name === `${prefix}.tgz`;
        const bStatic = b.name === `${prefix}.tgz`;
        if (aStatic !== bStatic) {
          return aStatic ? 1 : -1;
        }

        const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
        return bTime - aTime;
      });

    return matches[0] || null;
  };

  const mastraAsset = findBestAsset(`mastra-${cliVersion}`);
  const coreAsset = findBestAsset(`mastra-core-${coreVersion}`);

  if (!mastraAsset || !coreAsset) {
    console.error(`Unable to find release tarballs for tag ${releaseTag} in ${githubRepo}.`);
    console.error(
      `Expected assets starting with mastra-${cliVersion} and mastra-core-${coreVersion}. Available assets:`,
    );
    for (const asset of assets) {
      console.error(`- ${asset.name}`);
    }
    process.exit(1);
  }

  return {
    mastraUrl: mastraAsset.browser_download_url,
    coreUrl: coreAsset.browser_download_url,
    mastraName: mastraAsset.name,
    coreName: coreAsset.name,
  };
}

if (mode === 'local') {
  const { mastraFile, coreFile, manifestCommit } = resolveLocalPackageFiles();

  if (!mastraFile || !coreFile) {
    console.error(
      `Missing local fork tarballs in ${resolve(repoRoot, localPackDir)}. Run bun run mastra:release-fork first.`,
    );
    process.exit(1);
  }

  setDep('dependencies', '@mastra/core', `file:${localPackDir}/${coreFile}`);
  setDep('devDependencies', 'mastra', `file:${localPackDir}/${mastraFile}`);

  if (manifestCommit) {
    console.log(`Using local fork tarballs from commit: ${manifestCommit}`);
  }
} else if (mode === 'release') {
  if (!releaseTag) {
    console.error('release mode requires --tag=<release-tag> or MASTRA_RELEASE_TAG');
    process.exit(1);
  }

  const { mastraUrl, coreUrl, mastraName, coreName } = await resolveReleasePackageFiles();
  setDep('dependencies', '@mastra/core', coreUrl);
  setDep('devDependencies', 'mastra', mastraUrl);
  console.log(`Using release asset for mastra: ${mastraName}`);
  console.log(`Using release asset for @mastra/core: ${coreName}`);
} else {
  console.error(`Unknown mode: ${mode}`);
  process.exit(1);
}

writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

console.log(`Updated Mastra dependencies in ${packageJsonPath}`);
console.log(`Mode: ${mode}`);
if (mode === 'release') {
  console.log(`Release tag: ${releaseTag}`);
}
