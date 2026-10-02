// Interface: menu, progresso, link ativo, movimento reduzido, som opcional e o configurador
// de agendamento (monta a mensagem para o Direct do Instagram; nada é enviado pelo site).
import { $, $$, view, state, css, f } from './core.js';
import { chapterAt } from './chapters.js';

let jumpFn = () => {};
export function bindJump(fn) { jumpFn = fn; }

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

const LINK_FOR = { lavagem: '#lavagem', correcao: '#lavagem', ceramic: '#lavagem', camadas: '#camadas', ppf: '#camadas', interior: '#interior', rota: '#rota' };
let solid = null, page = null, active = null;

/** Menu, progresso e link ativo a cada quadro. */
export function renderUi(u, scrollY, pageY) {
  const isSolid = scrollY > 24;
  if (isSolid !== solid) { solid = isSolid; nav.classList.toggle('is-solid', isSolid); }
  const isPage = scrollY > pageY - view.nav;
  if (isPage !== page) { page = isPage; nav.classList.toggle('is-page', isPage); }
  css(progress, 'transform', `scaleX(${f(Math.min(1, scrollY / (view.scrollMax || 1)), 4)})`);
  const id = isPage ? (scrollY > (view.faqY || 1e9) - view.nav ? '#duvidas' : null) : LINK_FOR[chapterAt(u).id] ?? null;
  if (id !== active) {
    active = id;
    for (const a of navLinks) {
      const on = a.getAttribute('href') === id;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
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

// ——— Som ambiente opcional (desligado por padrão) ———
const soundButton = $('.nav-sound');
let soundFn = null;
export function bindSound(fn) { soundFn = fn; }
soundButton.addEventListener('click', async () => {
  const on = soundButton.getAttribute('aria-pressed') !== 'true';
  const ok = soundFn ? await soundFn(on) : false;
  const really = on && ok !== false;
  soundButton.setAttribute('aria-pressed', String(really));
  $('.sr-only', soundButton).textContent = really ? 'Desligar o som ambiente' : 'Ligar o som ambiente';
  $('use', soundButton).setAttribute('href', really ? '#i-sound' : '#i-mute');
});

// ——— Configurador de agendamento ———
const form = $('#config');
const carInput = $('#car-model');
const messageEl = $('#message-text');
const status = $('#copy-status');
const WANTS = {
  pintura: 'correção de pintura (polimento)',
  protecao: 'proteção da pintura (Ceramic Coating ou PPF)',
  interior: 'higienização do interior',
  lavagem: 'lavagem técnica',
};
function buildMessage() {
  const car = carInput.value.trim();
  const picked = $$('input[name="want"]:checked', form).map(i => i.value);
  const services = picked.filter(v => WANTS[v]).map(v => WANTS[v]);
  const parts = ['Olá, JETCAR!'];
  if (car) parts.push(`Meu carro é um ${car}.`);
  if (services.length) {
    const list = services.length > 1 ? `${services.slice(0, -1).join(', ')} e ${services[services.length - 1]}` : services[0];
    parts.push(`Tenho interesse em ${list}.`);
  }
  if (picked.includes('avaliacao') || !services.length) parts.push('Gostaria de uma avaliação para saber o que o carro precisa.');
  parts.push('Podem me passar o orçamento e a disponibilidade?');
  return parts.join(' ');
}
function refresh() { messageEl.textContent = buildMessage(); }
form.addEventListener('input', refresh);
form.addEventListener('change', refresh);
form.addEventListener('submit', e => e.preventDefault());
carInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('input[name="want"]', form)?.focus(); } });
refresh();

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
$('#send-message').addEventListener('click', () => {
  // A cópia começa dentro do gesto; o link abre o Direct do Instagram em seguida.
  copy(buildMessage()).then(ok => { status.textContent = ok ? 'Mensagem copiada. É só colar no Direct.' : 'Copie o texto acima e cole no Direct.'; });
});
$('#copy-message').addEventListener('click', async () => {
  const ok = await copy(buildMessage());
  status.textContent = ok ? 'Mensagem copiada.' : 'Selecione o texto acima para copiar.';
  if (!ok) { const r = document.createRange(); r.selectNodeContents(messageEl); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
});

// ——— Teclado do celular: ao focar um campo, o iOS rola a página; ignoramos por um instante ———
let freezeTimer = 0;
const touchOnly = matchMedia('(hover: none)');
function freezeFor(ms) {
  if (state.frozenY == null) state.frozenY = window.scrollY;
  clearTimeout(freezeTimer);
  freezeTimer = setTimeout(() => { state.frozenY = null; }, ms);
}
document.addEventListener('focusin', e => { if (touchOnly.matches && e.target.matches('input, select, textarea')) freezeFor(800); });
export function cancelFreeze() { clearTimeout(freezeTimer); state.frozenY = null; }
addEventListener('touchmove', () => { if (state.frozenY != null) cancelFreeze(); }, { passive: true });

export function ready() { document.documentElement.classList.add('is-ready'); }
export function loading(p) { css($('.loader'), '--p', f(p, 3).toString()); }
