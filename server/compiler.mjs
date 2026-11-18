import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { zipSync, strToU8 } from 'fflate';
import { catalog, slug, localSpec, pageFrom, pretty } from '../shared/catalog.mjs';
import { specSchema, filePath } from './schema.mjs';
import { fail, id, now, audit, transaction } from './db.mjs';
const base = Object.fromEntries(
  ['index.html', 'styles.css', 'app.js', 'server.mjs'].map((f) => [
    f,
    readFileSync(new URL('./runtime/' + f, import.meta.url), 'utf8'),
  ]),
);
export const architecture = [
  'Responsive HTML, CSS and JavaScript client',
  'Node.js HTTP API with server-side field validation',
  'SQLite records scoped by collection',
  'Optional password-protected standalone server',
];
export function compile(spec) {
  specSchema.parse(spec);
  return {
    ...base,
    'app.config.json': JSON.stringify(spec, null, 2),
    'schema.sql':
      'CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, page TEXT NOT NULL, data TEXT NOT NULL);\nCREATE INDEX IF NOT EXISTS records_page ON records(page);\n',
    'package.json': JSON.stringify(
      {
        name: slug(spec.name),
        private: true,
        version: '1.0.0',
        type: 'module',
        engines: { node: '>=22.13' },
        scripts: { start: 'node server.mjs', test: 'node --test tests/*.test.mjs' },
      },
      null,
      2,
    ),
    'tests/application.test.mjs': `import {test} from 'node:test';\nimport assert from 'node:assert/strict';\nimport {readFileSync} from 'node:fs';\nconst config = JSON.parse(readFileSync(new URL('../app.config.json',import.meta.url),'utf8'));\ntest('every collection has a unique route and fields',()=>{assert.ok(config.pages.length);assert.equal(new Set(config.pages.map(p=>p.id)).size,config.pages.length);for(const p of config.pages)assert.ok(p.fields.length)});\n`,
    'README.md': `# ${spec.name}\n\n${spec.summary}\n\n## Run locally\nRequires Node.js 22.13 or newer. Run \`npm test\` and \`npm start\`. Open http://127.0.0.1:3000. No dependencies or credentials are required.\n\n## Configuration\nEdit app.config.json to change pages, components and fields. Records are persisted in data/app.sqlite. Workspace preview records are private and are not included in source exports.\n\n## Deploy\nUse a persistent disk and an HTTPS reverse proxy. Set HOST=0.0.0.0, PORT, and a strong ATROX_APP_PASSWORD (login: owner). Authentication is single-owner, not multi-tenant. Do not publish without authentication.\n\n## API\nGET/POST /api/records/:collection; PUT/DELETE /api/records/:collection/:id. Writes require X-ATROX-App: records.\n\nMade with ATROX — Describe it. Build it. Own it.\n`,
  };
}
export function validateFiles(files) {
  for (const [path, content] of Object.entries(files)) {
    filePath.parse(path);
    if (Buffer.byteLength(content) > 180000) fail(400, 'A source file exceeds 180 KB.');
    try {
      if (path.endsWith('.json')) JSON.parse(content);
      if (path.endsWith('.js') && !/^\s*(?:import|export)\s/m.test(content))
        new Script(content, { filename: path });
    } catch (e) {
      fail(422, `${path}: ${e.message}`);
    }
  }
  if (!files['index.html']?.trim()) fail(422, 'index.html must contain a document.');
  if (files['app.config.json']) specSchema.parse(JSON.parse(files['app.config.json']));
  if (Object.keys(files).length > 64 || JSON.stringify(files).length > 600000)
    fail(400, 'Project source limit reached (64 files / 600 KB).');
}
export const getFiles = (db, p) =>
  Object.fromEntries(
    db
      .prepare('SELECT path,content FROM project_files WHERE project_id=? ORDER BY path')
      .all(p)
      .map((f) => [f.path, f.content]),
  );
export function snapshot(db, project, label) {
  const count = db
    .prepare('SELECT COALESCE(MAX(number),0)+1 AS n FROM project_versions WHERE project_id=?')
    .get(project).n;
  db.prepare('INSERT INTO project_versions VALUES(?,?,?,?,?,?)').run(
    id(),
    project,
    count,
    label,
    JSON.stringify(getFiles(db, project)),
    now(),
  );
  db.prepare('DELETE FROM project_versions WHERE project_id=? AND number<=?').run(
    project,
    count - 30,
  );
  return count;
}
export function insertProject(
  db,
  user,
  spec,
  label = 'Application generated',
  seed = false,
  onStage = () => {},
) {
  const pid = id(),
    tm = now(),
    report = [];
  const stage = (name, work, detail) => {
    onStage({ stage: name, state: 'running' });
    const start = performance.now();
    const result = work();
    const entry = {
      stage: name,
      state: 'complete',
      detail: typeof detail === 'function' ? detail(result) : detail,
      durationMs: Math.round((performance.now() - start) * 100) / 100,
    };
    report.push(entry);
    onStage(entry);
    return result;
  };
  const files = stage(
    'Creating files',
    () => compile(spec),
    (result) =>
      Object.keys(result).length + ' source files created from the approved specification.',
  );
  stage(
    'Building application',
    () => {
      const model = JSON.parse(files['app.config.json']);
      if (!files['app.js'] || !files['styles.css'] || !model.pages.length)
        fail(422, 'Runtime source is incomplete.');
      return model;
    },
    spec.pages.length + ' collections bound to the browser client and Node.js API.',
  );
  stage(
    'Running validation',
    () => validateFiles(files),
    'Application schema, JSON, browser JavaScript syntax and source size checks passed.',
  );
  stage(
    'Preparing preview',
    () => previewHTML(files),
    'Local scripts and styles resolved into an isolated preview document.',
  );
  db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?,?,?)').run(
    pid,
    user,
    spec.name,
    spec.summary,
    spec.kind,
    JSON.stringify(spec),
    tm,
    tm,
  );
  const put = db.prepare('INSERT INTO project_files VALUES(?,?,?)');
  for (const [p, c] of Object.entries(files)) put.run(pid, p, c);
  db.prepare('INSERT INTO project_memory VALUES(?,?,?,?)').run(
    pid,
    JSON.parse(db.prepare('SELECT preferences FROM users WHERE id=?').get(user).preferences)
      .instructions || '',
    JSON.stringify(spec.features),
    JSON.stringify(architecture),
  );
  snapshot(db, pid, label);
  if (seed) {
    const samples = catalog.find((t) => t.kind === spec.kind)?.samples || [],
      page = spec.pages[0];
    for (const values of samples)
      db.prepare('INSERT INTO records VALUES(?,?,?,?,?)').run(
        id(),
        pid,
        page.id,
        JSON.stringify(Object.fromEntries(page.fields.map((f, i) => [f.key, values[i] || '']))),
        tm,
      );
  }
  db.prepare('INSERT INTO project_builds VALUES(?,?,?)').run(pid, JSON.stringify(report), tm);
  audit(db, user, pid, label, spec.name);
  return pid;
}
export function seedWorkspace(db, user) {
  for (const t of [...catalog.slice(0, 3)].reverse()) {
    const spec = localSpec(t.prompt, t.kind);
    spec.summary = t.description;
    insertProject(db, user, spec, 'Starter project added', true);
  }
}
export function applySpec(db, project, user, next, label) {
  const spec = specSchema.parse(next);
  transaction(db, () => {
    db.prepare('UPDATE projects SET spec=?,name=?,description=?,kind=?,updated=? WHERE id=?').run(
      JSON.stringify(spec),
      spec.name,
      spec.summary,
      spec.kind,
      now(),
      project,
    );
    db.prepare(
      "UPDATE project_files SET content=? WHERE project_id=? AND path='app.config.json'",
    ).run(JSON.stringify(spec, null, 2), project);
    snapshot(db, project, label);
    audit(db, user, project, label, spec.name);
  });
  return spec;
}
export function localRefine(spec, prompt) {
  const s = structuredClone(spec),
    text = prompt.toLowerCase();
  let changes = [];
  if (/dark|light mode|light theme/.test(text)) {
    s.theme = /dark/.test(text) ? 'dark' : 'light';
    changes.push('theme');
  }
  if (/minimal|compact|dense|spacious|comfortable/.test(text)) {
    s.density = /spacious|comfortable/.test(text) ? 'comfortable' : 'compact';
    changes.push('spacing');
  }
  if (/navigation|sidebar|top bar|top menu/.test(text)) {
    s.layout = /sidebar|side navigation/.test(text) ? 'sidebar' : 'top';
    changes.push('navigation');
  }
  const color =
    text.match(/#[\da-f]{6}\b/)?.[0] ||
    /(?:accent|color|theme).*\b(blue|purple|green|red|orange)\b/.exec(text)?.[1];
  if (color) {
    s.accent =
      { blue: '#5294E5', purple: '#AD8CF1', green: '#64B58A', red: '#E32636', orange: '#DFA455' }[
        color
      ] || color;
    changes.push('accent');
  }
  if (/(?:add|create|include|build)\b/.test(text)) {
    if (/chart|graph/.test(text)) {
      s.pages[0].components.push({
        id: id(),
        type: 'chart',
        title: 'Data overview',
        text: '',
        spacing: 16,
        color: '',
      });
      changes.push('chart');
    } else {
      const raw = text
        .replace(/^.*?(?:add|create|include|build)\s+(?:an?\s+)?/, '')
        .replace(/\s+(?:management\s+)?(?:page|feature|collection|section|module).*$/, '')
        .replace(/[.!?]/g, '')
        .trim();
      let title = pretty(raw).slice(0, 50) || 'Reports';
      if (/customer/.test(raw)) title = 'Customers';
      if (/report/.test(raw)) title = 'Reports';
      const p = pageFrom(title);
      if (s.pages.some((x) => x.id === p.id))
        fail(400, 'This collection already exists. Choose another name.');
      s.pages.push(p);
      changes.push('collection');
    }
  }
  if (!changes.length)
    fail(
      422,
      'The local engine supports adding a collection or chart, changing the accent, switching light/dark mode, spacing, and navigation. Connect an AI provider for broader changes.',
    );
  return s;
}
export function previewHTML(files) {
  const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
  let doc = files['index.html'];
  doc = doc
    .replace(/<link\b[^>]*href=["'](?:\.\/)?([^"']+\.css)["'][^>]*>/gi, (tag, p) =>
      files[p] !== undefined
        ? `<style>${files[p].replace(/<\/style/gi, '<\\/style')}</style>`
        : tag,
    )
    .replace(/<script\b[^>]*src=["'](?:\.\/)?([^"']+\.js)["'][^>]*>\s*<\/script>/gi, (tag, p) =>
      files[p] !== undefined ? `<script>${safe(files[p])}</script>` : tag,
    );
  const prefix = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'"><script>window.__ATROX_MODEL__=${(files['app.config.json'] || '{}').replace(/</g, '\\u003c')};const pending=new Map();window.addEventListener('message',e=>{if(e.source!==parent||e.data?.type!=='atrox:result')return;const cb=pending.get(e.data.ticket);if(cb){pending.delete(e.data.ticket);e.data.error?cb[1](Error(e.data.error)):cb[0](e.data.result)}});window.__ATROX_REQUEST__=request=>new Promise((resolve,reject)=>{const ticket=crypto.randomUUID();pending.set(ticket,[resolve,reject]);parent.postMessage({type:'atrox:records',ticket,request},'*');setTimeout(()=>{if(pending.delete(ticket))reject(Error('Preview request timed out'))},15000)});addEventListener('error',e=>parent.postMessage({type:'atrox:error',message:String(e.message).slice(0,300)},'*'));</script>`;
  return /<head(?:\s[^>]*)?>/i.test(doc)
    ? doc.replace(/<head(?:\s[^>]*)?>/i, (m) => m + prefix)
    : prefix + doc;
}
export const zipFiles = (files) =>
  Buffer.from(
    zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])), {
      level: 6,
    }),
  );
