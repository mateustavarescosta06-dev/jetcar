// Quem somos (quem-somos.html): as interações da página, sem o motor da principal.
// - Revelação por rolagem (uma vez) e a linha de luz que percorre o fio de cada bloco.
// - Os números contam até o valor ao entrar na tela.
// - As cinco etapas: abas com a linha de luz embaixo da etapa escolhida.
// - Os depoimentos: trilho com rolagem presa, setas, contador e teclado.
// - O mapa da rota entra inline e a rota se desenha ao aparecer.
// Com movimento reduzido (preferência do sistema ou o botão do rodapé, lembrado como na principal)
// nada anima: tudo aparece pronto.
const html = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

// ——— Movimento reduzido ———
const saved = (() => { try { return localStorage.getItem('jetcar-motion'); } catch { return null; } })();
const reduceQ = matchMedia('(prefers-reduced-motion: reduce)');
let reduce = saved === 'reduce' || (saved !== 'full' && reduceQ.matches);
const motionButton = $('.motion');
function setReduce(flag, remember) {
  reduce = flag;
  html.classList.toggle('reduced', flag);
  motionButton?.setAttribute('aria-pressed', String(flag));
  if (remember) try { localStorage.setItem('jetcar-motion', flag ? 'reduce' : 'full'); } catch {}
  if (flag) for (const el of $$('[data-reveal]')) el.classList.add('is-in');
}
setReduce(reduce, false);
motionButton?.addEventListener('click', () => setReduce(!reduce, true));

// ——— Revelação ———
const seen = new IntersectionObserver(entries => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); seen.unobserve(e.target); e.target.dispatchEvent(new CustomEvent('reveal')); }
}, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
for (const el of $$('[data-reveal]')) seen.observe(el);

// ——— Números ———
const ease = t => 1 - (1 - t) ** 3;
for (const b of $$('.numbers b[data-n]')) {
  const n = Number(b.dataset.n), suffix = b.dataset.suffix || '';
  const li = b.closest('li');
  b.textContent = (reduce ? n : 0) + suffix;
  li.addEventListener('reveal', () => {
    if (reduce) { b.textContent = n + suffix; return; }
    const t0 = performance.now(), dur = 900 + n * 20;
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur);
      b.textContent = Math.round(ease(k) * n) + suffix;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { once: true });
}

// ——— As cinco etapas ———
const steps = $('.steps');
if (steps) {
  const tabs = $$('[role="tab"]', steps), panels = $$('[role="tabpanel"]', steps), lit = $('.steps-lit', steps);
  const place = () => { const t = tabs.find(t => t.getAttribute('aria-selected') === 'true'); if (!t || !lit) return; lit.style.transform = `translateX(${t.offsetLeft}px)`; lit.style.width = `${t.offsetWidth}px`; };
  const select = (i, focus) => {
    tabs.forEach((t, k) => { const on = k === i; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; panels[k].hidden = !on; });
    place();
    if (focus) tabs[i].focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i));
    t.addEventListener('keydown', e => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'Home' ? -i : e.key === 'End' ? tabs.length - 1 - i : 0;
      if (!d) return;
      e.preventDefault();
      select((i + d + tabs.length) % tabs.length, true);
    });
  });
  select(0);
  addEventListener('resize', place);
  document.fonts?.ready.then(place);
}

// ——— Depoimentos ———
const car = $('.quotes');
if (car) {
  const track = $('.quotes-track', car), items = $$('.quotes-track > *', car), count = $('.quotes-count', car);
  const prev = $('[data-prev]', car), next = $('[data-next]', car);
  let i = 0;
  const index = () => { const x = track.scrollLeft + track.clientWidth / 2; return items.findIndex(el => x >= el.offsetLeft && x < el.offsetLeft + el.offsetWidth); };
  const show = () => {
    i = Math.max(0, index());
    count.textContent = `${String(i + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
    prev.disabled = i === 0;
    next.disabled = i === items.length - 1;
    items.forEach((el, k) => el.classList.toggle('is-on', k === i));
  };
  const go = k => { const el = items[Math.max(0, Math.min(items.length - 1, k))]; track.scrollTo({ left: el.offsetLeft - track.offsetLeft, behavior: reduce ? 'auto' : 'smooth' }); };
  prev.addEventListener('click', () => go(i - 1));
  next.addEventListener('click', () => go(i + 1));
  track.addEventListener('scroll', () => requestAnimationFrame(show), { passive: true });
  track.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); } });
  addEventListener('resize', show);
  show();
}

// ——— O mapa: a rota se desenha ———
const map = $('.place-map[data-map]');
if (map) fetch(map.dataset.map).then(r => (r.ok ? r.text() : Promise.reject())).then(svg => {
  const img = $('img', map);
  map.insertAdjacentHTML('beforeend', svg);
  const el = $('svg', map);
  el.setAttribute('aria-hidden', 'true');
  el.classList.add('route-art');
  img?.remove();
  // já na tela: desenha no próximo quadro; senão, quando aparecer
  const draw = () => requestAnimationFrame(() => map.classList.add('is-drawn'));
  if (map.classList.contains('is-in') || reduce) draw(); else map.addEventListener('reveal', draw, { once: true });
}).catch(() => {});

