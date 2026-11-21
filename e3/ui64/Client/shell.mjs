const appearanceURL =
  'https://raw.githubusercontent.com/woodsstudiosupport/cloverstoresupports/e3/ui64-preview/e3/ui64/Client/appearance.json';

export function applyAppearance(config, style) {
  if (config?.schemaVersion !== 1) return;
  for (const key of ['accent', 'surface', 'background']) {
    const color = config[key];
    if (typeof color === 'string' && /^#[\da-f]{6}$/i.test(color)) {
      style.setProperty('--ui64-' + key, color);
    }
  }
}

export function startAppearance(document) {
  const style = document.documentElement.style;
  const refresh = async () => {
    if (document.hidden) return;
    try {
      const response = await fetch(appearanceURL, {
        credentials: 'omit', cache: 'no-cache', signal: AbortSignal.timeout(5000)
      });
      if (response.ok) applyAppearance(await response.json(), style);
    } catch {
      // Keep the last working palette when the remote configuration is unavailable.
    }
  };
  void refresh();
  setInterval(refresh, 30000);
}

export function desktopShell({ page, body, icon, storeIcon, status, compare }) {
  const primary = [
    ['discover', 'Discover'], ['explore', 'Explore'], ['collections', 'Collections'],
    ['developers', 'Publishers'], ['library', 'Library']
  ];
  const workspace = [
    ['updates', 'Updates'], ['downloads', 'Downloads'], ['compare', 'Compare'], ['settings', 'Settings']
  ];
  const links = list => list.map(([id, title]) =>
    `<a href="#/${id}" ${page === id ? 'aria-current="page"' : ''}>${title}</a>`).join('');
  return `<div class="e3-shell ui64-shell">
    <header class="ui64-header">
      <a class="ui64-brand" href="#/discover"><img src="${storeIcon}" alt="">Clover Store</a>
      <button type="button" data-action="search">${icon('search')}<span>Search the store</span><kbd>Ctrl K</kbd></button>
      <button type="button" data-action="windows-tools" title="Windows tools (Ctrl+P)">Windows tools</button>
    </header>
    <aside class="ui64-sidebar">
      <nav aria-label="Storefront">${links(primary)}</nav>
      <nav aria-label="Workspace">${links(workspace)}</nav>
    </aside>
    <main id="e3-main"><div class="e3-page">${body}</div></main>
    <footer class="ui64-status"><span>${status}</span><span>E3.UI64 · Windows x64</span></footer>
    ${compare}
  </div>`;
}
