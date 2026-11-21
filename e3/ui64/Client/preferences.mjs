const storageKey = 'e3.ui64.discovery.v1';

export function relatedApps(registry, preferences) {
  return registry.map((app, index) => ({
    app, index,
    score: Number(preferences.categories.includes(app.category)) +
      2 * Number(preferences.publishers.includes(app.developerId))
  })).filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(entry => entry.app);
}

export function createPreferences({ catalogue, render, escape }) {
  let selected = { categories: [], publishers: [] };
  let complete = false;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(stored?.categories) && Array.isArray(stored?.publishers)) {
      selected = {
        categories: stored.categories.filter(v => typeof v === 'string').slice(0, 500),
        publishers: stored.publishers.filter(v => typeof v === 'string').slice(0, 500)
      };
      complete = true;
    }
  } catch { /* Start with empty preferences if the saved record is unreadable. */ }

  const dialog = document.createElement('dialog');
  dialog.className = 'ui64-preferences';
  dialog.setAttribute('aria-labelledby', 'ui64-preferences-title');
  document.body.append(dialog);

  function show(firstRun = false) {
    if (dialog.open) return;
    const { registry, developers } = catalogue();
    const categories = [...new Set(registry.map(app => app.category).filter(Boolean))].sort();
    const publishers = developers.filter(dev => registry.some(app => app.developerId === dev.id));
    const chip = (name, value, label) =>
      `<label class="ui64-choice"><input type="checkbox" name="${name}" value="${escape(value)}" ${selected[name].includes(value) ? 'checked' : ''}><span>${escape(label)}</span></label>`;
    dialog.innerHTML = `<form class="ui64-preferences-form">
      <header><h2 id="ui64-preferences-title">${firstRun ? 'Make Clover Store yours' : 'Discovery preferences'}</h2>
        <p>Choose categories and publishers you want to see in your Discover feed.</p></header>
      <fieldset><legend>Favourite categories</legend><div class="ui64-choice-grid">${categories.map(label => chip('categories', label, label)).join('')}</div></fieldset>
      <fieldset><legend>Favourite publishers</legend><div class="ui64-choice-grid">${publishers.map(dev => chip('publishers', dev.id, dev.displayName || dev.name || dev.id)).join('')}</div></fieldset>
      <p class="ui64-preferences-status" role="status"></p>
      <footer><button type="button" class="e3-button" data-preferences-dismiss>${firstRun ? 'Skip for now' : 'Cancel'}</button>
        <button class="e3-button primary">Save preferences</button></footer>
    </form>`;
    const form = dialog.querySelector('form');
    const commit = choice => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(choice));
        selected = choice;
        complete = true;
        dialog.close();
        render();
      } catch {
        dialog.querySelector('[role="status"]').textContent = 'Windows could not save your preferences.';
      }
    };
    form.addEventListener('submit', event => {
      event.preventDefault();
      const fields = new FormData(form);
      commit({ categories: fields.getAll('categories'), publishers: fields.getAll('publishers') });
    });
    form.querySelector('[data-preferences-dismiss]').addEventListener('click', () => {
      if (firstRun) commit(selected);
      else dialog.close();
    });
    dialog.showModal();
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-preferences-open]')) show();
  });
  return {
    maybeOnboard() { if (!complete) show(true); },
    recommendations(registry) { return relatedApps(registry, selected); }
  };
}
