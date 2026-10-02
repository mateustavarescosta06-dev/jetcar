// O logo JETCAR como uma parede preta e espessa com as letras vazadas. O filme fica atrás
// dela, então vemos o vídeo DENTRO das letras com paralaxe real; a câmera recua por dentro
// de uma letra e depois atravessa outra. As bordas chanfradas pegam as barras de luz.
import * as THREE from '../../vendor/three.min.js';
import { LOGO } from '../logo-data.js';
import { BARS } from './glsl.js';

/** Converte o path (só M/L/Z) em contornos [[x, y], ...]. */
function contours(d) {
  const out = [];
  let cur = null;
  const re = /([MLZ])([^MLZ]*)/g;
  let m;
  while ((m = re.exec(d))) {
    const nums = m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (m[1] === 'M') { cur = [[nums[0], nums[1]]]; out.push(cur); for (let i = 2; i + 1 < nums.length; i += 2) cur.push([nums[i], nums[i + 1]]); }
    else if (m[1] === 'L') for (let i = 0; i + 1 < nums.length; i += 2) cur.push([nums[i], nums[i + 1]]);
  }
  return out.filter(c => c.length >= 3);
}

function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Pontos do logo (em unidades do logo) usados como alvos da câmera. */
export const LOGO_TARGETS = {
  T: { x: 486, y: 520 },      // haste do T: a câmera recua por aqui
  A: { x: 905, y: 520 },      // perna esquerda do A: a câmera entra por aqui
  base: 579,                  // pé da palavra JETCAR (para a legenda logo abaixo)
};

/**
 * Parede com as letras vazadas. Retorna a malha e a escala (unidades do mundo por unidade do logo).
 * width: largura do logo no mundo. thickness: espessura da parede.
 */
export function buildLogoWall({ width = 1, thickness = 0.03, kinds = ['emblem', 'word'] } = {}) {
  const s = width / LOGO.w;
  const cx = LOGO.w / 2, cy = LOGO.h / 2;
  const toV = ([x, y]) => new THREE.Vector2((x - cx) * s, -(y - cy) * s);
  const all = [];
  // O subtítulo do logo é pequeno demais para virar janela: ele aparece como texto da página.
  for (const p of LOGO.parts) if (kinds.includes(p.kind)) for (const c of contours(p.d)) all.push(c);
  // Profundidade de aninhamento (regra par-ímpar): par = área preenchida do logo (vira furo).
  const depth = all.map((c, i) => all.reduce((n, o, j) => n + (j !== i && inside(c[0], o) ? 1 : 0), 0));
  const W = width * 3.2, H = width * 2.4;
  const wall = new THREE.Shape([new THREE.Vector2(-W, -H), new THREE.Vector2(W, -H), new THREE.Vector2(W, H), new THREE.Vector2(-W, H)]);
  const islands = [];
  all.forEach((c, i) => {
    const pts = c.map(toV);
    if (depth[i] % 2 === 0) wall.holes.push(new THREE.Path(pts));
    else {
      const island = new THREE.Shape(pts);
      all.forEach((h, j) => { if (depth[j] === depth[i] + 1 && inside(h[0], c)) island.holes.push(new THREE.Path(h.map(toV))); });
      islands.push(island);
    }
  });
  const bevel = thickness * 0.35;
  const geo = new THREE.ExtrudeGeometry([wall, ...islands], {
    depth: thickness, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.55, bevelSegments: 3, curveSegments: 1,
  });
  // Face da frente em z = 0, espessura para trás.
  geo.translate(0, 0, -(thickness + bevel));
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, wallMaterial());
  mesh.frustumCulled = false;
  return { mesh, scale: s, center: { x: cx, y: cy }, toWorld: (x, y) => new THREE.Vector3((x - cx) * s, -(y - cy) * s, 0) };
}

function wallMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vW; varying vec3 vN;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCam; uniform float uGloss; uniform float uBase; uniform float uEdge;
      varying vec3 vW; varying vec3 vN;
      ${BARS}
      // Estúdio refletido nos chanfros (metal polido): softbox no alto, faixas nas laterais,
      // chão escuro. Varia suavemente com a direção, então as bordas brilham por inteiro.
      vec3 studioEnv(vec3 r) {
        float top = smoothstep(0.1, 0.8, r.y);
        float sx = (abs(r.x) - 0.7) / 0.25;
        float sides = exp(-sx * sx) * smoothstep(-0.6, 0.2, r.y) * 0.4;
        return vec3(1.0, 0.985, 0.96) * (top + sides) + vec3(0.004) * smoothstep(0.0, -0.8, r.y);
      }
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(uCam - vW);
        if (dot(n, v) < 0.0) n = -n;
        float edge = 1.0 - smoothstep(0.9, 0.995, abs(n.z)); // chanfros e paredes das letras
        vec3 r = reflect(-v, n);
        float F = fresnel(max(dot(n, v), 0.0), 0.04);
        vec3 spec = barsRadiance(vW, r, mix(uGloss, 0.05, edge)) * F;
        vec3 diff = barsDiffuse(vW, n) * uBase;
        vec3 c = vec3(0.0018) + diff + spec + studioAmbient(r) * F + studioEnv(r) * uEdge * edge * mix(0.3, 1.0, F);
        gl_FragColor = vec4(c, 1.0);
      }`,
    uniforms: {
      uCam: { value: new THREE.Vector3() }, uGloss: { value: 0.004 }, uBase: { value: 0.004 }, uEdge: { value: 0.3 },
      uBarC: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) },
      uBarA: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) },
      uBarI: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) },
      uBarN: { value: 0 },
      uAmbTop: { value: new THREE.Color(0.012, 0.012, 0.013) },
      uAmbBottom: { value: new THREE.Color(0.002, 0.002, 0.002) },
    },
  });
}
