import express from 'express';
import { z, ZodError } from 'zod';
import { join } from 'node:path';
import { openDB, id, now, fail, audit, transaction } from './db.mjs';
import { vault, currentUser, publicUser, guardWrites, rateLimit } from './security.mjs';
import { authRoutes } from './auth.mjs';
import { projectRoutes, projectList } from './project-routes.mjs';
import { plans, registry, providerState, monthStart, boundedJSON } from './providers.mjs';
import { allowedHook } from './workflows.mjs';
import { getFiles, zipFiles } from './compiler.mjs';
import { billingReady, billingRoutes, billingWebhook } from './billing.mjs';
import { modes } from '../shared/catalog.mjs';
export function createApp(options = {}) {
  const dir = options.dir || process.env.ATROX_DATA_DIR || '.data',
    db = options.db || openDB(join(dir, 'atrox.sqlite')),
    box = vault(dir, options.key || process.env.ATROX_MASTER_KEY),
    ctx = { db, box, fetchFn: options.fetchFn || fetch };
  const app = express(),
    api = express.Router();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000');
    next();
  });
  app.get('/healthz', (_req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', service: 'ATROX' });
  });
  app.post(
    '/api/billing/webhook',
    express.raw({ type: 'application/json', limit: '128kb' }),
    billingWebhook(db),
  );
  app.use('/api', api);
  api.use(
    rateLimit(600, 60000),
    guardWrites,
    express.json({ limit: '450kb' }),
    (req, res, next) => {
      req.user = currentUser(db, req);
      res.set('Cache-Control', 'no-store');
      next();
    },
  );
  authRoutes(api, ctx);
  api.use((req, _res, next) => {
    if (!req.user) fail(401, 'Open a workspace or sign in to continue.');
    next();
  });
  api.get('/workspace', (req, res) => {
    const user = req.user,
      projects = projectList(db, user.id),
      activity = db
        .prepare(
          'SELECT id,project_id,action,detail,created FROM activity_logs WHERE user_id=? ORDER BY created DESC,rowid DESC LIMIT 100',
        )
        .all(user.id),
      usage = db
        .prepare(
          'SELECT provider,model,task,input_tokens,output_tokens,status,created FROM usage_records WHERE user_id=? ORDER BY created DESC LIMIT 100',
        )
        .all(user.id),
      monthly = db
        .prepare(
          'SELECT count(*) AS requests,COALESCE(sum(input_tokens),0)+COALESCE(sum(output_tokens),0) AS tokens FROM usage_records WHERE user_id=? AND created>=?',
        )
        .get(user.id, monthStart());
    res.json({
      user: publicUser(user),
      projects,
      activity,
      usage,
      monthly,
      providers: providerState(db, user.id),
      integrations: db
        .prepare('SELECT slug,config FROM integrations WHERE user_id=?')
        .all(user.id)
        .map((i) => ({ slug: i.slug, ...JSON.parse(i.config) })),
      plans,
      billing: billingReady(),
    });
  });
  api.put('/profile', (req, res) => {
    const b = z
      .object({
        name: z.string().trim().min(1).max(60),
        preferences: z.object({
          mode: z.enum(modes),
          instructions: z.string().max(2500).default(''),
        }),
      })
      .parse(req.body);
    db.prepare('UPDATE users SET name=?,preferences=? WHERE id=?').run(
      b.name,
      JSON.stringify(b.preferences),
      req.user.id,
    );
    audit(db, req.user.id, null, 'Preferences saved', 'Account settings');
    res.json({ ok: true });
  });
  api.put('/providers/:slug', (req, res) => {
    const { slug } = req.params;
    if (!Object.hasOwn(registry, slug)) fail(404, 'Unknown provider.');
    const b = z
        .object({
          secret: z.string().trim().min(8).max(2000).optional(),
          model: z
            .string()
            .trim()
            .regex(/^[a-zA-Z0-9._:-]{1,100}$/),
          fallback: z.boolean(),
        })
        .parse(req.body),
      prev = db
        .prepare('SELECT * FROM ai_providers WHERE user_id=? AND slug=?')
        .get(req.user.id, slug);
    if (!b.secret && !prev) fail(400, 'An API key is required.');
    transaction(db, () => {
      const pid = prev?.id || id();
      db.prepare(
        'INSERT INTO ai_providers VALUES(?,?,?,?,0) ON CONFLICT(user_id,slug) DO UPDATE SET secret=excluded.secret,verified=0',
      ).run(pid, req.user.id, slug, b.secret ? box.seal(b.secret) : prev.secret);
      db.prepare(
        'INSERT INTO model_configurations VALUES(?,?,?) ON CONFLICT(provider_id) DO UPDATE SET model=excluded.model,fallback=excluded.fallback',
      ).run(pid, b.model, Number(b.fallback));
      audit(db, req.user.id, null, 'Provider configured', registry[slug].name);
    });
    res.json({ ok: true });
  });
  api.delete('/providers/:slug', (req, res) => {
    db.prepare('DELETE FROM ai_providers WHERE user_id=? AND slug=?').run(
      req.user.id,
      req.params.slug,
    );
    audit(db, req.user.id, null, 'Provider disconnected', req.params.slug);
    res.json({ ok: true });
  });
  api.post(
    '/providers/:slug/test',
    rateLimit(10, 60000, (r) => r.user.id),
    async (req, res) => {
      const p = db
        .prepare('SELECT * FROM ai_providers WHERE user_id=? AND slug=?')
        .get(req.user.id, req.params.slug);
      if (!p) fail(404, 'Configure credentials first.');
      const key = box.open(p.secret),
        url = {
          openai: 'https://api.openai.com/v1/models',
          anthropic: 'https://api.anthropic.com/v1/models',
          gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
        }[p.slug];
      let r;
      try {
        r = await ctx.fetchFn(url, {
          headers:
            p.slug === 'openai'
              ? { Authorization: 'Bearer ' + key }
              : p.slug === 'anthropic'
                ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
                : { 'x-goog-api-key': key },
          signal: AbortSignal.timeout(8000),
          redirect: 'error',
        });
      } catch {
        fail(502, 'Could not reach the provider’s official API. Check outbound network access.');
      }
      await r.body?.cancel?.();
      db.prepare('UPDATE ai_providers SET verified=? WHERE id=?').run(Number(r.ok), p.id);
      if (!r.ok) fail(400, 'Provider rejected this connection (HTTP ' + r.status + ').');
      res.json({ ok: true });
    },
  );
  api.put('/integrations/:slug', (req, res) => {
    const slug = z.enum(['netlify', 'webhook']).parse(req.params.slug);
    let s,
      c = {};
    if (slug === 'webhook') {
      s = allowedHook(z.string().max(2000).parse(req.body.url));
      c = { host: new URL(s).hostname };
    } else {
      const b = z
        .object({ token: z.string().trim().min(8).max(2000), site: z.string().uuid() })
        .parse(req.body);
      s = b.token;
      c = { site: b.site };
    }
    db.prepare(
      'INSERT INTO integrations VALUES(?,?,?,?,?) ON CONFLICT(user_id,slug) DO UPDATE SET secret=excluded.secret,config=excluded.config',
    ).run(id(), req.user.id, slug, box.seal(s), JSON.stringify(c));
    audit(db, req.user.id, null, 'Integration configured', slug);
    res.json({ ok: true });
  });
  api.delete('/integrations/:slug', (req, res) => {
    db.prepare('DELETE FROM integrations WHERE user_id=? AND slug=?').run(
      req.user.id,
      req.params.slug,
    );
    audit(db, req.user.id, null, 'Integration disconnected', req.params.slug);
    res.json({ ok: true });
  });
  projectRoutes(api, ctx);
  api.post(
    '/projects/:pid/deploy',
    rateLimit(5, 60000, (r) => r.user.id),
    async (req, res) => {
      const p = req.project,
        conn = db
          .prepare("SELECT * FROM integrations WHERE user_id=? AND slug='netlify'")
          .get(req.user.id);
      if (!conn) fail(409, 'Configure a Netlify site and access token before publishing.');
      if (req.body.confirm !== p.name) fail(400, 'Confirm the project name to publish.');
      const files = Object.fromEntries(
        Object.entries(getFiles(db, p.id)).filter(
          ([k]) => /\.(html|css|js|json)$/.test(k) && k !== 'package.json',
        ),
      );
      files['index.html'] = files['index.html'].replace(
        /<head>/i,
        '<head><script>window.__ATROX_STATIC__=true</script>',
      );
      let r;
      try {
        r = await ctx.fetchFn(
          'https://api.netlify.com/api/v1/sites/' + JSON.parse(conn.config).site + '/deploys',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + box.open(conn.secret),
              'Content-Type': 'application/zip',
            },
            body: zipFiles(files),
            signal: AbortSignal.timeout(30000),
            redirect: 'error',
          },
        );
      } catch {
        fail(502, 'Could not reach Netlify. No deployment has been confirmed.');
      }
      if (!r.ok) fail(502, 'Netlify rejected the upload (HTTP ' + r.status + ').');
      const j = await boundedJSON(r);
      audit(db, req.user.id, p.id, 'Deployment submitted to Netlify', p.name);
      res.json({ id: j.id, state: j.state, url: j.deploy_ssl_url || null });
    },
  );
  billingRoutes(api);
  api.use((_req, _res) => fail(404, 'API endpoint not found.'));
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof ZodError)
      return res.status(400).json({
        error: err.issues
          .slice(0, 3)
          .map((v) => `${v.path.join('.') || 'Input'}: ${v.message}`)
          .join('; '),
      });
    const status = Number(err.status) || 500;
    if (status >= 500)
      console.error(
        JSON.stringify({
          event: 'request_error',
          status,
          route: req.route?.path || 'api',
          time: new Date().toISOString(),
        }),
      );
    res.status(status).json({
      error:
        status === 500
          ? 'An unexpected error occurred. Your saved projects have not been removed.'
          : err.type === 'entity.parse.failed'
            ? 'Invalid JSON request.'
            : err.message,
    });
  });
  return { app, db };
}
