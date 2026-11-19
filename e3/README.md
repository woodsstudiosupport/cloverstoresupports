# Clover Store · E3 foundation

A separate rebuild of Clover Store on Woods Studio E3 Core 0.1. The working 1.7 application and the existing public catalogue are not replaced by this branch.

This project includes a new interface, runtime, design system, structured content engine, offline snapshots and Android message-port host. It does not load the previous application screen framework or JavaScript bridge. Existing app/developer/review records are preserved; personal data is migrated without deleting its source.

See [E3 Core](docs/E3-CORE.md) for the component contracts, delivered features and remaining work. This is a foundation preview, not a production 2.0 release or a finished implementation of every proposed feature.

## Run and check

Run `node --test tests/*.test.mjs` from this directory. Serve `index.html` and the `runtime`, `ui` and `content` directories using a normal HTTPS/static development host. There is no Node dependency installation or frontend framework build step.

Android build requirements: JDK 21, SDK platform 36, build-tools 35.0.0 and bundletool 1.18.2. Configure their locations near the top of `android/build.py`, then run `python3 android/build.py`. The output is an unsigned `CloverStore-2.0-E3-foundation-unsigned.aab`. Sign only for testing with the appropriate existing upload key. No production signing keys or credentials are included.

## Editing public content

- Existing catalogue records remain in the repository root JSON documents.
- `content/app-metadata.json` adds attributed E3-specific facts keyed by listing ID. It starts empty so no privacy, pricing or compatibility claims are fabricated.
- `content/editorial.json` contains editorial collections using existing listing IDs.
- `content/layout.json` selects supported Discover components.
- `content/themes.json` contains validated theme colours and modes.
- `content/trust.json` contains public verification keys only. It is currently unconfigured.

The snapshot generator gathers the root documents into one E3 feed. Signed content delivery additionally requires a configured publishing key and channel. App code and platform capabilities ship through an app release.
