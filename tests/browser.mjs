import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.env.CAREER_BROWSER_URL || 'http://127.0.0.1:5173';
const initial = await fetch(`${base}/api/career`).then(r => r.json());
assert.equal(initial.ready, false, 'Browser checks must run with transactions disabled');
const directory = await mkdtemp(join(tmpdir(), 'jury-browser-'));
const headed = process.argv.includes('--headed');
const liveOnly = process.argv.includes('--live-only');
const browser = await chromium.launch({ channel: 'chrome', headless: !headed, slowMo: headed ? 250 : 0 });
const results = [];
const viewports = liveOnly ? [['desktop', 1440, 1000], ['mobile', 390, 844]] : [['desktop', 1440, 1000], ['tablet', 834, 1112], ['mobile', 390, 844], ['small-mobile', 320, 740]];
try {
  for (const [name, width, height] of viewports) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [], failed = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => { if (!request.failure()?.errorText.includes('ERR_ABORTED')) failed.push({ url: request.url(), error: request.failure()?.errorText }); });
    if (!liveOnly) await page.route('**/api/jobs**', route => {
      if (route.request().method() !== 'GET') return route.abort('blockedbyclient');
      return route.continue();
    });
    const pageURL = new URL(base); pageURL.searchParams.set('mode', 'legacy');
    await page.goto(pageURL.href, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '查看可驗證履歷' }).first().waitFor();
    const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    await page.screenshot({ path: join(directory, `${name}.png`), fullPage: true });
    assert.ok(overflow.scroll <= overflow.width + 1, `${name}: horizontal overflow ${JSON.stringify(overflow)}`);
    assert.equal(await page.getByRole('button', { name: '先建立真實種子工作' }).isDisabled(), true);
    await page.getByRole('button', { name: '查看可驗證履歷' }).first().click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('combobox').selectOption(initial.modelB);
    assert.ok(await page.getByText('此模型版本尚無真實工作紀錄。').isVisible());
    const modalOverflow = await page.getByRole('dialog').evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    await page.screenshot({ path: join(directory, `${name}-drawer.png`) });
    assert.ok(modalOverflow.scroll <= modalOverflow.client + 1, `${name}: drawer horizontal overflow`);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.locator('audio').evaluate(async el => { await el.play(); });
    await page.waitForTimeout(300);
    assert.ok(await page.locator('audio').evaluate(el => el.currentTime > 0 && !el.paused));
    if (liveOnly) {
      await page.waitForFunction(() => document.querySelector('audio')?.ended, undefined, { timeout: 20000 });
      for (let i = 1; i < initial.workers.length; i++) {
        await page.getByRole('button', { name: '查看可驗證履歷' }).nth(i).click();
        await page.getByRole('dialog').waitFor();
        assert.ok(await page.getByText('此模型版本尚無真實工作紀錄。').isVisible());
        await page.getByRole('button', { name: '關閉履歷' }).click();
      }
      await page.screenshot({ path: join(directory, `${name}-actual-after-playback.png`), fullPage: true });
      const playback = await page.locator('audio').evaluate(el => ({ duration: el.duration, ended: el.ended, currentTime: el.currentTime }));
      results.push({ name, overflow, playback, inspectedWorkers: initial.workers.length, startButtonDisabled: true, errors: [...errors], failed: [...failed] });
      assert.deepEqual(errors, [], `${name}: live console errors`);
      assert.deepEqual(failed, [], `${name}: live failed requests`);
      await context.close();
      continue;
    }
    await page.locator('audio').evaluate(el => el.pause());
    const worker = { ...initial.workers[0], agentId: '1' };
    const makeJob = (kind, model, digit) => {
      const id = `${digit.repeat(8)}-${digit.repeat(4)}-${digit.repeat(4)}-${digit.repeat(4)}-${digit.repeat(12)}`;
      const record = { jobId: id, kind, manager: `0x${'1'.repeat(40)}`, worker: { ...worker, model, payee: `0x${'2'.repeat(40)}` }, response: { body: JSON.stringify({ review: { score: 80, headline: 'BROWSER TEST FIXTURE', critique: '只供瀏覽器測試，不是真實工作紀錄。'.repeat(12) } }), proofHeader: 'BROWSER_TEST_FIXTURE_NOT_A_REAL_PROOF' }, observedBlock: { number: 1, hash: `0x${'3'.repeat(64)}` } };
      return { id, kind, model, status: 'completed', createdAt: '2026-09-09T00:00:00Z', works: [{ key: worker.key, agentId: '1', status: 'completed', record, storage: { rootHash: `0x${'4'.repeat(64)}`, stored: true }, verification: { ok: true, checkedAt: '2026-09-09T00:00:00Z', checks: [{ key: 'record', status: 'passed', detail: 'Browser fixture only' }] } }], events: Array.from({ length: 5 }, (_, i) => ({ id: String(i), at: '2026-09-09T00:00:00Z', key: worker.key, status: 'passed', message: `BROWSER TEST FIXTURE event ${i}` })) };
    };
    const fixture = { ...initial, ready: true, missing: [], paidJobLimit: 1, paidJobsCreated: 1, workers: [worker, ...initial.workers.slice(1)], jobs: [makeJob('live', initial.modelB, 'a'), makeJob('seed', initial.modelA, 'b')] };
    const posts = [];
    await page.unroute('**/api/jobs**');
    await page.route('**/api/jobs**', async route => {
      if (route.request().method() !== 'GET') posts.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: fixture.jobs[0].id }) });
    });
    await page.route('**/api/career', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(await page.getByRole('button', { name: '已達真實工作次數上限' }).isDisabled(), true);
    const beforeCounts = await page.locator('.career-counts').allTextContents();
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: '重播既有工作（不發交易）' }).click();
      await page.getByText('唯讀重播 · 非即時執行').waitFor();
      await page.waitForTimeout(850);
      assert.ok(await page.locator('.trail-events li').count() > 0);
      await page.getByRole('button', { name: '結束重播' }).click();
    }
    assert.deepEqual(posts, [], 'Rehearsal must not issue POSTs');
    assert.deepEqual(await page.locator('.career-counts').allTextContents(), beforeCounts);
    await page.getByRole('button', { name: '查看可驗證履歷' }).first().click();
    await page.getByRole('combobox').selectOption(initial.modelB);
    assert.equal(await page.locator('.work-evidence').count(), 1);
    await page.screenshot({ path: join(directory, `${name}-fixture-evidence.png`) });
    assert.ok(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await page.keyboard.press('Escape');
    fixture.paidJobLimit = 2;
    await page.getByRole('button', { name: '新增真實三人工作（會支出）' }).waitFor();
    await page.getByRole('button', { name: '新增真實三人工作（會支出）' }).click();
    await page.getByRole('button', { name: '取消', exact: true }).click();
    assert.deepEqual(posts, []);
    results.push({ name, overflow, readOnlyReplays: 3, errors: [...errors], failed: [...failed] });
    assert.deepEqual(errors, [], `${name}: console errors`);
    assert.deepEqual(failed, [], `${name}: failed requests`);
    await context.close();
  }
  console.log(JSON.stringify({ ok: true, scope: liveOnly ? 'actual UI only; no mocked responses; no paid requests' : 'UI regression including isolated fixtures', fullWorkflow: liveOnly ? 'blocked by actual configuration' : 'not tested against real agents', blockers: liveOnly ? initial.missing : undefined, screenshots: directory, results }, null, 2));
} finally { await browser.close(); }
