// HERO · planos reais. A foto do galpão é projetada a partir da câmera original sobre uma
// geometria simples (parede, piso); o carro é outro plano, recortado com alfa real, apoiado no
// piso (pneus na linha de contato), com reflexo e sombra de contato gerados a partir do recorte.
// O letreiro JETCAR fica entre a parede e o carro (o teto do carro cobre a base das letras).
// Um pilar do galpão passa perto da câmera. A câmera virtual anda de verdade, então cada plano
// se move conforme a própria distância.
// A linha de luz: uma barra vertical entre a câmera e o carro varre o galpão uma vez ao abrir;
// o reflexo corre pela carroceria (normais do recorte) e o carro fica aceso. Na saída, a linha
// deita no piso e desce até a borda da tela, onde vira a borda da moldura da lavagem.
import * as THREE from '../../vendor/three.min.js';
import { $, view, pointer, state, clamp, lerp, span, smooth, smoother, env, glWidth } from '../core.js';
import { post } from '../gl/engine.js';
import { BARS, COLOR, NOISE } from '../gl/glsl.js';
import { StudioLights } from '../gl/studio.js';
import { LOGO } from '../logo-data.js';
import { Act } from './act.js';

// câmera original da foto (estimada pelo horizonte, pela linha parede/piso e pelo contato dos pneus)
const SRC = { w: 1672, h: 941, fov: 30, y: 1.2 };
// retângulo do carro na foto (UV, v de baixo para cima): car.webp e normal.webp são recortes dele
// (scripts/frames/hero_layers.py → hero.json)
const BOX = { u0: 0.20455, v0: 0.14984, u1: 0.79605, v1: 0.61105 };
const ZC = -6.8;   // plano do carro
const ZW = -16;    // parede do fundo
const ZM = -11.5;  // letreiro
const ZP = -2.4;   // pilar perto da câmera
// celular (retrato): plate-m.webp é o miolo da placa em 2× (a câmera em pé vê u 0,17…0,87)
const PLATE_M = [0.14, 0, 0.9, 1];

const PROJ = /* glsl */ `
uniform mat4 uPV;
vec2 projRaw(vec3 w) { vec4 c = uPV * vec4(w, 1.0); return c.xy / c.w * 0.5 + 0.5; }
vec2 projUV(vec3 w) { return clamp(projRaw(w), vec2(0.0005), vec2(0.9995)); }
// fora da foto (no celular a câmera vê além dela): o galpão some no escuro
float outside(vec3 w) { vec2 u = projRaw(w); vec2 d = max(-u, u - 1.0); return smoothstep(0.0, 0.22, max(d.x, d.y)); }
`;
const VERT = /* glsl */ `
varying vec3 vW; varying vec2 vUv;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vUv = uv; gl_Position = projectionMatrix * viewMatrix * w; }
`;

export class HeroAct extends Act {
  constructor(el, { engine, quality }) {
    super(el);
    this.gl = !!engine;
    this.copy = $('.hero-copy', el);
    this.ready = !engine;
    this.t0 = null;
    this.quality = quality;
    if (engine) this.build(quality);
  }

  build() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0, 0, 0);
    this.camera = new THREE.PerspectiveCamera(SRC.fov, 1, 0.05, 120);
    this.src = new THREE.PerspectiveCamera(SRC.fov, SRC.w / SRC.h, 0.05, 120);
    this.src.position.set(0, SRC.y, 0);
    this.src.lookAt(0, SRC.y, -1);
    this.src.updateMatrixWorld();
    const PV = new THREE.Matrix4().multiplyMatrices(this.src.projectionMatrix, this.src.matrixWorldInverse);
    this.lights = new StudioLights();
    this.lights.count(1);
    this.scene.add(this.lights.group);
    const L = this.lights.uniforms;
    this.U = { uPV: { value: PV }, uCam: { value: new THREE.Vector3() }, uTraceX: { value: -9 }, uFloorLine: { value: 99 }, uFloorLineI: { value: 0 }, uTime: { value: 0 } };
    const U = this.U;
    const tex = () => ({ value: null });

    // ——— Parede e piso: a placa limpa projetada ———
    const plateMat = (floor) => new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tPlate; uniform vec3 uCam; uniform float uFloorLine; uniform float uFloorLineI; uniform vec4 uCrop;
        varying vec3 vW;
        ${PROJ}
        ${COLOR}
        ${BARS}
        void main() {
          // a textura pode ser só um recorte da foto (celular): coordenadas da foto -> do recorte
          vec2 cu = (projRaw(vW) - uCrop.xy) / (uCrop.zw - uCrop.xy);
          // textura sRGB: o hardware converte para linear antes de filtrar
          vec3 c = texture2D(tPlate, clamp(cu, vec2(0.0005), vec2(0.9995)), -0.5).rgb;
          vec2 od = max(-cu, cu - 1.0);
          c = mix(c, vec3(0.0035, 0.0036, 0.004), max(outside(vW), smoothstep(0.0, 0.22, max(od.x, od.y))));
          ${floor ? `
          // piso brilhante: reflete a barra de luz (uma faixa vertical na frente do carro)
          vec3 v = normalize(uCam - vW);
          vec3 r = reflect(-v, vec3(0.0, 1.0, 0.0));
          float F = 0.04 + 0.96 * pow(clamp(1.0 - v.y, 0.0, 1.0), 5.0);
          c += barsRadiance(vW, r, 0.06) * F * 0.5;
          // a linha deitada no piso (saída)
          float dz = vW.z - uFloorLine;
          c += vec3(1.0, 0.99, 0.97) * uFloorLineI * (exp(-dz * dz / 0.00035) * 6.0 + exp(-dz * dz / 0.02) * 0.25) * (1.0 - smoothstep(4.0, 9.0, abs(vW.x)));
          ` : ''}
          gl_FragColor = vec4(c, 1.0);
        }`,
      uniforms: { ...L, ...U, tPlate: tex(), uCrop: { value: new THREE.Vector4(0, 0, 1, 1) } },
    });
    this.wallMat = plateMat(false);
    this.floorMat = plateMat(true);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(90, 50), this.wallMat);
    wall.position.set(0, 18, ZW);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 40), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, ZW + 20);
    this.scene.add(wall, floor);

    // ——— Atmosfera: feixe do teto e névoa baixa (aditivos, bem fracos) ———
    const atmo = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uK; varying vec2 vUv;
        ${NOISE}
        void main() {
          float shaft = smoothstep(0.5, 0.0, abs(vUv.x - 0.5) - vUv.y * 0.18) * smoothstep(0.0, 0.9, vUv.y);
          float haze = (1.0 - smoothstep(0.0, 0.35, vUv.y)) * 0.9;
          float n = 0.85 + 0.15 * fbm(vec2(vUv.x * 3.0 + uTime * 0.02, vUv.y * 2.0 - uTime * 0.015));
          gl_FragColor = vec4(vec3(0.8, 0.82, 0.86) * (shaft * 0.012 + haze * 0.01) * n * uK, 1.0);
        }`,
      uniforms: { uTime: U.uTime, uK: { value: 1 } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.atmo = atmo;
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), atmo);
    shaft.position.set(0.4, 4.5, -10.5);
    this.scene.add(shaft);

    // ——— Letreiro: as letras JETCAR do logo, entre a parede e o carro ———
    const cv = document.createElement('canvas');
    cv.width = 2048; cv.height = 300;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff';
    const sx = 2048 / 1354, words = LOGO.parts.filter(p => p.kind === 'word');
    g.setTransform(sx, 0, 0, sx, 0, -409 * sx + 20);
    for (const w of words) g.fill(new Path2D(w.d), 'evenodd');
    const wordTex = new THREE.CanvasTexture(cv);
    wordTex.colorSpace = THREE.NoColorSpace;
    wordTex.anisotropy = 8;
    this.mast = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4 * 300 / 2048), new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tWord; uniform float uA; varying vec2 vUv;
        void main() {
          float a = texture2D(tWord, vUv).a;
          // laca escura com um degradê do teto (mais clara em cima)
          vec3 c = mix(vec3(0.05, 0.051, 0.054), vec3(0.16, 0.162, 0.168), smoothstep(0.1, 0.95, vUv.y));
          gl_FragColor = vec4(c * a * uA, a * uA);
        }`,
      uniforms: { tWord: { value: wordTex }, uA: { value: 1 } },
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    }));
    this.mast.position.set(0.35, 1.98, ZM);
    this.scene.add(this.mast);

    // ——— Sombra de contato e reflexo do carro ———
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.6), new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: 'varying vec2 vUv; void main(){ vec2 q = (vUv - 0.5) * vec2(2.0, 2.0); float d = length(q * vec2(1.0, 1.9)); float a = exp(-d * d * 3.2) * 0.75; gl_FragColor = vec4(0.0, 0.0, 0.0, a); }',
      transparent: true, depthWrite: false,
    }));
    contact.rotation.x = -Math.PI / 2;
    contact.position.set(0.05, 0.003, ZC + 0.2);
    this.scene.add(contact);
    this.carMat = (mirror) => new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tCar; uniform sampler2D tNorm; uniform vec3 uCam; uniform float uTraceX; uniform float uDark; uniform vec4 uBox;
        varying vec3 vW;
        ${PROJ}
        ${COLOR}
        ${BARS}
        void main() {
          vec3 P = vW;
          ${mirror ? 'P.y = -P.y;' : ''}
          vec2 uv = (projRaw(P) - uBox.xy) / (uBox.zw - uBox.xy);
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
          // viés −0,5: nítido como o nível cheio acima de 0,71×, sem serrilhar abaixo (teste de filtros)
          vec4 s = texture2D(tCar, uv, -0.5);
          ${mirror ? `
          // reflexo no piso: borrado e apagando com a distância do contato
          vec2 o = vec2(0.0, 0.05 / (uBox.w - uBox.y) * 0.08);
          vec4 s2 = texture2D(tCar, uv + o) + texture2D(tCar, uv - o);
          s = (s * 2.0 + s2) * 0.25;
          float fade = exp(-max(-vW.y, 0.0) / 0.45) * 0.22;
          ` : 'float fade = 1.0;'}
          if (s.a < 0.003) discard;
          vec3 c = s.rgb;
          // a linha revela: à esquerda da barra (onde ela já passou) o carro está aceso
          float lit = mix(uDark, 1.0, 1.0 - smoothstep(uTraceX - 0.4, uTraceX + 0.9, P.x));
          vec3 n = normalize(texture2D(tNorm, uv).xyz * 2.0 - 1.0 + vec3(0.0, 0.0, 1e-3));
          vec3 v = normalize(uCam - P);
          vec3 r = reflect(-v, n);
          // clamp: com a normal de frente para a câmera, dot(n, v) arredonda para pouco acima de 1 e
          // pow() de base negativa dá NaN (o bloom espalha em blocos)
          float F = 0.04 + 0.96 * pow(clamp(1.0 - dot(n, v), 0.0, 1.0), 5.0);
          vec3 spec = barsRadiance(P + n * 0.3, r, 0.035) * F * 0.9;
          c = c * lit + spec;
          float a = s.a * fade;
          gl_FragColor = vec4(c * a, a);
        }`,
      uniforms: { ...L, ...U, tCar: tex(), tNorm: tex(), uDark: { value: 0.28 }, uBox: { value: new THREE.Vector4(BOX.u0, BOX.v0, BOX.u1, BOX.v1) } },
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.refl = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.2), this.carMat(true));
    this.refl.position.set(0, -1.6, ZC);
    this.car = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), this.carMat(false));
    this.car.position.set(0, 2.3, ZC);
    this.scene.add(this.refl, this.car);

    // ——— Pilar perto da câmera (fora de foco): a borda de concreto e a tira de luz ———
    this.pillar = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 9), new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          // borda desfocada (degradê largo) e a tira de LED fora de foco perto da quina
          float body = smoothstep(0.98, 0.62, vUv.x);
          float sx = (vUv.x - 0.74) / 0.05;
          float strip = exp(-sx * sx) * smoothstep(0.02, 0.2, vUv.y) * smoothstep(0.98, 0.8, vUv.y);
          vec3 c = vec3(0.006, 0.0062, 0.0066) * (0.6 + 0.4 * vUv.y) + vec3(1.0, 0.86, 0.66) * strip * 0.9;
          float a = max(body, strip);
          gl_FragColor = vec4(c * a, a);
        }`,
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    }));
    this.pillar.position.set(-1.62, 2.6, ZP);
    this.scene.add(this.pillar);
    this.tmp = new THREE.Vector3();
  }

  load() {
    if (!this.scene) return Promise.resolve();
    const loader = new THREE.TextureLoader();
    // fotos em sRGB (filtradas em luz linear); as normais são dados e ficam como estão
    const get = (url, cs = THREE.SRGBColorSpace) => new Promise(res => loader.load(url, t => { t.colorSpace = cs; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; res(t); }, undefined, () => res(null)));
    // nível do carro pela largura do canvas: ele ocupa ~60% dela e cresce 1,6× no avanço da
    // câmera; em telas largas (2000 px ou mais) o 3× fica perto de 1:1 até o fim do avanço
    const portrait = view.portrait;
    this.loadedFor = portrait;
    const carUrl = !portrait && glWidth(this.quality) >= 2000 ? 'assets/hero/car-3x.webp' : 'assets/hero/car.webp';
    const plateUrl = portrait ? 'assets/hero/plate-m.webp' : 'assets/hero/plate.webp';
    return Promise.all([get(plateUrl), get(carUrl), get('assets/hero/normal.webp', THREE.NoColorSpace)]).then(([plate, car, norm]) => {
      for (const m of [this.wallMat, this.floorMat]) {
        m.uniforms.tPlate.value = plate;
        m.uniforms.uCrop.value.set(...(portrait ? PLATE_M : [0, 0, 1, 1]));
      }
      for (const m of [this.car.material, this.refl.material]) { m.uniforms.tCar.value = car; m.uniforms.tNorm.value = norm; }
      this.ready = !!(plate && car);
    });
  }

  start() { this.t0 = performance.now(); }

  resize(w, h) {
    if (!this.camera) return;
    // girou o aparelho: a placa do celular é um recorte, troca pela versão certa
    if (this.ready && this.loadedFor != null && this.loadedFor !== view.portrait) this.load();
    const cam = this.camera;
    cam.aspect = w / h;
    if (view.portrait) {
      // celular: o carro inteiro ocupa a largura, no meio da tela; o letreiro acima, o texto abaixo
      const hfov = 35;
      cam.fov = clamp((2 * Math.atan(Math.tan((hfov * Math.PI) / 360) / cam.aspect) * 180) / Math.PI, 30, 80);
      cam.setViewOffset(w, h, 0, h * 0.16, w, h);
    } else {
      cam.fov = SRC.fov * (cam.aspect < SRC.w / SRC.h ? (SRC.w / SRC.h) / cam.aspect * 0.92 : 1);
      // o carro um pouco à direita (o texto fica à esquerda, embaixo)
      cam.setViewOffset(w, h, -w * 0.07, h * 0.05, w, h);
    }
    cam.updateProjectionMatrix();
  }

  get animating() { return this.t0 != null && performance.now() - this.t0 < 2600; }
  key() { return `${Math.round(this.p * 2000)}|${this.t0 != null && performance.now() - this.t0 < 2600 ? performance.now() : 0}`; }

  update() {
    const p = this.p;
    // o texto sobe e some antes da saída
    const a = state.reduce ? 1 : 1 - smooth(span(p, 0.45, 0.8));
    this.copy.style.setProperty('--a', a.toFixed(3));
    // apagado só na opacidade (o título continua na árvore de acessibilidade e os botões no Tab)
    this.copy.style.pointerEvents = a < 0.5 ? 'none' : '';
  }

  // o foco do teclado num botão do hero volta a rolagem para o começo, onde o texto aparece
  focusPoint(el) { return this.copy.contains(el) ? 0 : null; }

  render(engine, now) {
    const p = this.p, cam = this.camera, U = this.U, L = this.lights;
    // ——— Câmera: avança pelo galpão (perspectiva real: cada plano anda conforme a distância) ———
    const dolly = smoother(span(p, 0, 1));
    const px = state.reduce ? 0 : pointer.sx, py = state.reduce ? 0 : pointer.sy;
    const z = lerp(0, -2.6, dolly), y = lerp(SRC.y, 1.0, dolly) + (view.portrait ? 0.15 : 0);
    cam.position.set(px * 0.05, y - py * 0.03, z);
    this.tmp.set(px * 0.02 + lerp(0, 0.35, dolly), lerp(SRC.y, 0.75, dolly), ZC);
    cam.lookAt(this.tmp);
    U.uCam.value.copy(cam.position);
    U.uTime.value = now / 1000;

    // ——— A linha de luz ———
    // abertura: varre da esquerda para a direita em 1,8 s (uma vez); depois volta devagar com a rolagem
    const t = this.t0 == null ? 0 : (now - this.t0) / 1000;
    const intro = state.reduce ? 1 : smoother(clamp((t - 0.25) / 1.8));
    let tx = lerp(-5.5, 6.5, intro), ti = (intro > 0 && intro < 1 ? 1 : 0) * 1;
    const back = smoother(span(p, 0.25, 0.7));
    if (back > 0 && back < 1) { tx = lerp(6.5, -5.5, back); ti = 1; }
    const bar = view.portrait ? 0.008 : 0.006;
    L.set(0, [tx, 1.6, -3.6], [0, 1, 0], bar, 3.2, [11 * ti, 10.9 * ti, 10.7 * ti], 0.004, ti > 0.01, 0.28);
    L.count(1);
    // a primeira passada acende o carro; depois ele fica aceso
    U.uTraceX.value = intro < 1 ? lerp(-5.5, 6.5, intro) - 0.6 : 9;
    this.car.material.uniforms.uDark.value = state.reduce ? 1 : 0.22;
    this.refl.material.uniforms.uDark.value = this.car.material.uniforms.uDark.value;
    // saída: a linha deita no piso atrás do carro e vem na direção da câmera até a borda da tela
    const lay = span(p, 0.72, 1.0);
    U.uFloorLine.value = lerp(ZC - 1.2, cam.position.z - 0.9, smoother(lay));
    U.uFloorLineI.value = lay > 0 ? smooth(span(lay, 0, 0.15)) : 0;

    // atmosfera (feixe e névoa): um dos últimos degraus da escada de qualidade
    this.atmo.uniforms.uK.value = this.quality.atmosphere ? 1 : 0;
    post.exposure = state.reduce ? 1 : lerp(0.0, 1, smooth(clamp(t / 0.6)));
    // foto: o branco chega a 255; bloom só na barra de luz e na linha do piso (acima de 4)
    post.tone = 'photo';
    post.vignette = 0.25;
    post.dof = 0;
    engine.render(this.scene, cam);
  }
}
