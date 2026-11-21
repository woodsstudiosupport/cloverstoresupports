const key = 'e3.ui64.install-locations.v1';

export function packageWorkspace(platform, render, escape, catalogue) {
  let locations = {};
  try { locations = JSON.parse(localStorage.getItem(key)) || {}; } catch {}
  let busy = false;
  let output = '';
  let manager = 'winget';
  let id = '';
  let category = '';

  const rerender = () => { if (location.hash === '#/packages') render(); };
  document.addEventListener('submit', async event => {
    const form = event.target;
    if (form.id !== 'ui64-packages' || busy) return;
    event.preventDefault();
    const formData = new FormData(form);
    manager = formData.get('manager');
    id = formData.get('id').trim();
    category = formData.get('category');
    const operation = event.submitter?.value;
    busy = true;
    output = 'Working…';
    rerender();
    try {
      if (operation === 'location') {
        if (!category) throw Error('Choose a catalogue category first.');
        const result = await platform.request('windows.pick-folder');
        if (result.path) {
          locations = { ...locations, [category]: result.path };
          localStorage.setItem(key, JSON.stringify(locations));
        }
        output = result.path ? 'Saved a WinGet location preference.' : 'Folder selection cancelled.';
      } else if (operation === 'clear') {
        delete locations[category];
        localStorage.setItem(key, JSON.stringify(locations));
        output = 'Location preference removed.';
      } else {
        const result = await platform.request('windows.package-manager', {
          manager, operation, id, location: locations[category] || ''
        });
        output = (result.exitCode ? 'Package manager exit code ' + result.exitCode + '\n' : '') + (result.output || 'Finished.');
      }
    } catch (error) {
      output = error.message;
    } finally {
      busy = false;
      rerender();
    }
  });
  const option = (value, selected, label = value) =>
    `<option value="${escape(value)}" ${value === selected ? 'selected' : ''}>${escape(label)}</option>`;
  return () => `<section class="ui64-workspace">
    <header><h1>Package managers</h1><p>List software and run an exact package ID through a manager already installed on this PC.</p></header>
    <form id="ui64-packages" class="panel ui64-tool-form">
      <label>Manager <select name="manager">${[['winget','WinGet'],['scoop','Scoop'],['chocolatey','Chocolatey']].map(([value,label])=>option(value,manager,label)).join('')}</select></label>
      <label>Package ID <input name="id" value="${escape(id)}" placeholder="Publisher.Package"></label>
      <label>Category <select name="category">${option('',category,'Default location')}${[...new Set(catalogue().map(row=>row.category).filter(Boolean))].sort().map(value=>option(value,category)).join('')}</select></label>
      <p>WinGet location preference: ${escape(locations[category] || 'Default')}. Installer support varies.</p>
      <div class="ui64-actions">${[['list','List installed'],['install','Install'],['upgrade','Upgrade'],['location','Choose WinGet folder'],['clear','Clear folder']].map(([value,label])=>`<button class="e3-button" value="${value}" ${busy?'disabled':''}>${label}</button>`).join('')}</div>
    </form>
    <pre class="panel ui64-command-output" role="status">${escape(output)}</pre>
  </section>`;
}

export function windowsSources(file) {
  const sources = [{ url:file.url, label:'Publisher download' }];
  if (!/^[a-f0-9]{64}$/i.test(file.sha256 || '') || !Array.isArray(file.mirrors)) return sources;
  const seen = new Set([file.url]);
  for (const mirror of file.mirrors.slice(0,8)) {
    try {
      const url = new URL(mirror.url);
      if (url.protocol !== 'https:' || url.username || url.password || seen.has(url.href)) continue;
      seen.add(url.href);
      sources.push({ url:url.href, label:typeof mirror.label === 'string' ? mirror.label.slice(0,80) : url.hostname });
    } catch {}
  }
  return sources;
}

export function downloadDetails(file, escape) {
  const sources = windowsSources(file);
  const changes = file.installChanges;
  const sections = [['files','Files'],['registry','Registry'],['firewall','Firewall']].flatMap(([key,label]) => {
    const values = Array.isArray(changes?.[key]) ? changes[key].filter(value => typeof value === 'string').slice(0,40) : [];
    return values.length ? [`<h4>${label}</h4><ul>${values.map(value => '<li>' + escape(value.slice(0,500)) + '</li>').join('')}</ul>`] : [];
  });
  return (sources.length > 1 ? `<label>Download source <select id="ui64-download-source">${sources.map((source,index) =>
    `<option value="${index}">${escape(source.label)} · ${escape(new URL(source.url).hostname)}</option>`).join('')}</select></label><p>All mirrors are checked against the publisher’s SHA-256.</p>` : '') +
    (sections.length ? '<details><summary>Publisher-declared installer changes</summary><p>Actual installer changes can differ.</p>' + sections.join('') + '</details>' :
    '<p class="source-note">The publisher has not declared installer changes.</p>');
}
