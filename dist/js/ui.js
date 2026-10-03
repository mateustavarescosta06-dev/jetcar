// Interface: barra e trilho de luz, menu, movimento reduzido, som opcional, o pedido
// (configurador em quatro passos: carro, o que melhorar, serviços e contato; monta a mensagem para
// o Direct, nada é enviado pelo site) e os botões "Incluir no pedido" dos cards, que marcam o mesmo
// serviço no pedido.
import { $, $$, view, state, css, f, clamp } from './core.js';
import { setSound } from './audio.js';

const bar = $('.bar');
const laneLinks = $$('.lane a');
const laneLit = $('.lane-lit');
const barTrace = $('.bar-trace');
const menuBays = $$('.menu-links a').slice(0, 5);
const traceStops = $$('.bar-trace b');
const menuToggle = $('.bar-menu');
const menu = $('#menu');
const html = document.documentElement;

let lenisRef = null;
export function setMenu(open) {
  if (open === !menu.hidden) return;
  menu.hidden = !open;
  // a página atrás do menu sai do Tab e da árvore de acessibilidade, e não rola
  for (const el of $$('main, body > footer')) el.inert = open;
  if (open) lenisRef?.stop(); else lenisRef?.start();
  menuToggle.setAttribute('aria-expanded', String(open));
  $('.sr-only', menuToggle).textContent = open ? 'Fechar menu' : 'Abrir menu';
  $('use', menuToggle).setAttribute('href', open ? '#i-close' : '#i-menu');
  html.classList.toggle('menu-open', open);
  if (open) $('a', menu)?.focus({ preventScroll: true });
  else if (menu.contains(document.activeElement) || document.activeElement === document.body) menuToggle.focus({ preventScroll: true });
}

// ——— Movimento reduzido ———
const motionButton = $('.motion');
export function setReduce(flag, remember = false) {
  state.reduce = flag;
  state.flat = flag || html.classList.contains('no-gl');
  html.classList.toggle('reduced', flag);
  // rótulo fixo; o estado fica no aria-pressed (e no quadradinho do botão)
  motionButton.setAttribute('aria-pressed', String(flag));
  if (remember) try { localStorage.setItem('jetcar-motion', flag ? 'reduce' : 'full'); } catch {}
}
export function savedMotion() {
  try { return localStorage.getItem('jetcar-motion'); } catch { return null; }
}

// ——— Pedido (configurador) ———
const form = $('#config');
const carInput = $('#car-model');
const messageEl = $('#message-text');
const status = $('#copy-status');
const orderEl = $('[data-order]');
const WANTS = {
  lavagem: 'lavagem técnica',
  pintura: 'polimento e correção de pintura',
  ceramic: 'Ceramic Coating',
  ppf: 'PPF (película de proteção)',
  interior: 'higienização interna',
};
const AIMS = {
  brilho: { say: 'recuperar o brilho da pintura', want: ['pintura'] },
  marcas: { say: 'tirar riscos finos e marcas de lavagem', want: ['pintura'] },
  protecao: { say: 'proteger a pintura', want: ['ceramic', 'ppf'] },
  limpeza: { say: 'uma limpeza cuidadosa por fora', want: ['lavagem'] },
  cabine: { say: 'cuidar do interior', want: ['interior'] },
  naosei: { say: '', want: ['avaliacao'] },
};
const picked = () => $$('input[name="want"]:checked', form).map(i => i.value);
const aims = () => $$('input[name="aim"]:checked', form).map(i => i.value);
// serviços marcados pela sugestão (e não pela pessoa): desmarcar o objetivo desmarca a sugestão
const suggested = new Set();
function suggest(aim, on) {
  for (const v of AIMS[aim].want) {
    const box = $(`input[name="want"][value="${v}"]`, form);
    if (!box) continue;
    if (on && !box.checked) { box.checked = true; suggested.add(v); }
    // só desmarca o que a sugestão marcou e que nenhum outro objetivo marcado ainda pede
    if (!on && suggested.has(v) && !aims().some(a => AIMS[a].want.includes(v))) { box.checked = false; suggested.delete(v); }
  }
}
const list = items => (items.length > 1 ? `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}` : items[0]);
function buildMessage() {
  const car = carInput.value.trim();
  const wants = picked();
  const services = wants.filter(v => WANTS[v]).map(v => WANTS[v]);
  const parts = ['Olá, JETCAR!'];
  if (car) parts.push(`Meu carro é um ${car}.`);
  const goals = aims().map(a => AIMS[a].say).filter(Boolean);
  if (goals.length) parts.push(`Quero ${list(goals)}.`);
  if (services.length) parts.push(`Tenho interesse em ${list(services)}.`);
  if (wants.includes('avaliacao') || !services.length) parts.push('Gostaria de uma avaliação para saber o que o carro precisa.');
  parts.push('Podem me passar o orçamento e a disponibilidade?');
  return parts.join(' ');
}
function refresh() {
  messageEl.textContent = buildMessage();
  const wants = picked();
  // os cards mostram o que já está no pedido
  for (const b of $$('.card-add')) b.setAttribute('aria-pressed', String(wants.includes(b.dataset.want)));
  // o fim da rota leva o pedido junto
  const car = carInput.value.trim();
  const names = wants.filter(v => WANTS[v]).map(v => WANTS[v]);
  if (orderEl) {
    if (car || names.length) {
      orderEl.hidden = false;
      orderEl.innerHTML = '';
      const b = document.createElement('b');
      b.textContent = 'Seu pedido';
      orderEl.append(b, document.createTextNode([car, names.length ? list(names) : 'avaliação'].filter(Boolean).join(' · ')));
    } else orderEl.hidden = true;
  }
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

// ——— Som ambiente opcional ———
const soundButton = $('.bar-sound');

export function initUi({ jump, lenis }) {
  lenisRef = lenis || null;
  menuToggle.addEventListener('click', () => setMenu(menu.hidden));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });
  addEventListener('resize', () => { if (!menu.hidden && innerWidth > 1080) setMenu(false); });
  motionButton.addEventListener('click', () => setReduce(!state.reduce, true));

  soundButton?.addEventListener('click', async () => {

    const on = soundButton.getAttribute('aria-pressed') !== 'true';
    const ok = await setSound(on);
    const really = on && ok !== false;
    soundButton.setAttribute('aria-pressed', String(really));
    $('use', soundButton).setAttribute('href', really ? '#i-sound' : '#i-mute');
  });

  form.addEventListener('input', refresh);
  form.addEventListener('change', e => {
    if (e.target.name === 'aim') suggest(e.target.value, e.target.checked);
    // a pessoa mexeu no serviço: a escolha passa a ser dela
    if (e.target.name === 'want') suggested.delete(e.target.value);
    refresh();
  });
  form.addEventListener('submit', e => e.preventDefault());
  carInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('input[name="want"]', form)?.focus(); } });
  $('#send-message').addEventListener('click', () => {
    // a cópia começa dentro do gesto; o link abre o Direct em seguida
    copy(buildMessage()).then(ok => { status.textContent = ok ? 'Mensagem copiada. É só colar no Direct.' : 'Copie o texto acima e cole no Direct.'; });
  });
  $('#copy-message').addEventListener('click', async () => {
    const ok = await copy(buildMessage());
    status.textContent = ok ? 'Mensagem copiada.' : 'Selecione o texto acima para copiar.';
    if (!ok) { const r = document.createRange(); r.selectNodeContents(messageEl); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
  });
  // "Incluir no pedido" nos cards marca o serviço no pedido (e desmarca)
  for (const b of $$('.card-add')) b.addEventListener('click', () => {
    const box = $(`input[name="want"][value="${b.dataset.want}"]`, form);
    if (!box) return;
    box.checked = !box.checked;
    suggested.delete(b.dataset.want);
    refresh();
  });
  refresh();

  // teclado do celular: ao focar um campo, o iOS rola a página; ignoramos por um instante
  const touchOnly = matchMedia('(hover: none)');
  document.addEventListener('focusin', e => { if (touchOnly.matches && e.target.matches('input:not([type="range"]), select, textarea')) freezeFor(800); });
  addEventListener('touchmove', () => { if (state.frozenY != null) cancelFreeze(); }, { passive: true });
}

let freezeTimer = 0;
function freezeFor(ms) {
  if (state.frozenY == null) state.frozenY = scrollY;
  clearTimeout(freezeTimer);
  freezeTimer = setTimeout(() => { state.frozenY = null; }, ms);
}
export function cancelFreeze() { clearTimeout(freezeTimer); state.frozenY = null; }

// ——— A cada quadro: sombra da barra e o trilho de luz ———
// J vai de 0 a 5 ao longo das baias (lavagem 0–1, polimento 1–2, ceramic 2–3, PPF 3–4, interior 4–5).
const ORDER = ['wash', 'polish', 'ceramic', 'ppf', 'interior'];
let shade = null, page = null, cur = -2;
export function renderUi(y, acts, byId) {
  const isShade = y > 24;
  if (isShade !== shade) { shade = isShade; bar.classList.toggle('is-shade', isShade); }
  const line = y + view.nav;
  const isPage = (view.flat || []).some(([a, b]) => line >= a && line < b);
  if (isPage !== page) { page = isPage; bar.classList.toggle('is-page', isPage); }
  let J = 0;
  const w = byId.wash, it = byId.interior;
  // os topos têm fração de pixel (alturas em svh) e a rolagem para em pixel inteiro: 1 px de folga
  const yy = y + 1;
  ORDER.forEach((id, i) => { const a = byId[id]; if (a && yy >= a.top - (i === 0 ? view.svh * 0.5 : 0)) J = i + a.raw; });
  // o silêncio entre o Polimento e o Ceramic fica com o Polimento aceso
  if (it && y > it.top + it.height - view.svh + 1) J = 5;
  const lit = f(clamp(J / 5), 4);
  css(laneLit, 'transform', `scaleX(${lit})`);
  barTrace?.style.setProperty('--lane', lit);
  // parada atual: -1 antes da lavagem, 5 depois do interior (todas percorridas, nenhuma atual)
  const on = yy < (w?.top ?? 0) - view.svh * 0.5 ? -1 : J >= 5 ? 5 : Math.min(4, Math.max(0, Math.ceil(J) - 1));
  if (on !== cur) {
    cur = on;
    laneLinks.forEach((a, i) => {
      a.classList.toggle('is-on', i === on);
      a.classList.toggle('is-past', i < on);
      if (i === on) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    });
    // celular: a linha embaixo da barra aparece a partir da lavagem; a baia atual fica marcada no menu
    barTrace?.style.setProperty('--trace-a', on >= 0 ? '1' : '0');
    traceStops.forEach((b, i) => { b.classList.toggle('is-on', i === on); b.classList.toggle('is-past', i < on); });
    menuBays.forEach((a, i) => {
      a.classList.toggle('is-on', i === on);
      if (i === on) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    });
  }
  return ORDER;
}

export function ready() { html.classList.add('is-ready'); }
