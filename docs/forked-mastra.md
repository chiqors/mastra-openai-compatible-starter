# Using the Forked Mastra Repo

This starter can use fork-built Mastra tarballs from either:

- local `.tgz` files in `.local-packs`
- GitHub release assets from your Mastra fork

The fork is used here to accommodate fixes for custom OpenAI endpoint support, plus some system and Studio UI improvements.

## Local fork workflow

By default, the helper script reads from `../mastra`:

```sh
bun run mastra:release-fork
```

This packs fresh tarballs into `.local-packs`.

The local pack helper:

- rebuilds the Studio bundle before packing
- writes content-hashed tarball filenames so Bun does not reuse stale local packages
- writes `.local-packs/mastra-fork-manifest.json` so `mastra:deps:local` can resolve the newest files automatically

If your fork lives somewhere else:

```sh
MASTRA_FORK_DIR=/absolute/path/to/mastra bun run mastra:release-fork
```

Then point this starter back to local tarballs:

```sh
bun run mastra:deps:local
bun install
```

## GitHub release workflow

To upload packed tarballs to your fork's GitHub release assets:

```sh
MASTRA_RELEASE_TAG=fix-composer-model-picker-hydration \
MASTRA_GITHUB_REPO=chiqors/mastra \
bun run mastra:release-fork -- --upload
```

That creates or updates a release and uploads:

- `mastra-<version>-<commit>-<hash>.tgz`
- `mastra-core-<version>-<commit>-<hash>.tgz`

These hashed asset names prevent stale package reuse and let the starter install the exact fork build you published.

After uploading release assets:

```sh
MASTRA_RELEASE_TAG=fix-composer-model-picker-hydration \
MASTRA_GITHUB_REPO=chiqors/mastra \
bun run mastra:deps:release

bun install
```

The release helper resolves actual asset names from GitHub release metadata so it can safely pick the newest hashed tarballs.

## Updating to newer fork code

When your fork branch changes:

1. Sync or rebuild the fork in `../mastra`
2. Run:

```sh
bun run mastra:release-fork
bun run mastra:deps:local
bun install
```

Or, if you use GitHub release assets:

```sh
MASTRA_RELEASE_TAG=<new-tag> \
MASTRA_GITHUB_REPO=<owner>/<repo> \
bun run mastra:deps:release
bun install
```

If you reuse the same release tag, rerun both commands after uploading updated assets so `package.json` and `bun.lock` point at the latest tarballs for that tag.

## Verification

After switching dependencies, a quick validation step is:

```sh
bun run build
```
