// Pôsteres das cenas 3D (usados sem WebGL e enquanto a cena carrega): abre o site, leva cada
// ato até o ponto de leitura, esconde o que é HTML por cima (cards, rótulos, controles, barra)
// e fotografa o palco. Desktop (1920×1200) e celular (430×932 a 2×).
// Uso: npm start (porta 3000) e, em outro terminal, node scripts/posters.cjs [url]
// ONLY=hero-m (por exemplo) refaz só um pôster.
// Rode depois de mudar uma cena 3D, para o pôster continuar igual à cena.
// Precisa do Playwright com um Chromium que tenha WebGL (PLAYWRIGHT_PATH aponta para o pacote).
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.argv[2] || 'http://localhost:3000';
const OUT = path.resolve(__dirname, '../dist/assets/posters');
// os mesmos pontos de leitura do movimento reduzido (data-hold no HTML)
const ACTS = [['hero', 0.0], ['wash', 0.8], ['polish', 0.78], ['protect', 0.3]];
const MODES = {
  d: { viewport: { width: 1920, height: 1200 }, deviceScaleFactor: 1 },
  m: { viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [suffix, opts] of Object.entries(MODES)) {
    if (process.env.ONLY && !process.env.ONLY.endsWith(`-${suffix}`)) continue;
    const page = await (await browser.newContext(opts)).newPage();
    await page.goto(`${BASE}/?debug`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.classList.contains('is-ready'), null, { timeout: 60000 });
    await page.waitForTimeout(4000);
    await page.addStyleTag({ content: '.bar,.card,.hero-copy,.hero-scrim,.layer-labels,.separator,.film-control,.film-labels,.slit,.stack{visibility:hidden!important}' });
    for (const [id, p] of ACTS) {
      if (process.env.ONLY && process.env.ONLY !== `${id}-${suffix}`) continue;
      const y = await page.evaluate(([id, p]) => { const a = window.__jetcar.acts[id]; return a.top + a.travel * p; }, [id, p]);
      await page.evaluate(y => scrollTo(0, y), y);
      await page.waitForTimeout(800);
      await page.evaluate(() => window.__jetcar.settle());
      // mexe 1 px e volta: conta como atividade e força quadros novos (parado, o site deixa de desenhar)
      await page.evaluate(y => { scrollTo(0, y + 1); requestAnimationFrame(() => scrollTo(0, y)); }, y);
      await page.waitForTimeout(3500);
      const png = path.join(OUT, `${id}-${suffix}.png`);
      await page.screenshot({ path: png });
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-c:v', 'libwebp', '-quality', '82', path.join(OUT, `${id}-${suffix}.webp`)]);
      // imagem de compartilhamento (1200×630) a partir do hero do desktop
      if (id === 'hero' && suffix === 'd') execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-vf', 'scale=1200:-2,crop=1200:630:0:(ih-630)/2', '-q:v', '3', path.join(OUT, '../og.jpg')]);
      fs.unlinkSync(png);
      console.log(`${id}-${suffix}.webp`);
    }
  }
  await browser.close();
})();
