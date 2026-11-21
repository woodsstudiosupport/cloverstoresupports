export function windowsWorkspace(platform, render, escape) {
  let installed = [];
  let status = 'Scan this PC to list installed desktop programs.';
  let busy = false;
  async function scan() {
    if (busy) return;
    busy = true;
    status = 'Scanning installed programs…';
    render();
    try {
      installed = await platform.request('windows.inventory');
      status = `${installed.length} installed desktop programs`;
    } catch (error) {
      status = error.message;
    } finally {
      busy = false;
      if (location.hash === '#/installed') render();
    }
  }
  document.addEventListener('click', event => {
    if (event.target.closest('[data-inventory-scan]')) void scan();
    if (event.target.closest('[data-palette-open]')) {
      const palette = document.getElementById('ui64-palette');
      if (!palette?.open) palette?.showModal();
    }
    if (event.target.closest('[data-palette-close], #ui64-palette a, #ui64-palette [data-action]')) {
      document.getElementById('ui64-palette')?.close();
    }
  });
  document.addEventListener('input', event => {
    if (event.target.id !== 'ui64-inventory-filter') return;
    const query = event.target.value.toLowerCase().trim();
    for (const row of document.querySelectorAll('.ui64-inventory li')) {
      row.hidden = !row.textContent.toLowerCase().includes(query);
    }
  });
  return () => `<section class="ui64-workspace">
    <header><h1>Installed apps</h1><p>Review the desktop programs Windows reports on this PC.</p></header>
    <div class="ui64-actions">
      <button class="e3-button primary" data-inventory-scan ${busy ? 'disabled' : ''}>Scan this PC</button>
      <p role="status">${escape(status)}</p>
    </div>
    <label for="ui64-inventory-filter">Filter installed apps</label>
    <input id="ui64-inventory-filter" type="search" placeholder="Search by name or version">
    <ul class="ui64-inventory">${installed.map(name => '<li>' + escape(name) + '</li>').join('')}</ul>
  </section>`;
}

export function installPalette() {
  const dialog = document.createElement('dialog');
  dialog.id = 'ui64-palette';
  dialog.setAttribute('aria-labelledby', 'ui64-palette-title');
  dialog.innerHTML = `<div class="ui64-palette-heading"><h2 id="ui64-palette-title">Command palette</h2>
    <button class="e3-button" data-palette-close>Close</button></div>
    <nav aria-label="Quick destinations">
      <a href="#/explore">Explore apps</a><a href="#/updates">Check updates</a>
      <a href="#/downloads">Open downloads</a><a href="#/installed">Scan installed apps</a>
      <a href="#/releases">Watch GitHub releases</a>
      <button data-action="windows-tools">Windows tools and offline export</button>
    </nav>`;
  document.body.append(dialog);
  return dialog;
}
