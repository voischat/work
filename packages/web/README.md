## Release

Bump the version, build the app, archive `dist`, and upload the archive to the
[weila-work-releases](https://github.com/kvoon9/weila-work-releases) repo:

```sh
pnpm run pack
```

The archive is written to `pkg/weila-work-web_<version>.tar.gz` and uploaded as
the asset of release `v<version>`. Upload needs `gh` authenticated with write
access to `kvoon9/weila-work-releases`, or a `GH_TOKEN` that has it.
