import { createServer } from 'node:http';
import { createApp } from './app.mjs';
import { serveBuilt } from './serve.mjs';
const { app, db } = createApp(),
  server = createServer(app);
const production = process.env.NODE_ENV === 'production';
if (production) serveBuilt(app);
else {
  const { createServer: createVite } = await import('vite');
  const vite = await createVite({
    server: { middlewareMode: true, allowedHosts: true, hmr: { server } },
    appType: 'spa',
  });
  app.use((_req, res, next) => {
    res.set('Content-Security-Policy', "frame-src 'self'; object-src 'none'; base-uri 'self'");
    next();
  });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 5173);
server.listen(port, '0.0.0.0', () => console.log(`ATROX workspace ready on port ${port}`));
server.requestTimeout = 60000;
const cleanup = setInterval(() => {
  const t = Date.now();
  db.prepare('DELETE FROM sessions WHERE expires<?').run(t);
  db.prepare(
    'DELETE FROM users WHERE guest=1 AND created<? AND NOT EXISTS(SELECT 1 FROM sessions WHERE user_id=users.id)',
  ).run(t - 14 * 86400000);
}, 3600000);
cleanup.unref();
for (const sig of ['SIGTERM', 'SIGINT'])
  process.on(sig, () => {
    clearInterval(cleanup);
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
