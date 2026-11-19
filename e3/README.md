# Clover Store · E3 foundation

A separate rebuild of Clover Store on Woods Studio E3 Core 0.1. The public web deployment is controlled separately through the GitHub deployment setting.

This project includes a new interface, runtime, design system, structured content engine, offline snapshots and Android message-port host. It does not load the previous application screen framework or JavaScript bridge. Existing app/developer/review records are preserved; personal data is migrated without deleting its source.

See [E3 Core](docs/E3-CORE.md) for the component contracts, delivered features and remaining work. This is a foundation preview, not a production 2.0 release or a finished implementation of every proposed feature.

## Run and check

Run `node --test tests/*.test.mjs` from this directory. Serve `index.html` and the `runtime`, `ui` and `content` directories using a normal HTTPS/static development host. There is no Node dependency installation or frontend framework build step.

Run `python3 e3/android/build.py --check` from the repository root to check the shared runtime and Android source contracts without building a package. This check requires Python and Node.js.

Android packaging also requires JDK 21, SDK platform 36, build-tools 35.0.0 and bundletool 1.18.2. Set `JAVA_HOME` and `ANDROID_HOME` or pass `--java-home` and `--sdk`. Use `--bundletool` for a local bundletool JAR. A separate build command without `--check` produces an unsigned AAB. Use the existing Clover Store signing identity for an in-place update.

The adaptive launcher icon and the Android storefront use the same PNG under `android/res/drawable-nodpi/`. For device validation, check the launcher artwork, launch and offline catalogue, existing-install data migration, notification permission, and the download and install confirmation flows.

## Editing public content

- Existing catalogue records remain in the repository root JSON documents.
- `content/app-metadata.json` adds attributed E3-specific facts keyed by listing ID. The five publisher declarations default to `n/a` for each listed app. The snapshot generator supplies the same defaults for newly listed apps.
- `content/editorial.json` contains editorial collections using existing listing IDs.
- `content/layout.json` selects supported Discover components.
- `content/themes.json` contains validated theme colours and modes.
- `content/trust.json` contains public verification keys only. It is currently unconfigured.

The snapshot generator gathers the root documents into one E3 feed. Signed content delivery additionally requires a configured publishing key and channel. App code and platform capabilities ship through an app release.

## Publisher declarations

Use **Settings → Publisher declarations** in E3 to export a Yes / No / N/A draft alongside a listing submission. For a new listing, add its app ID to `registry.json` before approving its declarations. A repository maintainer reviews the publisher and applies the draft with:

```sh
python3 e3/scripts/approve-declarations.py path/to/declarations.json
```

Review and commit the resulting `e3/content/app-metadata.json` change. The main-branch snapshot workflow republishes the declarations with the catalogue, and clients check the feed every 30 seconds while visible. `n/a` does not count as evidence for a preference filter.

## EdgeOne cutover

Publish `edgeone/index.html` as the existing EdgeOne project's root `index.html` once. This launcher shows the upgrade notice immediately and checks `web/deployment.json` on GitHub before loading any storefront code.

- Keep `{"tag":"under-upgrades"}` while the public storefront is closed.
- After validating and merging the E3 source, use `{"tag":"","storefront":"e3"}` to open E3 from `main`.
- Set a non-empty tag or branch with `"storefront":"e3"` to load another E3 revision. The launcher resolves it to a commit and loads that commit's CSS and ES modules through jsDelivr.
- Restore `{"tag":"under-upgrades"}` to close the public storefront again. Visitors pick up the change on reload.

For local preview, serve the E3 directory and open its top-level `index.html`. The public launcher and local E3 preview use different entry points. The Android build uses its own icon source independently of the public web storefront.
