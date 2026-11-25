# Clover Store E3.UI64

E3.UI64 is the Windows x64 host for the same E3 interface and public GitHub catalogue used by E3.HTML and E3.ARM. It ships the E3 interface with the application and uses the shared GitHub snapshot refresh for catalogue data. Client changes are delivered through a new Windows build. The host checks the operating system and process architecture at launch.

## Build

On an x64 Windows PC with the .NET 8 SDK and Microsoft Edge WebView2 Runtime:

```powershell
dotnet publish e3/ui64/CloverStore.UI64.csproj -c Release --self-contained true -o publish
.\publish\CloverStore.UI64.exe
```

Keep the entire publish folder together. Windows Sandbox also needs to be enabled on an edition that supports it.

## Preview features

- Shared E3 catalogue, discovery, app details, collections, preferences, and local library.
- Windows downloads with cancel and retry, progress, optional publisher SHA-256 verification, and Explorer reveal. Downloads are not automatically executed.
- **Test in Sandbox** stages a copy of a downloaded installer in Windows Sandbox with networking, clipboard redirection, and virtual GPU disabled. The installer is launched by the user inside the sandbox, which also allows choosing how to inspect it first.
- **Ctrl+P** opens the Windows tools panel. It shows a read-only 32/64-bit registry inventory of installed desktop programs, RAM, and available drive space. It can copy the inventory and navigate to Downloads or Updates. Jump List entries target Updates, Downloads, and Installed.

- The Windows tools panel can export completed downloads into an offline ZIP. Installers that need network access or extra dependencies retain those requirements.

The preview has no claim of a complete pre-install diff. A future preview can show publisher-declared changes or observed sandbox changes, with the source stated for each change. Restore points, activity-aware downloads, category install paths, package-manager reconciliation, startup and shell-extension controls, compatibility ratings, package adoption, config sync, version pinning, widget support, selected-app and single-EXE bundles, bandwidth and mirrors, release watching, and a theme/plugin marketplace still need implementation and Windows testing.

## Desktop layout and palette

The Windows build uses a separate E3.UI64 shell with shared E3 catalogue views. It uses a sidebar above 900 px, a scrollable navigation strip at smaller sizes, and a compact toolbar below 560 px. The desktop palette is read on launch and refreshed every 30 seconds while the window is visible from `e3/ui64/Client/appearance.json` on `e3/ui64-preview`. Version 1 accepts only six-digit hex colours for accent, surface, and background. Shell code and other executable assets ship in the Windows build.

Windows tools also provides an optional pause at 20% battery or below while unplugged and a per-transfer bandwidth limit of 256, 1024, 5120, or 10240 KiB/s. These controls apply to the current session. A paused request can still time out if its download server closes the connection. Full-screen game and call detection are pending.

The Windows shell includes a searchable Installed page and a Ctrl+P command palette. Release Watch checks up to 12 public GitHub repositories on startup, on request, and every 10 minutes while visible. It shows Windows assets and release notes in a local watchlist, with local pin and skip controls. Asset buttons open the browser and never run an installer. Watching a repository does not publish an entry or adopt a local app. The offline ZIP tool lets you select completed downloads before exporting.

## 2.1 · Build 1276471

This release packages the desktop client, isolated from Android and HTML runtime overrides. It uses the main-branch appearance configuration, preserves the installed inventory and download-management experience, and restores completed download records across restarts. Windows Sandbox launches via the registered .wsb handler with a legacy executable fallback; the staged read-only installer is retained so launcher exit cannot remove it prematurely. Staging folders remain under LocalAppData until manually removed after Sandbox closes. Windows testing is required to confirm Sandbox availability and package installation on the target PC.
