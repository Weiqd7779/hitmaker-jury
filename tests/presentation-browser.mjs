import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.env.CAREER_BROWSER_URL || 'http://127.0.0.1:5173';
const staticSite = process.argv.includes('--static');
const statePath = staticSite ? '/presentation.json' : '/api/presentation';
const initial = await fetch(`${base}${statePath}`).then(r => r.json());
const allowPaid = process.argv.includes('--allow-paid');
const directory = await mkdtemp(join(tmpdir(), 'jury-presentation-browser-'));
const browser = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--headed'), slowMo: 180 });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const consoleErrors = [], failures = [], posts = [];
page.on('pageerror', error => consoleErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('requestfailed', request => { if (!request.failure()?.errorText.includes('ERR_ABORTED')) failures.push(request.url()); });
page.on('request', request => { if (request.method() === 'POST') posts.push(new URL(request.url()).pathname); });
try {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Music Jury #031' }).waitFor();
  await page.screenshot({ path: join(directory, 'before.png'), fullPage: true });
  if (initial.status === 'empty' && allowPaid) {
    await page.getByRole('button', { name: '準備三位真實評論' }).click();
    await page.getByRole('button', { name: '確認取得三份評論' }).click();
  }
  let ready = await fetch(`${base}${statePath}`).then(r => r.json());
  for (let attempt = 0; ready.status === 'running' && attempt < 350; attempt++) {
    await page.waitForTimeout(1200);
    ready = await fetch(`${base}${statePath}`).then(r => r.json());
  }
  if (ready.status !== 'completed') {
    if (allowPaid || ready.status === 'blocked') {
      await page.screenshot({ path: join(directory, 'blocked.png'), fullPage: true });
      throw new Error(`Real inference not complete: ${ready.status}; ${ready.error || 'No spending authorized'}`);
    }
    await page.getByRole('combobox', { name: '評論來源' }).selectOption('sample');
  }
  await page.getByRole('button', { name: '開始展示' }).click();
  await page.getByTestId('career-complete').waitFor({ timeout: 90000 });
  assert.equal(await page.locator('.delivered-reviews article').count(), 3);
  assert.ok(await page.getByText('三位 Agent，合計 0.003 0G。').isVisible());
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const overlaps = await page.locator('.worker-card').evaluateAll(cards => cards.some(card => {
    const line = card.querySelector('.worker-topline'), score = card.querySelector('[class~="-top-6"]');
    return line && score && score.getBoundingClientRect().top < line.getBoundingClientRect().bottom;
  }));
  assert.equal(overlaps, false, 'Score badges must not overlap hiring status');
  await page.screenshot({ path: join(directory, 'desktop-complete.png'), fullPage: true });
  const beforeReplay = await fetch(`${base}${statePath}`).then(r => r.json());
  const postCount = posts.length;
  for (let run = 0; run < 2; run++) {
    await page.getByRole('button', { name: '重新播放' }).click();
    for (let scene = 0; scene < 10; scene++) {
      const next = page.getByRole('button', { name: '下一幕' });
      if (!await next.isVisible()) break;
      await next.click({ timeout: 2000 });
      await page.waitForTimeout(100);
    }
    await page.getByTestId('career-complete').waitFor();
  }
  const afterReplay = await fetch(`${base}${statePath}`).then(r => r.json());
  assert.equal(afterReplay.attempts, beforeReplay.attempts); assert.equal(posts.length, postCount);
  if (ready.status === 'completed') {
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: '下載 AI 交付紀錄' }).click()]);
    await download.saveAs(join(directory, 'real-reviews.json'));
    assert.equal(download.suggestedFilename(), 'jury-real-reviews.json');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(directory, 'mobile-complete.png'), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', { name: '查看履歷與交付' }).first().click();
  await page.getByRole('combobox', { name: '模型版本' }).selectOption('current');
  await page.screenshot({ path: join(directory, 'mobile-deliverable.png') });
  assert.ok(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
  await page.keyboard.press('Escape');
  assert.deepEqual(consoleErrors, []); assert.deepEqual(failures, []);
  console.log(JSON.stringify({ ok: true, screenshots: directory, realInferenceStatus: afterReplay.status, attempts: afterReplay.attempts, savedReviews: afterReplay.entries.filter(e => e.status === 'completed').length, replaysWithoutNewRequests: 2, billedCosts0G: afterReplay.entries.map(e => e.billedCost0G), chainTransactions: 'not performed; settlement explicitly simulated', posts, consoleErrors, failures }, null, 2));
} finally { await browser.close(); }
