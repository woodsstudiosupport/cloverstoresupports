import { applyAppearance } from './shell.mjs';

const key = 'e3.ui64.palette.v1';
const colors = ['accent', 'surface', 'background'];
const presets = {
  Clover: { accent:'#96e6cd', surface:'#121b25', background:'#0b1017' },
  Orchid: { accent:'#d7b1ff', surface:'#261c35', background:'#141020' },
  Ember: { accent:'#ffc49b', surface:'#34221e', background:'#1a1214' }
};

export function readPalette(value) {
  if (value?.schemaVersion !== 1 || !colors.every(key =>
    typeof value[key] === 'string' && /^#[0-9a-f]{6}$/i.test(value[key]))) {
    throw Error('Choose an E3 palette file with three six-digit hex colours.');
  }
  return { schemaVersion:1, ...Object.fromEntries(colors.map(key => [key,value[key]])) };
}

export function themeWorkspace(platform, render, escape) {
  let status = '';
  function set(palette) {
    const validated = readPalette(palette);
    localStorage.setItem(key, JSON.stringify(validated));
    applyAppearance(validated, document.documentElement.style);
  }
  document.addEventListener('change', async event => {
    if (event.target.id !== 'ui64-theme-import') return;
    try {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 8192) throw Error('The palette must be smaller than 8 KiB.');
      set(JSON.parse(await file.text()));
      status = 'Palette imported.';
    } catch (error) { status = error.message; }
    if (location.hash === '#/themes') render();
  });
  document.addEventListener('click', async event => {
    const choice = event.target.closest('[data-ui64-theme]');
    if (!choice) return;
    try {
      const name = choice.dataset.ui64Theme;
      if (Object.hasOwn(presets,name)) {
        set({ schemaVersion:1, ...presets[name] });
        status = name + ' is active.';
      } else if (name === 'reset') {
        localStorage.removeItem(key);
        for (const color of colors) document.documentElement.style.removeProperty('--ui64-' + color);
        status = 'Using the Store palette.';
      } else if (name === 'export') {
        const palette = readPalette(JSON.parse(localStorage.getItem(key)) || { schemaVersion:1, ...presets.Clover });
        await platform.request('files.export', { name:'clover-e3-palette.json',text:JSON.stringify(palette,null,2),mime:'application/json' });
        status = 'Palette exported.';
      }
    } catch (error) { status = error.message; }
    if (location.hash === '#/themes') render();
  });
  return () => `<section class="ui64-workspace"><header><h1>Desktop palettes</h1><p>Choose a colour preset or share an E3 palette JSON file.</p></header>
    <div class="ui64-watch-grid">${Object.entries(presets).map(([name,palette]) =>
      `<article class="panel"><h2>${name}</h2><div class="ui64-actions">${colors.map(color => `<span aria-label="${color}" style="background:${palette[color]};width:30px;height:30px;border:1px solid #ffffff40;border-radius:8px"></span>`).join('')}</div>
        <button class="e3-button" data-ui64-theme="${name}">Apply ${name}</button></article>`).join('')}</div>
    <section class="panel ui64-tool-form"><label>Import palette <input id="ui64-theme-import" type="file" accept=".json,application/json"></label>
      <div class="ui64-actions"><button class="e3-button" data-ui64-theme="export">Export palette</button><button class="e3-button" data-ui64-theme="reset">Use Store palette</button></div>
      <p role="status">${escape(status)}</p></section></section>`;
}
