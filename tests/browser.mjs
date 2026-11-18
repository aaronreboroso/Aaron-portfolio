/** Browser acceptance tests use a disposable database and the real production build. */
import { chromium } from 'playwright-core';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import { createApp } from '../server/app.mjs';
import { serveBuilt } from '../server/serve.mjs';
import { openDB } from '../server/db.mjs';
if (!existsSync('dist/index.html')) throw Error('Build the frontend with npm run build first.');
const { app, db } = createApp({ db: openDB(':memory:'), key: randomBytes(32).toString('hex') });
serveBuilt(app);
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const url = 'http://127.0.0.1:' + server.address().port;
let browser;
const tmp = mkdtempSync(join(tmpdir(), 'atrox-ui-'));
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: [
      '--disable-dev-shm-usage',
      ...(process.env.BROWSER_NO_SANDBOX === '1' ? ['--no-sandbox', '--no-zygote'] : []),
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.getByRole('heading', { name: 'What will you create today?' }).waitFor();
  assert.equal(await page.locator('.project-card').count(), 3);
  await page.getByRole('button', { name: 'CRM system', exact: true }).click();
  assert.match(await page.getByLabel('Application description').inputValue(), /customer/);
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await page.getByLabel('Application name', { exact: true }).fill('Atlas Service Desk');
  await page.getByRole('button', { name: 'Build application', exact: true }).click();
  await page.getByRole('heading', { name: 'Atlas Service Desk', exact: true }).waitFor();
  const projectURL = page.url(),
    frame = () => page.frameLocator('iframe[title^="Live preview"]');
  await frame().getByRole('button', { name: '+ Add entry' }).click();
  await frame().getByLabel('Name', { exact: true }).fill('Mika Santos');
  await frame().getByLabel('Email', { exact: true }).fill('mika@example.test');
  await frame().getByRole('button', { name: 'Save entry' }).click();
  await frame().getByRole('cell', { name: 'Mika Santos' }).waitFor();
  await page.getByRole('button', { name: 'Reload preview', exact: true }).click();
  await frame().getByRole('cell', { name: 'Mika Santos' }).waitFor();
  console.log('✓ Prompt → plan → generated project → persistent preview CRUD');
  await page.getByRole('button', { name: 'Add dark mode', exact: true }).click();
  await page.getByRole('button', { name: 'Apply change', exact: true }).click();
  await frame().locator('body[data-theme="dark"]').waitFor();
  await page.getByRole('button', { name: 'Visual builder', exact: true }).click();
  await page.getByLabel('Component title', { exact: true }).fill('Customer directory');
  await frame().getByRole('heading', { name: 'Customer directory' }).waitFor();
  await page.getByRole('button', { name: 'Save design', exact: true }).click();
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('button', { name: 'Create source file', exact: true }).click();
  await page.getByLabel('Relative file path').fill('notes.txt');
  await page.getByRole('button', { name: 'Create file', exact: true }).click();
  await page.locator('.editor-head').getByText('notes.txt').waitFor();
  await page.locator('.cm-content').click();
  await page.keyboard.insertText('Tested in a real browser.');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Saved source', { exact: true }).waitFor();
  console.log('✓ Refinement, live visual editing, CodeMirror source creation and saving');
  await page.getByRole('button', { name: 'Versions', exact: true }).click();
  await page.getByLabel('Checkpoint name').fill('Reviewed build');
  await page.getByRole('button', { name: 'Save version' }).click();
  await page.getByText('Reviewed build', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Workflows', exact: true }).click();
  await page.getByRole('button', { name: 'Create workflow', exact: true }).click();
  await page.getByLabel('Workflow name', { exact: true }).fill('Acceptance log');
  await page.getByRole('button', { name: 'Save workflow', exact: true }).click();
  await page.getByRole('button', { name: 'Run saved workflow', exact: true }).click();
  await page.locator('.run-result').getByText('success', { exact: true }).waitFor();
  assert.match(await page.locator('.run-result').innerText(), /Workspace owner/);
  const dl = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export ZIP', exact: true }).click();
  const download = await dl;
  await download.saveAs(join(tmp, 'source.zip'));
  const zip = unzipSync(readFileSync(join(tmp, 'source.zip')));
  assert.equal(Buffer.from(zip['notes.txt']).toString(), 'Tested in a real browser.');
  assert.ok(zip['server.mjs']);
  console.log('✓ Version checkpoint, real workflow execution and editable source ZIP');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Display name').fill('Mika');
  await page.getByLabel('Email address', { exact: true }).fill('mika@example.test');
  await page.getByLabel('Password', { exact: true }).fill('a strong example passphrase');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await page.getByLabel('Account recovery key').waitFor();
  assert.ok((await page.getByLabel('Account recovery key').inputValue()).length > 32);
  await page.getByLabel('I have stored my recovery key safely.').check();
  await page.getByRole('button', { name: 'Continue to workspace' }).click();
  await page.getByRole('heading', { name: 'What will you create today?' }).waitFor();
  await page.keyboard.press('Control+k');
  await page
    .getByRole('dialog')
    .getByLabel('Search workspace', { exact: true })
    .fill('Atlas Service Desk');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Atlas Service Desk/ })
    .click();
  await frame().getByRole('cell', { name: 'Mika Santos' }).waitFor();
  await page.reload();
  await frame().getByRole('heading', { name: 'Customer directory' }).waitFor();
  console.log('✓ Account upgrade, command search and reload persistence');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.locator('.main-nav').getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('heading', { name: 'What will you create today?' }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.locator('.main-nav').getByRole('link', { name: 'Templates', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect template' }).first().click();
  await page.getByRole('button', { name: 'Use template', exact: true }).click();
  await page.getByRole('heading', { name: 'Review your build plan' }).waitFor();
  await page.goto(url + '/welcome');
  await page.getByRole('heading', { name: 'Software should adapt to you.' }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  assert.deepEqual(errors, []);
  console.log('✓ Mobile menu, template creation, public landing and no runtime exceptions');
} finally {
  await browser?.close();
  await new Promise((r) => {
    server.close(r);
    server.closeAllConnections();
  });
  db.close();
  rmSync(tmp, { force: true, recursive: true });
}
