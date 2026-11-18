// Standalone, zero-dependency Node.js 22.13+ server. Only explicitly public files are served.
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url)),
  config = JSON.parse(readFileSync(join(dir, 'app.config.json'), 'utf8'));
mkdirSync(join(dir, 'data'), { recursive: true });
const db = new DatabaseSync(join(dir, 'data', 'app.sqlite'));
db.exec(readFileSync(join(dir, 'schema.sql'), 'utf8'));
const host = process.env.HOST || '127.0.0.1',
  pass = process.env.ATROX_APP_PASSWORD;
if (host !== '127.0.0.1' && !pass)
  throw Error(
    'Set ATROX_APP_PASSWORD before binding a public interface. Use an HTTPS reverse proxy.',
  );
const digest = (x) => createHash('sha256').update(x).digest();
const types = {
  html: 'text/html',
  js: 'text/javascript',
  css: 'text/css',
  json: 'application/json',
};
const server = createServer(async (req, res) => {
  const send = (status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };
  try {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (
      pass &&
      !timingSafeEqual(
        digest(req.headers.authorization || ''),
        digest('Basic ' + Buffer.from('owner:' + pass).toString('base64')),
      )
    ) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Application workspace"');
      return send(401, { error: 'Authentication required' });
    }
    const path = new URL(req.url, 'http://app.local').pathname;
    const match = path.match(/^\/api\/records\/([\w-]+)(?:\/([\w-]+))?$/);
    if (match) {
      const [, page, id] = match,
        p = config.pages.find((p) => p.id === page);
      if (!p) return send(404, { error: 'Collection not found' });
      if (req.method === 'GET')
        return send(
          200,
          db
            .prepare('SELECT id,data FROM records WHERE page=? ORDER BY rowid DESC LIMIT 1000')
            .all(page)
            .map((r) => ({ ...r, data: JSON.parse(r.data) })),
        );
      if (
        req.headers['x-atrox-app'] !== 'records' ||
        req.headers['sec-fetch-site'] === 'cross-site'
      )
        return send(403, { error: 'Same-origin requests only' });
      if (req.method === 'DELETE' && id) {
        db.prepare('DELETE FROM records WHERE id=? AND page=?').run(id, page);
        return send(200, { ok: true });
      }
      if (!['POST', 'PUT'].includes(req.method))
        return send(405, { error: 'Method not supported' });
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 24000) return send(413, { error: 'Entry too large' });
      }
      const input = JSON.parse(body),
        data = {};
      for (const f of p.fields) {
        const v = String(input[f.key] ?? '').trim();
        if (
          v.length > 1000 ||
          (v && f.type === 'number' && !Number.isFinite(Number(v))) ||
          (v && f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
        )
          return send(400, { error: 'Invalid ' + f.label });
        data[f.key] = v;
      }
      if (!data[p.fields[0].key]) return send(400, { error: 'The first field is required' });
      if (req.method === 'POST') {
        const key = randomUUID();
        db.prepare('INSERT INTO records VALUES(?,?,?)').run(key, page, JSON.stringify(data));
        return send(201, { id: key, data });
      }
      const result = db
        .prepare('UPDATE records SET data=? WHERE id=? AND page=?')
        .run(JSON.stringify(data), id || '', page);
      return send(
        result.changes ? 200 : 404,
        result.changes ? { ok: true } : { error: 'Record not found' },
      );
    }
    const file = path === '/' ? 'index.html' : path.slice(1);
    if (
      req.method !== 'GET' ||
      !/^([\w-]+\/)*[\w-]+(?:\.[\w-]+)*\.(html|css|js|json)$/.test(file) ||
      file === 'package.json' ||
      file.startsWith('data/')
    )
      return send(404, { error: 'Not found' });
    let content;
    try {
      content = readFileSync(join(dir, file));
    } catch {
      return send(404, { error: 'Not found' });
    }
    res.writeHead(200, {
      'Content-Type': types[file.split('.').at(-1)] + '; charset=utf-8',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    });
    res.end(content);
  } catch {
    return send(400, { error: 'Request could not be processed' });
  }
});
server.listen(Number(process.env.PORT || 3000), host, () =>
  console.log('Application ready at http://' + host + ':' + server.address().port),
);
