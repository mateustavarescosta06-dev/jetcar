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
  vec4 c0 = texture2D(tSrc, vUv);
  float w0 = 1.0 / (1.0 + dot(c0.rgb, vec3(0.3333)) * 2.0);
  vec3 acc = c0.rgb * w0; float wsum = w0; float fg = c0.a;
  for (int i = 1; i < 48; i++) {
    if (i >= uTaps) break;
    float fi = float(i);
    float r = sqrt(fi / float(uTaps));
    float th = fi * 2.39996323;
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
  float m = smoothstep(0.04, 0.3, max(coc, b.a * 0.9));
  gl_FragColor = vec4(mix(safe(s.rgb), safe(b.rgb), m), 1.0);
}`;

const COMPOSITE = /* glsl */ `
uniform sampler2D tScene; uniform sampler2D tBloom;
uniform float uBloom; uniform float uExposure; uniform float uVignette; uniform float uGrain; uniform float uTime;
uniform float uWhite; uniform float uBlack; uniform vec2 uRes; uniform float uChroma;
uniform float uLens; uniform float uLensX; uniform float uLensBig; uniform float uFoam; uniform float uFoamY;
varying vec2 vUv;
${COLOR}
${SAFE}
float fh(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float fn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(fh(i), fh(i + vec2(1.0, 0.0)), u.x), mix(fh(i + vec2(0.0, 1.0)), fh(i + vec2(1.0, 1.0)), u.x), u.y); }
float ffbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * fn(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
// Espuma da lavagem na lente: massa branca fora de foco que se espalha a partir de manchas, com
// bolhas de vários tamanhos nas bordas (não uma nuvem). Devolve a cobertura e a cor (sRGB).
vec2 vor(vec2 q) {
  vec2 iq = floor(q), fq = fract(q);
  float d1 = 9.0, id = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    float d = length(g + vec2(fh(iq + g), fh(iq + g + 5.3)) - fq) / (0.6 + 0.4 * fh(iq + g + 11.7));
    if (d < d1) { d1 = d; id = fh(iq + g + 2.1); }
  }
  return vec2(d1, id);
}
float lensFoam(vec2 uv, out vec3 fc) {
  vec2 p = vec2(uv.x * uRes.x / uRes.y, uv.y + uFoamY);
  float n = ffbm(p * 1.6) * 0.7 + ffbm(p * 4.0 + 7.3) * 0.3;
  vec2 b1 = vor(p * 7.0), b2 = vor(p * 16.0 + 3.3), b3 = vor(p * 34.0 + 9.1);
  float t = n - 0.75 * (1.0 - uFoam) + (b2.x - 0.5) * 0.06 + (b3.x - 0.5) * 0.03;
  float m = smoothstep(-0.008, 0.012, t);
  float thick = smoothstep(0.0, 0.3, t);
  float dome = (1.0 - smoothstep(0.55, 0.95, b1.x)) * 0.5 + (1.0 - smoothstep(0.55, 0.95, b2.x)) * 0.35 + (1.0 - smoothstep(0.5, 0.95, b3.x)) * 0.15;
  float shade = 0.84 + 0.1 * ffbm(p * 3.0 + 1.7) + 0.06 * dome;
  fc = mix(vec3(0.72, 0.75, 0.79), vec3(0.95, 0.955, 0.96), thick) * shade + pow(max(1.0 - b2.x * 1.8, 0.0), 8.0) * step(0.85, b2.y) * 0.15;
  return m * (0.72 + 0.28 * thick);
}
float sq2(float x) { return x * x; }
vec2 lhash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
// Água passando na frente da lente: gotas (células) que refratam a imagem, numa faixa que
// atravessa a tela. spec devolve o brilho da borda das gotas.
vec2 lensWater(vec2 uv, out float spec) {
  spec = 0.0;
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  float band = exp(-sq2((uv.x - uLensX) / 0.32)) * uLens;
  if (band < 0.002) return vec2(0.0);
  vec2 p = uv * asp * 6.0 + vec2(0.0, uLensX * 0.7);
  vec2 ip = floor(p), fp = fract(p);
  vec2 off = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 h = lhash(ip + g);
    float rad = 0.18 + 0.32 * h.y;
    if (lhash(ip + g + 3.7).x > 0.62) continue;
    vec2 d = (g + h - fp) / rad;
    float q = dot(d, d);
    if (q < 1.0) {
      float z = sqrt(1.0 - q);
      off += d * (1.0 - z) * rad * 0.09 + d * 0.012;
      // brilho pequeno no alto da gota e uma borda quase invisível
      vec2 hl = d - vec2(-0.35, -0.4);
      spec += exp(-dot(hl, hl) * 40.0) * 0.5 + smoothstep(0.86, 1.0, q) * 0.05;
    }
  }
  spec *= band;
  return off * band / asp;
}
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
// Curva de filme: linear até 0,8 e ombro suave acima (preserva o filme e segura as luzes).
vec3 shoulder(vec3 x) {
  vec3 k = vec3(0.8);
  // limitado: exp de números muito negativos dá lixo em alguns drivers (o farol ficava escuro)
  vec3 over = clamp(x - k, 0.0, 4.0);
  return min(x, k) + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
}
void main() {
  vec2 d = vUv - 0.5;
  vec2 uv = vUv;
  float spec = 0.0;
  if (uLens > 0.0) uv += lensWater(vUv, spec);
  if (uLensBig > 0.0) {
    // uma gota cobrindo a lente: tudo refratado (lupa invertida nas bordas)
    vec2 q = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    float r2 = dot(q, q);
    uv = 0.5 + (uv - 0.5) * (1.0 - uLensBig * (0.55 - 0.9 * r2));
  }
  vec3 c;
  float chroma = uChroma + uLensBig * 0.004;
  if (chroma > 0.0) {
    vec2 o = (uv - 0.5) * chroma;
    c = vec3(texture2D(tScene, uv - o).r, texture2D(tScene, uv).g, texture2D(tScene, uv + o).b);
  } else c = texture2D(tScene, uv).rgb;
  c = safe(c) + safe(texture2D(tBloom, uv).rgb) * uBloom + spec * vec3(0.8, 0.85, 0.9);
  c *= uExposure;
  c = shoulder(c);
  float v = smoothstep(0.95, 0.2, length(d * vec2(uRes.x / uRes.y, 1.0)) * 0.9);
  c *= mix(1.0, v, uVignette);
  c = mix(c, vec3(1.0), uWhite);
  c *= 1.0 - uBlack;
  vec3 s = linearToSrgb(c);
  if (uFoam > 0.0) { vec3 fc; float fm = lensFoam(vUv, fc); s = mix(s, fc, fm); }
  float g = hash(vUv * uRes + fract(uTime * 13.17) * 517.0) - 0.5;
  s += g * uGrain * (0.6 + 0.4 * (1.0 - s));
  gl_FragColor = vec4(s, 1.0);
}`;

/** Parâmetros de pós-processamento de cada quadro (as cenas ajustam). */
const POST = { exposure: 1, bloom: 0.6, threshold: 1.0, knee: 0.6, vignette: 0.55, grain: 0.035, white: 0, black: 0, chroma: 0, dof: 0, lens: 0, lensX: 0.5, lensBig: 0, foam: 0, foamY: 0 };
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
      tScene: { value: null }, tBloom: { value: null }, uBloom: { value: 0.6 }, uExposure: { value: 1 }, uVignette: { value: 0.5 },
      uGrain: { value: 0.03 }, uTime: { value: 0 }, uWhite: { value: 0 }, uBlack: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uChroma: { value: 0 },
      uLens: { value: 0 }, uLensX: { value: 0.5 }, uLensBig: { value: 0 }, uFoam: { value: 0 }, uFoamY: { value: 0 },
    });
    this.mDofDown = mat(DOF_DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mDofBlur = mat(DOF_BLUR, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 8 }, uTaps: { value: quality.dofTaps || 24 } });
    this.mDofMerge = mat(DOF_MERGE, { tSharp: { value: null }, tBlur: { value: null } });
    this.dofRT = [];
    this.rt = null;
    this.bloomRT = [];
    this.frameMs = 16;
  }

  /** Ajusta o tamanho interno: largura/altura em px CSS e a escala de resolução. */
  resize(w, h, scale) {
    this.scale = scale;
    const W = Math.max(2, Math.round(w * scale)), H = Math.max(2, Math.round(h * scale));
    if (W === this.size.x && H === this.size.y && this.rt) return;
    this.size.set(W, H);
    this.renderer.setSize(W, H, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    const q = this.quality;
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
  render(scene, camera, time) {
    const r = this.renderer;
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
        this.mUp.uniforms.uScatter.value = 0.9;
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
    u.uGrain.value = post.grain;
    u.uTime.value = time;
    u.uWhite.value = post.white;
    u.uBlack.value = post.black;
    u.uChroma.value = post.chroma;
    u.uLens.value = post.lens;
    u.uLensX.value = post.lensX;
    u.uLensBig.value = post.lensBig;
    u.uFoam.value = post.foam;
    u.uFoamY.value = post.foamY;
    this.pass(this.mComp, null);
  }

  dispose() {
    this.rt?.dispose();
    for (const r of [...this.bloomRT, ...this.dofRT]) r.dispose();
    this.renderer.dispose();
  }
}

/** Perfil de qualidade conforme o aparelho (ajustado depois pelo tempo de quadro medido). */
export function pickQuality({ mobile, dpr, cores, memory }) {
  if (mobile || (cores && cores <= 4) || (memory && memory <= 4)) return { name: 'low', msaa: 0, bloomLevels: 4, maxScale: Math.min(dpr, 1.5), minScale: 0.6, parallaxSteps: 2, dofTaps: 16 };
  if (dpr > 1.6) return { name: 'high', msaa: 4, bloomLevels: 5, maxScale: 1.5, minScale: 0.7, parallaxSteps: 4, dofTaps: 32 };
  return { name: 'high', msaa: 4, bloomLevels: 5, maxScale: Math.min(dpr, 1.25), minScale: 0.7, parallaxSteps: 4, dofTaps: 32 };
}
