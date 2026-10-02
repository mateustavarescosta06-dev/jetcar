// 01 · LAVAGEM. Um trecho curto do filme numa moldura (nunca em tela cheia), controlado pela
// rolagem: o jato chega no capô. Então o tempo para. O quadro congelado vira uma foto em alta e
// a água que estava no ar ganha espaço: gotas de verdade (esferas que refratam a moldura) ficam
// suspensas em três profundidades, algumas fora da moldura, e a câmera pode olhar em volta.
// A linha de luz atravessa a água (cada gota acende quando ela passa) e desenha a borda do
// card 01. No fim, as luzes da oficina apagam.
import * as THREE from '../../vendor/three.min.js';
import { $, view, pointer, state, clamp, lerp, span, smooth, smoother, env, rng } from '../core.js';
import { post } from '../gl/engine.js';
import { BARS, COLOR } from '../gl/glsl.js';
import { StudioLights, typePlane, sharedUniforms } from '../gl/studio.js';
import { Act, cardState } from './act.js';

// trecho do master: 5,25 s a 7,0 s (43 quadros, scripts/encode-wash.sh); o congelamento é o último
export const CLIP = { dur: 42 / 24 };
const FREEZE_P = 0.42;
const ZF = -4;     // plano da moldura
const BG = new THREE.Color(0.0037, 0.0037, 0.0042);

const DOFG = /* glsl */ `
uniform float uFocus; uniform float uAperture; varying float vViewZ;
float sharpness() { return 1.0 - clamp(uAperture * abs(1.0 - uFocus / max(vViewZ, 1e-4)), 0.0, 1.0); }
`;

export class WashAct extends Act {
  constructor(el, { engine, quality }) {
    super(el);
    this.gl = !!engine;
    this.card = $('.card', el);
    this.ready = !engine;
    this.drag = { x: 0, y: 0 };
    let d = null;
    this.stage.addEventListener('pointerdown', e => { if (!e.target.closest('.card')) d = { x: e.clientX - this.drag.x * view.w * 0.3, y: e.clientY - this.drag.y * view.h * 0.3 }; });
    addEventListener('pointermove', e => { if (d) { this.drag.x = clamp((e.clientX - d.x) / (view.w * 0.3), -1, 1); this.drag.y = clamp((e.clientY - d.y) / (view.h * 0.3), -1, 1); this.dirty = true; } });
    addEventListener('pointerup', () => { d = null; });
    if (engine) this.build(quality);
  }

  build(quality) {
    const low = quality.name === 'low';
    this.scene = new THREE.Scene();
    this.scene.background = BG;
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);
    this.lights = new StudioLights();
    this.shared = sharedUniforms();
    this.scene.add(this.lights.group);
    const L = this.lights.uniforms;
    this.U = { tFrame: { value: null }, tStill: { value: null }, uMix: { value: 0 }, uFrameMin: { value: new THREE.Vector2() }, uFrameMax: { value: new THREE.Vector2() }, uSrcAspect: { value: 1916 / 1080 }, uEdge: { value: 0 }, uBg: { value: BG } };
    const U = this.U;

    // moldura: o vídeo (ou o quadro congelado) num plano à frente da câmera
    this.frame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `varying vec2 vUv; varying float vViewZ; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vViewZ = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tFrame; uniform sampler2D tStill; uniform float uMix; uniform float uSrcAspect; uniform float uEdge; uniform vec2 uFrameMin; uniform vec2 uFrameMax;
        varying vec2 vUv;
        ${COLOR}
        ${DOFG}
        vec2 cover(vec2 uv) {
          vec2 sz = uFrameMax - uFrameMin; float fa = sz.x / sz.y;
          vec2 s = fa > uSrcAspect ? vec2(1.0, uSrcAspect / fa) : vec2(fa / uSrcAspect, 1.0);
          return (uv - 0.5) * s + 0.5;
        }
        void main() {
          vec2 uv = cover(vUv);
          vec3 a = srgbToLinear(texture2D(tFrame, uv).rgb);
          vec3 b = srgbToLinear(texture2D(tStill, uv).rgb);
          vec3 c = mix(a, b, uMix);
          // borda de cima: a linha que veio do hero
          float ey = (1.0 - vUv.y) * (uFrameMax.y - uFrameMin.y) * 900.0;
          c += vec3(1.0, 0.99, 0.97) * uEdge * exp(-ey * ey / 1.2) * 6.0;
          gl_FragColor = vec4(c, sharpness());
        }`,
      uniforms: { ...U, ...this.shared },
    }));
    this.scene.add(this.frame);

    // número grande ao fundo
    this.num = typePlane('01', this.shared, { h: 3.0, color: 0.022 });
    this.num.position.set(-2.3, 0.35, ZF - 3);
    this.scene.add(this.num);

    // gotas congeladas: esferas instanciadas que refratam a moldura (posições em placeDrops)
    const R = rng(7);
    const n = low ? 120 : 240;
    this.dropData = [];
    for (let i = 0; i < n; i++) this.dropData.push({ t: R(), a: R(), b: R(), c: R(), near: R() < 0.06, s: 0.7 + R() * 0.9, seed: R(), p: new THREE.Vector3(), r: 0 });
    this.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 24, 16), new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        uniform float uStretch;
        varying vec3 vW; varying vec3 vN; varying float vViewZ;
        void main() {
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
          vW = w.xyz;
          vec4 mv = viewMatrix * w; vViewZ = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCam; uniform sampler2D tStill; uniform vec2 uFrameMin; uniform vec2 uFrameMax; uniform float uSrcAspect; uniform vec3 uBg; uniform float uFrameZ; uniform float uA;
        varying vec3 vW; varying vec3 vN;
        ${BARS}
        ${COLOR}
        ${DOFG}
        vec2 cover(vec2 uv) {
          vec2 sz = uFrameMax - uFrameMin; float fa = sz.x / sz.y;
          vec2 s = fa > uSrcAspect ? vec2(1.0, uSrcAspect / fa) : vec2(fa / uSrcAspect, 1.0);
          return (uv - 0.5) * s + 0.5;
        }
        void main() {
          vec3 n = normalize(vN);
          vec3 v = normalize(uCam - vW);
          float NdV = max(dot(n, v), 1e-3);
          // atrás da gota: o raio refratado acerta a moldura (imagem invertida) ou o fundo escuro
          vec3 rd = refract(-v, n, 0.75);
          float t = (uFrameZ - vW.z) / min(rd.z, -1e-3);
          vec2 hit = vW.xy + rd.xy * t;
          vec2 fuv = (hit - uFrameMin) / (uFrameMax - uFrameMin);
          vec3 bg = uBg;
          if (fuv.x > 0.0 && fuv.x < 1.0 && fuv.y > 0.0 && fuv.y < 1.0) bg = srgbToLinear(texture2D(tStill, cover(fuv)).rgb);
          float F = fresnel(NdV, 0.02);
          vec3 refl = barsRadiance(vW, reflect(-v, n), 0.0015) + studioAmbient(reflect(-v, n)) * 2.0;
          vec3 col = bg * (1.0 - F) * 0.96 + refl * F;
          // a borda da gota pega a luz ambiente do galpão (fica legível contra o fundo escuro)
          col += vec3(0.5, 0.52, 0.56) * pow(clamp(1.0 - NdV, 0.0, 1.0), 3.0) * 0.08;
          gl_FragColor = vec4(col * uA, sharpness());
        }`,
      uniforms: { ...L, ...this.shared, tStill: U.tStill, uFrameMin: U.uFrameMin, uFrameMax: U.uFrameMax, uSrcAspect: U.uSrcAspect, uBg: U.uBg, uFrameZ: { value: ZF }, uA: { value: 1 } },
    }), n);
    this.drops.frustumCulled = false;
    this.scene.add(this.drops);
    this.M = new THREE.Matrix4(); this.Q = new THREE.Quaternion(); this.S = new THREE.Vector3(); this.P = new THREE.Vector3();
    this.tgt = new THREE.Vector3();
  }

  load() {
    if (!this.scene) return Promise.resolve();
    const sfx = view.portrait ? '-m' : '';
    const still = new Promise(res => new THREE.TextureLoader().load(`assets/wash/freeze${sfx}.webp`, t => { t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; res(t); }, undefined, () => res(null)));
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    const mp4 = v.canPlayType('video/mp4; codecs="avc1.640028"');
    const url = `assets/wash/scrub${sfx}.${mp4 === 'probably' ? 'mp4' : 'webm'}`;
    this.video = v;
    // o arquivo inteiro na memória: a busca de quadro não depende da rede
    const clip = fetch(url).then(r => (r.ok ? r.blob() : null)).then(b => new Promise(res => {
      if (!b) return res(null);
      v.src = URL.createObjectURL(b);
      v.addEventListener('loadeddata', () => res(v), { once: true });
      v.addEventListener('error', () => res(null), { once: true });
      v.load();
    })).catch(() => null);
    // iOS: a primeira interação libera a decodificação para buscar quadros
    const prime = () => { v.play().then(() => v.pause()).catch(() => {}); removeEventListener('touchstart', prime); };
    addEventListener('touchstart', prime, { passive: true });
    return Promise.all([still, clip]).then(([st, vid]) => {
      this.U.tStill.value = st;
      if (vid && vid.videoWidth) {
        // cada quadro buscado é copiado para um canvas (textura estável em qualquer navegador)
        const cv = document.createElement('canvas');
        cv.width = vid.videoWidth; cv.height = vid.videoHeight;
        const g = cv.getContext('2d');
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.NoColorSpace;
        tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
        const grab = () => { g.drawImage(vid, 0, 0); tex.needsUpdate = true; this.dirty = true; this.frameKey = vid.currentTime; };
        vid.addEventListener('seeked', grab);
        grab();
        this.U.tFrame.value = tex;
        this.U.uSrcAspect.value = vid.videoWidth / vid.videoHeight;
      } else {
        this.U.tFrame.value = st;
        this.U.uSrcAspect.value = view.portrait ? 1 : 1916 / 1080;
      }
      this.ready = !!st;
    });
  }

  resize(w, h) {
    if (!this.camera) return;
    this.camera.aspect = w / h;
    this.camera.fov = view.portrait ? 50 : 32;
    this.camera.updateProjectionMatrix();
    this.placeFrame();
  }

  /** Coloca a moldura no plano ZF de modo que ela ocupe o retângulo desejado na tela. */
  placeFrame() {
    const cam = this.camera;
    const hz = Math.tan((cam.fov * Math.PI) / 360) * Math.abs(ZF); // meia altura visível em ZF (câmera na origem)
    const wz = hz * cam.aspect;
    // retângulo na tela (fração): desktop à direita; celular em cima
    let r;
    if (view.portrait) { const fw = 0.92, fh = fw * (view.w / view.h); r = { x0: 0.04, x1: 0.96, y0: 0.12, y1: 0.12 + fh }; }
    else { const fw = 0.62, fh = fw * (view.w / view.h) / (16 / 9); r = { x0: 0.34, x1: 0.34 + fw, y0: 0.5 - fh / 2 - 0.02, y1: 0.5 + fh / 2 - 0.02 }; }
    const x0 = (r.x0 * 2 - 1) * wz, x1 = (r.x1 * 2 - 1) * wz;
    const y1 = (1 - r.y0 * 2) * hz, y0 = (1 - r.y1 * 2) * hz;
    this.frame.position.set((x0 + x1) / 2, (y0 + y1) / 2, ZF);
    this.frame.scale.set(x1 - x0, y1 - y0, 1);
    this.U.uFrameMin.value.set(x0, y0);
    this.U.uFrameMax.value.set(x1, y1);
    this.rect = r;
    this.placeDrops(wz / Math.abs(ZF), hz / Math.abs(ZF));
  }

  /** Gotas ao longo do jato: do bico (fora da moldura, no alto à direita) até o capô. */
  placeDrops(tx, ty) {
    const r = this.rect;
    // pontos do jato na tela (fração): o bico fica fora do quadro, no alto à direita
    const A = view.portrait ? [0.98, 0.04] : [0.99, 0.08];
    const B = [r.x0 + (r.x1 - r.x0) * 0.5, r.y0 + (r.y1 - r.y0) * 0.5];
    const toWorld = (sx, sy, z, out) => out.set((sx * 2 - 1) * tx * -z, (1 - sy * 2) * ty * -z, z);
    for (const d of this.dropData) {
      if (d.near) {
        // algumas gotas maiores na frente da moldura, a meia distância (paralaxe ao olhar em volta)
        toWorld(lerp(0.4, 0.98, d.a), lerp(0.12, 0.7, d.b), lerp(-1.9, -2.6, d.c), d.p);
        d.r = 0.006 + d.seed * 0.006;
        continue;
      }
      const z = lerp(-1.7, -3.8, d.t);
      const spread = 0.025 + d.t * 0.09;
      const sx = lerp(A[0], B[0], d.t) + (d.a - 0.5) * spread * 1.4;
      const sy = lerp(A[1], B[1], d.t) + (d.b - 0.5) * spread;
      toWorld(sx, sy, z, d.p);
      d.r = (0.0035 + d.seed ** 3 * 0.012) * (-z / 3);
    }
  }

  key() { return `${Math.round(this.p * 2000)}|${Math.round(this.drag.x * 100)}|${this.frameKey ?? 0}`; }
  get animating() { return this.dirty || (this.video && this.video.seeking); }

  focusPoint(el) { return this.card.contains(el) ? this.hold : null; }
  /** Testes: o vídeo vai direto ao quadro do alvo. */
  settle() { this.vt = null; this.update(16); return new Promise(r => { const v = this.video; if (!v || !v.seeking) return r(); v.addEventListener('seeked', () => r(), { once: true }); }); }
  explore(btn, { jump }) { jump(this.hold, this.card.querySelector('.card-add')); }

  update(dt) {
    const p = this.p;
    cardState(this.card, p, [0.5, 0.6], 0.12);
    // tempo do clipe: anda desde a entrada do palco até o congelamento
    const vh = view.h;
    const into = this.travel > 0 ? (this.enter * vh + p * this.travel) / (vh + FREEZE_P * this.travel) : 1;
    const c = state.reduce ? 1 : clamp(into);
    const target = c * CLIP.dur;
    const v = this.video;
    if (v && v.readyState >= 2) {
      this.vt = this.vt == null ? target : this.vt + (target - this.vt) * (state.reduce ? 1 : 0.18);
      this.vtarget = target;
      if (Math.abs(this.vt - target) < 0.002) this.vt = target;
      const want = Math.round(this.vt * 24) / 24;
      if (!v.seeking && Math.abs(v.currentTime - want) > 1 / 60) { v.currentTime = Math.min(want, v.duration || want); this.vtime = want; }
    }
  }

  render(engine, now) {
    this.dirty = false;
    const p = this.p, U = this.U, cam = this.camera, L = this.lights, sh = this.shared;
    // congelamento: o quadro em alta substitui o vídeo; as gotas aparecem no espaço
    const frz = state.reduce ? 1 : smooth(span(p, FREEZE_P - 0.01, FREEZE_P + 0.04));
    U.uMix.value = frz;
    // câmera: parada durante o vídeo; no congelado ela avança e pode olhar em volta
    const look = smoother(span(p, FREEZE_P, 0.9));
    const px = (state.reduce ? 0 : pointer.sx) * 0.6 + this.drag.x, py = (state.reduce ? 0 : pointer.sy) * 0.6 + this.drag.y;
    cam.position.set(px * 0.12 * frz + look * 0.06, -py * 0.07 * frz, -look * 0.35);
    this.tgt.set(lerp(0, 0.05, look) + px * 0.02, 0, ZF);
    cam.lookAt(this.tgt);
    sh.uCam.value.copy(cam.position);
    sh.uFocus.value = Math.abs(ZF - cam.position.z) - 1.2;
    sh.uAperture.value = 0.55;
    // a linha de luz atravessa a água (barra vertical que varre da direita para a esquerda)
    const sweep = span(p, 0.47, 0.72);
    const li = env(p, [0.46, 0.5, 0.68, 0.73]) * (state.reduce ? 0 : 1);
    L.set(0, [lerp(1.3, -1.3, smoother(sweep)), 0.1, -2.5], [0, 1, 0], 0.003, 1.6, [10 * li, 9.9 * li, 9.7 * li], 0.002, li > 0.02, 0.5);
    // um softbox fraco em cima: o brilho de cima de cada gota
    L.set(1, [0.4, 2.2, -0.6], [1, 0, 0], 0.5, 1.8, [2.4, 2.4, 2.5], 0.4, false);
    L.count(2);
    // gotas: aparecem com o congelamento
    this.drops.visible = frz > 0.01;
    if (this.drops.visible) {
      this.drops.material.uniforms.uA.value = frz;
      const D = this.dropData;
      for (let i = 0; i < D.length; i++) {
        const d = D[i];
        this.P.copy(d.p);
        // alongadas na direção do jato (velocidade congelada)
        this.Q.setFromAxisAngle(this.zAxis || (this.zAxis = new THREE.Vector3(0, 0, 1)), -0.62);
        const r = d.r * clamp(frz * 1.4 - d.seed * 0.3);
        this.S.set(r * d.s * 1.6, r, r);
        this.M.compose(this.P, this.Q, this.S);
        this.drops.setMatrixAt(i, this.M);
      }
      this.drops.instanceMatrix.needsUpdate = true;
    }
    // borda de cima da moldura: a linha que chegou do hero, apagando quando o vídeo começa
    U.uEdge.value = state.reduce ? 0 : 1 - smooth(clamp(span(this.enter, 0.5, 1.0) * 0.5 + p * 4));
    this.num.material.uniforms.uAlpha.value = env(p, [0.0, 0.12, 0.86, 0.98]);
    // as luzes da oficina apagam no fim: a cena inteira (moldura, gotas e fundo) vai ao preto,
    // o mesmo preto de onde a fenda do polimento abre
    const out = smooth(span(p, 0.88, 1.0));
    post.exposure = 1 - out;
    post.bloom = 0.5;
    post.threshold = 0.95;
    post.knee = 0.5;
    post.vignette = 0.2;
    post.grain = view.mobile ? 0.03 : 0.035;
    post.dof = 0.9 * frz;
    engine.render(this.scene, cam, now / 1000);
  }
}
