import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from '../server/compiler.mjs';
import { localSpec } from '../shared/catalog.mjs';
// Execute only the repository's trusted starter runtime in a disposable test directory.
// This is a development acceptance test, not a project-code execution endpoint.
test(
  'standalone export runs its own tests and a real password-protected SQLite API',
  { timeout: 15000 },
  async (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'atrox-export-'));
    t.after(() => rmSync(dir, { force: true, recursive: true }));
    const files = compile(localSpec('Build an inventory management system'));
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), content);
    }
    const testResult = spawnSync(process.execPath, ['--test', 'tests/application.test.mjs'], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.equal(testResult.status, 0, testResult.stderr);
    const start = async () => {
      const child = spawn(process.execPath, ['server.mjs'], {
        cwd: dir,
        env: {
          PATH: process.env.PATH,
          HOST: '127.0.0.1',
          PORT: '0',
          ATROX_APP_PASSWORD: 'test-owner-password',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const url = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          child.kill();
          reject(Error('Exported server did not start'));
        }, 4000);
        child.stdout.on('data', (b) => {
          const m = b.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
          if (m) {
            clearTimeout(timer);
            resolve(m[0]);
          }
        });
        child.once('error', reject);
        child.once('exit', () => clearTimeout(timer));
      });
      return {
        url,
        stop: async () => {
          const done = once(child, 'exit');
          child.kill('SIGTERM');
          await done;
        },
      };
    };
    const headers = {
      Authorization: 'Basic ' + Buffer.from('owner:test-owner-password').toString('base64'),
      'Content-Type': 'application/json',
      'X-ATROX-App': 'records',
    };
    let proc = await start();
    try {
      assert.equal((await fetch(proc.url)).status, 401);
      assert.equal((await fetch(proc.url + '/app.config.json', { headers })).status, 200);
      let r = await fetch(proc.url + '/api/records/products', {
        method: 'POST',
        headers,
        body: JSON.stringify({ product: 'Test keyboard', quantity: 12 }),
      });
      assert.equal(r.status, 201);
      const record = await r.json();
      r = await fetch(proc.url + '/api/records/products/' + record.id, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ product: 'Edited keyboard', quantity: 8 }),
      });
      assert.equal(r.status, 200);
      await proc.stop();
      proc = await start();
      const persisted = await fetch(proc.url + '/api/records/products', { headers }).then((r) =>
        r.json(),
      );
      assert.equal(persisted[0].data.product, 'Edited keyboard');
      assert.equal(
        (
          await fetch(proc.url + '/api/records/products/' + record.id, {
            method: 'DELETE',
            headers,
          })
        ).status,
        200,
      );
      assert.equal(
        (await fetch(proc.url + '/api/records/products', { headers }).then((r) => r.json())).length,
        0,
      );
    } finally {
      await proc.stop();
    }
  },
);
