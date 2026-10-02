// Filme controlado pela rolagem: sequência de quadros (WebP com o mapa de profundidade
// embutido logo abaixo da imagem), decodificados sob demanda numa janela ao redor da posição
// atual. O shader usa a profundidade de cada quadro para paralaxe/aproximação em 2,5D, para a
// luz que revela o carro e para colocar tipografia ENTRE o carro e o fundo do estúdio.
import * as THREE from '../../vendor/three.min.js';
import { COLOR, NOISE } from './glsl.js';

export const FILM = { count: 226, fps: 15, colorH: 720 / 1080 };

export class FrameSequence {
  constructor(base, count, { mipmaps = false } = {}) {
    this.base = base;
    this.count = count;
    this.frames = Array.from({ length: count }, () => ({ blob: null, bitmap: null, fetching: false, decoding: null }));
    this.pool = [];
    this.mipmaps = mipmaps;
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Texture();
      t.flipY = false;
      t.colorSpace = THREE.NoColorSpace;
      t.generateMipmaps = mipmaps;
      t.minFilter = mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      this.pool.push({ tex: t, frame: -1, used: 0 });
    }
    this.queue = [];
    this.active = 0;
    this.head = 0;
    this.listeners = new Set();
    this.firstReady = new Promise(r => { this.resolveFirst = r; });
  }

  url(i) { return `${this.base}/${String(i).padStart(3, '0')}.webp`; }

  /** Busca os arquivos priorizando os quadros perto da posição atual. */
  prefetch(order) {
    for (const i of order) if (i >= 0 && i < this.count && !this.frames[i].blob && !this.frames[i].fetching) this.queue.push(i);
    this.pump();
  }

  pump() {
    while (this.active < 6 && this.queue.length) {
      // o mais próximo do cabeçote primeiro
      let best = 0;
      for (let k = 1; k < this.queue.length; k++) if (Math.abs(this.queue[k] - this.head) < Math.abs(this.queue[best] - this.head)) best = k;
      const i = this.queue.splice(best, 1)[0];
      const fr = this.frames[i];
      if (fr.blob || fr.fetching) continue;
      fr.fetching = true;
      this.active++;
      fetch(this.url(i)).then(r => (r.ok ? r.blob() : null)).then(b => { fr.blob = b; }).catch(() => {}).finally(() => {
        fr.fetching = false;
        this.active--;
        this.pump();
      });
    }
  }

  decode(i) {
    const fr = this.frames[i];
    if (!fr || fr.bitmap || fr.decoding || !fr.blob) return;
    fr.decoding = (typeof createImageBitmap === 'function'
      ? createImageBitmap(fr.blob)
      : new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = URL.createObjectURL(fr.blob); })
    ).then(b => {
      fr.bitmap = b;
      if (i === 0) this.resolveFirst();
      for (const fn of this.listeners) fn(i);
    }).catch(() => {}).finally(() => { fr.decoding = null; });
  }

  /** Mantém decodificados os quadros ao redor de idx e libera os distantes. */
  keep(idx) {
    this.head = idx;
    const lo = Math.max(0, Math.floor(idx) - 4), hi = Math.min(this.count - 1, Math.floor(idx) + 8);
    for (let i = lo; i <= hi; i++) {
      const fr = this.frames[i];
      if (!fr.blob && !fr.fetching) this.prefetch([i]);
      else this.decode(i);
    }
    for (let i = 0; i < this.count; i++) {
      if (i >= lo - 10 && i <= hi + 10) continue;
      const fr = this.frames[i];
      if (fr.bitmap) { fr.bitmap.close?.(); fr.bitmap = null; }
    }
  }

  nearestDecoded(i) {
    for (let d = 0; d < this.count; d++) {
      if (i - d >= 0 && this.frames[i - d].bitmap) return i - d;
      if (i + d < this.count && this.frames[i + d].bitmap) return i + d;
    }
    return -1;
  }

  /** Textura na GPU para o quadro i (envia só quando muda). */
  texture(i) {
    let slot = this.pool.find(p => p.frame === i);
    const stamp = performance.now();
    if (!slot) {
      const bmp = this.frames[i]?.bitmap;
      if (!bmp) return null;
      slot = this.pool.reduce((a, b) => (a.used < b.used ? a : b));
      slot.frame = i;
      slot.tex.image = bmp;
      slot.tex.needsUpdate = true;
    }
    slot.used = stamp;
    return slot.tex;
  }

  /** Par de quadros para o tempo t (s) e a mistura entre eles. */
  sample(t) {
    const idx = Math.min(this.count - 1, Math.max(0, t * FILM.fps));
    this.keep(idx);
    let i0 = Math.floor(idx), i1 = Math.min(this.count - 1, i0 + 1), m = idx - i0;
    if (!this.frames[i0].bitmap || !this.frames[i1].bitmap) {
      const n = this.nearestDecoded(Math.round(idx));
      if (n < 0) return null;
      i0 = i1 = n; m = 0;
    }
    const a = this.texture(i0), b = i1 === i0 ? a : this.texture(i1);
    if (!a || !b) return null;
    return { a, b, m };
  }
}

const FILM_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const FILM_FRAG = /* glsl */ `
uniform sampler2D tA; uniform sampler2D tB; uniform float uMix;
uniform float uColorH;          // fração da textura ocupada pela imagem (o resto é a profundidade)
uniform vec4 uView;             // recorte da imagem: centro.xy, zoom, -
uniform vec2 uParallax; uniform float uDolly; uniform vec2 uDollyC; uniform float uFocus;
uniform float uExposure; uniform float uReveal; uniform float uAmbient;
uniform vec4 uBar[2];           // x na tela (0…1), intensidade, largura, brilho no carro
uniform float uGlint; uniform float uShine;
uniform float uGate; uniform vec4 uGateRect; uniform vec3 uGateColor;
uniform float uFixtures; uniform float uFixtureX;
uniform float uFlare;
uniform sampler2D tType; uniform vec4 uTypeRect; uniform float uTypeDepth; uniform float uTypeAlpha; uniform vec3 uTypeColor; uniform float uTypeLit;
uniform float uDof; uniform vec2 uRes; uniform int uSteps; uniform float uTime;
varying vec2 vUv;
${COLOR}
${NOISE}

vec2 colorUV(vec2 c) { return vec2(c.x, clamp(c.y, 0.0005, 0.9995) * uColorH); }
vec2 depthUV(vec2 c) { return vec2(clamp(c.x, 0.001, 0.999) * 0.5, uColorH + clamp(c.y, 0.002, 0.998) * (1.0 - uColorH)); }
float depthAt(vec2 c) { return mix(texture2D(tA, depthUV(c)).r, texture2D(tB, depthUV(c)).r, uMix); }
float depthSoft(vec2 c) { return mix(texture2D(tA, depthUV(c), 2.5).r, texture2D(tB, depthUV(c), 2.5).r, uMix); }

// Paralaxe 2,5D: encontra o ponto de origem cuja projeção deslocada cai neste pixel.
vec2 warp(vec2 c, out float d) {
  vec2 s = c;
  d = depthAt(s);
  for (int i = 0; i < 6; i++) {
    if (i >= uSteps) break;
    vec2 off = (d - uFocus) * uParallax;
    s = uDollyC + (c - off - uDollyC) / (1.0 + d * uDolly);
    d = depthAt(s);
  }
  return s;
}

void main() {
  // vUv cobre o quadro inteiro (o plano tem a proporção do filme); o recorte permite panorâmica.
  // Coordenadas da imagem com y para baixo (a textura não é invertida).
  vec2 c0 = uView.xy + (vec2(vUv.x, 1.0 - vUv.y) - 0.5) / uView.z;
  float d;
  vec2 c = warp(c0, d);
  float lod = uDof * abs(d - uFocus) * 6.0;
  vec3 colA = texture2D(tA, colorUV(c), lod).rgb;
  vec3 colB = texture2D(tB, colorUV(c), lod).rgb;
  vec3 col = srgbToLinear(mix(colA, colB, uMix));
  float L = sqrt(luma(col));

  // Luzes do estúdio acendendo: primeiro o que é mais claro (as próprias luminárias).
  float thr = 1.0 - uReveal * 1.25;
  float lit = mix(uAmbient, 1.0, smoothstep(thr, thr + 0.22, L));
  vec2 sp = gl_FragCoord.xy / uRes;

  // Barras de luz: iluminam uma faixa e acendem o brilho nas curvas. As normais vêm da
  // profundidade suavizada (nível de mipmap mais baixo e passo largo, sem degraus).
  vec2 px = vec2(5.0 / 640.0, 5.0 / 360.0);
  float dx = depthSoft(c + vec2(px.x, 0.0)) - depthSoft(c - vec2(px.x, 0.0));
  float dy = depthSoft(c + vec2(0.0, px.y)) - depthSoft(c - vec2(0.0, px.y));
  vec3 n = normalize(vec3(-dx * 3.2, dy * 3.2, 1.0));
  vec3 glint = vec3(0.0);
  float band = 0.0;
  for (int i = 0; i < 2; i++) {
    vec4 b = uBar[i];
    if (b.y <= 0.0) continue;
    float gx = (sp.x - b.x) / b.z;
    float g = exp(-gx * gx);
    band += g * b.y;
    vec3 Lb = normalize(vec3((b.x - sp.x) * 2.4, 0.25, 1.0));
    vec3 h = normalize(Lb + vec3(0.0, 0.0, 1.0));
    float spec = pow(max(dot(n, h), 0.0), uShine) * smoothstep(0.12, 0.35, d);
    // o brilho acompanha o que já é reflexo no filme (as luzes do estúdio na lataria)
    glint += vec3(1.0, 0.97, 0.93) * spec * b.w * g * (0.15 + L * 1.2);
  }
  // Luminárias acendendo uma a uma (da esquerda para a direita) no final.
  float fixture = smoothstep(0.5, 0.8, L) * (1.0 - smoothstep(0.3, 0.55, d));
  float on = 1.0 - smoothstep(uFixtureX - 0.025, uFixtureX + 0.025, c.x);
  lit = max(lit, uFixtures * fixture * on);

  // A faixa de luz realça sobretudo o que já brilha (reflexos reais da pintura no filme).
  vec3 outc = col * (lit + band * (0.12 + 2.2 * L * L)) * uExposure + glint * uGlint * uExposure;

  // O portão abre ATRÁS da câmera: a luz do dia entra rente ao chão e sobe pelo carro
  // enquanto a porta sobe. A borda dessa luz é a linha que revela o carro e o letreiro.
  float dayLit = 0.0;
  if (uGate > 0.0) {
    float edgeY = mix(1.08, -0.1, uGate);
    float on = smoothstep(0.0, 0.12, uGate);
    dayLit = smoothstep(edgeY - 0.06, edgeY + 0.06, c.y) * on;
    float ey = (c.y - edgeY) / 0.07;
    float edgeGlow = exp(-ey * ey) * on * (1.0 - smoothstep(0.85, 1.0, uGate));
    outc += col * uGateColor * (dayLit * (0.3 + 1.7 * L * L) + edgeGlow * (0.25 + 1.2 * L)) * uExposure;
  }
  // Faróis: realces fortes do carro ganham brilho (o bloom faz o resto).
  outc += col * uFlare * smoothstep(0.82, 0.97, L) * smoothstep(0.35, 0.5, d) * 6.0;

  // Tipografia entre o carro e o fundo: oculta onde a profundidade do filme está à frente dela.
  if (uTypeAlpha > 0.0) {
    vec2 ct = uDollyC + (c0 - (uTypeDepth - uFocus) * uParallax - uDollyC) / (1.0 + uTypeDepth * uDolly);
    vec2 tu = (ct - uTypeRect.xy) / uTypeRect.zw;
    if (tu.x > 0.0 && tu.x < 1.0 && tu.y > 0.0 && tu.y < 1.0) {
      float a = texture2D(tType, tu).a;
      float front = smoothstep(uTypeDepth - 0.02, uTypeDepth + 0.04, d);
      // letras quase apagadas no escuro; acendem quando a luz do portão chega nelas
      vec3 tc = uTypeColor * mix(0.05, 0.92, max(dayLit, uTypeLit));
      outc = mix(outc, tc, a * uTypeAlpha * (1.0 - front));
    }
  }
  gl_FragColor = vec4(outc, 1.0);
}`;

export function filmMaterial(steps = 4) {
  return new THREE.ShaderMaterial({
    vertexShader: FILM_VERT,
    fragmentShader: FILM_FRAG,
    uniforms: {
      tA: { value: null }, tB: { value: null }, uMix: { value: 0 }, uColorH: { value: FILM.colorH },
      uView: { value: new THREE.Vector4(0.5, 0.5, 1, 0) },
      uParallax: { value: new THREE.Vector2() }, uDolly: { value: 0 }, uDollyC: { value: new THREE.Vector2(0.5, 0.5) }, uFocus: { value: 0.5 },
      uExposure: { value: 1 }, uReveal: { value: 1 }, uAmbient: { value: 1 },
      uBar: { value: [new THREE.Vector4(), new THREE.Vector4()] },
      uGlint: { value: 0 }, uShine: { value: 40 },
      uGate: { value: 0 }, uGateRect: { value: new THREE.Vector4(0.45, 0.55, 0.2, 0.62) }, uGateColor: { value: new THREE.Color(0.94, 0.97, 1.0) },
      uFixtures: { value: 0 }, uFixtureX: { value: 0 },
      uFlare: { value: 0 },
      tType: { value: null }, uTypeRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uTypeDepth: { value: 0.3 }, uTypeAlpha: { value: 0 }, uTypeColor: { value: new THREE.Color(1, 1, 1) }, uTypeLit: { value: 0 },
      uDof: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uSteps: { value: steps }, uTime: { value: 0 },
    },
    depthWrite: true,
  });
}
