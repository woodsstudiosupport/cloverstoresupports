const key = 'e3.ui64.release-watches.v1';

export function repositoryKey(input) {
  const url = new URL(input.trim());
  if (url.origin !== 'https://github.com' || url.username || url.password ||
      url.search || url.hash || !/^\/[\w.-]+\/[\w.-]+\/?$/.test(url.pathname)) {
    throw Error('Enter a GitHub repository URL, such as https://github.com/owner/project.');
  }
  return url.pathname.replace(/^\/|\/$/g, '').replace(/\.git$/i, '').toLowerCase();
}

function loadWatches() {
  try {
    const rows = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(rows) ? rows.slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function releaseAssets(release, repository) {
  return (Array.isArray(release.assets) ? release.assets : []).filter(asset => {
    try {
      const url = new URL(asset.browser_download_url);
      return url.origin === 'https://github.com' && !url.username && !url.password &&
        url.pathname.toLowerCase().startsWith('/' + repository + '/releases/download/') &&
        /\.(exe|msi|msix|msixbundle)$/i.test(asset.name);
    } catch {
      return false;
    }
  });
}

export function releaseWorkspace(render, escape) {
  let watches = loadWatches();
  const releases = new Map();
  let status = '';
  let checking = false;

  function save() {
    localStorage.setItem(key, JSON.stringify(watches));
  }

  async function refresh() {
    if (checking || !watches.length) return;
    checking = true;
    status = 'Checking GitHub…';
    if (location.hash === '#/releases') render();
    let errors = 0;
    for (const row of [...watches]) {
      try {
        const response = await fetch('https://api.github.com/repos/' + row.repo + '/releases/latest', {
          credentials: 'omit', signal: AbortSignal.timeout(7000)
        });
        if (!response.ok) throw Error('GitHub returned ' + response.status);
        const release = await response.json();
        if (typeof release.tag_name !== 'string') throw Error('Missing release tag');
        if (watches.includes(row)) releases.set(row.repo, release);
      } catch {
        errors++;
      }
    }
    checking = false;
    status = errors ? `Could not refresh ${errors} repositories. Previously loaded results are retained.` : 'Release watch is up to date.';
    if (location.hash === '#/releases') render();
  }

  document.addEventListener('submit', event => {
    if (event.target.id !== 'ui64-watch-form') return;
    event.preventDefault();
    try {
      const repo = repositoryKey(String(new FormData(event.target).get('repository')));
      if (watches.some(row => row.repo === repo)) throw Error('This repository is already watched.');
      if (watches.length >= 12) throw Error('Remove a repository before adding another.');
      watches.push({ repo, pinned: '', skipped: '' });
      save();
      void refresh();
    } catch (error) {
      status = error.message;
    }
    render();
  });

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-watch]');
    if (!button) return;
    const row = watches.find(item => item.repo === button.dataset.repo);
    if (button.dataset.watch === 'refresh') { void refresh(); return; }
    if (!row) return;
    const tag = releases.get(row.repo)?.tag_name;
    switch (button.dataset.watch) {
      case 'remove': watches = watches.filter(item => item !== row); releases.delete(row.repo); break;
      case 'pin': row.pinned = row.pinned ? '' : tag || ''; break;
      case 'skip': row.skipped = row.skipped === tag ? '' : tag || ''; break;
    }
    save();
    render();
  });

  setInterval(() => { if (!document.hidden) void refresh(); }, 600000);
  void refresh();

  const action = (name, label, repo) =>
    `<button class="e3-button" data-watch="${name}" data-repo="${escape(repo)}">${label}</button>`;
  return () => `<section class="ui64-workspace">
    <header><h1>Release Watch</h1><p>Track Windows installers published by GitHub repositories.</p></header>
    <form id="ui64-watch-form" class="ui64-watch-form">
      <label for="ui64-repository">GitHub repository URL</label>
      <input id="ui64-repository" name="repository" type="url" placeholder="https://github.com/owner/project" required>
      <button class="e3-button primary">Watch repository</button>
    </form>
    <div class="ui64-actions">${action('refresh', 'Check now', '')}<p role="status">${escape(status)}</p></div>
    <div class="ui64-watch-grid">${watches.map(row => {
      const release = releases.get(row.repo);
      const tag = release?.tag_name;
      const suppressed = tag && ((row.pinned && row.pinned !== tag) || row.skipped === tag);
      const assets = tag && !suppressed ? releaseAssets(release, row.repo) : [];
      return `<article class="panel"><h2>${escape(row.repo)}</h2>
        <p>${tag ? 'Latest release · ' + escape(tag) : 'Awaiting release details'}</p>
        ${row.pinned ? '<p>Pinned to ' + escape(row.pinned) + '</p>' : ''}
        ${suppressed ? '<p>This release is hidden by your version preference.</p>' : ''}
        ${tag && !suppressed && typeof release.body === 'string' && release.body ?
          '<details><summary>Release notes</summary><p class="ui64-release-notes">' + escape(release.body.slice(0, 12000)) + '</p></details>' : ''}
        ${assets.map(asset => `<button class="e3-button" data-action="website" data-url="${escape(asset.browser_download_url)}">${escape(asset.name)}</button>`).join('')}
        <div class="ui64-actions">${tag || row.pinned ? action('pin', row.pinned ? 'Unpin' : 'Pin current tag', row.repo) : ''}
          ${tag ? action('skip', row.skipped === tag ? 'Show release' : 'Skip this release', row.repo) : ''}
          ${action('remove', 'Remove watch', row.repo)}</div>
      </article>`;
    }).join('')}</div>
  </section>`;
}
