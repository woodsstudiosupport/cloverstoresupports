const appearanceURL =
  'https://raw.githubusercontent.com/woodsstudiosupport/cloverstoresupports/main/e3/ui64/Client/appearance.json';

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
      const local = JSON.parse(localStorage.getItem('e3.ui64.palette.v1'));
      if (local?.schemaVersion === 1) { applyAppearance(local, style); return; }
    } catch { /* Continue with the public palette. */ }
    try {
      const response = await fetch(appearanceURL, {
        credentials: 'omit', cache: 'no-cache', signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        const palette = await response.json();
        if (!localStorage.getItem('e3.ui64.palette.v1')) applyAppearance(palette, style);
      }
    } catch {
      // Keep the last working palette when the remote configuration is unavailable.
    }
  };
  void refresh();
  setInterval(refresh, 30000);
}

export function desktopShell({ page, body, icon, storeIcon, status, compare }) {
  const tabs = [
    ['discover', 'Discover', 'discover'], ['explore', 'Explore', 'explore'],
    ['library', 'Library', 'library'], ['installed', 'Installed', 'check'],
    ['updates', 'Updates', 'updates'], ['downloads', 'Downloads', 'download'],
    ['settings', 'Settings', 'settings']
  ];
  const links = tabs.map(([id, title, symbol]) =>
    `<a href="#/${id}" ${page === id ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${title}</span></a>`).join('');

  return `<div class="e3-shell ui64-shell">
    <header class="ui64-header">
      <a class="ui64-brand" href="#/discover"><img src="${storeIcon}" alt="">Clover Store</a>
      <button type="button" data-action="search">${icon('search')}<span>Search the store</span><kbd>Ctrl K</kbd></button>
      <button class="ui64-preferences-button" type="button" data-preferences-open>Preferences</button>
      <button type="button" data-palette-open aria-label="Command palette" title="Command palette (Ctrl+P)"><span>Commands</span><kbd>Ctrl P</kbd></button>
    </header>
    <main id="e3-main"><div class="e3-page">${body}</div></main>
    <nav class="ui64-dock" aria-label="Store navigation">${links}
      <button type="button" data-palette-open>${icon('menu')}<span>More</span></button>
    </nav>
    <footer class="ui64-status"><span>${status}</span><span>2.1 · E3.UI64 · Build 1276471</span></footer>
    ${compare}
  </div>`;
}


export function discovery(picks, catalogue) {
  return `<section class="ui64-discovery">
    <header class="ui64-discovery-heading">
      <div><h1>Discover apps</h1><p>Explore the catalogue or tune your feed around the software you care about.</p></div>
      <button type="button" class="e3-button" data-preferences-open>Personalise Discover</button>
    </header>
    ${picks ? '<section class="ui64-picks" aria-labelledby="ui64-picks-title"><h2 id="ui64-picks-title">For you</h2>' + picks + '</section>' : ''}
    ${catalogue}
  </section>`;
}
