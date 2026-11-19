# Woods Studio E3 Core 0.1

E3 is a new shared application runtime and design system. Clover Store is its first reference application. This source is a foundation preview for the larger 2.0 rebuild, not a declaration that every proposed service is deployed.

## Separation from the previous application

The new build ships only `assets/e3/`. There are no imports of the old renderer, stylesheets, global UI functions or `CloverAndroid` interface. The new ES-module runtime owns routing, components, state, caching and rendering. Android connects through a versioned WebMessagePort protocol. Independent Android download/installer logic is retained as a platform service, with user confirmation, checksum checks and package/signature safeguards. Retaining those platform checks is not retaining the old UI framework.

The package remains `com.woodsstudio.clover.apps`. The preview is `2.0-e3.1`, code `200001`. Signing must use the same identity as the existing release to update it. This preview is not ready for production rollout.

## Components

| Module | Contract |
| --- | --- |
| `catalogue.mjs` | Snapshot validation, normalised downloads, evidence-aware filters, comparison facts and portable app lists. |
| `content.mjs` | Complete catalogue snapshots, offline fallback and validation of declarative content. |
| `storage.mjs` | IndexedDB snapshots and versioned personal data; non-destructive legacy-data migration. |
| `packages.mjs` | Runtime compatibility, resource bounds, ECDSA signatures, SHA-256 file staging and content activation/recovery primitives. |
| `updater.mjs` | Signed-channel checks, complete staging, activation, cached restoration and recovery on application failure. |
| `platform.mjs` | Versioned request/result messages; supported web fallbacks and Android port handshaking. |
| `app.mjs` | New Clover Store application, route handling and component registry. |
| `ui/design.css` | E3 responsive design tokens, surfaces, layout, typography and motion. |

## GitHub content delivery

The catalogue is one JSON snapshot containing all seven existing catalogue documents, publisher declarations and its source commit. Clients poll that complete file every 30 seconds while visible, validate it and replace the last cache only as a whole. A failed refresh leaves the previous snapshot available. Native app code is never downloaded by this path.

The proposed GitHub workflow regenerates `e3/content/catalogue-snapshot.json` after changes to the root catalogue documents. The workflow and new files remain in the E3 development branch until reviewed and merged. Consequently the development preview can show its bundled snapshot and report that the main-branch E3 feed is unavailable before deployment. This is not reported as a successful sync.

Publisher declarations are part of the catalogue snapshot. Additional attributed evidence, themes, editorial collections and supported layout sections can use signed content packages. The shipped `content/trust.json` deliberately has no publishing key: signed content updates are not enabled until the team chooses a publishing identity and pins its public key in a build. Private keys must remain outside this repository and outside client packages.

A signed envelope contains `keyId`, Base64 `payload`, and Base64 ECDSA-P256/P1363 `signature`. The signature covers the exact decoded payload bytes. The payload declares runtime compatibility, content version, an immutable GitHub commit and all files with byte counts, kinds and SHA-256 hashes. Supported content kinds are `layout`, `themes`, `editorial` and `metadata`, all JSON. Paths cannot escape the commit root. Files are bounded to 4 MB each and 20 MB total. Content cannot introduce JavaScript, native libraries, arbitrary components or new Android capabilities.

Updates stage every required file before activation. Runtime validation and health checks precede the cache commit; a failed application restores the previous record. Versions must increase for automatic activation; explicit recovery can restore a previous content package. Restored packages are reverified on launch. Native app releases are independent from content versions.

`package-content.mjs` prepares a signed envelope using an externally supplied private key. It does not create, print or copy private keys. Publish its output as `e3/channels/stable.json` only after the referenced files exist at the declared immutable commit. Pin the corresponding public JWK in `content/trust.json` through an app release. Key rotation and an organisational publishing process must be settled before enabling this in production.

## Platform protocol

Requests: `{ "protocol": 1, "id": "unique-id", "action": "downloads.list", "payload": {} }`.
Responses: `{ "id": "unique-id", "ok": true, "result": ... }` or `{ "id": ..., "ok": false, "error": ... }`.
Only predefined actions dispatch. The host sends a dedicated port to the local app origin. Publisher previews are sandboxed and never receive the port. Website browsing uses a separate WebView with no E3 connection. Requests cannot grant themselves Android permissions or silently bypass installation consent. Unexpected messages, unsupported actions and timeouts fail explicitly.

## Data migration

Personal data moves from legacy `clover-html-v5:` local-storage keys into `woods-e3:personal:v1`. Saved IDs, followed developers, recently viewed IDs, appearance and motion preferences are migrated as data only. The old keys are not deleted. Migration commits the new object in one write and preserves the source if storage fails. Existing Android download records are imported into a new platform record namespace. Android app data survives only when package/signing identity remains compatible and the OS retains it.

## Evidence model

Publishers declare whether their app contains ads, requires an account, works offline, offers subscriptions or is open source. Yes and No are explicit answers. N/A is unknown. The preference filters account for the inverse wording of No Ads, No Account and No Subscriptions. Only an explicit true value with an allowed evidence source satisfies a filter. RAM requirements, pricing, setup time, release dates, scan results and tracker statements are not inferred from absence. Related apps are labelled as category-related unless explicit alternatives are published. Community reviews are not labelled as install-verified.

## Included in this preview

New Discover/Explore/Library/Updates shell; editorial collections; developer pages; all published apps; search/categories/preference filters; saved apps/follows; comparison of up to three listings; app Overview/Privacy/Versions/Community sections; primary Android and other-device downloads; native request routing; starter-pack review/queue UI; local list import/export; five themes; offline catalogue browsing; evidence-aware empty states; content verification primitives and signed update orchestration.

## Not completed or connected

Publishing key/channel activation; authenticated review submission, public-list hosting, bug voting, tips/payment integration, price notifications and malware scanning; background scheduler, automatic Update All, bandwidth throttling, delta patch production/reconstruction, desktop CLI/runtime installation, XML export, APK inspection UI, numeric installed-update dashboard, channel-specific install guidance and native E3 handshake device validation.

Direct signed-content delivery is therefore configurable infrastructure, not an active deployed service. Native Android runtime testing and accessibility/performance testing are required before release. Browser checks do not validate Android installation or port handshaking.
