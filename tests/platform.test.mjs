import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { unzipSync, strFromU8 } from 'fflate';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';
import { openDB } from '../server/db.mjs';
import { vault } from '../server/security.mjs';
import { catalog, localSpec } from '../shared/catalog.mjs';
import { compile, validateFiles } from '../server/compiler.mjs';
import { routed } from '../server/providers.mjs';
const header = ['X-ATROX-Request', 'workspace'];
const fixture = (t, extra = {}) => {
  const db = openDB(':memory:');
  t.after(() => db.close());
  const { app } = createApp({ db, key: '11'.repeat(32), ...extra });
  const agent = request.agent(app),
    write = (url, body = {}, verb = 'post') =>
      agent[verb]('/api' + url)
        .set(...header)
        .send(body);
  return {
    db,
    app,
    agent,
    write,
    guest: () => write('/session/guest').expect(201),
    state: async () => (await agent.get('/api/workspace').expect(200)).body,
  };
};
test('all starter specifications compile into runnable exported source', () => {
  for (const t of catalog) {
    const s = localSpec(t.prompt, t.kind),
      files = compile(s);
    assert.equal(s.name, t.name);
    assert.ok(files['server.mjs']);
    assert.ok(files['schema.sql']);
    assert.ok(files['tests/application.test.mjs']);
    validateFiles(files);
  }
});
test('private session, honest initial counts, named sources, and authorization', async (t) => {
  const f = fixture(t);
  await f.agent.get('/api/workspace').expect(401);
  await f.agent.post('/api/session/guest').expect(403);
  await f.agent
    .post('/api/session/guest')
    .set(...header)
    .set('Sec-Fetch-Site', 'cross-site')
    .expect(403);
  const r = await f.guest();
  assert.match(r.headers['set-cookie'][0], /HttpOnly/);
  const st = await f.state();
  assert.equal(st.projects.length, 3);
  assert.equal(st.monthly.requests, 0);
  assert.ok(st.providers.every((p) => !p.configured));
  const other = request.agent(f.app);
  await other
    .post('/api/session/guest')
    .set(...header)
    .expect(201);
  const pid = st.projects[0].id;
  for (const path of ['', '/preview', '/frame', '/export', '/records/contacts'])
    await other.get('/api/projects/' + pid + path).expect(404);
  await other
    .delete('/api/projects/' + pid)
    .set(...header)
    .expect(404);
  await f.write('/session/guest').expect(200);
  assert.equal((await f.state()).projects.length, 3);
});
test('plan → build → edit → refine → restore → export; project memory and data survive', async (t) => {
  const f = fixture(t);
  await f.guest();
  await f
    .write(
      '/profile',
      {
        name: 'Studio owner',
        preferences: { mode: 'Balanced', instructions: 'Prefer concise labels.' },
      },
      'put',
    )
    .expect(200);
  const plan = (
    await f
      .write('/plans', {
        prompt: 'Create a customer management system named Atlas',
        provider: 'local',
      })
      .expect(200)
  ).body;
  assert.equal(plan.source, 'Local engine');
  plan.spec.name = 'Atlas Workspace';
  const pid = (await f.write('/projects', { spec: plan.spec }).expect(201)).body.id,
    base = '/projects/' + pid;
  let p = (await f.agent.get('/api' + base)).body;
  assert.equal(p.memory.instructions, 'Prefer concise labels.');
  assert.equal(p.versions.length, 1);
  const rid = (
    await f
      .write(base + '/records/contacts', { name: 'Maria', email: 'maria@example.test' })
      .expect(201)
  ).body.id;
  await f
    .write(
      base + '/records/contacts/' + rid,
      { name: 'Maria Lee', email: 'maria@example.test' },
      'put',
    )
    .expect(200);
  await f
    .write(
      base + '/files',
      {
        path: 'styles.css',
        base: p.files['styles.css'],
        content: p.files['styles.css'] + '\n/* custom styles */',
      },
      'put',
    )
    .expect(200);
  await f
    .write(base + '/files', { path: 'styles.css', base: 'outdated file', content: 'body{}' }, 'put')
    .expect(409);
  await f
    .write(
      base + '/files',
      { path: 'tools/note.txt', create: true, content: 'personal note' },
      'put',
    )
    .expect(200);
  await f
    .write(base + '/files', { path: 'tools/note.txt', create: true, content: 'duplicate' }, 'put')
    .expect(409);
  await f.write(base + '/files', { path: 'app.js', content: 'function (' }, 'put').expect(422);
  await f.write(base + '/files', { path: '../escape.js', content: 'nothing' }, 'put').expect(400);
  await f
    .write(base + '/refine', { prompt: 'Add a reporting page', provider: 'local' })
    .expect(200);
  p = (await f.agent.get('/api' + base)).body;
  assert.ok(p.spec.pages.some((s) => s.id === 'reports'));
  assert.match(p.files['styles.css'], /custom styles/);
  assert.equal(p.files['tools/note.txt'], 'personal note');
  await f.write(base + '/refine', { prompt: 'Make pancakes', provider: 'local' }).expect(422);
  const changed = structuredClone(p.spec);
  changed.theme = 'dark';
  changed.pages[0].components.push({
    id: 'chart-new',
    type: 'chart',
    title: 'Contact analysis',
    text: '',
    color: '',
    spacing: 12,
  });
  await f.write(base + '/design', { spec: changed, base: p.updated }, 'put').expect(200);
  await f
    .write(
      base + '/memory',
      {
        instructions: 'Keep existing field names',
        requirements: ['Owner access'],
        decisions: ['Use SQLite'],
      },
      'put',
    )
    .expect(200);
  await f.write(base + '/versions', { label: 'Review checkpoint' }).expect(200);
  await f.write(base + '/versions/' + p.versions.at(-1).id + '/restore').expect(200);
  const after = (await f.agent.get('/api' + base)).body;
  assert.ok(after.versions[0].label.includes('Restored'));
  assert.equal(after.memory.instructions, 'Keep existing field names');
  assert.equal(
    (await f.agent.get('/api' + base + '/records/contacts')).body[0].data.name,
    'Maria Lee',
  );
  const frame = await f.agent.get('/api' + base + '/frame').expect(200);
  assert.match(frame.headers['content-security-policy'], /sandbox allow-scripts/);
  assert.ok(!frame.headers['content-security-policy'].includes('allow-same-origin'));
  assert.match(frame.text, /window.__ATROX_REQUEST__/);
  const zip = await f.agent
    .get('/api' + base + '/export')
    .buffer(true)
    .parse((res, cb) => {
      const parts = [];
      res.on('data', (c) => parts.push(c));
      res.on('end', () => cb(null, Buffer.concat(parts)));
    })
    .expect(200);
  const names = Object.keys(unzipSync(zip.body));
  assert.ok(names.includes('server.mjs'));
  assert.ok(!names.some((n) => n.includes('sqlite') || n.includes('secret')));
  await f.write(base + '/deploy', { confirm: 'Atlas Workspace' }).expect(409);
});
test('scrypt accounts, guest upgrade, credential rotation and recovery', async (t) => {
  const f = fixture(t);
  const guest = (await f.guest()).body.user;
  const cookie = (await f.write('/session/guest')).headers['set-cookie'];
  const signup = (
    await f
      .write('/auth/signup', {
        name: 'Ariel',
        email: 'ariel@example.test',
        password: 'strong password 123',
      })
      .expect(201)
  ).body;
  assert.equal(signup.user.id, guest.id);
  assert.equal(signup.user.guest, false);
  assert.equal((await f.state()).projects.length, 3);
  assert.ok(signup.recovery.length >= 32);
  assert.ok(!JSON.stringify(await f.state()).includes(signup.recovery));
  const stored = f.db.prepare('SELECT password,recovery FROM users WHERE id=?').get(guest.id);
  assert.notEqual(stored.password, 'strong password 123');
  assert.notEqual(stored.recovery, signup.recovery);
  await f.write('/auth/signout').expect(200);
  await f.agent.get('/api/workspace').expect(401);
  await f.write('/auth/signin', { email: 'ariel@example.test', password: 'wrong' }).expect(401);
  await f
    .write('/auth/signin', { email: 'ariel@example.test', password: 'strong password 123' })
    .expect(200);
  const reset = (
    await f
      .write('/auth/reset', {
        email: 'ariel@example.test',
        recovery: signup.recovery,
        password: 'a different password',
      })
      .expect(200)
  ).body;
  assert.notEqual(reset.recovery, signup.recovery);
  await f
    .write('/auth/reset', {
      email: 'ariel@example.test',
      recovery: signup.recovery,
      password: 'another password',
    })
    .expect(400);
  await f
    .write('/auth/signin', { email: 'ariel@example.test', password: 'strong password 123' })
    .expect(401);
});
test('real workflow effects, enabled triggers, conditions and failed execution history', async (t) => {
  const f = fixture(t);
  await f.guest();
  const st = await f.state(),
    base = '/projects/' + st.projects.find((p) => p.kind === 'crm').id;
  const steps = [
    { type: 'variable', key: 'message', value: 'Hello {{name}}' },
    { type: 'log', key: 'result', value: '{{message}}' },
    { type: 'record', key: 'deals', value: '{"name":"Welcome deal"}' },
  ];
  const def = { name: 'Welcome customer', trigger: 'record.created', enabled: true, steps };
  const wid = (await f.write(base + '/workflows', def).expect(201)).body.id;
  const run = (
    await f.write(base + '/workflows/' + wid + '/run', { input: { name: 'Kai' } }).expect(200)
  ).body;
  assert.equal(run.status, 'success');
  assert.equal(run.log[1].message, 'Hello Kai');
  await f.write(base + '/records/contacts', { name: 'Ira' }).expect(201);
  assert.equal((await f.agent.get('/api' + base + '/records/deals')).body.length, 2);
  let p = (await f.agent.get('/api' + base)).body;
  assert.equal(p.workflows[0].executions.length, 2);
  assert.equal(p.workflows[0].executions[0].log[1].message, 'Hello Ira');
  await f.write(
    base + '/workflows/' + wid,
    {
      ...def,
      enabled: false,
      steps: [{ type: 'condition', key: 'name', value: 'Ariel' }, ...steps],
    },
    'put',
  );
  const skip = (await f.write(base + '/workflows/' + wid + '/run', { input: { name: 'Kai' } }))
    .body;
  assert.equal(skip.status, 'skipped');
  await f.write(
    base + '/workflows/' + wid,
    { ...def, enabled: false, steps: [{ type: 'ai', key: 'result', value: 'Say hello.' }] },
    'put',
  );
  assert.equal((await f.write(base + '/workflows/' + wid + '/run')).body.status, 'error');
  await f.write(base + '/records/contacts', { name: 'Kim' });
  assert.equal((await f.agent.get('/api' + base + '/records/deals')).body.length, 2);
});
test('provider secrets never round-trip; safe opt-in fallback tracks actual attempts', async (t) => {
  const calls = [];
  const f = fixture(t, {
    fetchFn: async (url) => {
      calls.push(url);
      return url.includes('anthropic')
        ? new Response('{}', { status: 429 })
        : Response.json({
            output: [{ content: [{ text: 'Reviewed source.' }] }],
            usage: { input_tokens: 12, output_tokens: 4 },
          });
    },
  });
  await f.guest();
  for (const [slug, model] of [
    ['openai', 'gpt-4.1'],
    ['anthropic', 'claude-sonnet-4-5'],
  ])
    await f
      .write('/providers/' + slug, { model, secret: 'test-only-credential', fallback: true }, 'put')
      .expect(200);
  const st = await f.state();
  assert.ok(!JSON.stringify(st).includes('test-only-credential'));
  assert.ok(
    !f.db
      .prepare('SELECT secret FROM ai_providers LIMIT 1')
      .get()
      .secret.includes('test-only-credential'),
  );
  const r = await f
    .write('/projects/' + st.projects[0].id + '/assist', { path: 'app.js', action: 'Explain code' })
    .expect(200);
  assert.match(r.body.source, /OpenAI/);
  assert.match(r.body.notes.join(' '), /Switched to the configured fallback/);
  assert.equal(calls.length, 2);
  const after = await f.state();
  assert.equal(after.monthly.requests, 2);
  assert.equal(after.monthly.tokens, 16);
  assert.deepEqual(after.usage.map((x) => x.status).sort(), ['error', 'success']);
  await f.write('/providers/anthropic', { model: 'claude-sonnet-4-5', fallback: false }, 'put');
  await f
    .write('/projects/' + st.projects[0].id + '/assist', { path: 'app.js', action: 'Explain code' })
    .expect(502);
  assert.equal(calls.length, 3);
  await f.write('/providers/openai', {}, 'delete');
  assert.ok(!(await f.state()).providers.find((p) => p.slug === 'openai').configured);
});
test('limits, unavailable integrations and invalid input fail without pretending success', async (t) => {
  const f = fixture(t);
  await f.guest();
  const state = await f.state(),
    base = '/projects/' + state.projects[0].id;
  await f.write('/plans', { prompt: 'a' }).expect(400);
  await f.write('/integrations/webhook', { url: 'http://127.0.0.1/internal' }, 'put').expect(400);
  await f.write('/billing/checkout', { plan: 'pro' }).expect(503);
  await f.write(base + '/records/contacts', { name: 'Sam', email: 'not an address' }).expect(400);
  await f.write(base + '/records/missing', { name: 'Sam' }).expect(404);
  const spec = localSpec('Build a tracker for books');
  for (let i = 3; i < state.plans.free.projects; i++)
    await f.write('/projects', { spec }).expect(201);
  await f.write('/projects', { spec }).expect(409);
  assert.equal((await f.state()).projects.length, state.plans.free.projects);
});
test('migrations are repeatable and private projects persist across server instances', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'atrox-db-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  let f = createApp({ dir, key: '22'.repeat(32) });
  const guest = await request(f.app)
    .post('/api/session/guest')
    .set(...header)
    .expect(201);
  const cookie = guest.headers['set-cookie'][0].split(';')[0];
  f.db.close();
  f = createApp({ dir, key: '22'.repeat(32) });
  const state = await request(f.app).get('/api/workspace').set('Cookie', cookie).expect(200);
  assert.equal(state.body.projects.length, 3);
  assert.equal(state.body.user.id, guest.body.user.id);
  assert.equal(f.db.prepare('SELECT count(*) n FROM schema_migrations').get().n, 3);
  f.db.close();
});
test('explicit natural-language fields and actual streamed compiler events', async (t) => {
  const f = fixture(t);
  await f.guest();
  const b = (
    await f
      .write('/plans', {
        prompt:
          'Build a book catalog named "Archive". Fields: title, author, price. Pages: reviews. Use dark mode.',
      })
      .expect(200)
  ).body;
  assert.equal(b.spec.name, 'Archive');
  assert.equal(b.spec.theme, 'dark');
  assert.deepEqual(
    b.spec.pages[0].fields.map((x) => x.key),
    ['title', 'author', 'price'],
  );
  assert.equal(b.spec.pages[0].fields[2].type, 'number');
  assert.ok(b.spec.pages.some((x) => x.id === 'reviews'));
  const stream = await f.write('/projects/build', { spec: b.spec }).expect(200);
  const events = stream.text
    .trim()
    .split('\n')
    .map((x) => JSON.parse(x));
  assert.equal(events.filter((x) => x.state === 'complete').length, 4);
  const p = await f.agent.get('/api/projects/' + events.at(-1).id).expect(200);
  assert.deepEqual(
    p.body.build,
    events.filter((x) => x.state === 'complete'),
  );
  assert.ok(p.body.build.every((x) => typeof x.durationMs === 'number'));
});
test('signed billing lifecycle: reject invalid signatures, deduplicate and ignore stale events', async (t) => {
  const { createHmac } = await import('node:crypto');
  const keys = {
      STRIPE_SECRET_KEY: 'test-only',
      STRIPE_WEBHOOK_SECRET: 'local-test-signature',
      STRIPE_PRO_PRICE: 'price_pro_test',
      STRIPE_TEAM_PRICE: 'price_team_test',
      APP_ORIGIN: 'https://atrox.example.test',
    },
    prev = {};
  for (const [k, v] of Object.entries(keys)) {
    prev[k] = process.env[k];
    process.env[k] = v;
  }
  t.after(() => {
    for (const [k, v] of Object.entries(prev))
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
  });
  const f = fixture(t);
  await f.guest();
  const uid = (await f.state()).user.id;
  const deliver = (eid, tm, status, valid = true) => {
    const raw = JSON.stringify({
        id: eid,
        type:
          status === 'canceled' ? 'customer.subscription.deleted' : 'customer.subscription.updated',
        created: tm,
        data: {
          object: {
            id: 'test-subscription',
            metadata: { atrox_user: uid },
            status,
            items: { data: [{ price: { id: 'price_pro_test' } }] },
          },
        },
      }),
      ts = Math.floor(Date.now() / 1000),
      sig = createHmac('sha256', valid ? keys.STRIPE_WEBHOOK_SECRET : 'incorrect-test-secret')
        .update(ts + '.' + raw)
        .digest('hex');
    return request(f.app)
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', `t=${ts},v1=${sig}`)
      .send(raw);
  };
  await deliver('invalid', 100, 'active', false).expect(400);
  assert.equal((await f.state()).user.plan, 'free');
  await deliver('started', 100, 'active').expect(200);
  assert.equal((await f.state()).user.plan, 'pro');
  await deliver('started', 100, 'active').expect(200);
  await deliver('ended', 200, 'canceled').expect(200);
  await deliver('late', 120, 'active').expect(200);
  assert.equal((await f.state()).user.plan, 'free');
  assert.equal(f.db.prepare('SELECT count(*) n FROM billing_events').get().n, 3);
});
