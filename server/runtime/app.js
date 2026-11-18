/* Exported ATROX runtime. No framework or build step required. */
(async function () {
  const config = window.__ATROX_MODEL__ || (await fetch('./app.config.json').then((r) => r.json()));
  const root = document.querySelector('#app');
  const escape = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  let active = config.pages[0],
    rows = [],
    search = '',
    loading = false,
    error = '',
    loadId = 0;
  document.title = config.name;
  document.body.dataset.theme = config.theme;
  document.body.dataset.density = config.density;
  document.documentElement.style.setProperty('--accent', config.accent);
  async function api(method, page, row, data) {
    if (window.__ATROX_REQUEST__) return window.__ATROX_REQUEST__({ method, page, row, data });
    if (window.__ATROX_STATIC__) {
      const key = 'atrox.records.' + config.name + '.' + page;
      const records = JSON.parse(localStorage.getItem(key) || '[]');
      if (method === 'GET') return records;
      if (method === 'POST') records.unshift({ id: crypto.randomUUID(), data });
      if (method === 'PUT') {
        const hit = records.find((x) => x.id === row);
        if (!hit) throw Error('Record not found');
        hit.data = data;
      }
      if (method === 'DELETE') {
        const i = records.findIndex((x) => x.id === row);
        if (i >= 0) records.splice(i, 1);
      }
      localStorage.setItem(key, JSON.stringify(records));
      return { ok: true };
    }
    const r = await fetch(
      '/api/records/' + encodeURIComponent(page) + (row ? '/' + encodeURIComponent(row) : ''),
      {
        method,
        headers: { 'Content-Type': 'application/json', 'X-ATROX-App': 'records' },
        body: data ? JSON.stringify(data) : undefined,
      },
    );
    const result = await r.json();
    if (!r.ok) throw Error(result.error || 'Record request failed');
    return result;
  }
  async function load() {
    const rev = ++loadId;
    loading = true;
    error = '';
    render();
    try {
      const value = await api('GET', active.id);
      if (rev === loadId) rows = value;
    } catch (e) {
      if (rev === loadId) error = e.message;
    } finally {
      if (rev === loadId) {
        loading = false;
        render();
      }
    }
  }
  const filtered = () =>
    rows.filter((r) =>
      Object.values(r.data).join(' ').toLowerCase().includes(search.toLowerCase()),
    );
  const button = (label, act, style = '') =>
    `<button class="${style}" data-act="${act}">${escape(label)}</button>`;
  function table() {
    return `<div class="table-scroll"><table><thead><tr>${active.fields.map((f) => `<th>${escape(f.label)}</th>`).join('')}<th></th></tr></thead><tbody>${filtered()
      .map(
        (r) =>
          `<tr>${active.fields.map((f) => `<td>${escape(r.data[f.key])}</td>`).join('')}<td><button data-edit="${escape(r.id)}">Edit</button></td></tr>`,
      )
      .join(
        '',
      )}</tbody></table></div>${!filtered().length ? `<div class="empty">${loading ? 'Loading records…' : search ? 'No matching records.' : 'No records yet. Add your first entry.'}</div>` : ''}`;
  }
  function component(c) {
    const title = escape(c.title),
      text = c.text ? `<p>${escape(c.text)}</p>` : '';
    let inner = '';
    const nav = config.pages
      .map(
        (p) =>
          `<button class="${p.id === active.id ? 'sel' : ''}" data-page="${escape(p.id)}">${escape(p.title)}</button>`,
      )
      .join('');
    switch (c.type) {
      case 'header':
        inner = `<small>WORKSPACE / ${escape(active.title.toUpperCase())}</small><div class="row"><div><h1>${title}</h1>${text || `<p>Manage your ${escape(active.title.toLowerCase())} in one place.</p>`}</div>${button('+ Add entry', 'add', 'primary')}</div>`;
        break;
      case 'cards':
        inner = `<div class="metrics"><div><small>TOTAL RECORDS</small><strong>${rows.length}</strong></div><div><small>DATA FIELDS</small><strong>${active.fields.length}</strong></div><div><small>COLLECTIONS</small><strong>${config.pages.length}</strong></div></div>${text}`;
        break;
      case 'table':
        inner = `<div class="panel"><div class="row"><h3>${title}</h3><input data-search placeholder="Search records…" aria-label="Search records" value="${escape(search)}"></div>${text}<div data-table>${table()}</div></div>`;
        break;
      case 'chart': {
        const f = active.fields.find((f) => f.type === 'number');
        const counts = f
          ? rows.slice(0, 10).map((r) => [r.data[active.fields[0].key], Number(r.data[f.key]) || 0])
          : Object.entries(
              rows.reduce((a, r) => {
                const v = String(r.data[active.fields.at(-1).key] || 'Other');
                a[v] = (a[v] || 0) + 1;
                return a;
              }, Object.create(null)),
            ).slice(0, 10);
        const max = Math.max(1, ...counts.map((x) => Number(x[1])));
        inner = `<div class="panel"><h3>${title}</h3>${text}${counts.map(([k, n]) => `<div class="barrow"><span>${escape(k)}</span><i style="width:${Math.max(1, (100 * n) / max)}%"></i><b>${escape(n)}</b></div>`).join('') || '<p>Add a record to chart your data.</p>'}</div>`;
        break;
      }
      case 'input':
        inner = `<label>${title}<input data-search placeholder="Filter this collection" value="${escape(search)}"></label>${text}`;
        break;
      case 'form':
        inner = `<div class="panel"><h3>${title}</h3>${text}<form data-inline>${fields()}<button class="primary">Save entry</button></form></div>`;
        break;
      case 'button':
      case 'modal':
        inner = button(c.title || 'New entry', 'add', 'primary') + text;
        break;
      case 'navigation':
      case 'sidebar':
        inner = `<nav class="secondary ${c.type}">${nav}</nav>${text}`;
        break;
      case 'footer':
        inner = `<footer>${title} ${text}</footer>`;
        break;
    }
    return `<section style="margin-bottom:${Number(c.spacing)}px;${c.color ? '--accent:' + c.color + ';color:' + c.color : ''}">${inner}</section>`;
  }
  function fields(data = {}) {
    return active.fields
      .map(
        (f, i) =>
          `<label>${escape(f.label)}<input name="${escape(f.key)}" type="${escape(f.type)}" maxlength="1000" ${i === 0 ? 'required' : ''} value="${escape(data[f.key])}"></label>`,
      )
      .join('');
  }
  function render() {
    root.innerHTML = `<div class="shell ${config.layout}"><aside><div class="brand"><b>${escape(config.name[0])}</b>${escape(config.name)}</div><small>COLLECTIONS</small><nav>${config.pages.map((p) => `<button data-page="${escape(p.id)}" class="${active.id === p.id ? 'sel' : ''}"><span>◇</span> ${escape(p.title)}</button>`).join('')}</nav><div class="built">Built with ATROX</div></aside><main>${error ? `<p class="err" role="alert">${escape(error)}</p>` : ''}${active.components.map(component).join('') || '<p>Use the visual builder to add components to this page.</p>'}</main></div>`;
  }
  function dialog(row) {
    const d = document.createElement('dialog');
    d.innerHTML = `<h2>${row ? 'Edit' : 'New'} entry</h2><form>${fields(row?.data)}<p class="err" role="alert"></p><div class="actions"><button type="button" data-dismiss>Cancel</button>${row ? '<button type="button" data-remove>Delete</button>' : ''}<button class="primary">Save entry</button></div></form>`;
    document.body.append(d);
    d.addEventListener('close', () => d.remove());
    d.querySelector('[data-dismiss]').onclick = () => d.close();
    d.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api(
          row ? 'PUT' : 'POST',
          active.id,
          row?.id,
          Object.fromEntries(new FormData(e.target)),
        );
        d.close();
        await load();
      } catch (err) {
        d.querySelector('.err').textContent = err.message;
      }
    };
    const del = d.querySelector('[data-remove]');
    if (del)
      del.onclick = async () => {
        if (del.textContent !== 'Confirm delete') {
          del.textContent = 'Confirm delete';
          return;
        }
        try {
          await api('DELETE', active.id, row.id);
          d.close();
          await load();
        } catch (err) {
          d.querySelector('.err').textContent = err.message;
        }
      };
    d.showModal();
  }
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.page) {
      active = config.pages.find((p) => p.id === b.dataset.page);
      rows = [];
      search = '';
      load();
    }
    if (b.dataset.act === 'add') dialog();
    if (b.dataset.edit) dialog(rows.find((r) => r.id === b.dataset.edit));
  });
  root.addEventListener('input', (e) => {
    if (e.target.matches('[data-search]')) {
      search = e.target.value;
      root.querySelectorAll('[data-table]').forEach((t) => (t.innerHTML = table()));
    }
  });
  root.addEventListener('submit', async (e) => {
    if (!e.target.matches('[data-inline]')) return;
    e.preventDefault();
    try {
      await api('POST', active.id, null, Object.fromEntries(new FormData(e.target)));
      await load();
    } catch (err) {
      error = err.message;
      render();
    }
  });
  if (window.__ATROX_REQUEST__)
    addEventListener('message', (e) => {
      if (e.source !== parent || e.data?.type !== 'atrox:design') return;
      Object.assign(config, e.data.spec);
      active = config.pages.find((p) => p.id === e.data.page) || config.pages[0];
      document.body.dataset.theme = config.theme;
      document.body.dataset.density = config.density;
      document.documentElement.style.setProperty('--accent', config.accent);
      load();
    });
  await load();
})().catch((e) => {
  document.querySelector('#app').textContent = 'Application error: ' + e.message;
  throw e;
});
