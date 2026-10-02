// Estúdio 3D: depois do mergulho na pintura, a câmera fica rente ao capô (cena real em 3D,
// não um vídeo). Correção (luz de inspeção revela os micro-riscos; a boina da politriz passa
// na frente da lente e deixa a pintura corrigida), Ceramic Coating (uma luz atravessa o verniz,
// as gotas se formam e uma delas toma a tela), camadas da pintura em vista explodida, PPF
// (gotas se formam e escorrem; a película corre pelo capô) e o vidro: a câmera atravessa o
// para-brisa e entra no interior, uma foto com profundidade real.
import * as THREE from '../../vendor/three.min.js';
import { $, view, pointer, state, clamp, lerp, span, smooth, smoother, env, curve, rng, css } from '../core.js';
import { C, at } from '../chapters.js';
import { post } from './engine.js';
import {
  hoodY, hoodN, hoodGeometry, swirlTexture, StudioLights, sharedUniforms, paintMaterial, dropGeometry, dropMaterial,
  polisher, slabGeometry, layerMaterial, glassMaterial, interiorMesh, backdrop, typePlane, carbonMaterial,
} from './studio.js';

/** Trilha de câmera: posição e alvo interpolados por curvas monótonas (sem paradas nas chaves). */
function track(keys) {
  const comp = (k, i) => curve(keys.map(e => [e[0], e[k][i]]));
  const px = comp(1, 0), py = comp(1, 1), pz = comp(1, 2), tx = comp(2, 0), ty = comp(2, 1), tz = comp(2, 2);
  return (u, p, t) => { p.set(px(u), py(u), pz(u)); t.set(tx(u), ty(u), tz(u)); };
}

const LAYERS = [
  { kind: 'metal', t: 0.011, name: 'Estrutura', note: 'a chapa da carroceria' },
  { kind: 'primer', t: 0.006, name: 'Primer', note: 'prepara a chapa para a tinta' },
  { kind: 'base', t: 0.006, name: 'Cor', note: 'a tinta que dá a cor' },
  { kind: 'clear', t: 0.006, name: 'Verniz', note: 'camada transparente, o brilho' },
  { kind: 'film', t: 0.004, name: 'Proteção', note: 'Ceramic Coating ou PPF' },
];

// ponto da pintura onde a câmera mergulha numa gota e de onde sai a vista explodida
const SPOT = { x: 0.45, z: 0.05 };

export class StudioShot {
  constructor(quality) {
    this.quality = quality;
    const low = quality.name === 'low';
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0, 0, 0);
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.003, 80);
    this.lights = new StudioLights();
    this.shared = sharedUniforms();
    this.scene.add(this.lights.group);

    const { sky, floor } = backdrop(this.lights, this.shared);
    this.sky = sky; this.floor = floor;
    this.scene.add(sky, floor);

    // capô
    this.swirl = swirlTexture(low ? 768 : 1024);
    this.paint = paintMaterial(this.lights, this.shared, this.swirl);
    this.hood = new THREE.Mesh(hoodGeometry(low ? 220 : 320, low ? 150 : 220), this.paint);
    this.scene.add(this.hood);

    // gotas: as do coating (muitas, paradas) e as que escorrem no PPF
    const R = rng(29);
    const dropGeo = dropGeometry();
    this.beadMat = dropMaterial(this.lights, this.shared);
    const nB = low ? 420 : 900;
    this.beads = new THREE.InstancedMesh(dropGeo, this.beadMat, nB);
    this.beads.frustumCulled = false;
    this.beadData = [];
    for (let i = 0; i < nB; i++) {
      // mais densas perto do ponto em que a câmera desce
      const near = i < nB * 0.45;
      const x = near ? SPOT.x + (R() - 0.5) * 0.36 : -0.3 + R() * 1.5;
      const z = near ? SPOT.z + (R() - 0.5) * 0.3 : -0.7 + R() * 1.4;
      const r = 0.0012 + R() ** 2.2 * 0.0042;
      this.beadData.push({ x, z, r, b: R() });
    }
    // a gota em que a câmera entra
    this.beadData[0] = { x: SPOT.x, z: SPOT.z, r: 0.0058, b: 0.1 };
    // nenhuma outra gota encostada nela
    for (let i = 1; i < nB; i++) { const d = this.beadData[i]; if (Math.hypot(d.x - SPOT.x, d.z - SPOT.z) < 0.016) d.r = 0; }
    this.scene.add(this.beads);

    this.runMat = dropMaterial(this.lights, this.shared);
    const nR = low ? 40 : 70;
    this.runners = new THREE.InstancedMesh(dropGeo, this.runMat, nR);
    this.runners.frustumCulled = false;
    this.runData = [];
    for (let i = 0; i < nR; i++) this.runData.push({ x: 0.2 + R() * 0.6, z: -0.33 + R() * 0.56, r: 0.0035 + R() ** 1.5 * 0.0055, b: R(), a: 0.5 + R() * 0.7 });
    this.scene.add(this.runners);
    this.tmpM = new THREE.Matrix4(); this.tmpQ = new THREE.Quaternion(); this.tmpQ2 = new THREE.Quaternion(); this.tmpS = new THREE.Vector3(); this.tmpP = new THREE.Vector3(); this.tmpN = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);

    // politriz
    this.pol = polisher(this.lights, this.shared);
    this.scene.add(this.pol);

    // LED da luz de inspeção (um ponto de luz que a câmera vê, fora de foco)
    this.led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(30, 29, 27) }));
    this.scene.add(this.led);

    // camadas
    this.stack = new THREE.Group();
    this.slabs = LAYERS.map(L => {
      const m = new THREE.Mesh(slabGeometry(0.36, 0.24, L.t), layerMaterial(L.kind, this.lights, this.shared));
      m.renderOrder = L.kind === 'clear' || L.kind === 'film' ? 2 : 0;
      this.stack.add(m);
      return m;
    });
    this.stack.position.set(SPOT.x, 0, SPOT.z);
    this.scene.add(this.stack);

    // vidro (para-brisa inclinado no fim do capô) e o interior atrás dele
    const rake = (32 * Math.PI) / 180;
    const d = new THREE.Vector3(-Math.cos(rake), Math.sin(rake), 0), zAx = new THREE.Vector3(0, 0, 1), nG = new THREE.Vector3().crossVectors(d, zAx);
    this.glassBase = new THREE.Vector3(-1.62, hoodY(-1.6, 0) + 0.004, 0);
    this.glassD = d; this.glassN = nG;
    const gGeo = new THREE.PlaneGeometry(0.95, 1.6);
    this.glassMat = glassMaterial(this.lights, this.shared);
    this.glass = new THREE.Mesh(gGeo, this.glassMat);
    this.glass.matrixAutoUpdate = false;
    this.glass.matrix.makeBasis(d, zAx, nG).setPosition(this.glassBase.clone().addScaledVector(d, 0.475));
    this.glass.renderOrder = 3;
    this.scene.add(this.glass);
    const loader = new THREE.TextureLoader();
    const colorTex = loader.load('assets/interior.webp');
    colorTex.colorSpace = THREE.NoColorSpace;
    const depthTex = loader.load('assets/interior-depth.webp');
    depthTex.colorSpace = THREE.NoColorSpace;
    this.interior = interiorMesh(this.shared, colorTex, depthTex);
    this.interior.position.set(-3.05, 0.3, 0);
    this.interior.rotation.y = Math.PI / 2;
    this.scene.add(this.interior);

    // acabamento de fibra de carbono no painel, logo depois do para-brisa (a câmera passa rente)
    const cg = new THREE.PlaneGeometry(0.42, 1.1, 48, 72);
    cg.rotateX(-Math.PI / 2);
    const cp = cg.attributes.position;
    for (let i = 0; i < cp.count; i++) { const x = cp.getX(i) / 0.21; cp.setY(i, -0.05 * x * x); }
    cg.computeVertexNormals();
    this.carbon = new THREE.Mesh(cg, carbonMaterial(this.lights, this.shared));
    this.carbon.position.set(-2.27, 0.19, 0.0);
    this.carbon.visible = false;
    this.scene.add(this.carbon);

    // números grandes no fundo, além da frente do capô
    this.nums = ['02', '03', '04'].map(t => {
      const m = typePlane(t, this.shared, { h: 1.5, color: 0.06 });
      m.position.set(4.6, 0.32, -0.25);
      m.rotation.y = -Math.PI / 2;
      this.scene.add(m);
      return m;
    });

    // rótulos das camadas (no espaço, presos às bordas das placas)
    this.labelRoot = $('.labels');
    this.labels = LAYERS.map(L => {
      const el = document.createElement('div');
      el.className = 'lbl';
      el.innerHTML = `<i></i><b>${L.name}</b><span>${L.note}</span>`;
      this.labelRoot.append(el);
      return el;
    });

    this.p = new THREE.Vector3(); this.t = new THREE.Vector3(); this.v = new THREE.Vector3();
    this.timeline();
  }

  timeline() {
    // alturas relativas à pintura: S(x, h, z) = ponto h metros acima do capô
    const S = (x, h, z) => [x, hoodY(x, z) + h, z];
    const k = (id, t, p, q) => [at(id, t), p, q];
    this.path = track([
      k('correcao', 0.0, S(-0.52, 0.2, 0.34), S(0.04, 0, 0.16)),
      k('correcao', 0.18, S(-0.32, 0.15, 0.22), S(0.04, 0, 0.1)),
      k('correcao', 0.4, S(-0.26, 0.13, 0.04), S(0.08, 0, -0.06)),
      k('correcao', 0.54, S(-0.24, 0.13, -0.07), S(0.1, 0, -0.13)),
      k('correcao', 0.66, S(-0.24, 0.13, -0.13), S(0.11, 0, -0.19)),
      k('correcao', 0.8, S(-0.25, 0.1, -0.2), S(0.12, 0, -0.26)),
      k('correcao', 1.0, S(-0.55, 0.26, -0.16), S(0.35, 0, -0.1)),
      k('ceramic', 0.2, S(-0.8, 0.3, -0.02), S(0.62, -0.03, 0.04)),
      k('ceramic', 0.42, S(-0.68, 0.27, 0.06), S(0.62, -0.03, 0.06)),
      k('ceramic', 0.6, S(0.18, 0.07, 0.17), S(SPOT.x, 0.002, SPOT.z)),
      k('ceramic', 0.8, S(0.35, 0.03, 0.085), S(SPOT.x, 0.002, SPOT.z)),
      k('ceramic', 0.94, S(0.437, 0.0085, 0.056), S(SPOT.x, 0.002, SPOT.z)),
      k('ceramic', 1.0, S(0.4445, 0.006, 0.0525), S(SPOT.x, 0.001, SPOT.z)),
      k('camadas', 0.12, S(0.3, 0.13, 0.42), S(SPOT.x, 0.01, SPOT.z)),
      k('camadas', 0.3, S(0.02, 0.27, 0.74), S(SPOT.x, 0.08, SPOT.z)),
      k('camadas', 0.48, S(0.66, 0.22, 0.84), S(SPOT.x, 0.1, SPOT.z)),
      k('camadas', 0.64, S(0.98, 0.11, 0.42), S(SPOT.x, 0.11, SPOT.z)),
      k('camadas', 0.78, S(0.9, 0.25, 0.6), S(SPOT.x, 0.06, SPOT.z)),
      k('camadas', 0.92, S(0.3, 0.21, 0.7), S(SPOT.x, 0.0, SPOT.z)),
      k('camadas', 1.0, S(0.1, 0.19, 0.62), S(0.5, 0, 0.05)),
      k('ppf', 0.12, S(-0.4, 0.17, 0.3), S(0.4, 0, -0.05)),
      k('ppf', 0.45, S(0.05, 0.08, 0.1), S(0.45, 0, -0.05)),
      k('ppf', 0.75, S(0.3, 0.07, 0.02), S(0.75, -0.005, -0.06)),
      k('ppf', 1.0, S(0.45, 0.17, 0.2), S(1.1, -0.01, 0.0)),
      k('interior', 0.1, S(0.5, 0.2, 0.42), S(0.85, 0, 0.0)),
      k('interior', 0.22, S(0.05, 0.27, 0.5), S(-0.35, 0, 0.0)),
      k('interior', 0.34, S(-0.85, 0.28, 0.16), S(-1.55, 0.03, 0.0)),
      k('interior', 0.46, [-1.55, 0.31, 0.05], [-2.4, 0.3, 0.05]),
      k('interior', 0.56, [-1.98, 0.305, 0.04], [-2.6, 0.22, 0.06]),
      // rente ao carbono do painel, depois sobe e revela o interior
      k('interior', 0.62, [-2.13, 0.25, 0.03], [-2.31, 0.19, 0.07]),
      k('interior', 0.69, [-2.15, 0.245, -0.07], [-2.33, 0.19, -0.03]),
      k('interior', 0.78, [-2.1, 0.31, -0.02], [-3.0, 0.27, 0.2]),
      k('interior', 1.0, [-2.22, 0.32, -0.12], [-3.0, 0.26, 0.24]),
    ]);
  }

  resize() {
    const cam = this.camera;
    cam.aspect = view.w / view.h;
    // em pé, abre o campo vertical para não perder o assunto nas laterais
    cam.fov = view.portrait ? clamp((2 * Math.atan(Math.tan((19 * Math.PI) / 180) / cam.aspect) * 180) / Math.PI, 34, 62) : 34;
    cam.updateProjectionMatrix();
  }

  /** Coloca uma gota na superfície do capô (alinhada à normal). */
  place(mesh, i, x, z, r, stretch = 1, dir = 0) {
    const y = hoodY(x, z);
    hoodN(x, z, this.tmpN);
    this.tmpQ.setFromUnitVectors(this.up, this.tmpN);
    // gota alongada na direção em que escorre
    if (stretch !== 1) this.tmpQ.multiply(this.tmpQ2.setFromAxisAngle(this.up, -dir));
    this.tmpP.set(x, y - r * 0.08, z);
    this.tmpS.set(r * stretch, r, r);
    this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
    mesh.setMatrixAt(i, this.tmpM);
  }

  update(u, dt) {
    const cam = this.camera;
    const P = this.paint.uniforms;
    const sh = this.shared;
    const L = this.lights;
    const reduce = state.reduce;
    const tC = span(u, C.correcao.start, C.correcao.end);
    const tK = span(u, C.ceramic.start, C.ceramic.end);
    const tL = span(u, C.camadas.start, C.camadas.end);
    const tP = span(u, C.ppf.start, C.ppf.end);
    const tI = span(u, C.interior.start, C.interior.end);
    const inC = u < C.ceramic.start, inK = u >= C.ceramic.start && u < C.camadas.start, inL = u >= C.camadas.start && u < C.ppf.start;
    const inP = u >= C.ppf.start && u < C.interior.start, inI = u >= C.interior.start;

    // ——— Câmera ———
    this.path(u, this.p, this.t);
    const dist = this.p.distanceTo(this.t);
    // resposta mínima ao cursor (proporcional à distância: em macro, quase nada)
    const k = reduce ? 0 : dist * 0.018;
    cam.position.set(this.p.x, this.p.y, this.p.z);
    this.v.subVectors(this.t, this.p).normalize();
    const right = this.tmpN.crossVectors(this.v, this.up).normalize();
    cam.position.addScaledVector(right, pointer.sx * k).addScaledVector(this.up, -pointer.sy * k * 0.5);
    cam.lookAt(this.t);
    sh.uCam.value.copy(cam.position);

    // foco no alvo; abertura maior nos planos macro
    sh.uFocus.value = dist;
    sh.uAperture.value = clamp(0.45 + 0.05 / Math.max(dist, 0.02), 0.5, 1.2);
    let dof = 1;

    // ——— Luzes do estúdio ———
    // túnel de luz à frente do capô: quatro tubos atravessados, em alturas crescentes (no verniz
    // viram linhas que se curvam com o capô, como na inspeção de pintura). A quinta barra é
    // móvel (varre o verniz) e a sexta acompanha a câmera na vista explodida.
    const lv = inL ? lerp(1, 0.25, smooth(span(tL, 0.1, 0.3)) * (1 - smooth(span(tL, 0.82, 0.95)))) : 1;
    const tube = [6 * lv, 5.9 * lv, 5.7 * lv];
    L.set(0, [1.5, 0.9, -0.1], [0, 0, 1], 0.009, 1.3, tube, 0.002);
    L.set(1, [2.3, 1.18, 0.05], [0, 0, 1], 0.011, 1.6, [4.6 * lv, 4.5 * lv, 4.4 * lv], 0.002);
    // softbox largo ao fundo: um degradê suave no verniz
    L.set(2, [3.2, 1.6, 0], [0, 0, 1], 0.32, 2.2, [0.55 * lv, 0.55 * lv, 0.56 * lv], 0.45, false);
    L.set(3, [2.9, 0.5, 1.35], [0, 1, 0], 0.01, 0.7, [3.5 * lv, 3.45 * lv, 3.4 * lv], 0.002);
    let sweepI = 0, sweepX = 0;
    if (inK) { sweepI = env(tK, [0.02, 0.08, 0.42, 0.5]); sweepX = lerp(-1.2, 2.6, smoother(span(tK, 0.02, 0.5))); }
    if (inL) { sweepI = env(tL, [0.84, 0.88, 0.96, 1.0]); sweepX = lerp(-0.3, 1.5, smooth(span(tL, 0.84, 1.0))); }
    // no PPF uma luz passa por cima das gotas, de trás para a frente
    if (inP) { sweepI = env(tP, [0.34, 0.44, 0.78, 0.9]) * 0.8; sweepX = lerp(2.2, -0.7, smooth(span(tP, 0.34, 0.9))); }
    if (inI && tI < 0.54) {
      // no interior, a barra fica sobre o para-brisa: o reflexo dela no vidro some quando a câmera chega perto
      const g = env(tI, [0.18, 0.3, 0.46, 0.54]);
      L.set(4, [-2.35, 1.3, 0.05], [0, 0, 1], 0.18, 1.1, [0.9 * g, 0.89 * g, 0.88 * g], 0.35, false);
    } else if (inI) {
      // depois do vidro, uma luz estreita anda sobre o carbono: as mechas trocam de brilho
      const g = env(tI, [0.54, 0.58, 0.72, 0.8]);
      L.set(4, [-2.28, 0.6, lerp(-0.45, 0.45, smooth(span(tI, 0.55, 0.76)))], [1, 0, 0], 0.012, 0.32, [5 * g, 4.9 * g, 4.8 * g], 0.003, false);
    } else L.set(4, [sweepX, 0.62, 0.05], [0, 0, 1], 0.018, 1.4, [14 * sweepI, 13.8 * sweepI, 13.3 * sweepI], 0.003, sweepI > 0.01);
    // luz da vista explodida: do lado oposto à câmera, na altura dela (reflete no topo das placas)
    const keyA = inL ? smooth(span(tL, 0.12, 0.3)) * (1 - smooth(span(tL, 0.86, 0.98))) : 0;
    if (keyA > 0.001) {
      const sx = SPOT.x, sz = SPOT.z, sy = hoodY(sx, sz) + 0.1;
      const ox = sx - cam.position.x, oz = sz - cam.position.z, ol = Math.hypot(ox, oz) || 1;
      L.set(5, [sx + (ox / ol) * 1.1, sy + (cam.position.y - sy) * 1.6 + 0.1, sz + (oz / ol) * 1.1], [-oz / ol, 0, ox / ol], 0.035, 0.7, [1.1 * keyA, 1.09 * keyA, 1.07 * keyA], 0.04, false);
      L.count(6);
    } else L.count(5);

    // ——— Correção: luz de inspeção, riscos, politriz ———
    // o LED fica onde o reflexo dele cai no centro do quadro (no alvo da câmera)
    const insp = inC ? env(tC, [0.12, 0.22, 0.9, 1.0]) : 0;
    if (insp > 0) {
      const T = this.t;
      hoodN(T.x, T.z, this.tmpN);
      const d = this.v; // direção câmera → alvo (já normalizada acima)
      const dn = d.dot(this.tmpN);
      this.tmpP.copy(d).addScaledVector(this.tmpN, -2 * dn).normalize();
      P.uInsp.value.copy(T).addScaledVector(this.tmpP, 0.6 + Math.sin(u * 1.7) * 0.05);
      P.uInsp.value.z += Math.sin(u * 2.3) * 0.02;
    }
    P.uInspC.value.setRGB(1.6 * insp, 1.56 * insp, 1.5 * insp);
    this.led.visible = insp > 0.01;
    this.led.position.copy(P.uInsp.value);
    this.led.material.color.setRGB(30 * insp, 29 * insp, 27 * insp);
    P.uSwirl.value = inC ? 1 : 0;
    // a boina passa rente à lente da direita para a esquerda; atrás dela, a pintura corrigida
    const pp = span(tC, 0.55, 0.76);
    this.pol.visible = inC && pp > 0 && pp < 1;
    if (this.pol.visible) {
      const ax = cam.position.x + 0.19, az = lerp(cam.position.z + 0.34, cam.position.z - 0.34, smooth(pp));
      this.pol.position.set(ax, hoodY(ax, az) + 0.012, az);
      // o corpo da politriz aponta para longe da câmera
      this.pol.rotation.set(0, Math.PI * 0.92, 0);
      this.pol.userData.pad.rotation.y += dt * 0.09;
      this.pol.userData.foam.uniforms.uSpin.value += dt * 0.03;
      P.uPolishZ.value = az;
    } else P.uPolishZ.value = inC && pp >= 1 ? -9 : 9;
    // números ao fundo
    this.nums[0].material.uniforms.uAlpha.value = inC ? env(tC, [0.12, 0.3, 0.86, 1.0]) : 0;
    this.nums[1].material.uniforms.uAlpha.value = inK ? env(tK, [0.08, 0.24, 0.5, 0.62]) : 0;
    this.nums[2].material.uniforms.uAlpha.value = inP ? env(tP, [0.12, 0.3, 0.86, 1.0]) : 0;
    for (const n of this.nums) n.visible = n.material.uniforms.uAlpha.value > 0.002;

    // ——— Coating: gotas se formam; a câmera entra numa delas ———
    let beadGrow = 0, beadFade = 1;
    if (inK) beadGrow = span(tK, 0.36, 0.72);
    if (inL) { beadGrow = 1; beadFade = 1 - smooth(span(tL, 0.08, 0.22)); }
    this.beads.visible = (inK && beadGrow > 0) || (inL && beadFade > 0);
    if (this.beads.visible) {
      const D = this.beadData;
      for (let i = 0; i < D.length; i++) {
        const b = D[i];
        const g = smooth(span(beadGrow, b.b * 0.65, b.b * 0.65 + 0.35)) * beadFade;
        this.place(this.beads, i, b.x, b.z, Math.max(1e-5, b.r * g));
      }
      this.beads.instanceMatrix.needsUpdate = true;
    }
    // dentro da gota: tudo refratado; depois a câmera recua para o capô
    post.lensBig = (inK ? smooth(span(tK, 0.88, 1)) : 0) + (inL ? 1 - smooth(span(tL, 0, 0.1)) : 0);
    if (post.lensBig > 0.6) dof = 0.6;

    // ——— Camadas: a amostra sobe e se separa ———
    const lift = inL ? smooth(span(tL, 0.12, 0.26)) * (1 - smooth(span(tL, 0.84, 0.95))) : 0;
    const expl = inL ? smooth(span(tL, 0.18, 0.38)) * (1 - smooth(span(tL, 0.72, 0.88))) : 0;
    this.stack.visible = inL && tL > 0.1;
    if (this.stack.visible) {
      const yS = hoodY(SPOT.x, SPOT.z);
      let y = yS - LAYERS.reduce((a, l) => a + l.t, 0) + 0.0005;
      this.slabs.forEach((m, i) => {
        m.position.y = y + lift * 0.04 + expl * i * 0.05;
        y += LAYERS[i].t;
      });
    }
    const dim = 1 - 0.75 * expl;
    P.uDim.value = dim;
    this.floor.material.uniforms.uLevel.value = dim;
    this.renderLabels(inL ? expl : 0);

    // ——— PPF: gotas se formam e escorrem para a frente do capô ———
    this.runners.visible = inP && tP > 0.12;
    if (this.runners.visible) {
      const form = span(tP, 0.14, 0.42), run = span(tP, 0.42, 1);
      const D = this.runData;
      for (let i = 0; i < D.length; i++) {
        const d = D[i];
        const g = smooth(span(form, d.b * 0.6, d.b * 0.6 + 0.4));
        const tr = Math.max(0, run - d.b * 0.25);
        // escorre morro abaixo (na direção em que o capô cai naquele ponto)
        const e = 0.01, gx = (hoodY(d.x + e, d.z) - hoodY(d.x - e, d.z)) / (2 * e), gz = (hoodY(d.x, d.z + e) - hoodY(d.x, d.z - e)) / (2 * e);
        const gl = Math.hypot(gx, gz) || 1;
        const s = 0.5 * d.a * tr * tr * 1.6;
        const x = d.x - (gx / gl) * s, z = d.z - (gz / gl) * s;
        const sp = Math.min(1, tr * 2);
        this.place(this.runners, i, x, z, Math.max(1e-5, d.r * g), 1 + sp * 1.4, Math.atan2(-gz, -gx));
      }
      this.runners.instanceMatrix.needsUpdate = true;
    }

    // ——— Interior: a película corre pelo capô até o vidro; a câmera atravessa o vidro ———
    P.uFilm.value = inI || (inP && tP > 0.97) ? 1 : 0;
    P.uFilmX.value = inI ? lerp(1.5, -1.64, smooth(span(tI, 0.0, 0.34))) : 1.5;
    this.glass.visible = inI || inP;
    this.glassMat.uniforms.uReflect.value = inI ? 1 - smooth(span(tI, 0.4, 0.52)) : 1;
    this.glassMat.uniforms.uTint.value = inI ? 0.14 * (1 - smooth(span(tI, 0.44, 0.52))) : 0.14;
    this.interior.visible = inI && tI > 0.2;
    const IU = this.interior.material.uniforms;
    IU.uExposure.value = inI ? lerp(0.12, 1, smooth(span(tI, 0.44, 0.6))) * smooth(span(tI, 0.2, 0.34)) : 0;
    IU.uLight.value = inI ? env(tI, [0.6, 0.66, 0.84, 0.9]) : 0;
    IU.uLightX.value = lerp(-0.1, 1.1, span(tI, 0.6, 0.9));
    this.hood.visible = !(inI && tI > 0.62);
    this.carbon.visible = inI && tI > 0.5 && tI < 0.86;

    // ——— Exposição: entra do preto, sai no preto ———
    // entra pela espuma que cobriu a lente no fim da lavagem (a água enxágua), sai no preto
    let exposure = 1;
    if (inI) exposure = 1 - smooth(span(tI, 0.92, 0.995));
    post.exposure = exposure;
    post.black = exposure <= 0.0005 ? 1 : 0;
    post.white = 0;
    post.bloom = 0.62;
    post.threshold = 0.9;
    post.knee = 0.5;
    post.vignette = 0.62;
    post.grain = view.mobile ? 0.03 : 0.035;
    post.chroma = 0;
    post.dof = dof;
    // água atravessando a lente no começo da correção (da direita para a esquerda)
    post.lens = inC ? env(tC, [0.02, 0.07, 0.16, 0.26]) : 0;
    post.lensX = lerp(1.25, -0.25, span(tC, 0.02, 0.26));
    post.foam = inC ? 1 - smooth(span(tC, 0.03, 0.2)) : 0;
    post.foamY = inC ? 0.05 + smooth(span(tC, 0.0, 0.22)) * 0.7 : 0;
  }

  /** Ao sair do estúdio, some com o que é DOM (rótulos). */
  leave() { this.renderLabels(0); }

  renderLabels(a) {
    const on = a > 0.01;
    if (on !== this.labelsOn) { this.labelsOn = on; for (const el of this.labels) el.style.display = on ? '' : 'none'; }
    if (!on) return;
    const v = this.tmpP;
    const room = view.mobile ? 150 : 270;
    this.slabs.forEach((m, i) => {
      // rótulo preso à borda da placa voltada para a câmera; vai para o lado que tiver espaço
      const y3 = m.position.y + LAYERS[i].t * 0.5;
      v.set(SPOT.x + 0.18, y3, SPOT.z + 0.12).project(this.camera);
      let x = (v.x * 0.5 + 0.5) * view.w, y = (0.5 - v.y * 0.5) * view.h;
      let left = false;
      if (x + room > view.w) {
        v.set(SPOT.x - 0.18, y3, SPOT.z + 0.12).project(this.camera);
        const xl = (v.x * 0.5 + 0.5) * view.w;
        if (xl - room > 0) { x = xl; y = (0.5 - v.y * 0.5) * view.h; left = true; }
        else x = view.w - room;
      }
      const el = this.labels[i];
      if (el._left !== left) { el._left = left; el.classList.toggle('lbl-left', left); }
      const ai = clamp(a * 1.4 - (LAYERS.length - 1 - i) * 0.08);
      css(el, 'transform', `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(${left ? '-100%' : '0'}, -50%)`);
      css(el, 'opacity', ai.toFixed(3));
    });
  }
}
