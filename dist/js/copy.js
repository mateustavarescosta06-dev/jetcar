// Textos sobre as cenas: entram e saem guiados pela rolagem (letras giram em 3D),
// sempre legíveis no intervalo de pausa de cada cena.
import { $, $$, view, state, clamp, span, out, inn, smooth, env, css, on, opacity, f } from './core.js';
import { T } from './timeline.js';
import { logoRest } from './matte.js';
import { LOGO } from './logo-data.js';

const RANGES = {
  hero: T.hero.copy, brand: T.brand.copy, wash: T.wash.copy, polish: T.polish.copy, ceramic: T.ceramic.copy,
  layers: T.layers.copy, ppf: T.ppf.copy, interior: T.interior.copy, contact: T.contact.copy, place: T.place.copy, final: T.final.copy,
};
const SCRIM = { hero: 0.85, wash: 1, polish: 0.55, ceramic: 1, ppf: 1, interior: 1, contact: 0.7, place: 0, final: 0, layers: 0, brand: 0 };

const scrim = $('.scrim');
const ticker = $('.ticker');

function split(el) {
  const chars = [];
  let label = '';
  const nodes = Array.from(el.childNodes);
  el.textContent = '';
  for (const node of nodes) {
    if (node.nodeName === 'BR') { el.append(document.createElement('br')); label += ' '; continue; }
    const text = node.textContent;
    label += text;
    for (const part of text.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { el.append(document.createTextNode(' ')); continue; }
      const w = document.createElement('span');
      w.className = 'w';
      w.setAttribute('aria-hidden', 'true');
      for (const ch of part) {
        const c = document.createElement('span');
        c.className = 'c';
        c.textContent = ch;
        w.append(c);
        chars.push(c);
      }
      el.append(w);
    }
  }
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = label.replace(/\s+/g, ' ').trim();
  el.prepend(sr);
  return chars;
}

export const acts = $$('.act').map(el => {
  const name = el.dataset.act;
  const items = [];
  for (const node of $$('.ln, .split', el)) {
    if (node.classList.contains('split')) items.push({ chars: split(node) });
    else if (!node.closest('.split')) items.push({ line: node });
  }
  return { el, name, range: RANGES[name], items, visible: false };
});

export function layoutCopy() {
  const rest = logoRest();
  const bottom = rest.y + (LOGO.h * rest.s) / 2;
  css(ticker, 'top', `${Math.round(bottom + (view.mobile ? 26 : 40))}px`);
}

function animateAct(act, u) {
  const [a, b, c, d] = act.range;
  const tin = a < 0 ? 1 : span(u, a, b);
  const tout = span(u, c, d);
  const visible = tin > 0.001 && tout < 0.999;
  on(act.el, visible);
  act.visible = visible;
  act.level = visible ? Math.min(smooth(tin), 1 - smooth(tout)) : 0;
  if (!visible) return;
  const reduce = state.reduce;
  const n = act.items.length, st = 0.11, spread = 1 + st * (n - 1);
  act.items.forEach((item, i) => {
    const li = clamp(tin * spread - st * i), lo = clamp(tout * spread - st * i);
    if (item.line) {
      const ei = out(li), eo = inn(lo);
      opacity(item.line, ei * (1 - eo));
      css(item.line, 'transform', reduce || (ei === 1 && eo === 0) ? 'none' : `translate3d(0,${f((1 - ei) * 26 - eo * 18)}px,0)`);
      return;
    }
    const m = item.chars.length;
    item.chars.forEach((ch, j) => {
      const at = (j / Math.max(1, m - 1)) * 0.5;
      const ei = out(clamp((li - at) / 0.5)), eo = inn(clamp((lo - at) / 0.5));
      opacity(ch, ei * (1 - eo));
      css(ch, 'transform', reduce || (ei === 1 && eo === 0) ? 'none' : `perspective(560px) translate3d(0,${f((1 - ei) * 0.55 - eo * 0.3, 3)}em,0) rotateX(${f((1 - ei) * -84 + eo * 70)}deg)`);
    });
  });
}

export function renderCopy(u) {
  let s = 0;
  for (const act of acts) {
    animateAct(act, u);
    s = Math.max(s, act.level * (SCRIM[act.name] ?? 0));
  }
  opacity(scrim, s);
}

/** Navegação por teclado: focar algo de uma cena fora da tela leva a rolagem até ela. */
export function bindFocus(jumpToAct) {
  for (const act of acts) {
    act.el.addEventListener('focusin', () => { if (!act.visible) jumpToAct(act.name); });
  }
}
