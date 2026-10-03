// Render parado da cena do polimento da v6.1 (para scripts/frames/build_polish.py).
// node scripts/render/render-polish.cjs <saida.png> <largura> <altura> <dpr> "<query>"
// O site da v6.1 com polish-still.patch precisa estar servido em BASE (padrão http://localhost:3200).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3200';
(async () => {
  const [out, w, h, dpr, extra] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(`${BASE}/?debug&quality=high&still=1&${extra || ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.classList.contains('is-ready'), null, { timeout: 120000 });
  await page.addStyleTag({ content: '.bar,.card,.slit,.lane,.gl-snap,header,nav{visibility:hidden!important}' });
  await page.evaluate(() => { const a = window.__jetcar.acts.polish; scrollTo(0, a.top + a.travel * 0.5); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__jetcar.settle());
  // mexe 1 px e volta: o site só desenha quando algo muda
  await page.evaluate(() => { const y = scrollY; scrollTo(0, y + 1); requestAnimationFrame(() => scrollTo(0, y)); });
  await page.waitForTimeout(3000);
  const box = await page.evaluate(() => { const r = document.querySelector('#polimento .stage').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: Math.min(r.height, innerHeight) }; });
  await page.screenshot({ path: out, clip: box, timeout: 240000 });
  console.log(out, errs.join(' | ') || 'ok');
  await b.close();
})();
