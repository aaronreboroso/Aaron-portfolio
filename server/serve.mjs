import express from 'express';
import { resolve } from 'node:path';
/** All preview documents have their own, stricter CSP in project-routes. */
export function serveBuilt(app, root = resolve('dist')) {
  app.use((_req, res, next) => {
    res.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
    );
    next();
  });
  app.use('/assets', express.static(resolve(root, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(root, { index: false }));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve(root, 'index.html')));
}
