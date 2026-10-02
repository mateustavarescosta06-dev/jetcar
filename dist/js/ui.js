// Navegação, capítulos, diálogos, escolha do serviço e mensagem para o Instagram.
import { $, $$, view, state, css, f } from './core.js';
import { T, CHAPTERS, SERVICES, ACT_FOCUS } from './timeline.js';
import { focusCard } from './scenes.js';

const overlay = $('.overlay');
const chapterLabel = $('.chapter span'), chapterIndex = $('.chapter b');
const chaptersNav = $('.chapters');
const progress = $('.progress i');
const motionButton = $('.motion');
let jumpFn = () => {};

export function bindJump(fn) {
  jumpFn = fn;
  for (const b of $$('[data-jump]')) b.addEventListener('click', () => {
    const ch = CHAPTERS.find(c => c.id === b.dataset.jump);
    if (ch) jumpFn(ch.u);
  });
}
export const jumpToAct = name => jumpFn(ACT_FOCUS[name] ?? 0);

// ——— Capítulos ———
const visibleChapters = CHAPTERS.filter(c => !c.hidden);
for (const ch of visibleChapters) {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-label', ch.label);
  b.title = ch.label;
  b.addEventListener('click', () => jumpFn(ch.u));
  ch.button = b;
  chaptersNav.append(b);
}
let currentChapter = null;
export function renderHud(u) {
  let cur = visibleChapters[0];
  for (const ch of visibleChapters) if (u >= ch.u - 1.1) cur = ch;
  if (cur !== currentChapter) {
    currentChapter = cur;
    const i = visibleChapters.indexOf(cur);
    chapterIndex.textContent = String(i).padStart(2, '0');
    chapterLabel.textContent = cur.label;
    for (const ch of visibleChapters) {
      ch.button.classList.toggle('is-current', ch === cur);
      if (ch === cur) ch.button.setAttribute('aria-current', 'step');
      else ch.button.removeAttribute('aria-current');
    }
  }
  css(progress, 'transform', `scaleX(${f(Math.min(1, u / (T.total - 0.3)), 4)})`);
  overlay.classList.toggle('is-light', state.light > 0.5);
}

// ——— Movimento reduzido ———
export function setReduce(flag) {
  state.reduce = flag;
  document.documentElement.classList.toggle('reduced', flag);
  motionButton.setAttribute('aria-pressed', String(flag));
  motionButton.textContent = flag ? 'Ativar movimento' : 'Reduzir movimento';
}
motionButton.addEventListener('click', () => setReduce(!state.reduce));

// ——— Diálogos ———
const serviceDialog = $('#service-dialog');
let detailIndex = 0;
for (const b of $$('[data-detail]')) b.addEventListener('click', () => {
  detailIndex = Number(b.dataset.detail);
  const s = SERVICES[detailIndex];
  $('#detail-title').textContent = s.name;
  $('#detail-description').textContent = s.description;
  $('.detail-img').src = s.img;
  $('.detail-img').alt = `${s.name} (imagem ilustrativa)`;
  $('#detail-points').replaceChildren(...s.points.map(t => Object.assign(document.createElement('li'), { textContent: t })));
  openDialog(serviceDialog);
});
$('#choose-service').addEventListener('click', () => {
  closeDialog(serviceDialog);
  select(detailIndex);
  jumpToAct('contact');
});
$('#faq-open').addEventListener('click', () => openDialog($('#faq-dialog')));
// Diálogos nativos; em navegadores antigos sem <dialog>, abre como painel simples.
let lastFocus = null;
function openDialog(d) {
  lastFocus = document.activeElement;
  if (typeof d.showModal === 'function') d.showModal();
  else { d.setAttribute('open', ''); d.querySelector('button, a')?.focus(); }
}
function closeDialog(d) {
  if (typeof d.close === 'function') d.close();
  else { d.removeAttribute('open'); lastFocus?.focus?.(); }
}
for (const d of $$('dialog')) {
  d.addEventListener('click', e => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog(d);
  });
  d.querySelector('.close')?.addEventListener('click', e => { if (typeof d.close !== 'function') { e.preventDefault(); closeDialog(d); } });
}

// ——— Escolha do serviço (anel ⇄ campo) ———
const selectEl = $('#service-select');
export function select(i) {
  state.selected = i;
  selectEl.value = String(i);
  focusCard(i);
}
selectEl.addEventListener('change', () => select(Number(selectEl.value)));
document.addEventListener('jetcar:select', e => {
  select(e.detail);
  status.textContent = '';
});

// ——— Mensagem ———
const form = $('#contact-form'), fields = $('.fields', form), result = $('.result', form);
const messageEl = $('#message-text'), status = $('#copy-status');
function buildMessage() {
  const i = Number(selectEl.value), car = $('#car-model').value.trim();
  const intro = car ? `Meu carro é um ${car}. ` : '';
  const ask = i < 0 ? 'Gostaria de orientação para escolher o cuidado adequado.' : `Tenho interesse em ${SERVICES[i].name}.`;
  return `Olá, JETCAR! ${intro}${ask} Podem me informar o orçamento e a disponibilidade?`;
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  try {
    const area = Object.assign(document.createElement('textarea'), { value: text });
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.append(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch { return false; }
}
form.addEventListener('submit', e => {
  e.preventDefault();
  messageEl.textContent = buildMessage();
  fields.hidden = true;
  result.hidden = false;
  status.textContent = 'Mensagem pronta. Copie e envie para @jetcarbv.';
  $('#send-message').focus({ preventScroll: true });
});
$('#send-message').addEventListener('click', () => {
  // A cópia começa dentro do gesto; o link abre o Direct do Instagram em seguida.
  copy(messageEl.textContent).then(ok => { status.textContent = ok ? 'Mensagem copiada. É só colar no Direct.' : 'Copie o texto acima e cole no Direct.'; });
});
$('#copy-message').addEventListener('click', async () => {
  const ok = await copy(messageEl.textContent);
  status.textContent = ok ? 'Mensagem copiada.' : 'Selecione o texto acima para copiar.';
  if (!ok) { const r = document.createRange(); r.selectNodeContents(messageEl); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
});
$('#edit-message').addEventListener('click', () => {
  result.hidden = true;
  fields.hidden = false;
  status.textContent = '';
  $('#car-model').focus({ preventScroll: true });
});

// ——— Campos focados no celular: o teclado não deve "rolar" a experiência ———
// O iOS rola a página ao abrir/fechar o teclado; por um instante ignoramos essa rolagem
// e devolvemos a posição. A rolagem do usuário volta a valer logo em seguida.
let freezeTimer = 0;
const touchOnly = matchMedia('(hover: none)');
function freezeFor(ms) {
  if (state.frozenY == null) state.frozenY = window.scrollY;
  clearTimeout(freezeTimer);
  freezeTimer = setTimeout(() => {
    const y = state.frozenY;
    state.frozenY = null;
    if (y != null && Math.abs(window.scrollY - y) > 4) window.scrollTo(0, y);
  }, ms);
}
document.addEventListener('focusin', e => { if (touchOnly.matches && e.target.matches('input, select, textarea')) freezeFor(900); });
document.addEventListener('focusout', e => { if (touchOnly.matches && e.target.matches('input, select, textarea')) freezeFor(600); });
/** Gesto do usuário ou navegação explícita sempre vencem a proteção do teclado. */
export function cancelFreeze() {
  clearTimeout(freezeTimer);
  state.frozenY = null;
}
addEventListener('touchmove', () => { if (state.frozenY != null) cancelFreeze(); }, { passive: true });

// ——— Carregamento ———
export function ready() {
  document.documentElement.classList.add('is-ready');
}

export { view };
