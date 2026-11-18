import { z } from 'zod';
import { id, now, audit, transaction, fail } from './db.mjs';
import { owned, rateLimit } from './security.mjs';
import { specSchema, promptSchema, filePath, workflowSchema } from './schema.mjs';
import {
  architecture,
  insertProject,
  getFiles,
  snapshot,
  applySpec,
  localRefine,
  validateFiles,
  previewHTML,
  zipFiles,
} from './compiler.mjs';
import { localSpec, slug } from '../shared/catalog.mjs';
import { routed, parseModelJSON, plans } from './providers.mjs';
import { validatedRecord, addRecord, execute } from './workflows.mjs';
const versionList = (db, p) =>
  db
    .prepare(
      'SELECT id,number,label,created FROM project_versions WHERE project_id=? ORDER BY number DESC',
    )
    .all(p);
const listFlows = (db, p) =>
  db
    .prepare('SELECT * FROM workflows WHERE project_id=? ORDER BY rowid')
    .all(p)
    .map((w) => ({
      ...w,
      enabled: !!w.enabled,
      steps: JSON.parse(w.steps),
      executions: db
        .prepare(
          'SELECT id,status,log,created FROM workflow_executions WHERE workflow_id=? ORDER BY created DESC LIMIT 12',
        )
        .all(w.id)
        .map((e) => ({ ...e, log: JSON.parse(e.log) })),
    }));
export const projectList = (db, user) =>
  db
    .prepare(
      'SELECT p.id,p.name,p.description,p.kind,p.created,p.updated,(SELECT count(*) FROM project_files f WHERE f.project_id=p.id) AS files,(SELECT count(*) FROM project_versions v WHERE v.project_id=p.id) AS versions FROM projects p WHERE p.user_id=? ORDER BY p.updated DESC,p.rowid DESC',
    )
    .all(user);
const specPrompt =
  'Return only valid JSON matching the exact structure of the example specification. Do not change its schema. Page IDs and field keys must be unique lowercase slugs. Supported component types: header, cards, table, chart, form, button, input, navigation, modal, sidebar, footer. Supported features: CRUD records, charts, search, navigation, single-owner auth and configured workflows. Do not promise unsupported services. No executable code. ';
export function projectRoutes(api, ctx) {
  const { db } = ctx;
  const limited = rateLimit(45, 10 * 60000, (r) => r.user.id);
  api.post('/plans', limited, async (req, res) => {
    const b = promptSchema.parse(req.body),
      base = localSpec(b.prompt, b.template);
    const r = await routed(ctx, req.user, {
      ...b,
      task: 'planning',
      material: specPrompt + '\nExample: ' + JSON.stringify(base) + '\nUser request: ' + b.prompt,
    });
    const spec = specSchema.parse(r ? parseModelJSON(r.text) : base);
    res.json({
      spec,
      source: r?.source || 'Local engine',
      notes: r?.notes || [],
      architecture,
      stages: [
        'Understand objective',
        'Plan collections and pages',
        'Create source files',
        'Validate application',
        'Prepare live preview',
      ],
    });
  });
  api.get('/projects', (req, res) => res.json(projectList(db, req.user.id)));
  api.post('/projects', limited, (req, res) => {
    const spec = specSchema.parse(req.body.spec);
    if (projectList(db, req.user.id).length >= plans[req.user.plan].projects)
      fail(
        409,
        'Your plan’s project limit has been reached. Export and remove an unused project to continue.',
      );
    const pid = transaction(db, () => insertProject(db, req.user.id, spec));
    res.status(201).json({
      id: pid,
      stages: [
        'Source files created',
        'Application assembled',
        'Source validation passed',
        'Preview ready',
      ],
    });
  });
  api.post('/projects/build', limited, (req, res) => {
    const spec = specSchema.parse(req.body.spec);
    if (projectList(db, req.user.id).length >= plans[req.user.plan].projects)
      fail(409, 'Your project limit has been reached.');
    res.set({ 'Content-Type': 'application/x-ndjson; charset=utf-8', 'X-Accel-Buffering': 'no' });
    const event = (value) => res.write(JSON.stringify(value) + '\n');
    try {
      const pid = transaction(db, () =>
        insertProject(db, req.user.id, spec, 'Application generated', false, event),
      );
      event({ id: pid, state: 'saved' });
    } catch (e) {
      event({
        state: 'error',
        error: e.status ? e.message : 'The build could not be saved. No project was created.',
      });
    }
    res.end();
  });
  api.use('/projects/:pid', (req, _res, next) => {
    req.project = owned(db, req.user.id, req.params.pid);
    next();
  });
  api.get('/projects/:pid', (req, res) => {
    const p = req.project,
      m = db.prepare('SELECT * FROM project_memory WHERE project_id=?').get(p.id);
    res.json({
      id: p.id,
      spec: JSON.parse(p.spec),
      created: p.created,
      updated: p.updated,
      files: getFiles(db, p.id),
      versions: versionList(db, p.id),
      memory: {
        instructions: m.instructions,
        requirements: JSON.parse(m.requirements),
        decisions: JSON.parse(m.decisions),
      },
      workflows: listFlows(db, p.id),
      build: JSON.parse(
        db.prepare('SELECT report FROM project_builds WHERE project_id=?').get(p.id)?.report ||
          '[]',
      ),
    });
  });
  api.delete('/projects/:pid', (req, res) => {
    const p = req.project;
    transaction(db, () => {
      db.prepare('DELETE FROM projects WHERE id=?').run(p.id);
      audit(db, req.user.id, null, 'Project deleted', p.name);
    });
    res.json({ ok: true });
  });
  api.get('/projects/:pid/preview', (req, res) =>
    res.json({ html: previewHTML(getFiles(db, req.project.id)) }),
  );
  api.get('/projects/:pid/frame', (req, res) => {
    res.set(
      'Content-Security-Policy',
      "sandbox allow-scripts allow-forms; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'",
    );
    res.type('html').send(previewHTML(getFiles(db, req.project.id)));
  });
  api.get('/projects/:pid/export', (req, res) => {
    const p = req.project;
    res
      .set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${slug(p.name)}.zip"`,
      })
      .send(zipFiles(getFiles(db, p.id)));
  });
  api.put('/projects/:pid/files', (req, res) => {
    const p = req.project,
      b = z
        .object({
          path: filePath,
          content: z.string().max(180000),
          create: z.boolean().optional(),
          base: z.string().max(180000).optional(),
        })
        .parse(req.body),
      files = getFiles(db, p.id);
    if (b.create && Object.hasOwn(files, b.path))
      fail(409, 'A file with this name already exists.');
    if (b.base !== undefined && files[b.path] !== b.base)
      fail(409, 'This file changed in another editor. Reload before saving.');
    files[b.path] = b.content;
    validateFiles(files);
    transaction(db, () => {
      db.prepare(
        'INSERT INTO project_files VALUES(?,?,?) ON CONFLICT(project_id,path) DO UPDATE SET content=excluded.content',
      ).run(p.id, b.path, b.content);
      if (b.path === 'app.config.json') {
        const s = specSchema.parse(JSON.parse(b.content));
        db.prepare('UPDATE projects SET spec=?,name=?,description=?,kind=? WHERE id=?').run(
          JSON.stringify(s),
          s.name,
          s.summary,
          s.kind,
          p.id,
        );
      }
      db.prepare('UPDATE projects SET updated=? WHERE id=?').run(now(), p.id);
      snapshot(db, p.id, 'Saved ' + b.path);
      audit(db, req.user.id, p.id, 'Source file saved', b.path);
    });
    res.json({ ok: true });
  });
  api.put('/projects/:pid/design', (req, res) => {
    if (req.body.base && req.body.base !== req.project.updated)
      fail(409, 'The project changed. Reload before applying your design.');
    res.json({
      spec: applySpec(db, req.project.id, req.user.id, req.body.spec, 'Visual design updated'),
    });
  });
  api.post('/projects/:pid/refine', limited, async (req, res) => {
    const { project: p, user } = req,
      b = promptSchema.parse(req.body),
      s = JSON.parse(p.spec),
      m = db
        .prepare(
          'SELECT instructions,requirements,decisions FROM project_memory WHERE project_id=?',
        )
        .get(p.id);
    const r = await routed(ctx, user, {
      ...b,
      task: 'coding',
      material:
        specPrompt +
        '\nExisting project: ' +
        p.spec +
        '\nProject memory: ' +
        JSON.stringify(m) +
        '\nChange history: ' +
        JSON.stringify(
          versionList(db, p.id)
            .slice(0, 8)
            .map((v) => v.label),
        ) +
        '\nModification: ' +
        b.prompt +
        '\nPreserve all existing collections and field keys.',
    });
    const next = r ? specSchema.parse(parseModelJSON(r.text)) : localRefine(s, b.prompt);
    if (
      s.pages.some(
        (old) =>
          !next.pages.some(
            (n) =>
              n.id === old.id && old.fields.every((f) => n.fields.some((v) => v.key === f.key)),
          ),
      )
    )
      fail(422, 'Refinement would remove existing collections or fields. No changes were applied.');
    if (owned(db, user.id, p.id).updated !== p.updated)
      fail(409, 'Project changed during refinement. Please retry.');
    applySpec(db, p.id, user.id, next, 'Refined: ' + b.prompt.slice(0, 85));
    res.json({ source: r?.source || 'Local engine', notes: r?.notes || [] });
  });
  api.put('/projects/:pid/memory', (req, res) => {
    const b = z
      .object({
        instructions: z.string().max(5000),
        requirements: z.array(z.string().min(1).max(500)).max(30),
        decisions: z.array(z.string().max(500)).max(30),
      })
      .parse(req.body);
    db.prepare(
      'UPDATE project_memory SET instructions=?,requirements=?,decisions=? WHERE project_id=?',
    ).run(
      b.instructions,
      JSON.stringify(b.requirements),
      JSON.stringify(b.decisions),
      req.project.id,
    );
    audit(db, req.user.id, req.project.id, 'Project memory saved', req.project.name);
    res.json({ ok: true });
  });
  api.post('/projects/:pid/versions', (req, res) => {
    const label = z.string().trim().min(1).max(100).parse(req.body.label);
    snapshot(db, req.project.id, label);
    audit(db, req.user.id, req.project.id, 'Version saved', label);
    res.json({ ok: true });
  });
  api.post('/projects/:pid/versions/:vid/restore', (req, res) => {
    const p = req.project,
      v = db
        .prepare('SELECT snapshot,number FROM project_versions WHERE id=? AND project_id=?')
        .get(req.params.vid, p.id);
    if (!v) fail(404, 'Version not found.');
    const files = JSON.parse(v.snapshot),
      s = specSchema.parse(JSON.parse(files['app.config.json']));
    validateFiles(files);
    transaction(db, () => {
      db.prepare('DELETE FROM project_files WHERE project_id=?').run(p.id);
      for (const [k, c] of Object.entries(files))
        db.prepare('INSERT INTO project_files VALUES(?,?,?)').run(p.id, k, c);
      db.prepare('UPDATE projects SET spec=?,name=?,description=?,kind=?,updated=? WHERE id=?').run(
        JSON.stringify(s),
        s.name,
        s.summary,
        s.kind,
        now(),
        p.id,
      );
      snapshot(db, p.id, 'Restored version ' + v.number);
      audit(db, req.user.id, p.id, 'Version restored', 'Version ' + v.number);
    });
    res.json({ ok: true });
  });
  api.post('/projects/:pid/assist', limited, async (req, res) => {
    const b = z
      .object({
        action: z.enum([
          'Explain code',
          'Find errors',
          'Suggest improvements',
          'Refactor selection',
          'Generate component',
        ]),
        path: filePath,
        selection: z.string().max(12000).optional(),
      })
      .parse(req.body);
    const f = getFiles(db, req.project.id);
    if (!Object.hasOwn(f, b.path)) fail(404, 'Source file not found.');
    const r = await routed(ctx, req.user, {
      task: 'coding',
      material:
        b.action +
        ' in ' +
        b.path +
        ' for ' +
        req.project.name +
        '. Return a concise review or proposed code, not execution claims.\n' +
        (b.selection || f[b.path].slice(0, 16000)),
    });
    if (!r) {
      if (b.action === 'Find errors') {
        validateFiles(f);
        return res.json({
          text: 'Source validation passed: JSON and supported browser JavaScript parsed successfully. Runtime behavior and TypeScript are not executed by this check.',
          source: 'Local validator',
        });
      }
      fail(
        409,
        'Configure an AI provider in Integrations for this coding task. The local validator is available under Find errors.',
      );
    }
    res.json({ text: r.text, source: r.source, notes: r.notes });
  });
  api.all('/projects/:pid/records/:page{/:rid}', async (req, res) => {
    const p = req.project,
      page = JSON.parse(p.spec).pages.find((x) => x.id === req.params.page);
    if (!page) fail(404, 'Collection not found.');
    const rid = req.params.rid;
    if (req.method === 'GET')
      return res.json(
        db
          .prepare(
            'SELECT id,data FROM records WHERE project_id=? AND page=? ORDER BY created DESC,rowid DESC LIMIT 1000',
          )
          .all(p.id, page.id)
          .map((r) => ({ ...r, data: JSON.parse(r.data) })),
      );
    if (req.method === 'POST' && !rid) {
      const r = addRecord(db, p.id, page, req.body);
      audit(db, req.user.id, p.id, 'Record created', page.title);
      const flows = db
        .prepare(
          "SELECT * FROM workflows WHERE project_id=? AND trigger='record.created' AND enabled=1",
        )
        .all(p.id);
      for (const w of flows) await execute(ctx, req.user, p, w, r.data);
      return res.status(201).json(r);
    }
    if (!rid) fail(400, 'Missing record ID.');
    let result;
    if (req.method === 'PUT')
      result = db
        .prepare('UPDATE records SET data=? WHERE id=? AND project_id=? AND page=?')
        .run(JSON.stringify(validatedRecord(page, req.body)), rid, p.id, page.id);
    else if (req.method === 'DELETE')
      result = db
        .prepare('DELETE FROM records WHERE id=? AND project_id=? AND page=?')
        .run(rid, p.id, page.id);
    else fail(405, 'Method not supported.');
    if (!result.changes) fail(404, 'Record not found.');
    res.json({ ok: true });
  });
  api.post('/projects/:pid/workflows', (req, res) => {
    if (listFlows(db, req.project.id).length >= 20) fail(409, 'Maximum 20 workflows per project.');
    const w = workflowSchema.parse(req.body),
      wid = id();
    db.prepare('INSERT INTO workflows VALUES(?,?,?,?,?,?)').run(
      wid,
      req.project.id,
      w.name,
      w.trigger,
      JSON.stringify(w.steps),
      Number(w.enabled),
    );
    audit(db, req.user.id, req.project.id, 'Workflow created', w.name);
    res.status(201).json({ id: wid });
  });
  api.use('/projects/:pid/workflows/:wid', (req, _res, next) => {
    req.workflow = db
      .prepare('SELECT * FROM workflows WHERE id=? AND project_id=?')
      .get(req.params.wid, req.project.id);
    if (!req.workflow) fail(404, 'Workflow not found.');
    next();
  });
  api.put('/projects/:pid/workflows/:wid', (req, res) => {
    const w = workflowSchema.parse(req.body);
    db.prepare('UPDATE workflows SET name=?,trigger=?,steps=?,enabled=? WHERE id=?').run(
      w.name,
      w.trigger,
      JSON.stringify(w.steps),
      Number(w.enabled),
      req.workflow.id,
    );
    audit(db, req.user.id, req.project.id, 'Workflow updated', w.name);
    res.json({ ok: true });
  });
  api.post('/projects/:pid/workflows/:wid/run', limited, async (req, res) => {
    const input = z.record(z.string().max(1000)).parse(req.body.input || {});
    if (Object.keys(input).length > 30) fail(400, 'Too many input variables.');
    res.json(await execute(ctx, req.user, req.project, req.workflow, input));
  });
  api.delete('/projects/:pid/workflows/:wid', (req, res) => {
    db.prepare('DELETE FROM workflows WHERE id=?').run(req.workflow.id);
    audit(db, req.user.id, req.project.id, 'Workflow removed', req.workflow.name);
    res.json({ ok: true });
  });
}
