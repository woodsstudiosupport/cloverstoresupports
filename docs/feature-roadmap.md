# Clover Store feature roadmap

This repository change supplies catalogue data, schemas and moderated publication. It does not implement these features in Android or deploy backend services.

## Store experience

- Developer cards, searchable developer directory and developer pages with icon, banner, description, public links, app list/count and controlled verification.
- Rich app pages: full-screen screenshots, changelog, file size, Android requirements, supported devices and source information.
- Editorial/developer collections and app announcements.
- Appearance controls: light/dark/system, accent, card density and motion; accessibility improvements for large text, screen readers, keyboard input and optional haptics.
- Search suggestions/recent searches, platform/category/publisher/saved/installed filtering and sorting.
- App comparison, QR sharing, listing links, home-screen shortcuts and post-update What's New.
- Developer follows. Start locally; cross-device sync/notifications require a service.

## Downloads, compatibility and updates

- Update Centre with real numeric version codes, release notes and installation/update history.
- Stable/Beta/Nightly release selection, only when actual releases exist.
- Device compatibility explanations rather than unexplained disabled buttons.
- Download bytes/total, transfer speed, storage preflight, failure reasons, queue/reordering and configurable concurrency.
- Scheduled downloads for chosen time, Wi-Fi or charging conditions.
- Local APK selection, package/version/signer inspection and explicit system-confirmed installation.
- Separate catalogue and actual APK information, particularly for Woods Studio supplier packages; no claim of malware certification.

## Connected services

- Developer publishing portal with authenticated ownership, drafts, artwork/artefact upload, validation, moderation and publication status.
- Review submission/edit/delete with identity, abuse controls and moderation.
- Broken-download/listing reports and a private moderation process.
- Developer follows, announcements and opt-in delivery notifications.
- Paired-device lists and download handoff between Android/HomeUI and HomePC; explicit permission and revocation.

The previous Android preview already contains some local features (saved apps, recent views, filters, read-only reviews, import/export, downloads and Disclaimers). Treat the AAB's actual implementation and device testing as authoritative. New metadata does not automatically add developer UI or enable a backend in an existing AAB.
