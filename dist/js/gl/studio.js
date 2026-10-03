// Peças do estúdio 3D: o capô (superfície paramétrica com vinco), a pintura automotiva
// (base metálica com flocos, verniz que reflete as barras de luz, micro-riscos que só aparecem
// sob a luz de inspeção), a geometria das gotas, a boina da politriz, o fundo, o piso e os
// números do fundo. As camadas do Ceramic são materiais físicos (physical.js).
// Todos os materiais escrevem no alfa a nitidez do pixel (profundidade de campo no pós).
import * as THREE from '../../vendor/three.min.js';
import { BARS, NOISE, COLOR, MAX_BARS } from './glsl.js';
import { rng } from '../core.js';

// ——— Geometria do capô ———
export const HOOD = { x0: -1.6, x1: 1.6, z0: -1.1, z1: 1.1 };

/** Altura do capô (m): domo suave, dois vincos longitudinais e a frente que cai. */
export function hoodY(x, z) {
  let y = 0.06 * (1 - (x / 1.6) ** 2) + 0.035 * (1 - (z / 1.1) ** 2);
  y += 0.0045 * Math.exp(-(((Math.abs(z) - 0.52) / 0.03) ** 2));
  if (x > 1.12) y -= (x - 1.12) ** 2 * 1.5;
  return y;
}
/** Normal do capô por diferenças finitas. */
export function hoodN(x, z, out = new THREE.Vector3()) {
  const e = 0.002;
  const dx = (hoodY(x + e, z) - hoodY(x - e, z)) / (2 * e);
  const dz = (hoodY(x, z + e) - hoodY(x, z - e)) / (2 * e);
  return out.set(-dx, 1, -dz).normalize();
}

export function hoodGeometry(sx = 320, sz = 220) {
  const g = new THREE.PlaneGeometry(HOOD.x1 - HOOD.x0, HOOD.z1 - HOOD.z0, sx, sz);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, hoodY(x, z));
  }
  g.computeVertexNormals();
  return g;
}

// ——— Textura de micro-riscos (hologramas do polimento mal feito) ———
// R,G = direção do risco em ângulo dobrado vezes a presença, em torno de 0,5 (um risco é uma
// linha: θ e θ+π são o mesmo risco); B = presença. Com o fundo neutro (0,5; 0,5; 0), o
// antisserrilhado do canvas e os mipmaps só encurtam o vetor, nunca giram a direção (com a
// tangente guardada direto, a borda de cada traço apontava para outro lado e o risco revelado
// pela luz se partia em tracinhos). Arcos em volta de vários centros, como a marca de uma
// politriz rotativa, e alguns riscos retos de lavagem.
export function swirlTexture(size = 1024, seed = 11) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgb(128,128,0)';
  g.fillRect(0, 0, size, size);
  const R = rng(seed);
  // escala em relação a uma textura de 1024 (o desenho é o mesmo em qualquer tamanho)
  const k = size / 1024;
  g.lineCap = 'round';
  const rgb = (t, a) => `rgb(${Math.round((0.5 + 0.5 * a * Math.cos(t)) * 255)},${Math.round((0.5 + 0.5 * a * Math.sin(t)) * 255)},${Math.round(a * 255)})`;
  const seg = (x0, y0, x1, y1, w, a) => {
    g.strokeStyle = rgb(Math.atan2(y1 - y0, x1 - x0) * 2, a);
    g.lineWidth = w * k;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  };
  // Cada arco sai num traço só, com um degradê cônico em volta do centro: a cor guarda a direção
  // da tangente, que gira junto com o arco (no ângulo φ em volta do centro, 2φ + π em ângulo
  // dobrado). Em segmentos retos de cor fixa, a direção andava aos saltos e a luz acendia cada
  // risco em tracinhos. Um degradê por centro e presença (cache); sem createConicGradient
  // (navegadores antigos), os segmentos.
  const conic = typeof g.createConicGradient === 'function';
  const grads = new Map();
  const conicAt = (x, y, a) => {
    const key = `${x}|${y}|${a}`;
    let gr = grads.get(key);
    if (!gr) {
      gr = g.createConicGradient(0, x, y);
      for (let j = 0; j <= 36; j++) gr.addColorStop(j / 36, rgb(4 * Math.PI * j / 36 + Math.PI, a));
      grads.set(key, gr);
    }
    return gr;
  };
  // 14 grupos; o comprimento dos arcos cresce de um grupo para o outro (o primeiro fica vazio).
  // As medidas valem para a textura de 2048 (k = 2): qualquer tamanho desenha o mesmo padrão, só
  // com mais ou menos pixels (antes, o contador do laço tinha o mesmo nome da escala e a textura
  // de 1024 do celular saía com outro desenho, de arcos duas vezes mais longos).
  for (let c = 0; c < 14; c++) {
    const cx = R() * size, cy = R() * size;
    for (let i = 0; i < 150; i++) {
      const rad = 6 + R() * size * 0.42;
      const a0 = R() * Math.PI * 2;
      const len = Math.min(Math.PI * 1.2, (18 + R() * 120) * c * k / (2 * rad));
      const w = 0.6 + R() * 0.9, a = 0.45 + R() * 0.55;
      if (!c) continue;
      g.lineWidth = w * k;
      // repete nas bordas para a textura ladrilhar sem emenda
      for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
        const x = cx + ox, y = cy + oy;
        if (x - rad > size + 2 || x + rad < -2 || y - rad > size + 2 || y + rad < -2) continue;
        if (conic) {
          g.strokeStyle = conicAt(x, y, Math.round(a * 16) / 16);
          g.beginPath(); g.arc(x, y, rad, a0, a0 + len); g.stroke();
          continue;
        }
        const steps = Math.max(3, Math.ceil(len * rad / (3 * c * k)));
        let px = x + Math.cos(a0) * rad, py = y + Math.sin(a0) * rad;
        for (let s = 1; s <= steps; s++) {
          const an = a0 + (len * s) / steps;
          const qx = x + Math.cos(an) * rad, qy = y + Math.sin(an) * rad;
          seg(px, py, qx, qy, w, a);
          px = qx; py = qy;
        }
      }
    }
  }
  for (let i = 0; i < 120; i++) {
    const x = R() * size, y = R() * size, an = R() * Math.PI, l = (20 + R() * 90) * k;
    seg(x, y, x + Math.cos(an) * l, y + Math.sin(an) * l, 0.6 + R() * 0.6, 0.35 + R() * 0.4);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  return t;
}

// ——— Luzes do estúdio (barras analíticas compartilhadas por todos os materiais) ———
export class StudioLights {
  constructor() {
    this.uniforms = {
      uBarC: { value: Array.from({ length: MAX_BARS }, () => new THREE.Vector4()) },
      uBarA: { value: Array.from({ length: MAX_BARS }, () => new THREE.Vector4()) },
      uBarI: { value: Array.from({ length: MAX_BARS }, () => new THREE.Vector4()) },
      uBarN: { value: 0 },
      uAmbTop: { value: new THREE.Color(0.006, 0.0062, 0.0066) },
      uAmbBottom: { value: new THREE.Color(0.0012, 0.0012, 0.0013) },
    };
    // barras visíveis (tubos emissivos), para o reflexo ter de onde vir
    this.meshes = [];
    this.group = new THREE.Group();
    for (let i = 0; i < MAX_BARS; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), emissiveMaterial());
      m.visible = false;
      this.meshes.push(m);
      this.group.add(m);
    }
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._y = new THREE.Vector3(0, 1, 0);
  }

  /** Barra i: centro c, eixo a (unitário), meia-largura hw, meio-comprimento hl, cor×intensidade. */
  set(i, c, a, hw, hl, color, soft = 0.002, visible = true, glow = 1) {
    const u = this.uniforms;
    u.uBarC.value[i].set(c[0], c[1], c[2], hw);
    u.uBarA.value[i].set(a[0], a[1], a[2], hl);
    u.uBarI.value[i].set(color[0], color[1], color[2], soft);
    const m = this.meshes[i];
    m.visible = visible && (color[0] + color[1] + color[2]) > 0.01;
    if (!m.visible) return;
    m.position.set(c[0], c[1], c[2]);
    this._v.set(a[0], a[1], a[2]);
    this._q.setFromUnitVectors(this._y, this._v);
    m.quaternion.copy(this._q);
    m.scale.set(hw * 2, hl * 2, hw * 2);
    m.material.uniforms.uColor.value.setRGB(color[0] * glow, color[1] * glow, color[2] * glow);
  }

  count(n) {
    this.uniforms.uBarN.value = n;
    for (let i = n; i < MAX_BARS; i++) this.meshes[i].visible = false;
  }
}

// ——— Trechos comuns ———
// Nitidez para a profundidade de campo: lente fina, 1 = em foco.
const DOF = /* glsl */ `
uniform float uFocus; uniform float uAperture;
varying float vViewZ;
float sharpness() { return 1.0 - clamp(uAperture * abs(1.0 - uFocus / max(vViewZ, 1e-4)), 0.0, 1.0); }
`;

const VERT = /* glsl */ `
varying vec3 vW; varying vec3 vN; varying vec2 vUv; varying float vViewZ;
void main() {
#ifdef USE_INSTANCING
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
#else
  vec4 w = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
#endif
  vW = w.xyz; vUv = uv;
  vec4 mv = viewMatrix * w;
  vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

/** Uniformes de câmera e foco compartilhados (um objeto, todos os materiais). */
export function sharedUniforms() {
  return { uCam: { value: new THREE.Vector3() }, uFocus: { value: 1 }, uAperture: { value: 0 } };
}

// mistura que preserva o alfa do destino (o alfa é a nitidez, não transparência)
function keepAlpha(mat, src = THREE.OneFactor, dst = THREE.OneMinusSrcAlphaFactor) {
  mat.transparent = true;
  mat.blending = THREE.CustomBlending;
  mat.blendEquation = THREE.AddEquation;
  mat.blendSrc = src;
  mat.blendDst = dst;
  mat.blendSrcAlpha = THREE.ZeroFactor;
  mat.blendDstAlpha = THREE.OneFactor;
  mat.depthWrite = false;
  return mat;
}

function emissiveMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, 1.0); }`,
    uniforms: { uColor: { value: new THREE.Color() } },
  });
}

// ——— Pintura ———
export function paintMaterial(lights, shared, swirl) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uCam;
      uniform vec3 uBase; uniform float uFlake; uniform float uRough; uniform float uCoat;
      uniform sampler2D tSwirl; uniform float uSwirlScale; uniform float uSwirl; uniform float uPolishZ;
      uniform vec3 uInsp; uniform vec3 uInspC; uniform float uInspBar; uniform float uInspSpread; uniform float uSwirlGain;
      uniform float uFilm; uniform float uFilmX;
      uniform float uDim; uniform float uFill;
      varying vec3 vW; varying vec3 vN; varying vec2 vUv;
      ${BARS}
      ${NOISE}
      ${DOF}
      // Normal do capô por pixel, com as derivadas exatas de hoodY (domo, dois vincos de 3 cm e a
      // frente que cai). Um espelho dobra o erro de ângulo: com a normal interpolada dos vértices
      // (grade de 1 cm), o reflexo da barra virava uma linha quebrada ao cruzar os vincos.
      vec3 hoodNormal(vec2 p) {
        float dx = -0.12 * p.x / 2.56;
        if (p.x > 1.12) dx -= 3.0 * (p.x - 1.12);
        float c = (abs(p.y) - 0.52) / 0.03;
        float dz = -0.07 * p.y / 1.21 - 0.0045 * exp(-c * c) * 2.0 * c / 0.03 * sign(p.y);
        return normalize(vec3(-dx, 1.0, -dz));
      }
      void main() {
        vec3 n = hoodNormal(vW.xz);
        vec3 v = normalize(uCam - vW);
        if (dot(n, v) < 0.0) n = -n;
        float NdV = max(dot(n, v), 1e-3);

        // Película PPF: cobre o capô à frente da borda (x > uFilmX). Casca de laranja leve.
        float film = uFilm * smoothstep(uFilmX - 0.0006, uFilmX + 0.0006, vW.x);
        vec3 nc = n;
        if (film > 0.0) {
          vec2 q = vW.xz * 90.0;
          nc = normalize(n + vec3(vnoise(q) - 0.5, 0.0, vnoise(q + 9.1) - 0.5) * 0.012 * film);
        }
        vec3 r = reflect(-v, nc);
        barsFootprint(r);

        // Verniz: reflexo nítido das barras de luz e do estúdio.
        float F = fresnel(NdV, 0.045) * uCoat;
        vec3 coat = (barsRadiance(vW, r, uRough) + studioAmbient(r)) * F;

        // Flocos metálicos sob o verniz (somem em média quando ficam menores que um pixel).
        // Células de 0,33 mm: com 0,67 mm, na frente do capô em 2× cada floco tinha 2 px e
        // brilhava 90 vezes mais que o vão, um chuvisco de pontos brancos em vez do brilho metálico.
        vec2 cell = vW.xz * 3000.0;
        vec2 id = floor(cell);
        vec2 h2 = hash22(id);
        float has = step(0.4, hash12(id + 3.1));
        float inF = 1.0 - smoothstep(0.2, 0.4, length(fract(cell) - 0.5));
        float px = length(fwidth(cell));
        float detail = 1.0 - smoothstep(0.35, 1.2, px);
        // flocos quase paralelos à superfície: brilham só perto dos reflexos (o brilho metálico).
        // A inclinação sorteada por célula só vale quando o floco tem pixels; menor que isso, um
        // pixel amostrava a normal de uma célula só e acendia ou não (chuvisco de pontos). Aí vale a
        // média das inclinações: o reflexo das barras espalhado pela largura do sorteio.
        vec3 fn = normalize(n + vec3(h2.x - 0.5, 0.0, h2.y - 0.5) * 0.22 * detail);
        vec3 fr = reflect(-v, fn);
        vec3 flake = barsRadiance(vW, fr, mix(0.11, 0.03, detail)) * mix(0.3, has * inF, detail) * uFlake;
        vec3 base = uBase * (barsDiffuse(vW, n) * 0.35 + uFill * (0.6 + 0.4 * n.y)) + flake * uBase * 1.6;

        // Luz de inspeção (LED pequeno): ponto quente no verniz e, em volta, os micro-riscos,
        // que acendem onde a ranhura fica perpendicular ao meio-vetor (o efeito holograma).
        // com uInspBar, a luz de inspeção é a barra 0 (a linha de luz): o ponto dela mais perto
        // do raio refletido faz o papel do LED, e os riscos acendem numa faixa em volta do reflexo
        float halo = 1.0;
        vec3 Lp = uInsp;
        if (uInspBar > 0.5) {
          vec3 bc = uBarC[0].xyz; vec3 ba = uBarA[0].xyz; float bl = uBarA[0].w;
          vec3 w0 = vW - bc; float bb = dot(r, ba); float be = dot(w0, ba);
          float tt = max((be * bb - dot(w0, r)) / max(1.0 - bb * bb, 1e-4), 0.0);
          float ss = clamp(be + tt * bb, -bl, bl);
          Lp = bc + ss * ba;
          float dd = length(w0 + tt * r - ss * ba);
          halo = exp(-dd * dd / (0.0016 + 0.02 * tt * tt * uInspSpread));
        }
        vec3 Lv = Lp - vW;
        float dl2 = max(dot(Lv, Lv), 1e-4);
        vec3 L = Lv * inversesqrt(dl2);
        vec3 H = normalize(L + v);
        float NdL = max(dot(n, L), 0.0);
        float NdH = max(dot(nc, H), 0.0);
        vec3 insp = uInspBar > 0.5 ? vec3(0.0) : uInspC * F * NdL / dl2 * (pow(NdH, 4000.0) * 6.0 + pow(NdH, 120.0) * 0.004);
        float polished = smoothstep(uPolishZ - 0.012, uPolishZ + 0.012, vW.z);
        vec4 sw = texture2D(tSwirl, vW.xz * uSwirlScale);
        float scratch = sw.b * uSwirl * (1.0 - polished) * uCoat;
        // direção: o vetor (2R−1, 2G−1) é o ângulo dobrado; volta à tangente pela metade do ângulo
        vec2 dv = sw.rg * 2.0 - 1.0;
        float dl = max(length(dv), 1e-4);
        float c2 = dv.x / dl;
        vec3 T = vec3(sqrt(max(0.5 + 0.5 * c2, 0.0)), 0.0, sign(dv.y + 1e-6) * sqrt(max(0.5 - 0.5 * c2, 0.0)));
        T = normalize(T - n * dot(T, n) + 1e-5);
        vec3 Bt = cross(n, T);
        float ht = dot(H, T), hb = dot(H, Bt), hn = max(dot(H, n), 1e-3);
        float sel = exp(-ht * ht / (0.0009 * uSwirlGain)) * (1.0 - smoothstep(0.32, 0.6, abs(hb) / hn));
        vec3 swirlC = uInspC * sel * scratch * NdL / mix(dl2, 1.0, uInspBar) * 0.32 * halo * uSwirlGain;
        // os riscos também espalham um pouco das barras (névoa no reflexo)
        if (scratch > 0.001) swirlC += barsRadiance(vW, r, 0.03) * scratch * 0.02;

        vec3 edgeC = vec3(0.0), filmC = vec3(0.0);
        if (uFilm > 0.0) {
          // borda da película: um degrau finíssimo que pega a luz
          float ew = max(0.0012, fwidth(vW.x) * 1.5);
          float edge = uFilm * (1.0 - smoothstep(0.0, ew, abs(vW.x - uFilmX)));
          // linha fina e contínua (o degrau da película pega a luz por igual)
          if (edge > 0.0) edgeC = (barsRadiance(vW, r, 0.03) * 0.25 + vec3(0.11, 0.112, 0.116)) * edge;
          // a película soma um segundo reflexo, um pouco mais suave
          filmC = barsRadiance(vW, r, uRough * 2.5) * fresnel(NdV, 0.03) * film * 0.35;
        }

        vec3 col = base * (1.0 - F) + coat + insp + swirlC + edgeC + filmC;
        gl_FragColor = vec4(col * uDim, sharpness());
      }`,
    uniforms: {
      ...lights.uniforms,
      ...shared,
      uBase: { value: new THREE.Color(0.06, 0.063, 0.07) },
      uFill: { value: 0.12 },
      uFlake: { value: 1 },
      uRough: { value: 0.0025 },
      uCoat: { value: 1 },
      tSwirl: { value: swirl },
      uSwirlScale: { value: 2.6 },
      uSwirl: { value: 0 },
      uPolishZ: { value: 9 },
      uInsp: { value: new THREE.Vector3(0, 1, 0) },
      uInspC: { value: new THREE.Color(0, 0, 0) },
      uInspBar: { value: 0 },
      uInspSpread: { value: 1 },
      uSwirlGain: { value: 1 },
      uFilm: { value: 0 },
      uFilmX: { value: 9 },
      uDim: { value: 1 },
    },
  });
}

// ——— Gotas (instâncias) ———
export function dropGeometry() {
  // calota achatada: a gota parada numa superfície tratada
  const g = new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(1, 0.62, 1);
  return g;
}


// ——— Boina de polimento (espuma) com o prato de apoio ———
export function polisher(lights, shared) {
  const group = new THREE.Group();
  const foam = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uCam; uniform vec3 uColor; uniform float uSpin;
      varying vec3 vW; varying vec3 vN; varying vec2 vUv;
      ${BARS}
      ${NOISE}
      ${DOF}
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(uCam - vW);
        if (dot(n, v) < 0.0) n = -n;
        // espuma girando: textura borrada no sentido da rotação
        float a = atan(vUv.y - 0.5, vUv.x - 0.5);
        float rr = length(vUv - 0.5);
        float foamN = fbm(vec2(a * 3.0 + uSpin, rr * 40.0)) * 0.6 + vnoise(vUv * 160.0) * 0.4;
        float d = dot(barsDiffuse(vW, n), vec3(0.333));
        vec3 col = uColor * (0.05 + d * 0.9) * (0.75 + foamN * 0.5);
        col += barsRadiance(vW, reflect(-v, n), 0.35) * 0.015;
        gl_FragColor = vec4(col, sharpness());
      }`,
    uniforms: { ...lights.uniforms, ...shared, uColor: { value: new THREE.Color(0.34, 0.025, 0.02) }, uSpin: { value: 0 } },
  });
  const plastic = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uCam; varying vec3 vW; varying vec3 vN;
      ${BARS}
      ${DOF}
      void main() {
        vec3 n = normalize(vN); vec3 v = normalize(uCam - vW);
        if (dot(n, v) < 0.0) n = -n;
        float F = fresnel(max(dot(n, v), 0.0), 0.04);
        vec3 col = vec3(0.006) * (0.2 + dot(barsDiffuse(vW, n), vec3(0.333))) + barsRadiance(vW, reflect(-v, n), 0.06) * F;
        gl_FragColor = vec4(col, sharpness());
      }`,
    uniforms: { ...lights.uniforms, ...shared },
  });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.072, 0.024, 72, 1), foam);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.01, 64, 1), plastic);
  plate.position.y = 0.017;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.07, 48, 1), plastic);
  head.position.y = 0.057;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.26, 48, 1), plastic);
  body.rotation.z = Math.PI / 2;
  body.position.set(-0.11, 0.115, 0);
  group.add(pad, plate, head, body);
  group.userData.foam = foam;
  group.userData.pad = pad;
  return group;
}

/** Material das camadas: kind = metal | primer | base | clear | film. */



// ——— Fundo do estúdio e piso ———
export function backdrop(lights, shared) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform float uLevel; varying vec3 vW;
      ${DOF}
      void main() {
        vec3 d = normalize(vW);
        float g = mix(0.0016, 0.006, smoothstep(-0.25, 0.05, d.y)) * mix(1.0, 0.55, smoothstep(0.05, 0.6, d.y));
        gl_FragColor = vec4(vec3(g) * uLevel, sharpness());
      }`,
    uniforms: { ...shared, uLevel: { value: 1 } },
    side: THREE.BackSide,
    depthWrite: false,
  }));
  sky.renderOrder = -10;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uCam; uniform float uLevel; varying vec3 vW;
      ${BARS}
      ${DOF}
      void main() {
        vec3 n = vec3(0.0, 1.0, 0.0); vec3 v = normalize(uCam - vW);
        float F = fresnel(max(dot(n, v), 0.0), 0.04);
        vec3 rf = reflect(-v, n);
        barsFootprint(rf);
        vec3 col = vec3(0.0016) + barsRadiance(vW, rf, 0.04) * F * 0.8;
        float fade = 1.0 - smoothstep(4.0, 22.0, length(vW.xz));
        gl_FragColor = vec4(col * fade * uLevel, sharpness());
      }`,
    uniforms: { ...lights.uniforms, ...shared, uLevel: { value: 1 } },
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.72;
  return { sky, floor };
}

// ——— Tipografia no espaço: números grandes no fundo ———
export function typePlane(text, shared, { h = 1.4, color = 0.05 } = {}) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 512;
  const g = cv.getContext('2d');
  const draw = () => {
    g.clearRect(0, 0, 1024, 512);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'italic 800 440px "Barlow Condensed", "Arial Narrow", sans-serif';
    // o número fica atrás do assunto e já vem fora de foco na textura (as cenas de serviço
    // não desfocam mais a imagem inteira): só a sombra desfocada do texto, desenhado fora do
    // canvas, cai dentro dele (funciona em todos os navegadores, ao contrário de ctx.filter)
    g.shadowColor = '#fff';
    g.shadowBlur = 16;
    g.shadowOffsetX = 2048;
    g.fillText(text, 512 - 2048, 270);
    g.shadowBlur = 0;
    g.shadowOffsetX = 0;
    tex.needsUpdate = true;
  };
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  draw();
  document.fonts?.ready.then(draw);
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tText; uniform float uAlpha; uniform float uColor; varying vec2 vUv;
      ${DOF}
      void main() {
        float a = texture2D(tText, vUv).a * uAlpha;
        gl_FragColor = vec4(vec3(uColor) * a, a);
      }`,
    uniforms: { ...shared, tText: { value: tex }, uAlpha: { value: 0 }, uColor: { value: color } },
  });
  // aditivo: o número é luz fraca no fundo escuro; o alfa (nitidez) fica o do fundo
  keepAlpha(m, THREE.OneFactor, THREE.OneFactor);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(h * 2, h), m);
  mesh.frustumCulled = false;
  return mesh;
}

