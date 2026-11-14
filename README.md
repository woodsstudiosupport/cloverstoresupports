# Clover Store

**Discover apps across the Woods Studio ecosystem and beyond.**

Clover Store brings applications, developer profiles, releases and community reviews together in one catalogue. Browse apps for Android, Clover HomeUI, Clover Splash, Windows and other supported devices, with availability shown on each listing.

[Explore the catalogue repository](https://github.com/woodsstudiosupport/cloverstore)

## How Clover Store works

Publishers provide app information such as descriptions, artwork, supported platforms and download links. Clover Store reads the published catalogue and presents the available information in the app. While the store is open, it checks for catalogue changes every 30 seconds, allowing newly published apps and updated information to appear without a separate store update.

A listing may support several platforms. The Android app highlights its Android download, while downloads for other devices appear separately. Some applications are included with a device or platform and may not have a standalone download.

## Apps and downloads

App listings can include:

- An app name, icon, developer and description.
- Category and version information.
- Download options for supported platforms.
- Screenshots, release notes and compatibility information when provided.
- Community ratings and published reviews.

Availability and compatibility vary by app and device. Check the listing and publisher information before downloading. Android presents its own confirmation when an installation is requested.

## Developers

Developer profiles give publishers a consistent identity across their apps. A profile can include a name, icon, banner, description, website and support links. Apps are connected to their developer so compatible Clover Store clients can display developer cards and pages listing their applications.

Profile artwork and links appear when supplied. A verification badge is shown only when verification has been granted; having a profile does not automatically mean a publisher is verified.

The planned developer website will provide a dedicated place to manage profiles, submit apps and manage releases. It is not included as a running website in this repository.

## Reviews and ratings

Published community reviews are grouped with their app listing. Ratings and comments help people learn about other users' experiences. Existing reviews are included in this catalogue.

Review submission options depend on the Clover Store client and available publishing services. Including review data in the repository does not automatically enable review posting in every app version.

## Collections and announcements

Collections group apps by theme or category, helping people explore related applications. Developer and app announcements can share release news and other relevant updates when published.

## Releases

Apps can provide platform-specific releases and, where available, Stable, Beta or Nightly channels. Release information may include a version, change summary, download size and compatibility details. A channel or release is displayed only when its information has been published and is supported by the client.

## Repository contents

| File or folder | Public catalogue information |
| --- | --- |
| `registry.json` | Published applications and their listings. |
| `apps/` | Individual app records. |
| `developers.json` | Developer profiles and public links. |
| `reviews.json` | Published community reviews and ratings. |
| `collections.json` | Groups of related applications. |
| `releases.json` | Platform releases and release channels. |
| `announcements.json` | Published developer and app announcements. |
| `catalogue.json` | Catalogue information for compatible clients. |
| `schemas/` | Reference formats for catalogue information. |
| `examples/` | Example data formats for contributors. |

Example files demonstrate formats only; they are not published apps or releases. Empty announcement or release lists mean no entries have been supplied yet.

## Publishing and updates

Developers can prepare profile and app information for submission. Accepted updates become part of the published catalogue and can then appear in compatible Clover Store clients. Keep descriptions, download links, support information and release details accurate and up to date.

App and developer information may be updated independently of the Clover Store application. New interface features still require a client version that supports them.

## Privacy and support

The Android app's **Settings → Disclaimers** section explains its data use, permissions and important download information. Applications and websites listed in Clover Store may have their own privacy policies, terms and support channels.

For an individual app, use the publisher's support information where available. For catalogue questions or incorrect listings, use this repository's Issues section without including passwords, private account information or other sensitive details.

---

Clover Store is part of the Woods Studio ecosystem.
