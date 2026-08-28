# webtwa — Web-to-Android PWA Toolkit

A general-purpose, reusable toolkit for turning **any** website's PWA into a
signed Android App Bundle (`.aab`) ready for Google Play — built directly on
Google's real open-source [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
library (`@bubblewrap/core` + `@bubblewrap/cli`, pulled from npm, not vendored
or forked), with:

- **Multi-site profiles** — one JSON file per website you own, so you can
  build TWAs for as many sites as you like from the same project.
- **Play Store compliance patch** — defensively guarantees `targetSdkVersion
  36` regardless of which Bubblewrap version you have installed.
- **Full CLI pipeline** — init → build → sign → verify → assetlinks, each
  independently runnable or chained.
- **No dependency on pwabuilder.com** — everything runs locally, driven by
  Bubblewrap's programmatic API, so it keeps working even if a third-party
  website changes or goes down.

👉 **Start here: [`RUN.md`](./RUN.md)** — the full command reference for
setup, building, signing, and publishing.

Repo: https://github.com/Amaan9136/web-to-androidtwa

## Project layout

```
webtwa/
├── RUN.md                 ← full command reference (start here)
├── PROMPT.md               ← AI-assistant prompt to walk a user through setup
├── package.json
├── .env.example            ← keystore password env vars template
├── lib/                     ← shared helpers (args, profile loader, shell)
├── scripts/                 ← every CLI command (init, build, sign, verify, ...)
├── profiles/
│   └── example.json         ← template for any new site
├── keystores/                ← your .jks files live here (gitignored)
└── output/                    ← generated Android projects + build artifacts (gitignored)
```

## Quick start

```bash
npm install
npm run doctor
cp profiles/example.json profiles/myapp.json   # edit it for your site
npm run sign -- --profile myapp --generate-key
npm run build -- --profile myapp
npm run sign -- --profile myapp
npm run verify -- --profile myapp
```

Full details, flags, and troubleshooting: see [`RUN.md`](./RUN.md).