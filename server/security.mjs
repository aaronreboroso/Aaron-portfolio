import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
  scrypt as sc,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail, now } from './db.mjs';
const scrypt = promisify(sc);
export const hash = (s) => createHash('sha256').update(s).digest('hex');
export const secret = () => randomBytes(32).toString('base64url');
export async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + (await scrypt(password, salt, 64)).toString('hex');
}
export async function passwordMatch(password, stored) {
  const [salt, key] = (stored || '0000000000000000:' + '00'.repeat(64)).split(':');
  const test = await scrypt(password, salt, 64);
  return timingSafeEqual(test, Buffer.from(key, 'hex'));
}
export function vault(dir, key) {
  if (!key) {
    if (process.env.NODE_ENV === 'production')
      throw new Error('ATROX_MASTER_KEY is required in production.');
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const p = join(dir, 'vault.key');
    if (!existsSync(p))
      writeFileSync(p, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
    key = readFileSync(p, 'utf8').trim();
  }
  if (!/^[a-f0-9]{64}$/i.test(key))
    throw new Error('ATROX_MASTER_KEY must contain 64 hexadecimal characters.');
  const k = Buffer.from(key, 'hex');
  return {
    seal(text) {
      const iv = randomBytes(12),
        c = createCipheriv('aes-256-gcm', k, iv);
      const out = Buffer.concat([c.update(text, 'utf8'), c.final()]);
      return [iv, c.getAuthTag(), out].map((b) => b.toString('base64')).join('.');
    },
    open(data) {
      const [iv, tag, out] = data.split('.').map((v) => Buffer.from(v, 'base64'));
      const c = createDecipheriv('aes-256-gcm', k, iv);
      c.setAuthTag(tag);
      return Buffer.concat([c.update(out), c.final()]).toString('utf8');
    },
  };
}
export function currentUser(db, req) {
  const match = req.headers.cookie?.match(/(?:^|;\s*)atrox_session=([A-Za-z0-9_-]+)/);
  if (!match) return null;
  return db
    .prepare(
      'SELECT u.* FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token=? AND s.expires>?',
    )
    .get(hash(match[1]), now());
}
export function newSession(db, req, res, userId) {
  const token = secret(),
    age = 1000 * 60 * 60 * 24 * 14;
  const secure =
    !!req.secure ||
    process.env.NODE_ENV === 'production' ||
    process.env.COOKIE_SECURE === 'true' ||
    req.headers.origin?.startsWith('https://') === true;
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token), userId, now() + age);
  res.cookie('atrox_session', token, {
    httpOnly: true,
    sameSite: secure ? 'none' : 'lax',
    secure,
    partitioned: secure,
    path: '/',
    maxAge: age,
  });
}
export function endSession(db, req, res) {
  const token = req.headers.cookie?.match(/(?:^|;\s*)atrox_session=([A-Za-z0-9_-]+)/)?.[1];
  if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token));
  const secure =
    !!req.secure ||
    process.env.NODE_ENV === 'production' ||
    process.env.COOKIE_SECURE === 'true' ||
    req.headers.origin?.startsWith('https://') === true;
  res.clearCookie('atrox_session', {
    path: '/',
    httpOnly: true,
    sameSite: secure ? 'none' : 'lax',
    secure,
    partitioned: secure,
  });
}
export function rateLimit(max, period, key = (req) => req.ip) {
  const buckets = new Map();
  let reset = 0;
  return (req, res, next) => {
    const t = now();
    if (t > reset) {
      for (const [k, b] of buckets) if (b.end < t) buckets.delete(k);
      reset = t + Math.min(60000, period);
    }
    const k = key(req),
      b = buckets.get(k);
    if (!b || b.end < t) {
      buckets.set(k, { count: 1, end: t + period });
      return next();
    }
    if (++b.count > max) {
      res.set('Retry-After', String(Math.ceil((b.end - t) / 1000)));
      return next(
        Object.assign(new Error('Too many requests. Please try again shortly.'), { status: 429 }),
      );
    }
    next();
  };
}
export function guardWrites(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.headers['x-atrox-request'] !== 'workspace')
    return next(
      Object.assign(new Error('A same-origin workspace request is required.'), { status: 403 }),
    );
  if (req.headers['sec-fetch-site'] === 'cross-site')
    return next(Object.assign(new Error('Cross-site requests are not allowed.'), { status: 403 }));
  next();
}
export const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  guest: !!u.guest,
  plan: u.plan,
  preferences: JSON.parse(u.preferences || '{}'),
});
export function owned(db, user, project) {
  const p = db.prepare('SELECT * FROM projects WHERE id=? AND user_id=?').get(project, user);
  if (!p) fail(404, 'Project not found in this workspace.');
  return p;
}
