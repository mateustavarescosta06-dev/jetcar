// Interface: barra e trilho de luz, menu, movimento reduzido, som opcional, o pedido
// (configurador: monta a mensagem para o Direct; nada é enviado pelo site) e os botões
// "Incluir no pedido" dos cards, que marcam o mesmo serviço no pedido.
import { $, $$, view, state, css, f, clamp } from './core.js';
import { setSound } from './audio.js';

const bar = $('.bar');
const laneLinks = $$('.lane a');
const laneLit = $('.lane-lit');
const menuToggle = $('.bar-menu');
const menu = $('#menu');
const html = document.documentElement;

export function setMenu(open) {
  if (open === !menu.hidden) return;
  menu.hidden = !open;
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
  html.classList.toggle('reduced', flag);
  motionButton.setAttribute('aria-pressed', String(flag));
  motionButton.textContent = flag ? 'Ativar movimento' : 'Reduzir movimento';
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
const picked = () => $$('input[name="want"]:checked', form).map(i => i.value);
const list = items => (items.length > 1 ? `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}` : items[0]);
function buildMessage() {
  const car = carInput.value.trim();
  const wants = picked();
  const services = wants.filter(v => WANTS[v]).map(v => WANTS[v]);
  const parts = ['Olá, JETCAR!'];
  if (car) parts.push(`Meu carro é um ${car}.`);
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

export function initUi({ jump }) {
  menuToggle.addEventListener('click', () => setMenu(menu.hidden));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });
  addEventListener('resize', () => { if (!menu.hidden && innerWidth > 1080) setMenu(false); });
  motionButton.addEventListener('click', () => setReduce(!state.reduce, true));

  soundButton?.addEventListener('click', async () => {

    const on = soundButton.getAttribute('aria-pressed') !== 'true';
    const ok = await setSound(on);
    const really = on && ok !== false;
    soundButton.setAttribute('aria-pressed', String(really));
    $('.sr-only', soundButton).textContent = really ? 'Desligar o som ambiente' : 'Ligar o som ambiente';
    $('use', soundButton).setAttribute('href', really ? '#i-sound' : '#i-mute');
  });

  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
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
    refresh();
  });
  refresh();

  // resultado: a linha passa uma vez quando a foto aparece
  const result = $('.result');
  if (result && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { result.classList.add('is-in'); io.disconnect(); } }, { threshold: 0.45 });
    io.observe(result);
  } else result?.classList.add('is-in');

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
  const w = byId.wash, po = byId.polish, pr = byId.protect, it = byId.interior;
  // os topos têm fração de pixel (alturas em svh) e a rolagem para em pixel inteiro: 1 px de folga
  const yy = y + 1;
  if (w && yy >= w.top - view.svh * 0.5) J = w.raw;
  if (po && yy >= po.top) J = 1 + po.raw;
  if (pr && yy >= pr.top) J = pr.raw < pr.split ? 2 + pr.raw / pr.split : 3 + (pr.raw - pr.split) / (1 - pr.split);
  if (it && yy >= it.top) J = 4 + it.raw;
  if (it && y > it.top + it.height - view.svh + 1) J = 5;
  css(laneLit, 'transform', `scaleX(${f(clamp(J / 5), 4)})`);
  // parada atual: -1 antes da lavagem, 5 depois do interior (todas percorridas, nenhuma atual)
  const on = yy < (w?.top ?? 0) - view.svh * 0.5 ? -1 : J >= 5 ? 5 : Math.min(4, Math.max(0, Math.ceil(J) - 1));
  if (on !== cur) {
    cur = on;
    laneLinks.forEach((a, i) => {
      a.classList.toggle('is-on', i === on);
      a.classList.toggle('is-past', i < on);
      if (i === on) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    });
  }
  return ORDER;
}

export function ready() { html.classList.add('is-ready'); }
