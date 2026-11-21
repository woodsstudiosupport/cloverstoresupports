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
    <ul class="ui64-inventory">${installed.map(name => '<li class="panel"><span class="ui64-app-monogram" aria-hidden="true">' + escape(name.slice(0,1)) + '</span><div><strong>' + escape(name) + '</strong><small>Installed on this PC</small></div></li>').join('')}</ul>
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
      <a href="#/collections">Collections</a><a href="#/developers">Publishers</a>
      <a href="#/compare">Compare apps</a><a href="#/releases">Watch GitHub releases</a><a href="#/windows-tools">Windows tools and offline export</a>

    </nav>`;
  document.body.append(dialog);
  return dialog;
}

export function transferWorkspace(platform, render, escape) {
  let state;
  let status = '';
  let working = false;
  let loading = false;
  const limits = [0, 256, 1024, 5120, 10240];
  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      const [settings, packages, summary] = await Promise.all([
        platform.request('windows.transfer-settings'),
        platform.request('windows.completed'),
        platform.request('windows.summary')
      ]);
      state = { settings, packages, summary };
      status = '';
    } catch (error) {
      status = error.message;
    } finally {
      loading = false;
      if (location.hash === '#/windows-tools') render();
    }
  }
  document.addEventListener('click', event => {
    if (event.target.closest('[data-transfer-refresh]')) void refresh();
  });
  document.addEventListener('submit', async event => {
    const id = event.target.id;
    if (!['ui64-transfer-settings', 'ui64-bundle-form'].includes(id)) return;
    event.preventDefault();
    if (working) return;
    const fields = new FormData(event.target);
    working = true;
    try {
      if (id === 'ui64-transfer-settings') {
        state.settings = await platform.request('windows.transfer-settings', {
          limit: Number(fields.get('limit')), pause: fields.has('pause')
        });
        status = 'Transfer settings updated.';
      } else {
        const ids = fields.getAll('package');
        if (!ids.length) throw Error('Select at least one package.');
        const response = await platform.request('windows.bundle-export', { ids });
        status = response.cancelled ? 'Export cancelled.' : `Exported ${response.count} packages.`;
      }
    } catch (error) {
      status = error.message;
    } finally {
      working = false;
      if (location.hash === '#/windows-tools') render();
    }
  });
  return () => `<section class="ui64-workspace">
    <header><h1>Windows tools</h1><p>Manage transfers and prepare offline bundles.</p></header>
    <div class="ui64-actions"><button class="e3-button" data-transfer-refresh>Refresh Windows details</button>
      <p role="status">${escape(status || (state ? '' : 'Refresh to load available packages and Windows details.'))}</p></div>
    ${state ? `<section class="panel"><h2>This PC</h2>${state.summary.map(item => '<p>' + escape(item) + '</p>').join('')}</section>
      <form class="panel ui64-tool-form" id="ui64-transfer-settings"><h2>Transfers</h2>
        <label>Speed per transfer <select name="limit">${limits.map(limit => '<option value="' + limit + '" ' + (limit === state.settings.limit ? 'selected' : '') + '>' + (limit ? limit + ' KiB/s' : 'Unlimited') + '</option>').join('')}</select></label>
        <label><input type="checkbox" name="pause" ${state.settings.pause ? 'checked' : ''}> Pause on low battery</label>
        <button class="e3-button primary">Apply transfer settings</button></form>
      <form class="panel ui64-tool-form" id="ui64-bundle-form"><h2>Offline bundle</h2>
        ${state.packages.length ? state.packages.map(item => `<label><input type="checkbox" name="package" value="${escape(item.id)}"> ${escape(item.name)}</label>`).join('') : '<p>Completed Windows downloads will appear here.</p>'}
        <button class="e3-button" ${state.packages.length ? '' : 'disabled'}>Save selected as ZIP</button></form>` : ''}
  </section>`;
}
