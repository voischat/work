## Release

Bump the version, build the app, archive `dist`, and upload the archive to the
internal release repository named by `GH_REPO_RELEASES`:

```sh
pnpm run pack
```

The archive is written to `pkg/weila-work-web_<version>.tar.gz` and uploaded as
the asset of release `v<version>`. Upload needs `gh` authenticated with write
access to that repository, or a `GH_TOKEN` that has it.
