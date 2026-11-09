// Rest: heart rate with the breathing guide, on the real page. Live Hume-style heart rate (once a second, whole bpm)
// is injected while time runs on Playwright's clock, so a six-minute session takes seconds.
// Run: node scripts/guide-heart.mjs [screenshot folder]
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = pathToFileURL(path.join(root, "Autonomic_Telemetry_Console.html")).href;
const shots = process.argv[2] || null;
const browser = await chromium.launch({ headless: true });
const errors = [];
let passed = 0;
const only = process.argv[3] || "";
async function check(name, fn) { if (!name.includes(only)) return; await fn(); passed++; console.log(`✓ ${name}`); }

function lcg(seed) { let s = seed >>> 0; return () => ((s = (1664525 * s + 1013904223) >>> 0) / 4294967296); }

async function restPage(viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.clock.install();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => Boolean(window.TelemetryLive));
  await page.evaluate(() => TelemetryLive.setRestTier("min"));
  await page.click("#rest-mode");
  await page.clock.runFor(1500);
  if (!(await page.evaluate(() => TelemetryLive.getVisualState().breathing))) {
    await page.click("#space-button"); await page.click("#breath-toggle"); await page.keyboard.press("Escape");
  }
  assert.equal(await page.evaluate(() => TelemetryLive.getVisualState().breathing), true, "the breathing guide is on in Rest");
  return { page, close: () => context.close() };
}

// Seconds of live heart rate, sent from inside the page once a second on the page's own (simulated) clock.
// follow: swings ±amp with the guide the page is showing (peak about 3 s after the in-breath begins); otherwise
// breathing on one's own at 15 a minute (phase wandering slowly). Slow drift and beat noise either way. Seeded.
async function live(page, seconds, { follow, amp = 3, seed = 1 }) {
  await page.evaluate(({ follow, amp, seed }) => {
    if (window.__heart) clearInterval(window.__heart);
    let s = seed >>> 0, k = 0, own = 0;
    const rnd = () => ((s = (1664525 * s + 1013904223) >>> 0) / 4294967296);
    TelemetryLive.status({ device: "hume", state: "streaming" });
    const send = () => {
      const g = TelemetryLive.getVisualState().guideSeconds;
      const guide = Number.isFinite(g) ? Math.cos(2 * Math.PI * ((g % 10) / 10) - 1.9) : 0;
      const t = k++;
      own += 0.3 * (rnd() - 0.5);
      const bpm = 68 + 1.5 * Math.sin(2 * Math.PI * t / 77) + 2 * (rnd() - 0.5) +
        (follow ? amp * guide : 1.5 * Math.cos(2 * Math.PI * 0.25 * t + own));
      TelemetryLive.receive({ device: "hume", type: "heart_rate", heart_rate_bpm: Math.round(bpm), received_at: Date.now(), source: "device-reported" });
    };
    send();
    window.__heart = setInterval(send, 1000);
  }, { follow, amp, seed });
  await page.clock.runFor(seconds * 1000);
}
const text = (page, sel) => page.evaluate((q) => { const e = document.querySelector(q); return e && !e.hidden ? e.textContent.trim() : null; }, sel);
async function wake(page) {
  await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  await page.clock.runFor(500);
  await page.waitForTimeout(1600);   // the 1.2 s fade back in runs on real time, not the simulated clock
}

await check("Demo: no heart-and-guide readout, even in Rest with the guide on", async () => {
  const { page, close } = await restPage();
  await page.click("#mode-action").catch(() => {});
  await page.evaluate(() => document.getElementById("demo-button").click());
  await page.clock.runFor(30000);
  assert.equal(await page.evaluate(() => TelemetryLive.getState().source), "demo");
  assert.equal(await text(page, "#rest-guide"), null);
  assert.equal(await text(page, "#guide-heart"), null);
  await close();
});

await check("Live, heart following the guide: checking first, then in step with a swing near the true ±3 bpm", async () => {
  const { page, close } = await restPage();
  await live(page, 5, { follow: true, seed: 11 });
  assert.equal(await page.evaluate(() => TelemetryLive.getState().source), "live");
  assert.match(await text(page, "#rest-guide"), /^Checking your heart with the guide · 0 of 5 min$/);
  await live(page, 185, { follow: true, seed: 12 });
  assert.match(await text(page, "#rest-guide"), /^Checking your heart with the guide · 3 of 5 min$/);
  await live(page, 210, { follow: true, seed: 13 });
  const line = await text(page, "#rest-guide");
  const m = line && line.match(/^Heart in step with the guide · ±(\d+\.\d)\u00a0bpm$/);
  assert.ok(m, `in-step line, got: ${line}`);
  assert.ok(+m[1] >= 2.2 && +m[1] <= 3.6, `swing ${m[1]} bpm vs true 3`);
  if (shots) { await wake(page); await page.screenshot({ path: path.join(shots, "rest_in_step_desktop.png") }); }
  await page.evaluate(() => document.getElementById("arousal-button").click());
  await page.clock.runFor(800);
  const card = await text(page, "#guide-heart");
  assert.match(card, /With the breathing guide\s*Your heart rate rises and falls with the guide by about ±\d\.\d\u00a0bpm, highest about \d+ s after each in-breath begins\. From your last \d+ minutes with the guide\./);
  if (shots) {
    await page.locator("#guide-heart").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shots, "details_in_step_desktop.png") });
  }
  console.log(`   Rest line: "${line}"\n   details: "${card.replace(/\s+/g, " ")}"`);
  await page.evaluate(() => document.getElementById("arousal-sheet").close());
  await page.evaluate(() => document.getElementById("work-mode").click());
  await page.clock.runFor(1500);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("rest-guide")).display), "none", "the Rest line is gone in Work");
  assert.equal(await text(page, "#guide-heart"), null, "the details card is gone in Work");
  await close();
});

await check("Live, heart not following the guide: not in step", async () => {
  const { page, close } = await restPage();
  await live(page, 400, { follow: false, seed: 21 });
  assert.equal(await text(page, "#rest-guide"), "Heart not in step with the guide yet");
  await close();
});

await check("Phone width: the in-step line fits under the trend line", async () => {
  const { page, close } = await restPage({ width: 393, height: 852 });
  await live(page, 400, { follow: true, seed: 31 });
  await wake(page);
  const box = await page.locator("#rest-guide").boundingBox();
  const opacity = await page.evaluate(() => getComputedStyle(document.getElementById("rest-guide")).opacity);
  assert.equal(opacity, "1", "after a tap the line is shown, not withdrawn");
  assert.ok(box && box.width <= 393 && box.x >= 0, `line inside the screen: ${JSON.stringify(box)}`);
  if (shots) await page.screenshot({ path: path.join(shots, "rest_in_step_phone.png") });
  await close();
});

assert.deepEqual(errors, [], `page errors: ${errors.join(" | ")}`);
console.log(`${passed} heart-and-guide checks passed; no page errors.`);
await browser.close();
