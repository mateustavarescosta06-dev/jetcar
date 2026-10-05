// Atualizar só quando a pessoa escolhe: o site nunca recarrega sozinho. Quando sai uma versão nova
// (ou muda algo que só vale depois de recarregar, como o movimento pedido pelo aparelho), aparece
// um aviso no canto com "Atualizar" e "Agora não".
// - A versão é o hash de tudo o que é publicado (js/version.js, gerado por scripts/stamp.cjs). A
//   página guarda a versão com que abriu e confere a do servidor, sem cache, ao voltar para a aba,
//   ao reconectar, ao voltar pelo histórico e a cada 10 min com a aba à vista.
// - "Agora não" guarda o aviso até sair outra versão (ou o aparelho mudar de novo).
// - Antes de recarregar, a página guarda onde a pessoa estava (onReload) para voltar ao mesmo ponto.
import { VERSION } from './version.js';

const EVERY = 10 * 60e3;   // conferência com a aba à vista
const GAP = 60e3;          // intervalo mínimo entre conferências pedidas por eventos
const FIRST = 30e3;        // a primeira: cobre a página que abriu de um cache antigo
const SOURCE = new URL('./version.js', import.meta.url);

const box = document.querySelector('.update');
const say = document.querySelector('[data-update-say]');
const titleEl = box?.querySelector('[data-update-title]');
const textEl = box?.querySelector('[data-update-text]');
const reduceQ = matchMedia('(prefers-reduced-motion: reduce)');

// o texto da versão nova fica no HTML; os do movimento, aqui
const MESSAGES = {
  version: [titleEl?.textContent.trim(), textEl?.textContent.trim()],
  reduce: ['Menos movimento', 'O aparelho passou a pedir menos movimento. Atualize para aplicar; você volta para o mesmo ponto.'],
  full: ['Movimento liberado', 'O aparelho voltou a liberar o movimento. Atualize para aplicar; você volta para o mesmo ponto.'],
};

const reasons = new Set();
let dismissed = null;   // a versão que a pessoa deixou para depois
let latest = VERSION;
let last = 0;
let hideTimer = 0;
let beforeReload = null;

const still = () => reduceQ.matches || document.documentElement.classList.contains('reduced');

function render() {
  if (!box) return;
  const key = reasons.has('version') ? 'version' : [...reasons].pop();
  if (!key) { hide(); return; }
  const [title, text] = MESSAGES[key];
  const changed = titleEl.textContent !== title || box.hidden;
  titleEl.textContent = title;
  textEl.textContent = text;
  clearTimeout(hideTimer);
  if (box.hidden) {
    box.hidden = false;
    // o estado de saída precisa ser calculado antes de entrar (sem esperar quadro: no Ceramic, num
    // aparelho lento, um quadro pode demorar)
    void box.offsetWidth;
    box.classList.add('is-on');
  }
  // leitor de tela: avisa uma vez, sem tirar o foco de onde a pessoa está
  if (changed && say) {
    say.textContent = '';
    setTimeout(() => { say.textContent = `${title}. ${text}`; }, 120);
  }
}

function hide() {
  if (!box || box.hidden) return;
  box.classList.remove('is-on');
  if (say) say.textContent = '';
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { box.hidden = true; }, still() ? 0 : 450);
}

/** Algo que só vale depois de recarregar ('reduce' ou 'full': o movimento pedido pelo aparelho). */
export function offer(key) { reasons.add(key); render(); }
/** O motivo deixou de valer (o aparelho voltou atrás, por exemplo). */
export function withdraw(...keys) { let gone = false; for (const k of keys) gone = reasons.delete(k) || gone; if (gone) render(); }

async function check() {
  if (document.visibilityState !== 'visible' || navigator.onLine === false) return;
  last = Date.now();
  try {
    const res = await fetch(SOURCE, { cache: 'no-store' });
    if (!res.ok) return;
    const v = /VERSION = '([0-9a-f]+)'/.exec(await res.text())?.[1];
    if (!v) return;
    latest = v;
    // voltou para a versão aberta (a publicação foi desfeita): o aviso sai
    if (v === VERSION) { withdraw('version'); return; }
    if (v !== dismissed) offer('version');
  } catch {}
}
const soon = () => { if (Date.now() - last > GAP) check(); };

export function initUpdate({ onReload } = {}) {
  if (!box) return;
  beforeReload = onReload || null;
  box.querySelector('[data-update-go]').addEventListener('click', () => {
    try { beforeReload?.(); } catch {}
    location.reload();
  });
  const later = () => {
    if (reasons.has('version')) dismissed = latest;
    reasons.clear();
    hide();
  };
  box.querySelector('[data-update-later]').addEventListener('click', later);
  box.addEventListener('keydown', e => { if (e.key === 'Escape') later(); });

  if (location.protocol === 'file:') return;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') soon(); });
  addEventListener('online', soon);
  addEventListener('pageshow', e => { if (e.persisted) check(); });
  setInterval(() => { if (document.visibilityState === 'visible') check(); }, EVERY);
  setTimeout(check, FIRST);
  // ?debug: conferir na hora (testes)
  if (/[?&]debug\b/.test(location.search)) window.__jetcarUpdate = { check, offer, withdraw, version: VERSION };
}
