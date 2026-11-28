const storageKey = 'e3.arm.discovery.v1';

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
  dialog.className = 'arm-preferences';
  dialog.setAttribute('aria-labelledby', 'arm-preferences-title');
  document.body.append(dialog);

  function show(firstRun = false) {
    if (dialog.open) return;
    const { registry, developers } = catalogue();
    const categories = [...new Set(registry.map(app => app.category).filter(Boolean))].sort();
    const publishers = developers.filter(dev => registry.some(app => app.developerId === dev.id));
    const stages = [
      { key: 'categories', title: 'What do you enjoy exploring?', text: 'Pick the categories you want in your Discover feed.', choices: categories.map(label => [label, label]) },
      { key: 'publishers', title: 'Who makes your favourite apps?', text: 'Choose publishers you want to see more often.', choices: publishers.map(dev => [dev.id, dev.displayName || dev.name || dev.id]) },
      { title: 'Your store is ready', text: 'Your choices shape the For you shelf. You can change them any time.' }
    ];
    const draft = { categories: [...selected.categories], publishers: [...selected.publishers] };
    let step = 0;
    dialog.classList.toggle('arm-onboarding', firstRun);

    function finish(choice) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(choice));
        selected = choice;
        complete = true;
        dialog.close();
        render();
      } catch {
        dialog.querySelector('[role="status"]').textContent = 'Windows could not save your preferences.';
      }
    }

    function draw(focusHeading = true) {
      const stage = stages[step];
      const choices = stage.key
        ? `<label class="arm-onboarding-search">Filter choices<input type="search" placeholder="Search ${stage.key}"></label>
          <fieldset><legend>${stage.key === 'categories' ? 'Favourite categories' : 'Favourite publishers'}</legend>
          <div class="arm-choice-grid">${stage.choices.map(([value, label]) =>
            `<label class="arm-choice"><input type="checkbox" value="${escape(value)}" ${draft[stage.key].includes(value) ? 'checked' : ''}><span>${escape(label)}</span></label>`).join('')}</div></fieldset>`
        : `<div class="panel"><p>Categories selected · ${draft.categories.length}</p><p>Publishers selected · ${draft.publishers.length}</p></div>`;
      dialog.innerHTML = `<form class="arm-preferences-form">
        <header><p>Clover Store · ${step + 1} of ${stages.length}</p>
          <progress aria-label="Onboarding progress" value="${step + 1}" max="${stages.length}"></progress>
          <h2 id="arm-preferences-title" tabindex="-1">${stage.title}</h2><p>${stage.text}</p></header>
        ${choices}
        <p class="arm-preferences-status" role="status"></p>
        <footer><button type="button" class="e3-button" data-dismiss>${firstRun ? 'Skip setup' : 'Cancel'}</button>
          ${step ? '<button type="button" class="e3-button" data-back>Back</button>' : ''}
          <button class="e3-button primary">${stage.key ? 'Continue' : 'Save and explore'}</button></footer>
      </form>`;
      const form = dialog.querySelector('form');
      form.addEventListener('submit', event => {
        event.preventDefault();
        if (step === stages.length - 1) finish(draft);
        else { step++; draw(); }
      });
      form.addEventListener('change', event => {
        if (event.target.type !== 'checkbox') return;
        const values = new Set(draft[stage.key]);
        if (event.target.checked) values.add(event.target.value);
        else values.delete(event.target.value);
        draft[stage.key] = [...values];
      });
      form.querySelector('input[type="search"]')?.addEventListener('input', event => {
        const query = event.target.value.trim().toLowerCase();
        for (const option of form.querySelectorAll('.arm-choice'))
          option.hidden = !option.textContent.toLowerCase().includes(query);
      });
      form.querySelector('[data-back]')?.addEventListener('click', () => { step--; draw(); });
      form.querySelector('[data-dismiss]').addEventListener('click', () => {
        if (firstRun) finish(selected);
        else dialog.close();
      });
      if (focusHeading) dialog.querySelector('h2').focus();
    }

    draw(false);
    dialog.showModal();
    dialog.querySelector('h2').focus();
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-preferences-open]')) show();
  });
  return {
    maybeOnboard() { if (!complete) show(true); },
    recommendations(registry) { return relatedApps(registry, selected); }
  };
}
