// Peças do estúdio 3D: o capô (superfície paramétrica com vinco), a pintura automotiva
// (base metálica com flocos, verniz que reflete as barras de luz, micro-riscos que só aparecem
// sob a luz de inspeção, película PPF com borda), gotas que refratam, a boina da politriz, as
// camadas da pintura em vista explodida, o vidro e o interior em relevo (2,5D).
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
// R,G = direção do risco (tangente), B = presença. Arcos em volta de vários centros, como a
// marca de uma politriz rotativa, e alguns riscos retos de lavagem.
export function swirlTexture(size = 1024, seed = 11) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  const R = rng(seed);
  g.lineCap = 'round';
  const seg = (x0, y0, x1, y1, w, a) => {
    const tx = x1 - x0, ty = y1 - y0, l = Math.hypot(tx, ty) || 1;
    const r = Math.round(((tx / l) * 0.5 + 0.5) * 255), gg = Math.round(((ty / l) * 0.5 + 0.5) * 255);
    g.strokeStyle = `rgb(${r},${gg},${Math.round(a * 255)})`;
    g.lineWidth = w;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  };
  for (let k = 0; k < 14; k++) {
    const cx = R() * size, cy = R() * size;
    for (let i = 0; i < 150; i++) {
      const rad = 6 + R() * size * 0.42;
      const a0 = R() * Math.PI * 2;
      const len = Math.min(Math.PI * 1.2, (18 + R() * 120) / rad);
      const steps = Math.max(3, Math.ceil(len * rad / 6));
      const w = 0.6 + R() * 0.9, a = 0.45 + R() * 0.55;
      let px = cx + Math.cos(a0) * rad, py = cy + Math.sin(a0) * rad;
      for (let s = 1; s <= steps; s++) {
        const an = a0 + (len * s) / steps;
        const qx = cx + Math.cos(an) * rad, qy = cy + Math.sin(an) * rad;
        // repete nas bordas para a textura ladrilhar sem emenda
        for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
          if (Math.min(px, qx) + ox > size + 2 || Math.max(px, qx) + ox < -2 || Math.min(py, qy) + oy > size + 2 || Math.max(py, qy) + oy < -2) continue;
          seg(px + ox, py + oy, qx + ox, qy + oy, w, a);
        }
        px = qx; py = qy;
      }
    }
  }
  for (let i = 0; i < 120; i++) {
    const x = R() * size, y = R() * size, an = R() * Math.PI, l = 20 + R() * 90;
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
  set(i, c, a, hw, hl, color, soft = 0.002, visible = true) {
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
    m.material.uniforms.uColor.value.setRGB(color[0], color[1], color[2]);
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
      uniform vec3 uInsp; uniform vec3 uInspC;
      uniform float uFilm; uniform float uFilmX;
      uniform float uDim; uniform float uFill;
      varying vec3 vW; varying vec3 vN; varying vec2 vUv;
      ${BARS}
      ${NOISE}
      ${DOF}
      void main() {
        vec3 n = normalize(vN);
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

        // Verniz: reflexo nítido das barras de luz e do estúdio.
        float F = fresnel(NdV, 0.045) * uCoat;
        vec3 coat = (barsRadiance(vW, r, uRough) + studioAmbient(r)) * F;

        // Flocos metálicos sob o verniz (somem em média quando ficam menores que um pixel).
        vec2 cell = vW.xz * 1500.0;
        vec2 id = floor(cell);
        vec2 h2 = hash22(id);
        float has = step(0.4, hash12(id + 3.1));
        float inF = 1.0 - smoothstep(0.2, 0.4, length(fract(cell) - 0.5));
        float px = length(fwidth(cell));
        float detail = 1.0 - smoothstep(0.35, 1.2, px);
        // flocos quase paralelos à superfície: brilham só perto dos reflexos (o brilho metálico)
        vec3 fn = normalize(n + vec3(h2.x - 0.5, 0.0, h2.y - 0.5) * 0.22);
        vec3 fr = reflect(-v, fn);
        vec3 flake = barsRadiance(vW, fr, 0.03) * mix(0.3, has * inF, detail) * uFlake;
        vec3 base = uBase * (barsDiffuse(vW, n) * 0.35 + uFill * (0.6 + 0.4 * n.y)) + flake * uBase * 1.6;

        // Luz de inspeção (LED pequeno): ponto quente no verniz e, em volta, os micro-riscos,
        // que acendem onde a ranhura fica perpendicular ao meio-vetor (o efeito holograma).
        vec3 Lv = uInsp - vW;
        float dl2 = max(dot(Lv, Lv), 1e-4);
        vec3 L = Lv * inversesqrt(dl2);
        vec3 H = normalize(L + v);
        float NdL = max(dot(n, L), 0.0);
        float NdH = max(dot(nc, H), 0.0);
        vec3 insp = uInspC * F * NdL / dl2 * (pow(NdH, 4000.0) * 6.0 + pow(NdH, 120.0) * 0.004);
        float polished = smoothstep(uPolishZ - 0.012, uPolishZ + 0.012, vW.z);
        vec4 sw = texture2D(tSwirl, vW.xz * uSwirlScale);
        float scratch = sw.b * uSwirl * (1.0 - polished) * uCoat;
        vec3 T = vec3(sw.r * 2.0 - 1.0, 0.0, sw.g * 2.0 - 1.0);
        T = normalize(T - n * dot(T, n) + 1e-5);
        vec3 Bt = cross(n, T);
        float ht = dot(H, T), hb = dot(H, Bt), hn = max(dot(H, n), 1e-3);
        float sel = exp(-ht * ht / 0.0009) * (1.0 - smoothstep(0.32, 0.6, abs(hb) / hn));
        vec3 swirlC = uInspC * sel * scratch * NdL / dl2 * 0.32;
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

export function dropMaterial(lights, shared) {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vW; varying vec3 vN; varying vec3 vC; varying float vR; varying float vViewZ;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vec4 c = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vC = c.xyz; vR = length((modelMatrix * instanceMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
        vW = w.xyz;
        vec4 mv = viewMatrix * w; vViewZ = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCam; uniform vec3 uPaint; uniform vec2 uKeyDir; uniform vec3 uKeyC; uniform float uDim;
      varying vec3 vW; varying vec3 vN; varying vec3 vC; varying float vR;
      ${BARS}
      ${DOF}
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(uCam - vW);
        float NdV = max(dot(n, v), 1e-3);
        float F = fresnel(NdV, 0.02);
        vec3 r = reflect(-v, n);
        vec3 refl = barsRadiance(vW, r, 0.0012) + studioAmbient(r) * 1.5;
        // refração: através da gota vemos a pintura escura, e a luz que a gota concentra
        // aparece do lado oposto ao da luz principal
        vec3 t = refract(-v, n, 0.75);
        vec3 lp = (vW - vC) / max(vR, 1e-5);
        vec2 hit = lp.xz + t.xz * (lp.y / max(-t.y, 0.25));
        float ring = 1.0 - smoothstep(0.5, 1.0, length(hit));
        float caust = smoothstep(0.2, 0.9, dot(hit, uKeyDir)) * ring;
        vec3 below = uPaint * (0.25 + 0.5 * ring) + uKeyC * caust * caust;
        vec3 col = below * (1.0 - F) + refl * F;
        gl_FragColor = vec4(col * uDim, sharpness());
      }`,
    uniforms: {
      ...lights.uniforms,
      ...shared,
      uPaint: { value: new THREE.Color(0.008, 0.0085, 0.0095) },
      uKeyDir: { value: new THREE.Vector2(-0.7, 0.2).normalize() },
      uKeyC: { value: new THREE.Color(0.9, 0.9, 0.92) },
      uDim: { value: 1 },
    },
  });
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

// ——— Camadas da pintura (vista explodida) ———
function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function slabGeometry(w, d, t) {
  const bevel = Math.min(t * 0.3, 0.0016);
  const g = new THREE.ExtrudeGeometry(roundedRect(w, d, 0.028), { depth: t - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 });
  g.translate(0, 0, bevel);
  g.rotateX(-Math.PI / 2); // espessura para cima (y)
  return g;
}

/** Material das camadas: kind = metal | primer | base | clear | film. */
export function layerMaterial(kind, lights, shared) {
  const transparent = kind === 'clear' || kind === 'film';
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uCam; uniform float uKind; uniform float uDim; uniform float uGlow;
      varying vec3 vW; varying vec3 vN; varying vec2 vUv;
      ${BARS}
      ${NOISE}
      ${DOF}
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(uCam - vW);
        if (dot(n, v) < 0.0) n = -n;
        float NdV = max(dot(n, v), 1e-3);
        vec3 r = reflect(-v, n);
        vec3 col; float a = 1.0;
        float side = 1.0 - smoothstep(0.7, 0.95, abs(n.y)); // bordas da placa
        if (uKind < 0.5) {
          // estrutura: metal escovado (riscos finos no comprimento)
          float brush = vnoise(vec2(vW.x * 30.0, vW.z * 2400.0)) * 0.5 + vnoise(vec2(vW.x * 8.0, vW.z * 900.0)) * 0.5;
          vec3 f0 = vec3(0.46, 0.47, 0.49) * (0.82 + brush * 0.3);
          vec3 F = f0 + (1.0 - f0) * pow(1.0 - NdV, 5.0);
          col = (barsRadiance(vW, r, 0.05 + brush * 0.03) + studioAmbient(r) * 2.0) * F + barsDiffuse(vW, n) * 0.01;
        } else if (uKind < 1.5) {
          // primer: fosco, cinza claro
          float F = fresnel(NdV, 0.03);
          col = vec3(0.07, 0.07, 0.068) * (barsDiffuse(vW, n) * 0.4 + 0.06) + barsRadiance(vW, r, 0.25) * F * 0.3;
        } else if (uKind < 2.5) {
          // cor: base metálica grafite (flocos)
          vec2 cell = vW.xz * 900.0; vec2 id = floor(cell); vec2 h2 = hash22(id);
          float has = step(0.45, hash12(id + 3.1));
          float detail = 1.0 - smoothstep(0.35, 1.2, length(fwidth(cell)));
          vec3 fn = normalize(n + vec3(h2.x - 0.5, 0.0, h2.y - 0.5) * 0.9);
          vec3 flake = barsRadiance(vW, reflect(-v, fn), 0.05) * mix(0.25, has, detail);
          col = vec3(0.016, 0.017, 0.019) * (barsDiffuse(vW, n) * 0.6 + 0.04) + flake * vec3(0.016, 0.017, 0.019) * 12.0;
          col += barsRadiance(vW, r, 0.12) * fresnel(NdV, 0.02) * 0.3;
        } else if (uKind < 3.5) {
          // verniz: transparente, reflexo nítido; as bordas brilham (Fresnel rasante)
          float F = fresnel(NdV, 0.045);
          col = (barsRadiance(vW, r, 0.002) + studioAmbient(r)) * F + vec3(0.004, 0.0045, 0.005) * side;
          a = clamp(0.1 + F * 0.9 + side * 0.25, 0.0, 1.0);
        } else {
          // proteção (coating/PPF): película finíssima com leve iridescência
          float F = fresnel(NdV, 0.04);
          vec3 iri = 0.88 + 0.12 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + 1.6 / max(NdV, 0.2)));
          col = (barsRadiance(vW, r, 0.004) + studioAmbient(r)) * F * iri + vec3(0.006, 0.0035, 0.0035) * side * uGlow;
          a = clamp(0.06 + F * 0.9 + side * 0.3, 0.0, 1.0);
        }
        col *= uDim;
        gl_FragColor = ${transparent ? 'vec4(col, a)' : 'vec4(col, sharpness())'};
      }`,
    uniforms: { ...lights.uniforms, ...shared, uKind: { value: ['metal', 'primer', 'base', 'clear', 'film'].indexOf(kind) }, uDim: { value: 1 }, uGlow: { value: 1 } },
  });
  // transparentes: cor = reflexo + fundo × (1 − a); o alfa (nitidez) do que está atrás fica intacto
  if (transparent) keepAlpha(m);
  return m;
}

// ——— Vidro (para-brisa) ———
export function glassMaterial(lights, shared) {
  return keepAlpha(new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uCam; uniform float uReflect; uniform float uTint;
      varying vec3 vW; varying vec3 vN;
      ${BARS}
      void main() {
        vec3 n = normalize(vN); vec3 v = normalize(uCam - vW);
        if (dot(n, v) < 0.0) n = -n;
        float F = fresnel(max(dot(n, v), 0.0), 0.04);
        vec3 refl = (barsRadiance(vW, reflect(-v, n), 0.0015) + studioAmbient(reflect(-v, n)) * 3.0) * F * uReflect;
        // a = quanto do fundo é coberto (reflexo + um pouco de absorção do vidro)
        float a = clamp(F * uReflect + uTint, 0.0, 1.0);
        gl_FragColor = vec4(refl, a);
      }`,
    uniforms: { ...lights.uniforms, ...shared, uReflect: { value: 1 }, uTint: { value: 0.12 } },
    side: THREE.DoubleSide,
  }));
}

// ——— Interior em relevo: foto + mapa de profundidade deslocando uma malha ———
export function interiorMesh(shared, colorTex, depthTex, w = 2.1, h = 1.4) {
  const g = new THREE.PlaneGeometry(w, h, 240, 160);
  const m = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      uniform sampler2D tDepth; uniform float uDepth;
      varying vec2 vUv; varying float vViewZ; varying float vD;
      void main() {
        vUv = uv;
        float d = texture2D(tDepth, uv).r;
        vD = d;
        vec3 p = position + vec3(0.0, 0.0, d * uDepth);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vViewZ = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tColor; uniform float uExposure; uniform float uLight; uniform float uLightX;
      varying vec2 vUv; varying float vD;
      ${COLOR}
      ${DOF}
      void main() {
        vec3 c = srgbToLinear(texture2D(tColor, vUv).rgb);
        // uma luz de inspeção passa pelo interior (realça bancos e costuras)
        float gx = (vUv.x - uLightX) / 0.12;
        float g = exp(-gx * gx);
        c *= uExposure * (1.0 + uLight * g * 1.6 * smoothstep(0.2, 0.7, vD));
        gl_FragColor = vec4(c, sharpness());
      }`,
    uniforms: { ...shared, tColor: { value: colorTex }, tDepth: { value: depthTex }, uDepth: { value: 0.55 }, uExposure: { value: 1 }, uLight: { value: 0 }, uLightX: { value: -1 } },
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
}

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
        vec3 col = vec3(0.0016) + barsRadiance(vW, reflect(-v, n), 0.04) * F * 0.8;
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
    g.fillText(text, 512, 270);
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

// ——— Fibra de carbono (acabamento do painel, logo atrás do para-brisa) ———
// Trama sarja 2×2: cada mecha é um feixe de fibras numa direção; o brilho das fibras segue o
// modelo de Kajiya-Kay (acende quando o meio-vetor fica perpendicular à fibra), então as
// mechas trocam de brilho em xadrez conforme a luz anda. Por cima, a resina com verniz.
export function carbonMaterial(lights, shared) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uCam; uniform vec2 uTows; uniform float uDim;
      varying vec3 vW; varying vec3 vN; varying vec2 vUv;
      ${BARS}
      ${DOF}
      // brilho de fibra para as barras de luz: amostra o ponto de cada barra mais perto do pixel
      float fiber(vec3 T, vec3 n, vec3 v, vec3 p) {
        float acc = 0.0;
        for (int i = 0; i < MAX_BARS; i++) {
          if (i >= uBarN) break;
          vec3 c = uBarC[i].xyz; vec3 a = uBarA[i].xyz; float l = uBarA[i].w;
          vec3 q = c + clamp(dot(p - c, a), -l, l) * a;
          vec3 L = normalize(q - p);
          vec3 H = normalize(L + v);
          float th = dot(T, H);
          float s = pow(max(1.0 - th * th, 0.0), 160.0);
          acc += s * max(dot(n, L), 0.0) * dot(uBarI[i].rgb, vec3(0.333)) / (1.0 + dot(q - p, q - p));
        }
        return acc;
      }
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(uCam - vW);
        if (dot(n, v) < 0.0) n = -n;
        vec2 g = vUv * uTows;
        vec2 cell = floor(g), f = fract(g);
        // sarja 2×2: a mecha de cima alterna a cada duas células, deslocando uma por linha
        float warp = step(mod(cell.x + cell.y, 4.0), 1.5);
        // direção das fibras no espaço do mundo (u → x, v → z neste painel)
        vec3 Tu = normalize(vec3(1.0, 0.0, 0.0) - n * n.x);
        vec3 Tv = normalize(vec3(0.0, 0.0, 1.0) - n * n.z);
        vec3 T = mix(Tv, Tu, warp);
        // perfil arredondado de cada mecha (atravessando as fibras) e o sobe-desce da trama
        float across = warp > 0.5 ? f.y : f.x;
        float along = warp > 0.5 ? f.x : f.y;
        float bulge = sin(across * 3.14159) * (0.75 + 0.25 * sin(along * 3.14159));
        vec3 nb = normalize(n + (warp > 0.5 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0)) * (across - 0.5) * 0.5);
        float fib = fiber(T, nb, v, vW) * bulge;
        vec3 base = vec3(0.006, 0.0062, 0.0068) * (0.6 + 0.4 * bulge);
        // resina com verniz por cima: reflexo nítido das barras
        vec3 r = reflect(-v, n);
        float F = fresnel(max(dot(n, v), 0.0), 0.045);
        vec3 coat = (barsRadiance(vW, r, 0.002) + studioAmbient(r)) * F;
        vec3 col = base + vec3(0.2, 0.205, 0.215) * fib + coat;
        gl_FragColor = vec4(col * uDim, sharpness());
      }`,
    uniforms: { ...lights.uniforms, ...shared, uTows: { value: new THREE.Vector2(84, 220) }, uDim: { value: 1 } },
  });
}
