// Mapa: a linha de luz do chão (fim do filme) vira a Avenida Boa Viagem vista de perto; a luz
// sai da orla e percorre o caminho até a Rua José Trajano enquanto a câmera sobe e revela o
// bairro (ruas, quadras e o mar do OpenStreetMap). O destino é um feixe de luz com o nome.
// 1 unidade = 100 m; x = leste, z = sul. Origem no ponto do link do Apple Maps.
import * as THREE from '../../vendor/three.min.js';
import { $, view, pointer, state, clamp, lerp, span, smooth, smoother, env, curve, css } from '../core.js';
import { C, at } from '../chapters.js';
import { post } from './engine.js';
import { COLOR } from './glsl.js';

const K = 0.01; // metros → unidades

function track(keys) {
  const comp = (k, i) => curve(keys.map(e => [e[0], e[k][i]]));
  const px = comp(1, 0), py = comp(1, 1), pz = comp(1, 2), tx = comp(2, 0), ty = comp(2, 1), tz = comp(2, 2);
  return (u, p, t) => { p.set(px(u), py(u), pz(u)); t.set(tx(u), ty(u), tz(u)); };
}

const FADE = /* glsl */ `
uniform vec3 uFocusP; uniform float uRadius; uniform float uFocus; uniform float uAperture;
varying float vViewZ; varying vec3 vW;
float fade() { float d = length(vW.xz - uFocusP.xz) / uRadius; return exp(-d * d * 1.6); }
float sharpness() { return 1.0 - clamp(uAperture * abs(1.0 - uFocus / max(vViewZ, 1e-4)), 0.0, 1.0); }
`;
const VERT = /* glsl */ `
attribute float aK;
varying vec3 vW; varying vec3 vN; varying float vViewZ; varying float vK;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = mat3(modelMatrix) * normal; vK = aK;
  vec4 mv = viewMatrix * w; vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

function keepAlpha(mat, src = THREE.OneFactor, dst = THREE.OneFactor) {
  Object.assign(mat, {
    transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: src, blendDst: dst,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, depthWrite: false, side: THREE.DoubleSide,
  });
  return mat;
}

/** Faixa (fita) ao longo de uma polilinha, com a distância percorrida em cada vértice (aK). */
function ribbon(pts, width, y = 0.002) {
  const pos = [], kk = [], nrm = [];
  let acc = 0;
  const L = [0];
  for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(acc); }
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1;
    const nx = (-dz / l) * width * 0.5, nz = (dx / l) * width * 0.5;
    const a = [x0 + nx, y, z0 + nz], b = [x0 - nx, y, z0 - nz], c = [x1 + nx, y, z1 + nz], d = [x1 - nx, y, z1 - nz];
    pos.push(...a, ...b, ...c, ...b, ...d, ...c);
    const k0 = L[i], k1 = L[i + 1];
    kk.push(k0, k0, k1, k0, k1, k1);
    // lado da fita (−1…1) no lugar da normal, para o perfil de brilho
    nrm.push(1, 0, 0, -1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aK', new THREE.Float32BufferAttribute(kk, 1));
  g.userData.length = acc;
  return g;
}

export class MapShot {
  constructor(quality) {
    this.quality = quality;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0, 0, 0);
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.01, 200);
    this.shared = {
      uFocusP: { value: new THREE.Vector3() }, uRadius: { value: 10 }, uFocus: { value: 4 }, uAperture: { value: 0.2 },
      uTime: { value: 0 },
    };
    this.ready = false;
    this.p = new THREE.Vector3(); this.t = new THREE.Vector3(); this.v = new THREE.Vector3();
    this.timeline();
    // rótulos
    const root = $('.labels');
    this.lblDest = Object.assign(document.createElement('div'), { className: 'lbl lbl-dest' });
    this.lblDest.innerHTML = '<i></i><b>JETCAR</b><span>Rua José Trajano</span>';
    this.lblStart = Object.assign(document.createElement('div'), { className: 'lbl lbl-left' });
    this.lblStart.innerHTML = '<i></i><b>Orla</b><span>Av. Boa Viagem</span>';
    for (const el of [this.lblDest, this.lblStart]) { el.style.display = 'none'; root.append(el); }
  }

  /** Busca os dados do mapa (em segundo plano, depois que a página carregou). */
  load() {
    if (this.loading) return this.loading;
    this.loading = fetch('assets/map.json').then(r => r.json()).then(d => { this.build(d); this.ready = true; }).catch(() => {});
    return this.loading;
  }

  build(d) {
    const low = this.quality.name === 'low';
    const S = this.shared;
    const P = arr => { const o = []; for (let i = 0; i + 1 < arr.length; i += 2) o.push([arr[i] * K, arr[i + 1] * K]); return o; };

    // chão
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: /* glsl */ `${FADE}
        void main() { gl_FragColor = vec4(vec3(0.0045, 0.0047, 0.005) * (0.25 + 0.75 * fade()), sharpness()); }`,
      uniforms: { ...S },
    }));
    ground.rotation.x = -Math.PI / 2;
    ground.geometry.setAttribute('aK', new THREE.Float32BufferAttribute(new Float32Array(ground.geometry.attributes.position.count), 1));
    this.scene.add(ground);

    // mar: escuro, com um reflexo largo e suave de luz no horizonte
    const sea = P(d.sea);
    const seaShape = new THREE.Shape(sea.map(([x, z]) => new THREE.Vector2(x, -z)));
    const seaGeo = new THREE.ShapeGeometry(seaShape);
    seaGeo.rotateX(-Math.PI / 2);
    seaGeo.setAttribute('aK', new THREE.Float32BufferAttribute(new Float32Array(seaGeo.attributes.position.count), 1));
    const seaMesh = new THREE.Mesh(seaGeo, new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: /* glsl */ `uniform vec3 uCam; uniform float uTime;
        ${FADE}
        float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
          vec3 v = normalize(uCam - vW);
          // ondulação fina: só o reflexo do céu muda
          float rip = sin(vW.x * 38.0 + vW.z * 9.0 + uTime * 0.6) * 0.5 + sin(vW.z * 51.0 - vW.x * 7.0 - uTime * 0.4) * 0.5;
          float fres = pow(1.0 - max(v.y, 0.0), 4.0);
          vec3 col = vec3(0.006, 0.008, 0.012) + vec3(0.05, 0.058, 0.07) * fres * (0.7 + 0.3 * rip);
          gl_FragColor = vec4(col * (0.35 + 0.65 * fade()), sharpness());
        }`,
      uniforms: { ...S, uCam: { value: new THREE.Vector3() } },
    }));
    seaMesh.position.y = 0.0005;
    this.seaMesh = seaMesh;
    this.scene.add(seaMesh);

    // linha da costa (a orla) e a faixa de areia do lado de terra
    const coast = P(d.coast);
    const sandPts = coast.map(([x, z]) => [x - 0.28, z]);
    const sg = ribbon(sandPts, 0.5, 0.0008);
    this.scene.add(new THREE.Mesh(sg, new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: /* glsl */ `${FADE} varying vec3 vN; void main() { float e = 1.0 - abs(vN.x) * 0.5; gl_FragColor = vec4(vec3(0.03, 0.027, 0.022) * e * (0.3 + 0.7 * fade()), sharpness()); }`,
      uniforms: { ...S },
      side: THREE.DoubleSide,
    })));
    const cg = new THREE.BufferGeometry().setFromPoints(coast.map(([x, z]) => new THREE.Vector3(x, 0.002, z)));
    cg.setAttribute('aK', new THREE.Float32BufferAttribute(new Float32Array(coast.length), 1));
    cg.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(coast.length * 3), 3));
    this.scene.add(new THREE.Line(cg, keepAlpha(new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: /* glsl */ `${FADE} void main() { gl_FragColor = vec4(vec3(0.16, 0.15, 0.13) * fade(), 1.0); }`,
      uniforms: { ...S },
    }))));

    // ruas (segmentos de linha, mais claras as principais)
    const tone = { major: 0.09, minor: 0.05, service: 0.022 };
    for (const [cls, lines] of Object.entries(d.streets)) {
      if (low && cls === 'service') continue;
      const pos = [];
      for (const l of lines) for (let i = 0; i + 3 < l.length; i += 2) pos.push(l[i] * K, 0.001, l[i + 1] * K, l[i + 2] * K, 0.001, l[i + 3] * K);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
      g.setAttribute('aK', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3), 1));
      const m = keepAlpha(new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: /* glsl */ `uniform float uTone; ${FADE} void main() { gl_FragColor = vec4(vec3(uTone) * fade(), 1.0); }`,
        uniforms: { ...S, uTone: { value: tone[cls] } },
      }));
      this.scene.add(new THREE.LineSegments(g, m));
    }

    // quadras: prédios com altura baixa (volume para a luz rasante; não representa a altura real)
    const pos = [], nrm = [];
    const v2 = (x, z) => new THREE.Vector2(x, z);
    for (const b of d.buildings) {
      const pts = P(b);
      if (pts.length < 3) continue;
      let area = 0;
      for (let i = 0; i < pts.length; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length]; area += x0 * z1 - x1 * z0; }
      if (Math.abs(area) < 1e-6) continue;
      const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      const hh = 0.035 + (Math.abs(Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453) % 1) * 0.06;
      const contour = pts.map(([x, z]) => v2(x, z));
      const tris = THREE.ShapeUtils.triangulateShape(contour, []);
      for (const t of tris) {
        const [a, b, c] = t.map(i => pts[i]);
        // topo voltado para cima (+y)
        const up = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) > 0;
        for (const q of up ? [a, b, c] : [a, c, b]) { pos.push(q[0], hh, q[1]); nrm.push(0, 1, 0); }
      }
      if (low) continue;
      for (let i = 0; i < pts.length; i++) {
        const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length];
        let nx = z1 - z0, nz = -(x1 - x0);
        if (area < 0) { nx = -nx; nz = -nz; }
        const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
        const q = [[x0, 0, z0], [x1, 0, z1], [x1, hh, z1], [x0, hh, z0]];
        const order = area > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
        for (const k of order) { pos.push(...q[k]); nrm.push(nx, 0, nz); }
      }
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bg.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    bg.setAttribute('aK', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3), 1));
    this.blocks = new THREE.Mesh(bg, new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: /* glsl */ `uniform vec3 uSun; uniform float uGlow; uniform vec3 uGlowP;
        ${FADE}
        varying vec3 vN;
        void main() {
          vec3 n = normalize(vN);
          float key = max(dot(n, uSun), 0.0);
          float top = step(0.5, n.y);
          vec3 col = vec3(0.011, 0.0115, 0.013) * (0.55 + 0.45 * top) + vec3(0.055, 0.05, 0.045) * key * (1.0 - top) + vec3(0.012) * key * top;
          // a luz do destino ilumina as quadras em volta
          float gd = length(vW.xz - uGlowP.xz);
          col += vec3(0.5, 0.06, 0.05) * uGlow * exp(-gd * gd * 9.0) * (0.25 + 0.75 * (1.0 - top));
          gl_FragColor = vec4(col * (0.2 + 0.8 * fade()), sharpness());
        }`,
      uniforms: { ...S, uSun: { value: new THREE.Vector3(-0.75, 0.35, -0.55).normalize() }, uGlow: { value: 0 }, uGlowP: { value: new THREE.Vector3() } },
      side: THREE.DoubleSide,
    }));
    this.scene.add(this.blocks);

    // a rota: fita de luz que se desenha do começo ao fim
    // a rota termina na rua, em frente ao ponto do link (o feixe marca o ponto em si)
    const route = P(d.route);
    if (d.routeEnd) route.push([d.routeEnd[0] * K, d.routeEnd[1] * K]);
    this.routePts = route;
    const rg = ribbon(route, 0.07, 0.004);
    this.routeLen = rg.userData.length;
    this.routeMat = keepAlpha(new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: /* glsl */ `uniform float uDraw; uniform float uLen; uniform vec3 uColor; uniform float uI;
        varying float vK; varying vec3 vN;
        void main() {
          float side = abs(vN.x);
          float core = exp(-side * side * 10.0);
          float drawn = 1.0 - smoothstep(uDraw - 0.02, uDraw + 0.002, vK);
          float head = exp(-pow(max(uDraw - vK, 0.0) / 0.12, 2.0)) * drawn;
          vec3 c = uColor * (0.5 * core + 0.18) * drawn + vec3(1.0, 0.9, 0.85) * head * core * 2.0;
          gl_FragColor = vec4(c * uI, 1.0);
        }`,
      uniforms: { uDraw: { value: 0 }, uLen: { value: this.routeLen }, uColor: { value: new THREE.Color(2.4, 0.22, 0.16) }, uI: { value: 1 } },
    }));
    this.route = new THREE.Mesh(rg, this.routeMat);
    this.route.frustumCulled = false;
    this.scene.add(this.route);

    // a luz da orla (a mesma linha do fim do filme): um trecho reto da avenida em volta do início
    const s0 = route[0];
    const av = [1902 * K - -667 * K, -3165 * K - 2778 * K];
    const al = Math.hypot(av[0], av[1]);
    this.avDir = [av[0] / al, av[1] / al];
    const ag = ribbon([[s0[0] - this.avDir[0] * 6, s0[1] - this.avDir[1] * 6], [s0[0] + this.avDir[0] * 6, s0[1] + this.avDir[1] * 6]], 0.05, 0.005);
    this.avMat = keepAlpha(new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: /* glsl */ `uniform float uI; varying vec3 vN; varying float vK;
        void main() {
          float side = abs(vN.x);
          float along = smoothstep(0.0, 3.0, vK) * smoothstep(12.0, 9.0, vK);
          gl_FragColor = vec4(vec3(1.0, 0.95, 0.9) * exp(-side * side * 6.0) * along * uI, 1.0);
        }`,
      uniforms: { uI: { value: 0 } },
    }));
    this.avLine = new THREE.Mesh(ag, this.avMat);
    this.avLine.frustumCulled = false;
    this.scene.add(this.avLine);

    // destino: feixe de luz vertical (sempre de frente para a câmera) e um anel no chão
    const beamGeo = new THREE.PlaneGeometry(0.16, 2.4);
    beamGeo.translate(0, 1.2, 0);
    this.beamMat = keepAlpha(new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform float uI; varying vec2 vUv;
        void main() {
          float x = abs(vUv.x - 0.5) * 2.0;
          float core = exp(-x * x * 60.0), halo = exp(-x * x * 5.0) * 0.25;
          float up = pow(1.0 - vUv.y, 1.6);
          gl_FragColor = vec4(vec3(2.6, 0.35, 0.28) * (core * 1.5 + halo) * up * uI + vec3(1.0) * core * up * up * uI, 1.0);
        }`,
      uniforms: { uI: { value: 0 } },
    }));
    this.beam = new THREE.Mesh(beamGeo, this.beamMat);
    this.beam.frustumCulled = false;
    this.dest = new THREE.Vector3(d.dest[0] * K, 0, d.dest[1] * K);
    this.beam.position.copy(this.dest);
    this.scene.add(this.beam);
    this.blocks.material.uniforms.uGlowP.value.copy(this.dest);
    this.startP = new THREE.Vector3(route[0][0], 0, route[0][1]);
  }

  timeline() {
    const k = (t, p, q) => [at('rota', t), p, q];
    // início: rente à orla, olhando para dentro do bairro; a avenida cruza a tela na horizontal
    this.path = track([
      k(0.0, [5.98, 0.34, 0.26], [3.22, 0.34, -0.94]),
      k(0.08, [5.9, 0.4, 0.45], [3.3, 0.12, -0.8]),
      k(0.22, [5.4, 1.2, 2.1], [2.8, 0.0, -0.45]),
      k(0.42, [4.3, 2.5, 4.2], [2.3, 0.0, -0.2]),
      k(0.62, [3.4, 3.4, 5.4], [2.2, 0.0, -0.05]),
      k(0.82, [2.9, 3.7, 5.9], [2.15, 0.0, 0.0]),
      k(1.0, [2.6, 3.8, 6.1], [2.1, 0.0, 0.05]),
    ]);
  }

  resize() {
    const cam = this.camera;
    cam.aspect = view.w / view.h;
    cam.fov = view.portrait ? clamp((2 * Math.atan(Math.tan((19 * Math.PI) / 180) / cam.aspect) * 180) / Math.PI, 34, 64) : 34;
    cam.updateProjectionMatrix();
  }

  leave() { this.labels(0); }

  labels(a) {
    const on = a > 0.01 && this.ready;
    if (on !== this.lblOn) { this.lblOn = on; for (const el of [this.lblDest, this.lblStart]) el.style.display = on ? '' : 'none'; }
    if (!on) return;
    const place = (el, p, ai, left = false) => {
      this.v.copy(p).project(this.camera);
      const x = (this.v.x * 0.5 + 0.5) * view.w, y = (0.5 - this.v.y * 0.5) * view.h;
      css(el, 'transform', `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(${left ? '-100%' : '0'}, -50%)`);
      css(el, 'opacity', (this.v.z < 1 ? ai : 0).toFixed(3));
    };
    place(this.lblDest, this.v2 || (this.v2 = new THREE.Vector3()).copy(this.dest).setY(0.32), a * this.destA);
    place(this.lblStart, this.v3 || (this.v3 = new THREE.Vector3()).copy(this.startP).setY(0.05), a * this.startA, true);
  }

  update(u, dt) {
    if (!this.ready) { this.load(); post.black = 1; this.labels(0); return; }
    const cam = this.camera;
    const t = span(u, C.rota.start, C.rota.end);
    this.path(u, this.p, this.t);
    const dist = this.p.distanceTo(this.t);
    const k = state.reduce ? 0 : dist * 0.012;
    this.v.subVectors(this.t, this.p).normalize();
    const right = new THREE.Vector3().crossVectors(this.v, cam.up).normalize();
    cam.position.copy(this.p).addScaledVector(right, pointer.sx * k).addScaledVector(cam.up, -pointer.sy * k * 0.5);
    cam.lookAt(this.t);
    const S = this.shared;
    S.uFocusP.value.copy(this.t);
    S.uRadius.value = 2.2 + dist * 1.1;
    S.uFocus.value = dist;
    S.uAperture.value = 0.18;
    S.uTime.value = state.now / 1000;
    this.seaMesh.material.uniforms.uCam.value.copy(cam.position);

    // a luz da orla (continua a linha do filme) e a rota que sai dela
    this.avMat.uniforms.uI.value = (1 - smooth(span(t, 0.1, 0.3))) * 3.2 + 0.25;
    const draw = smoother(span(t, 0.08, 0.6));
    this.routeMat.uniforms.uDraw.value = draw * this.routeLen;
    this.routeMat.uniforms.uI.value = 1;
    const arrive = smooth(span(t, 0.52, 0.66));
    this.beamMat.uniforms.uI.value = arrive * (0.85 + 0.15 * Math.sin(state.now / 700));
    this.beam.quaternion.copy(cam.quaternion);
    // feixe vertical: gira só em torno de y
    const yaw = Math.atan2(cam.position.x - this.dest.x, cam.position.z - this.dest.z);
    this.beam.rotation.set(0, yaw, 0);
    this.blocks.material.uniforms.uGlow.value = arrive * 0.6;
    this.destA = arrive;
    this.startA = env(t, [0.14, 0.24, 0.5, 0.62]);
    this.labels(1);

    // entra do preto (o corte vem da linha de luz do chão)
    post.exposure = smooth(span(t, 0.0, 0.06)) * 0.85 + 0.15;
    post.black = 0;
    post.bloom = 0.7;
    post.threshold = 0.85;
    post.knee = 0.5;
    post.vignette = 0.65;
    post.grain = view.mobile ? 0.03 : 0.035;
    post.dof = 0.8;
  }
}
