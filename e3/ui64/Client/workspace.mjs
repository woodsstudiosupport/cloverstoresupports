const adoptionKey = 'e3.ui64.adopted-apps.v1';

export function blocksWindowsUpdate(links, listingId, version) {
  return Object.values(links).some(link => link.listingId === listingId &&
    ((link.pin && link.pin !== version) || (link.skip && link.skip === version)));
}

export function windowsWorkspace(platform, render, escape, catalogue) {
  let links = {};
  try {
    const value = JSON.parse(localStorage.getItem(adoptionKey));
    if (value && typeof value === 'object' && !Array.isArray(value)) links = value;
  } catch { /* Leave missing or invalid preferences empty. */ }
  let query = '';
  const inventory = document.createElement('dialog');
  inventory.id = 'ui64-adoption';
  inventory.setAttribute('aria-label', 'Link installed app');
  document.body.append(inventory);

  function storeLinks(next) {
    try {
      localStorage.setItem(adoptionKey, JSON.stringify(next));
      links = next;
      inventory.close();
    } catch {
      status = 'Could not save installed app preferences.';
    }
    render();
  }

  function editLink(app) {
    const old = links[app.id];
    const offers = catalogue();
    const selected = offers.find(offer => offer.id === old?.listingId);
    inventory.innerHTML = `<form class="panel ui64-tool-form">
      <h2>${escape(app.name)}</h2><p>${escape([app.publisher,app.version].filter(Boolean).join(' · '))}</p>
      <label>Clover Store listing <select name="listing">
        <option value="">Unlinked</option>${offers.map(offer => '<option value="' + escape(offer.id) + '"' +
          (offer.id === old?.listingId ? ' selected' : '') + '>' + escape(offer.name) + '</option>').join('')}
      </select></label>
      ${selected && app.version ? '<label><input name="pin" type="checkbox" ' + (old.pin ? 'checked' : '') +
        '> Pin installed version ' + escape(app.version) + '</label>' : ''}
      ${selected?.version ? '<label><input name="skip" type="checkbox" ' + (old.skip === selected.version ? 'checked' : '') +
        '> Skip store version ' + escape(selected.version) + '</label>' : ''}
      <div class="ui64-actions"><button class="e3-button primary">Save</button><button type="button" class="e3-button" data-adopt-close>Cancel</button></div>
    </form>`;
    const form = inventory.querySelector('form');
    form.querySelector('[data-adopt-close]').onclick = () => inventory.close();
    form.onsubmit = event => {
      event.preventDefault();
      const fields = new FormData(form);
      const listingId = fields.get('listing');
      const next = { ...links };
      if (!listingId) delete next[app.id];
      else {
        const unchanged = listingId === old?.listingId;
        next[app.id] = {
          listingId,
          pin: unchanged && fields.has('pin') ? app.version : '',
          skip: unchanged && fields.has('skip') ? selected?.version || '' : ''
        };
      }
      storeLinks(next);
    };
    inventory.showModal();
  }
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
    const edit = event.target.closest('[data-adopt-id]');
    if (edit) {
      const app = installed.find(row => row.id === edit.dataset.adoptId);
      if (app) editLink(app);
    }
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
    query = event.target.value.toLowerCase().trim();
    for (const row of document.querySelectorAll('.ui64-inventory li')) {
      row.hidden = !row.textContent.toLowerCase().includes(query);
    }
  });
  const page = () => `<section class="ui64-workspace">
    <header><h1>Installed apps</h1><p>Review the desktop programs Windows reports on this PC.</p></header>
    <div class="ui64-actions">
      <button class="e3-button primary" data-inventory-scan ${busy ? 'disabled' : ''}>Scan this PC</button>
      <p role="status">${escape(status)}</p>
    </div>
    <label for="ui64-inventory-filter">Filter installed apps</label>
    <input id="ui64-inventory-filter" type="search" placeholder="Search by name or version" value="${escape(query)}">
    <ul class="ui64-inventory">${installed.map(app => {
      const link = links[app.id];
      const offer = link && catalogue().find(row => row.id === link.listingId);
      const canReview = offer?.version && offer.version !== app.version && !blocksWindowsUpdate(links, offer.id, offer.version);
      const meta = [app.publisher, app.version].filter(Boolean).join(' · ');
      const hidden = ![app.name, meta].join(' ').toLowerCase().includes(query);
      return `<li class="panel" ${hidden ? 'hidden' : ''}>
        <span class="ui64-app-monogram" aria-hidden="true">${escape(app.name.slice(0,1))}</span>
        <div><strong>${escape(app.name)}</strong><small>${escape(meta)}</small>
          ${offer ? '<small>Linked to ' + escape(offer.name) + '</small>' : ''}
          ${link?.pin ? '<small>Pinned to ' + escape(link.pin) + '</small>' : ''}
          ${link?.skip ? '<small>Skipping ' + escape(link.skip) + '</small>' : ''}
          <div class="ui64-actions"><button class="e3-button" data-adopt-id="${escape(app.id)}">${link ? 'Manage link' : 'Link to Store'}</button>
            ${canReview ? '<a class="e3-button" href="#/app/' + encodeURIComponent(offer.id) + '">Review available version</a>' : ''}
          </div>
        </div>
      </li>`;
    }).join('')}</ul>
  </section>`;
  return { page, blocks: (listingId, version) => blocksWindowsUpdate(links, listingId, version) };
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
      <a href="#/compare">Compare apps</a><a href="#/themes">Desktop palettes</a><a href="#/packages">Package managers</a><a href="#/releases">Watch GitHub releases</a><a href="#/windows-tools">Windows tools and offline export</a>

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
    if (event.target.closest('[data-download-widget]'))
      platform.request('windows.widget').catch(error=>{status=error.message;render();});
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
          limit: Number(fields.get('limit')), pause: fields.has('pause'), focus: fields.has('focus')
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
      <button class="e3-button" data-download-widget>Show download widget</button>
      <p role="status">${escape(status || (state ? '' : 'Refresh to load available packages and Windows details.'))}</p></div>
    ${state ? `<section class="panel"><h2>This PC</h2>${state.summary.map(item => '<p>' + escape(item) + '</p>').join('')}</section>
      <form class="panel ui64-tool-form" id="ui64-transfer-settings"><h2>Transfers</h2>
        <label>Speed per transfer <select name="limit">${limits.map(limit => '<option value="' + limit + '" ' + (limit === state.settings.limit ? 'selected' : '') + '>' + (limit ? limit + ' KiB/s' : 'Unlimited') + '</option>').join('')}</select></label>
        <label><input type="checkbox" name="pause" ${state.settings.pause ? 'checked' : ''}> Pause on low battery</label>
        <label><input type="checkbox" name="focus" ${state.settings.focus ? 'checked' : ''}> Pause during full-screen Direct3D or presentation mode</label>
        <button class="e3-button primary">Apply transfer settings</button></form>
      <form class="panel ui64-tool-form" id="ui64-bundle-form"><h2>Offline bundle</h2>
        ${state.packages.length ? state.packages.map(item => `<label><input type="checkbox" name="package" value="${escape(item.id)}"> ${escape(item.name)}</label>`).join('') : '<p>Completed Windows downloads will appear here.</p>'}
        <button class="e3-button" ${state.packages.length ? '' : 'disabled'}>Save selected as ZIP</button></form>` : ''}
  </section>`;
}
