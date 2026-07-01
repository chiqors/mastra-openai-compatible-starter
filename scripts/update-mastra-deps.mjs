#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
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

function setDep(section, name, value) {
  packageJson[section] ||= {};
  packageJson[section][name] = value;
}

if (mode === 'local') {
  setDep('dependencies', '@mastra/core', `file:${localPackDir}/mastra-core-${coreVersion}.tgz`);
  setDep('devDependencies', 'mastra', `file:${localPackDir}/mastra-${cliVersion}.tgz`);
} else if (mode === 'release') {
  if (!releaseTag) {
    console.error('release mode requires --tag=<release-tag> or MASTRA_RELEASE_TAG');
    process.exit(1);
  }

  const baseUrl = `https://github.com/${githubRepo}/releases/download/${releaseTag}`;
  setDep('dependencies', '@mastra/core', `${baseUrl}/mastra-core-${coreVersion}.tgz`);
  setDep('devDependencies', 'mastra', `${baseUrl}/mastra-${cliVersion}.tgz`);
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
