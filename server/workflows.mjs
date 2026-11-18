import { id, now, fail, audit } from './db.mjs';
import { routed } from './providers.mjs';
export function validatedRecord(page, input) {
  if (!input || Array.isArray(input) || typeof input !== 'object')
    fail(400, 'Expected a record object.');
  const result = {};
  for (const f of page.fields) {
    const v = String(input[f.key] ?? '').trim();
    if (
      v.length > 1000 ||
      (v && f.type === 'number' && !Number.isFinite(Number(v))) ||
      (v && f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) ||
      (v && f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v))
    )
      fail(400, `Invalid value for ${f.label}.`);
    result[f.key] = v;
  }
  if (!result[page.fields[0].key]) fail(400, `${page.fields[0].label} is required.`);
  return result;
}
export function addRecord(db, project, page, input) {
  const data = validatedRecord(page, input);
  if (
    db.prepare('SELECT count(*) n FROM records WHERE project_id=? AND page=?').get(project, page.id)
      .n >= 1000
  )
    fail(409, 'Collection limit reached (1,000 records).');
  const rid = id();
  db.prepare('INSERT INTO records VALUES(?,?,?,?,?)').run(
    rid,
    project,
    page.id,
    JSON.stringify(data),
    now(),
  );
  return { id: rid, data };
}
export function allowedHook(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    fail(400, 'Enter a valid HTTPS endpoint.');
  }
  const allow = (process.env.ATROX_WEBHOOK_HOSTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (u.protocol !== 'https:' || u.username || u.password || u.port || !allow.includes(u.hostname))
    fail(
      400,
      'This endpoint must use HTTPS on an administrator-allowlisted hostname (ATROX_WEBHOOK_HOSTS).',
    );
  return u.href;
}
const expand = (s, vars) =>
  s
    .replace(/\{\{([a-z\d_-]+)\}\}/gi, (_, k) => (Object.hasOwn(vars, k) ? String(vars[k]) : ''))
    .slice(0, 3000);
export async function execute(ctx, user, project, w, input) {
  const { db, box, fetchFn = fetch } = ctx,
    vars = Object.assign(Object.create(null), input),
    log = [];
  let status = 'success';
  try {
    for (const step of JSON.parse(w.steps)) {
      const value = expand(step.value, vars);
      if (step.type === 'condition') {
        if (String(vars[step.key] ?? '') !== value) {
          log.push({ type: step.type, message: 'Condition not met. Remaining steps skipped.' });
          status = 'skipped';
          break;
        }
        log.push({ type: step.type, message: 'Condition matched.' });
      } else if (step.type === 'variable') {
        vars[step.key] = value;
        log.push({ type: step.type, message: `Set ${step.key}.` });
      } else if (step.type === 'log') log.push({ type: 'log', message: value });
      else if (step.type === 'record') {
        const page = JSON.parse(project.spec).pages.find((p) => p.id === step.key);
        if (!page) fail(400, 'Target collection does not exist.');
        const data = JSON.parse(value);
        const r = addRecord(db, project.id, page, data);
        log.push({ type: 'record', message: 'Created record ' + r.id + ' in ' + page.title });
      } else if (step.type === 'ai') {
        const r = await routed(ctx, user, { task: 'text', mode: 'Fast', material: value });
        if (!r) fail(409, 'Configure an AI provider before running an AI step.');
        vars[step.key] = r.text.slice(0, 3000);
        log.push({
          type: 'ai',
          message: [...r.notes, 'Response from ' + r.source + ': ' + vars[step.key]].join('\n'),
        });
      } else if (step.type === 'request') {
        const hook = db
          .prepare("SELECT * FROM integrations WHERE user_id=? AND slug='webhook'")
          .get(user.id);
        if (!hook) fail(409, 'Configure the webhook integration first.');
        const url = allowedHook(box.open(hook.secret));
        const response = await fetchFn(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: value, workflow: w.name }),
          signal: AbortSignal.timeout(8000),
          redirect: 'error',
        });
        await response.body?.cancel?.();
        if (!response.ok) fail(502, 'Webhook returned HTTP ' + response.status);
        log.push({ type: 'request', message: 'POST delivered · HTTP ' + response.status });
      }
    }
  } catch (e) {
    status = 'error';
    log.push({
      type: 'error',
      message: e.status
        ? e.message
        : e instanceof SyntaxError
          ? 'Step requires a valid JSON object.'
          : 'The step could not complete. Check the connection and input.',
    });
  }
  const result = { id: id(), status, log, created: now() };
  db.prepare('INSERT INTO workflow_executions VALUES(?,?,?,?,?)').run(
    result.id,
    w.id,
    status,
    JSON.stringify(log),
    result.created,
  );
  audit(db, user.id, project.id, 'Workflow ' + status, w.name);
  return result;
}
