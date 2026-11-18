import { z } from 'zod';
import { id, now, audit, transaction, fail } from './db.mjs';
import {
  publicUser,
  newSession,
  endSession,
  secret,
  hash,
  passwordHash,
  passwordMatch,
  rateLimit,
} from './security.mjs';
import { seedWorkspace } from './compiler.mjs';
const mail = z.string().trim().toLowerCase().email().max(200),
  pass = z.string().min(10, 'Use at least 10 characters for your password.').max(256),
  name = z.string().trim().min(1).max(60);
export function authRoutes(api, { db }) {
  const authLimit = rateLimit(25, 15 * 60000);
  api.post('/session/guest', rateLimit(40, 60 * 60000), (req, res) => {
    if (req.user) return res.json({ user: publicUser(req.user) });
    const uid = id();
    transaction(db, () => {
      db.prepare('INSERT INTO users(id,name,created) VALUES(?,?,?)').run(uid, 'Guest maker', now());
      seedWorkspace(db, uid);
      newSession(db, req, res, uid);
    });
    res
      .status(201)
      .json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(uid)) });
  });
  api.post('/auth/signup', authLimit, async (req, res) => {
    const b = z.object({ email: mail, password: pass, name }).parse(req.body);
    if (req.user && !req.user.guest) fail(409, 'Sign out before creating another account.');
    if (db.prepare('SELECT id FROM users WHERE email=?').get(b.email))
      fail(409, 'This email cannot be used. Try signing in instead.');
    const uid = req.user?.id || id(),
      recovery = secret(),
      pw = await passwordHash(b.password);
    transaction(db, () => {
      if (req.user)
        db.prepare('UPDATE users SET name=?,email=?,password=?,recovery=?,guest=0 WHERE id=?').run(
          b.name,
          b.email,
          pw,
          hash(recovery),
          uid,
        );
      else {
        db.prepare(
          'INSERT INTO users(id,name,email,password,recovery,guest,created) VALUES(?,?,?,?,?,0,?)',
        ).run(uid, b.name, b.email, pw, hash(recovery), now());
        seedWorkspace(db, uid);
      }
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(uid);
      newSession(db, req, res, uid);
      audit(db, uid, null, 'Account created', 'Private workspace saved');
    });
    res
      .status(201)
      .json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(uid)), recovery });
  });
  api.post('/auth/signin', authLimit, async (req, res) => {
    const b = z.object({ email: mail, password: z.string().min(1).max(256) }).parse(req.body),
      u = db.prepare('SELECT * FROM users WHERE email=?').get(b.email);
    if (!(await passwordMatch(b.password, u?.password)) || !u)
      fail(401, 'Email or password is incorrect.');
    endSession(db, req, res);
    newSession(db, req, res, u.id);
    audit(db, u.id, null, 'Signed in', 'Workspace session started');
    res.json({ user: publicUser(u) });
  });
  api.post('/auth/reset', authLimit, async (req, res) => {
    const b = z
        .object({ email: mail, recovery: z.string().min(1).max(256), password: pass })
        .parse(req.body),
      u = db
        .prepare('SELECT * FROM users WHERE email=? AND recovery=?')
        .get(b.email, hash(b.recovery.trim()));
    if (!u) fail(400, 'The email and recovery key do not match.');
    const recovery = secret(),
      pw = await passwordHash(b.password);
    transaction(db, () => {
      db.prepare('UPDATE users SET password=?,recovery=? WHERE id=?').run(pw, hash(recovery), u.id);
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id);
      newSession(db, req, res, u.id);
      audit(db, u.id, null, 'Password reset', 'All previous sessions revoked');
    });
    res.json({ recovery, user: publicUser(u) });
  });
  api.post('/auth/signout', (req, res) => {
    endSession(db, req, res);
    res.json({ ok: true });
  });
}
