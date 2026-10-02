// Revelações do conteúdo, como em um site: cada elemento entra (por tempo, não por rolagem)
// quando aparece na tela pela primeira vez. Títulos sobem palavra por palavra.
import { $$ } from './core.js';

function splitWords(el) {
  let i = 0;
  const walk = node => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) { walk(child); continue; }
      if (child.nodeType !== Node.TEXT_NODE || !child.textContent.trim()) continue;
      const frag = document.createDocumentFragment();
      for (const part of child.textContent.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { frag.append(document.createTextNode(' ')); continue; }
        const w = document.createElement('span');
        w.className = 'w';
        const inner = document.createElement('span');
        inner.textContent = part;
        inner.style.setProperty('--i', String(i++));
        w.append(inner);
        frag.append(w);
      }
      child.replaceWith(frag);
    }
  };
  walk(el);
}

export function setupReveals() {
  for (const el of $$('[data-words]')) splitWords(el);
  const items = $$('.reveal, [data-words]');
  if (!('IntersectionObserver' in window)) {
    for (const el of items) el.classList.add('is-in');
    return;
  }
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -5% 0px', threshold: 0.1 });
  for (const el of items) io.observe(el);
}

/** Mostra imediatamente tudo o que já está dentro de `root` (ex.: depois de um salto). */
export function revealWithin(root) {
  for (const el of $$('.reveal, [data-words]', root)) el.classList.add('is-in');
}
