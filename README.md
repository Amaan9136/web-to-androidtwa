# webtwa — Web-to-Android PWA Toolkit

A general-purpose, reusable toolkit for turning **any** website's PWA into a
signed Android App Bundle (`.aab`) ready for Google Play — built directly on
Google's real open-source [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
library (`@bubblewrap/core` + `@bubblewrap/cli`, pulled from npm, not vendored
or forked), with:

- **Multi-site profiles** — one JSON file per website you own, so you can
  build TWAs for Seeze *and* any future site from the same project.
- **Play Store compliance patch** — defensively guarantees `targetSdkVersion
  36` regardless of which Bubblewrap version you have installed.
- **Full CLI pipeline** — init → build → sign → verify → assetlinks, each
  independently runnable or chained.
- **No dependency on pwabuilder.com** — everything runs locally, driven by
  Bubblewrap's programmatic API, so it keeps working even if a third-party
  website changes or goes down.

👉 **Start here: [`RUN.md`](./RUN.md)** — the full command reference for
setup, building, signing, and publishing.

## Project layout

```
webtwa/
├── RUN.md                 ← full command reference (start here)
├── package.json
├── .env.example            ← keystore password env vars template
├── lib/                     ← shared helpers (args, profile loader, shell)
├── scripts/                 ← every CLI command (init, build, sign, verify, ...)
├── profiles/
│   ├── example.json         ← template for any new site
│   └── seeze.json           ← pre-configured profile for seeze.automatech.live
├── keystores/                ← your .jks files live here (gitignored)
└── output/                    ← generated Android projects + build artifacts (gitignored)
```

## Quick start

```bash
npm install
npm run doctor
npm run sign -- --profile seeze --generate-key
npm run build -- --profile seeze
npm run sign -- --profile seeze
npm run verify -- --profile seeze
```

Full details, flags, and troubleshooting: see [`RUN.md`](./RUN.md).
