// Interface do site: menu, progresso, diálogo dos serviços, controle das camadas,
// escolha do serviço e mensagem pronta para o Instagram.
import { $, $$, view, state, css, f } from './core.js';
import { S, T, SERVICES } from './timeline.js';
import { focusCard } from './scenes.js';

let jumpFn = () => {};
export function bindJump(fn) { jumpFn = fn; }
export const jumpTo = (target, opts) => jumpFn(target, opts);

// ——— Navegação ———
const nav = $('.nav');
const navLinks = $$('.nav-links a');
const progress = $('.nav-progress i');
const toggle = $('.nav-toggle');
const menu = $('#menu');

export function setMenu(open) {
  if (open === !menu.hidden) return;
  menu.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  $('.sr-only', toggle).textContent = open ? 'Fechar menu' : 'Abrir menu';
  $('use', toggle).setAttribute('href', open ? '#i-close' : '#i-menu');
  document.documentElement.classList.toggle('menu-open', open);
  if (open) $('a', menu)?.focus({ preventScroll: true });
  else if (menu.contains(document.activeElement) || document.activeElement === document.body) toggle.focus({ preventScroll: true });
}
toggle.addEventListener('click', () => setMenu(menu.hidden));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });
addEventListener('resize', () => { if (!menu.hidden && innerWidth > 1080) setMenu(false); });

let solid = null, active = null;
function sectionAt(u) {
  if (u >= T.sheet - 0.6) return 'duvidas';
  if (u >= S.local - 0.7) return 'local';
  if (u >= S.contato - 0.7) return 'contato';
  if (u >= S.ppf - 0.7) return 'servicos';
  if (u >= S.protecao - 0.7) return 'protecao';
  if (u >= S.servicos - 0.7) return 'servicos';
  return null;
}

// ——— Controle das camadas (Ceramic Coating ⇄ PPF) ———
const seg = $('.segmented');
const segButtons = $$('[data-guard]', seg);
let shownGuard = -1;
segButtons.forEach(b => b.addEventListener('click', () => { state.guard = Number(b.dataset.guard); state.busy = true; }));
seg.addEventListener('keydown', e => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
  e.preventDefault();
  const next = state.guardShown ? 0 : 1;
  state.guard = next;
  state.busy = true;
  segButtons[next].focus();
});

/** Atualiza menu, progresso e controles a cada quadro em que a rolagem muda. */
export function renderUi(u) {
  const isSolid = window.scrollY > 24;
  if (isSolid !== solid) { solid = isSolid; nav.classList.toggle('is-solid', isSolid); }
  css(progress, 'transform', `scaleX(${f(Math.min(1, window.scrollY / (view.scrollMax || 1)), 4)})`);
  const id = sectionAt(u);
  if (id !== active) {
    active = id;
    for (const a of navLinks) {
      const on = a.getAttribute('href') === `#${id}`;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
  }
  // A escolha manual vale enquanto a seção de camadas estiver por perto.
  if (state.guard != null && (u < S.protecao - 1.4 || u > S.ppf + 0.3)) state.guard = null;
  const g = state.guardShown ?? 0;
  if (g !== shownGuard) {
    shownGuard = g;
    seg.classList.toggle('is-right', g === 1);
    segButtons.forEach((b, i) => {
      b.setAttribute('aria-checked', String(i === g));
      b.tabIndex = i === g ? 0 : -1;
    });
  }
}

// ——— Movimento reduzido ———
const motionButton = $('.motion');
export function setReduce(flag, remember = false) {
  state.reduce = flag;
  document.documentElement.classList.toggle('reduced', flag);
  motionButton.setAttribute('aria-pressed', String(flag));
  motionButton.textContent = flag ? 'Ativar movimento' : 'Reduzir movimento';
  if (remember) try { localStorage.setItem('jetcar-motion', flag ? 'reduce' : 'full'); } catch {}
}
export function savedMotion() {
  try { return localStorage.getItem('jetcar-motion'); } catch { return null; }
}
motionButton.addEventListener('click', () => setReduce(!state.reduce, true));

// ——— Diálogo dos serviços ———
const serviceDialog = $('#service-dialog');
let detailIndex = 0;
function check(text) {
  const row = document.createElement('div');
  row.innerHTML = '<svg aria-hidden="true"><use href="#i-check"/></svg>';
  row.append(Object.assign(document.createElement('span'), { textContent: text }));
  return row;
}
for (const b of $$('[data-detail]')) b.addEventListener('click', () => {
  detailIndex = Number(b.dataset.detail);
  const s = SERVICES[detailIndex];
  $('#detail-title').textContent = s.name;
  $('#detail-description').textContent = s.description;
  const img = $('.detail-img', serviceDialog);
  img.src = s.img;
  img.alt = `${s.name} (imagem ilustrativa)`;
  $('#detail-points').replaceChildren(...s.points.map(check));
  openDialog(serviceDialog);
});
$('#choose-service').addEventListener('click', () => {
  closeDialog(serviceDialog);
  choose(detailIndex);
});
for (const b of $$('[data-choose]')) b.addEventListener('click', () => choose(Number(b.dataset.choose)));
function choose(i) {
  select(i);
  jumpTo($('#contato'), { focus: selectEl });
}
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

// ——— Escolha do serviço (arco ⇄ campo) ———
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
