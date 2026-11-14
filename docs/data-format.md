# Catalogue data contract

## Compatibility and synchronisation

`registry.json` stays an array; `reviews.json` stays an object whose keys are listing IDs. Existing app names, IDs, developer text, versions, descriptions, artwork, downloads and review content are preserved by this migration. All named published listings receive a stable `developerId`. The old blank placeholder is retained under archive/ and is no longer part of the published array.

Read `catalogue.json` for relative endpoint paths. Poll catalogue/profile/review metadata every 30 seconds while the store is active; use conditional requests and refresh on resume/reconnect. A client should retain the last valid data on a failed response, avoid overlapping requests, and update affected rows without resetting navigation. These are client requirements; this repository does not implement Android UI or polling.

## Developer identity

Profiles have `id`, `displayName`, `legacyNames`, `description`, nullable `icon`, `banner`, `website`, `supportUrl`, `privacyPolicy`, and `verification`. Artwork, websites and privacy links use HTTPS. Developer `supportUrl` may also be a simple `mailto:user@example.com` address; email headers, multiple recipients and other URL schemes are not accepted. Missing values mean no information has been supplied; use the generic assets in catalogue.json.profileDefaults, not a borrowed app logo. These relative paths resolve from the repository root. Profile app lists are derived from each listing's `developerId`.

IDs are stable identifiers, not proof of ownership. `legacyNames` supports older clients, not authentication. Names/aliases must be unambiguous across profiles. Verification defaults to `unverified` with `verifiedAt: null`. Only a documented maintainer verification process can award a badge. Do not let public submissions set verification or installation policy.

A developer card uses the profile icon/name and computed app count. A developer page uses the banner, description, links, published apps, collections and announcements. Name-based grouping remains a fallback for clients reading old data.

## Apps and supplier APKs

Existing `developer` strings are kept for legacy readers. New approved publications stamp the registered profile's name. The listing ID can differ from the Android package ID: use `androidPackageName` (preferred), or `packageName`, otherwise the listing `id` is the fallback. Keep reviews, saves and links keyed by listing ID.

Third-party Android downloads require a valid package identifier such as `com.example.android.app`. `catalogue.json.installationPolicy.supplierDeveloperIds` contains `woods-studio` only, matching the current exact Woods Studio exemption. That exemption removes the catalogue package-ID requirement/matching; it does not bypass APK parsing, optional checksum checks, Android signature validation, installed-update signer compatibility, downgrade protection or user confirmation. Do not infer exemptions from `com.woodsstudio.*` prefixes, claimed names, verification badges, or a submission flag. Woods Studio Labs and other separate profiles are not silently granted this exemption.

The app still has to perform checks against the actual downloaded APK. Registry validation is not APK inspection or malware scanning. The current Android preview uses the legacy exact developer-name rule; a future client should consume stable IDs and the explicit policy.

Optional listing fields include `screenshots`, `changelog`, `minimumAndroidSdk`, `sizeBytes`, `androidPackageName`, `androidVersionCode`, `androidSha256`, `website`, `supportUrl` and `privacyPolicy`. Unknown existing metadata is retained, but new consumers must only interpret supported fields. Empty platform download strings mean no download published. `downloads` values are URLs, not built-in flags; new submissions must place `isBuiltin` at the listing root.

## Releases and updates

`releases.json` is an array of platform/channel releases. Each entry has a unique slug ID, `appId`, `platform`, `channel`, `version`, and HTTPS `url`. Channels are `stable`, `beta`, `nightly`. Supported platform values are declared in the release schema. Optional fields include `sizeBytes`, `sha256`, `certificateSha256`, `changelog`, `publishedAt`, `minSdk`, and `architectures`.

Android entries require the APK's real positive integer `versionCode`. Third-party Android releases also require a `packageName` matching the listing's expected package. Human-readable version strings cannot be reliably converted into Android version codes. Do not invent file sizes, hashes, compatibility guarantees or version codes; leave release metadata absent until the actual artefact has been inspected.

## Collections and announcements

Collections reference published `appIds`. A developer-owned collection can only reference that developer's apps; editorial collections omit `developerId`. Initial editorial collections are based on current categories, not newly claimed recommendations.

Announcements contain a unique ID, developer ID, title/body and ISO timestamp, with optional app IDs, expiration and HTTPS URL. Developer announcements cannot claim another publisher's apps. Render all remotely supplied text as text, never executable HTML.

## Reviews

Published groups preserve existing review fields. New review submissions require `appId`, `name`, an integer `rating` from 1 to 5, and `comment`. The publisher stamps server-side date/timestamp and `submissionId: github-issue-N`, so retries are idempotent. Historical test reviews are retained under archive/reviews.json, outside the published review feed. New reviews require a currently published app.

Names are public display names, not authenticated reviewer identities. Existing reviews are not independently verified. The issue workflow does not provide private user accounts, app-side review editing/deletion, moderation appeals, or a rate-limited review API. A future service must implement those controls before enabling an in-app submission button. Do not put device identifiers or private account details into public review JSON.

