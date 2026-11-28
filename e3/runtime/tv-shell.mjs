import qrcode from './tv-qr.mjs';

export function tvSupported(app, file) {
  return file?.platform === 'android' && (file.tvSupported ?? app?.e3?.tv?.supported) === true;
}

export function drawHandoff(canvas, url) {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const count = qr.getModuleCount();
  canvas.width = canvas.height = (count + 8) * 5;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000';
  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      if (qr.isDark(y, x)) context.fillRect((x + 4) * 5, (y + 4) * 5, 5, 5);
    }
  }
}

export function tvHome({apps, saved, recent, picks, fileFor, artwork, escape}) {
  const featured = apps.find(app => tvSupported(app, fileFor(app))) || apps.find(app => fileFor(app)) || apps[0];
  const byIds = ids => ids.map(id => apps.find(app => app.id === id)).filter(Boolean);
  const shelf = (key, title, rows) => rows.length ? `<section class="tv-shelf"><h2>${title}</h2><div class="tv-shelf-track" data-shelf="${key}">${rows.map(app => `<button class="tv-card" data-action="app" data-id="${escape(app.id)}">${artwork(app)}<strong>${escape(app.name)}</strong><small>${tvSupported(app,fileFor(app)) ? 'TV support declared' : 'TV support unknown'}</small></button>`).join('')}</div></section>` : '';
  return (featured ? `<section class="tv-feature"><div><p class="eyebrow">CLOVER STORE</p><h1>${escape(featured.name)}</h1><p>${escape(featured.description || '')}</p><button class="e3-button primary" data-action="app" data-id="${escape(featured.id)}">View app</button></div>${artwork(featured,'large')}</section>` : '')+
    shelf('compatible','Made for this TV',apps.filter(app=>tvSupported(app,fileFor(app))))+
    shelf('saved','Saved for Later',byIds(saved))+shelf('recent','Continue Discovering',byIds(recent))+
    shelf('picks','For you',picks)+shelf('catalogue','Browse apps',apps);
}

export function tvShell({page, body, escape, logo}) {
  const tabs = [['discover','Discover'],['explore','Search'],['library','Library'],['updates','Updates'],['downloads','Downloads'],['settings','Settings']];
  return `<div class="e3-shell tv-shell"><header class="tv-header"><img src="${escape(logo)}" alt="Clover Store"><nav aria-label="TV navigation">${tabs.map(([id,title])=>`<a href="#/${id}" ${id===page?'aria-current="page"':''}>${title}</a>`).join('')}</nav></header><main id="e3-main"><div class="e3-page">${body}</div></main></div>`;
}
