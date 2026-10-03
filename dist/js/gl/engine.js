// Renderizador único da experiência: desenha a cena ativa em um alvo HDR (meio-float, com
// multiamostragem), aplica o brilho das luzes (bloom de passos duplos) e compõe na tela com
// exposição, curva de filme, vinheta e grão. Nenhuma outra tela WebGL existe na página.
import * as THREE from '../../vendor/three.min.js';
import { COLOR } from './glsl.js';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Um único pixel inválido (NaN/infinito) espalharia preto pela tela inteira através do bloom.
const SAFE = /* glsl */ `
vec3 safe(vec3 c) { float s = c.r + c.g + c.b; return (s >= 0.0 && s < 60000.0) ? c : vec3(0.0); }
`;

const PREFILTER = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold; uniform float uKnee;
varying vec2 vUv;
${SAFE}
void main() {
  vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5, -0.5)).rgb
         + texture2D(tSrc, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5, 0.5)).rgb;
  c = safe(c * 0.25);
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  float w = max(soft, br - uThreshold) / max(br, 1e-4);
  gl_FragColor = vec4(min(c * w, vec3(40.0)), 1.0);
}`;

const DOWN = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  c += texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}`;

const UP = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uScatter;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0);
  c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 0.0)).rgb * 2.0;
  c += texture2D(tSrc, vUv + uTexel * vec2(1.0, 0.0)).rgb * 2.0;
  c += texture2D(tSrc, vUv + uTexel * vec2(0.0, -1.0)).rgb * 2.0;
  c += texture2D(tSrc, vUv + uTexel * vec2(0.0, 1.0)).rgb * 2.0;
  c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  c += texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(c / 12.0 * uScatter, 1.0);
}`;

// Profundidade de campo (só nas cenas que pedem): o alfa da cena guarda a nitidez de cada
// pixel (1 = em foco). Reduz para meia resolução, junta amostras num disco (cada amostra só
// conta se o próprio desfoque dela alcança o pixel: o primeiro plano desfocado avança sobre o
// fundo, mas o fundo desfocado não "vaza" sobre o que está em foco) e mistura com a imagem nítida.
const DOF_DOWN = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel;
varying vec2 vUv;
${SAFE}
void main() {
  vec4 a = texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5)), b = texture2D(tSrc, vUv + uTexel * vec2(0.5, -0.5));
  vec4 c = texture2D(tSrc, vUv + uTexel * vec2(-0.5, 0.5)), d = texture2D(tSrc, vUv + uTexel * vec2(0.5, 0.5));
  vec3 col = safe((a.rgb + b.rgb + c.rgb + d.rgb) * 0.25);
  float coc = 1.0 - clamp(min(min(a.a, b.a), min(c.a, d.a)), 0.0, 1.0);
  gl_FragColor = vec4(col, coc);
}`;

const DOF_BLUR = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uRadius; uniform int uTaps;
varying vec2 vUv;
void main() {
  // disco girado por pixel (ruído de gradiente intercalado, fixo no pixel): com o mesmo disco em
  // todo pixel, uma gota pequena e nítida vira "favo" (N cópias dela); girando, as cópias se
  // espalham num desfoque uniforme
  float rot = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec4 c0 = texture2D(tSrc, vUv);
  float w0 = 1.0 / (1.0 + dot(c0.rgb, vec3(0.3333)) * 2.0);
  vec3 acc = c0.rgb * w0; float wsum = w0; float fg = c0.a;
  for (int i = 1; i < 48; i++) {
    if (i >= uTaps) break;
    float fi = float(i);
    float r = sqrt(fi / float(uTaps));
    float th = fi * 2.39996323 + rot;
    vec2 o = vec2(cos(th), sin(th)) * r * uRadius;
    vec4 s = texture2D(tSrc, vUv + o * uTexel);
    float dist = r * uRadius;
    // peso menor para pontos muito claros (sem "bolhas" de bokeh a cada floco brilhante)
    float cover = smoothstep(dist - 1.5, dist + 0.5, s.a * uRadius) / (1.0 + dot(s.rgb, vec3(0.3333)) * 2.0);
    acc += s.rgb * cover; wsum += cover;
    fg = max(fg, s.a * cover);
  }
  gl_FragColor = vec4(acc / wsum, fg);
}`;

const DOF_MERGE = /* glsl */ `
uniform sampler2D tSharp; uniform sampler2D tBlur;
varying vec2 vUv;
${SAFE}
void main() {
  vec4 s = texture2D(tSharp, vUv);
  vec4 b = texture2D(tBlur, vUv);
  float coc = 1.0 - clamp(s.a, 0.0, 1.0);
  // o que está em foco (coc < 0,15) fica 100% na imagem de resolução cheia: a meia resolução do
  // desfoque nunca é misturada no assunto (antes bastava coc 0,04 para começar a misturar)
  float m = smoothstep(0.15, 0.5, max(coc, b.a * 0.9));
  gl_FragColor = vec4(mix(safe(s.rgb), safe(b.rgb), m), 1.0);
}`;

const COMPOSITE = /* glsl */ `
uniform sampler2D tScene; uniform sampler2D tBloom;
uniform float uBloom; uniform float uExposure; uniform float uVignette; uniform float uBlack; uniform float uDither;
uniform float uToneK; uniform float uToneW; uniform vec2 uRes;
varying vec2 vUv;
${COLOR}
${SAFE}
// Curva de tom: linear até uToneK e ombro acima. Nas cenas de foto (conteúdo já graduado) o
// ombro começa em 1,0 e o branco da foto chega a 255; nas cenas 3D (HDR) começa em 0,8.
vec3 tone(vec3 x) {
  if (uToneW < 1e-3) return min(x, vec3(uToneK));
  vec3 over = clamp(x - uToneK, 0.0, 8.0 * uToneW);
  return min(x, vec3(uToneK)) + uToneW * (1.0 - exp(-over / uToneW));
}
// ruído triangular de ±1 nível em 8 bits, fixo no pixel (não muda a cada quadro): só quebra
// degraus nos degradês escuros; não é grão
float tri(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); float a = fract((p3.x + p3.y) * p3.z);
  p3 = fract(vec3(p.yxy + 17.0) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); float b = fract((p3.x + p3.y) * p3.z);
  return a + b - 1.0;
}
void main() {
  vec2 d = vUv - 0.5;
  vec3 c = safe(texture2D(tScene, vUv).rgb) + safe(texture2D(tBloom, vUv).rgb) * uBloom;
  c *= uExposure;
  c = tone(c);
  float v = smoothstep(0.95, 0.2, length(d * vec2(uRes.x / uRes.y, 1.0)) * 0.9);
  c *= mix(1.0, v, uVignette);
  c *= 1.0 - uBlack;
  vec3 s = linearToSrgb(c);
  s += tri(gl_FragCoord.xy) * uDither / 255.0;
  gl_FragColor = vec4(s, 1.0);
}`;

/**
 * Parâmetros de pós-processamento de cada quadro (as cenas ajustam).
 * Bloom só nas fontes de luz de verdade (limiar 4, joelho curto): o reflexo da barra na pintura
 * (0,4…2,5) não ganha halo. Sem grão: só um pontilhado fixo de ±1 nível contra degraus.
 * tone: 'photo' (identidade até 1,0, o branco da foto chega a 255) ou 'hdr' (ombro a partir de 0,8).
 */
const POST = { exposure: 1, bloom: 0.35, threshold: 4.0, knee: 0.1, vignette: 0.25, black: 0, dither: 1, dof: 0, tone: 'hdr' };
export const post = { ...POST };
/** Volta aos valores padrão (cada cena ajusta só o que usa). */
export function resetPost() { Object.assign(post, POST); }

export class Engine {
  constructor(canvas, quality) {
    this.canvas = canvas;
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', premultipliedAlpha: false });
    this.renderer.setPixelRatio(1);
    this.renderer.autoClear = true;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(0x000000, 1);
    // os alvos de render são meio-float: sem extensão para desenhar neles, tudo sairia preto.
    // Melhor cair no modo sem WebGL (pôsteres) do que mostrar telas pretas.
    const ext = this.renderer.extensions;
    if (!ext.has('EXT_color_buffer_half_float') && !ext.has('EXT_color_buffer_float')) {
      this.renderer.dispose();
      throw new Error('render targets meio-float indisponíveis');
    }
    this.size = new THREE.Vector2(1, 1);
    this.scale = 1;
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.fsMesh = new THREE.Mesh(tri);
    this.fsMesh.frustumCulled = false;
    this.fsScene = new THREE.Scene();
    this.fsScene.add(this.fsMesh);
    const mat = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.mPre = mat(PREFILTER, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1 }, uKnee: { value: 0.5 } });
    this.mDown = mat(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mUp = mat(UP, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uScatter: { value: 1 } });
    this.mUp.blending = THREE.AdditiveBlending;
    this.mUp.transparent = true;
    this.mComp = mat(COMPOSITE, {
      tScene: { value: null }, tBloom: { value: null }, uBloom: { value: 0.35 }, uExposure: { value: 1 }, uVignette: { value: 0.25 },
      uBlack: { value: 0 }, uDither: { value: 1 }, uToneK: { value: 0.8 }, uToneW: { value: 0.2 }, uRes: { value: new THREE.Vector2(1, 1) },
    });
    this.mDofDown = mat(DOF_DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mDofBlur = mat(DOF_BLUR, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 8 }, uTaps: { value: quality.dofTaps || 24 } });
    this.mDofMerge = mat(DOF_MERGE, { tSharp: { value: null }, tBlur: { value: null } });
    this.dofRT = [];
    this.rt = null;
    this.bloomRT = [];
    // tempo de GPU de verdade, quando o navegador expõe o timer (Chrome e Edge no desktop; o
    // Safari não): é o que a escada de qualidade usa para decidir; sem ele, os quadros perdidos
    const gl = this.renderer.getContext();
    this.gl = gl;
    this.tq = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.queries = [];
    this.gpuSamples = [];
    this.measure = false;
    this.built = '';
  }

  /** A escada mudou multiamostragem ou níveis do bloom: os alvos são refeitos no próximo resize. */
  applyQuality() { this.built = ''; }

  /** Média do tempo de GPU (ms) dos quadros medidos desde a última leitura, ou null. */
  gpuMs() {
    if (!this.tq || this.gpuSamples.length < 8) return null;
    const m = this.gpuSamples.reduce((a, b) => a + b, 0) / this.gpuSamples.length;
    this.gpuSamples.length = 0;
    return m;
  }

  pollTimer() {
    const gl = this.gl, tq = this.tq;
    while (this.queries.length) {
      const q = this.queries[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      if (!gl.getParameter(tq.GPU_DISJOINT_EXT)) this.gpuSamples.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(q);
      this.queries.shift();
    }
    while (this.queries.length > 6) gl.deleteQuery(this.queries.shift());
    if (this.gpuSamples.length > 120) this.gpuSamples.splice(0, this.gpuSamples.length - 120);
  }

  /** Ajusta o tamanho interno: largura/altura em px CSS e a escala de resolução. */
  resize(w, h, scale) {
    this.scale = scale;
    const W = Math.max(2, Math.round(w * scale)), H = Math.max(2, Math.round(h * scale));
    const q = this.quality, built = `${q.msaa}|${q.bloomLevels}`;
    if (W === this.size.x && H === this.size.y && this.rt && built === this.built) return;
    this.built = built;
    this.size.set(W, H);
    this.renderer.setSize(W, H, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.rt?.dispose();
    this.rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: q.msaa, depthBuffer: true, stencilBuffer: false });
    for (const r of this.bloomRT) r.dispose();
    this.bloomRT = [];
    let bw = W, bh = H;
    for (let i = 0; i < q.bloomLevels; i++) {
      bw = Math.max(2, Math.round(bw / 2)); bh = Math.max(2, Math.round(bh / 2));
      this.bloomRT.push(new THREE.WebGLRenderTarget(bw, bh, { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }));
    }
    for (const r of this.dofRT) r.dispose();
    const hw = Math.max(2, Math.round(W / 2)), hh = Math.max(2, Math.round(H / 2));
    const opts = { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.dofRT = [new THREE.WebGLRenderTarget(hw, hh, opts), new THREE.WebGLRenderTarget(hw, hh, opts), new THREE.WebGLRenderTarget(W, H, opts)];
    this.mComp.uniforms.uRes.value.set(W, H);
  }

  pass(material, target) {
    this.fsMesh.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.fsScene, this.fsCam);
  }

  /** Desenha a cena (ou só compõe, se scene for nulo: tela preta/branca). */
  render(scene, camera) {
    const r = this.renderer, gl = this.gl, tq = this.tq;
    let query = null;
    if (tq && this.measure) { query = gl.createQuery(); gl.beginQuery(tq.TIME_ELAPSED_EXT, query); }
    r.setRenderTarget(this.rt);
    r.clear(true, true, false);
    if (scene) r.render(scene, camera);
    let src = this.rt.texture;
    if (post.dof > 0.001 && this.dofRT.length) {
      const [h0, h1, full] = this.dofRT;
      this.mDofDown.uniforms.tSrc.value = src;
      this.mDofDown.uniforms.uTexel.value.set(1 / this.size.x, 1 / this.size.y);
      this.pass(this.mDofDown, h0);
      this.mDofBlur.uniforms.tSrc.value = h0.texture;
      this.mDofBlur.uniforms.uTexel.value.set(1 / h0.width, 1 / h0.height);
      this.mDofBlur.uniforms.uRadius.value = post.dof * h0.height * 0.022;
      this.mDofBlur.uniforms.uTaps.value = this.quality.dofTaps;
      this.pass(this.mDofBlur, h1);
      this.mDofMerge.uniforms.tSharp.value = src;
      this.mDofMerge.uniforms.tBlur.value = h1.texture;
      this.pass(this.mDofMerge, full);
      src = full.texture;
    }
    const B = this.bloomRT;
    if (B.length && post.bloom > 0.001) {
      this.mPre.uniforms.tSrc.value = src;
      this.mPre.uniforms.uTexel.value.set(1 / this.size.x, 1 / this.size.y);
      this.mPre.uniforms.uThreshold.value = post.threshold;
      this.mPre.uniforms.uKnee.value = post.knee;
      this.pass(this.mPre, B[0]);
      for (let i = 1; i < B.length; i++) {
        this.mDown.uniforms.tSrc.value = B[i - 1].texture;
        this.mDown.uniforms.uTexel.value.set(1 / B[i - 1].width, 1 / B[i - 1].height);
        this.pass(this.mDown, B[i]);
      }
      r.autoClear = false;
      for (let i = B.length - 1; i > 0; i--) {
        this.mUp.uniforms.tSrc.value = B[i].texture;
        this.mUp.uniforms.uTexel.value.set(1 / B[i].width, 1 / B[i].height);
        this.mUp.uniforms.uScatter.value = 0.7;
        this.pass(this.mUp, B[i - 1]);
      }
      r.autoClear = true;
    }
    const u = this.mComp.uniforms;
    u.tScene.value = src;
    u.tBloom.value = B.length ? B[0].texture : src;
    u.uBloom.value = B.length ? post.bloom : 0;
    u.uExposure.value = post.exposure;
    u.uVignette.value = post.vignette;
    u.uBlack.value = post.black;
    u.uDither.value = post.dither;
    const photo = post.tone === 'photo';
    u.uToneK.value = photo ? 1 : 0.8;
    u.uToneW.value = photo ? 0 : 0.2;
    this.pass(this.mComp, null);
    if (query) { gl.endQuery(tq.TIME_ELAPSED_EXT); this.queries.push(query); }
    if (tq) this.pollTimer();
  }

  dispose() {
    this.rt?.dispose();
    for (const r of [...this.bloomRT, ...this.dofRT]) r.dispose();
    this.renderer.dispose();
  }
}

/**
 * Qualidade: perfis e escada de degradação.
 * Escala de render (px do aparelho por px CSS, nunca acima do devicePixelRatio): alto 2, padrão
 * 1,5, baixo 1,25, piso 1,0. Quando o aparelho não acompanha, a escada desce nesta ordem:
 * efeitos secundários, níveis do bloom, amostras do desfoque, atmosfera, multiamostragem e, só
 * depois de tudo isso, a resolução (a nitidez do carro é a última coisa a cair). Para subir, o
 * caminho inverso: primeiro volta a resolução, depois os efeitos.
 */
export const EFFECTS = [
  {},
  { secondary: false },                     // metade das gotas e das contas d'água
  { secondary: false, bloomLevels: 3 },
  { secondary: false, bloomLevels: 3, dofTaps: 16 },
  { secondary: false, bloomLevels: 3, dofTaps: 16, atmosphere: false },
  { secondary: false, bloomLevels: 3, dofTaps: 16, atmosphere: false, msaa: 2 },
  { secondary: false, bloomLevels: 3, dofTaps: 16, atmosphere: false, msaa: 0 },
];
export const SCALES = [2, 1.75, 1.5, 1.25, 1];
const BASE = { msaa: 4, bloomLevels: 5, dofTaps: 44, secondary: true, atmosphere: true };
// e = degrau de efeitos, s = degrau de escala; o celular começa no padrão e pode subir para o alto
const PROFILES = { high: { e: 0, s: 0 }, standard: { e: 0, s: 2 }, low: { e: 3, s: 3 } };

/** Aplica os degraus (e, s) ao objeto de qualidade. */
export function applyLevel(q) {
  Object.assign(q, BASE, EFFECTS[q.e]);
  q.scale = Math.min(q.dpr, SCALES[q.s]);
}

/** Perfil inicial conforme o aparelho; `pin` (?quality=high|standard|low) fixa o perfil sem escada. */
export function pickQuality({ mobile, dpr, cores, memory, pin }) {
  const name = PROFILES[pin] ? pin : mobile ? 'standard' : (cores && cores <= 4) || (memory && memory <= 4) ? 'low' : 'high';
  const q = { name, pinned: !!PROFILES[pin], dpr, ...PROFILES[name] };
  applyLevel(q);
  // escala de referência para escolher o tamanho das fotos (a do perfil, não a do momento)
  q.maxScale = q.scale;
  return q;
}
