# Clover Store web app

The root `index.html` is the small startup page. Host it on an HTTPS website, or host this repository as a static site. It loads the public interface and catalogue from this repository. Uploading source to GitHub does not change an existing EdgeOne deployment: deploy the new root HTML there once to switch that website to this version.

## Files to edit

| File | What it controls |
| --- | --- |
| `web/shell.html` | Page structure, header, dialogs and internal browser. |
| `web/style.css` | Responsive layouts, pure black background, cards and animation. |
| `web/app.js` | Pages, interactions, download queue, settings and catalogue refresh. |
| `web/navigation.json` | Sidebar, mobile, store menu and internal browser navigation. |
| `web/apk.js` | Local APK information inspection. |
| `web/assets/` | Clover Store icon and Woods Studio logo. |
| `web/qrcode.js` | Third-party QR library; see `THIRD_PARTY_NOTICES.md`. |
| `web/manifest.json` | Required interface files, artwork and catalogue paths. |
| Root catalogue JSON files | Apps, developer profiles, reviews, releases, collections and announcements. |

Navigation entries use existing page names. Adding a new page also requires its implementation in `app.js`. The internal browser retains its Go Back control.

## Startup

1. Find the current repository revision, then fetch the interface, navigation, required artwork and catalogue from that same revision.
2. Parse and validate the required files, create the interface and check the images rendered on the opening page. The first bar measures completed work; failed optional listing artwork uses the existing fallback. Artwork checks have a timeout so an unavailable image cannot block startup indefinitely. Offscreen page artwork loads when needed; application download files are not preloaded.
3. Reset the bar to zero and run a separate five-second progress timer.
4. Reveal the store and refresh published catalogue information every 30 seconds while visible.

Interface and navigation edits appear on the next full page reload. Catalogue edits appear during the regular refresh. Download files, screenshots and publisher artwork keep their catalogue URLs; publisher-hosted content is not copied automatically.

A failed required request shows an error and retry control. A disconnected device shows the Woods Studio logo and the No Internet Connection message. Local saved apps and preferences remain local to the browser. The startup page includes a small logo so it can display that message before any network requests succeed.

All files in this folder are public browser code. Keep passwords, signing keys, private configuration and access tokens out of this repository and browser files. Review submission and other authenticated publishing require a separately deployed service; reading public review data does not enable automatic review posting.

## Check changes

Run `node --test web/tests/startup.test.cjs`. GitHub Actions runs the same checks for web changes. Existing catalogue validation remains separate.
