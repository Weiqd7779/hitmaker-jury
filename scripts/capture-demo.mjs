import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const base = process.env.CAREER_BROWSER_URL || 'https://dist-demo-gamma.vercel.app';
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'images', 'demo-steps');
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
page.on('console', msg => { if (msg.type() === 'error') console.log('console error:', msg.text()); });
page.on('pageerror', err => console.log('page error:', err.message));

const shot = async (selector, name, padding = 16) => {
  try {
    const el = await page.locator(selector).first();
    await el.waitFor({ state: 'visible', timeout: 10000 });
    await el.screenshot({ path: join(out, name), padding });
    console.log('saved', name);
  } catch (e) {
    console.error('failed', name, e.message);
    await page.screenshot({ path: join(out, `${name.replace('.png', '')}-fallback.png`), fullPage: true });
  }
};

const clickNext = async () => {
  const btn = page.locator('button', { hasText: '下一幕' });
  if (await btn.isVisible().catch(() => false)) await btn.click();
};

await page.goto(base, { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: 'Music Jury #031' }).waitFor();

// Step 0: hero + session card (before start)
await shot('.career-hero', 'step-00-hero.png');
await shot('.session-card', 'step-00-session-card.png');

// Start the demo
await page.getByRole('button', { name: '開始展示' }).click();

// Step 1: Manager posts job
await page.waitForTimeout(1200);
await shot('.manager-scene', 'step-01-manager-posts.png');

// Step 2: candidates apply
await clickNext();
await page.waitForTimeout(1200);
await shot('.jury-section', 'step-02-candidates-apply.png');

// Step 3: four agents visible, then hire
await clickNext();
await page.waitForTimeout(1200);
await shot('.jury-grid', 'step-03-agent-grid.png');

// Step 4: music playing / reviews being generated
await clickNext();
await page.waitForTimeout(4500);
await shot('.music-player', 'step-04-music-player.png');

// Step 5: delivered reviews
await clickNext();
await page.waitForTimeout(1200);
await shot('#deliverables', 'step-05-delivered-reviews.png');
await shot('.delivered-reviews article:first-of-type', 'step-05a-review-mixmaster.png');

// Step 6: manager accepts
await clickNext();
await page.waitForTimeout(1200);
await shot('.session-card', 'step-06-manager-accepts.png');

// Step 7: on-chain settlement ledger
await clickNext();
await page.waitForTimeout(1200);
await shot('.demo-ledger', 'step-07-settlement-ledger.png');

// Step 8: career finale
await clickNext();
await page.waitForTimeout(1200);
await shot('.career-finale', 'step-08-career-finale.png');

// Trust trail sidebar
await shot('.trust-trail', 'step-09-trust-trail.png');

// Scroll to on-chain panel and capture
await page.locator('#onchain').scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
await shot('.onchain-panel', 'step-10-onchain-panel.png');

// Capture a worker card detail
await page.locator('button:has-text("查看履歷與交付")').first().click();
await page.waitForTimeout(800);
await shot('[role="dialog"]', 'step-11-worker-drawer.png');

await browser.close();
console.log('done', out);
