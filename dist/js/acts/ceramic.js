// 03 · CERAMIC COATING (o pico da página).
// Uma amostra da pintura (chapa, primer, cor, verniz e o coating por cima) apoiada no piso do
// estúdio, em materiais físicos (MeshPhysicalMaterial: metal escovado, primer fosco, metálico
// grafite, verniz e coating transparentes de verdade, com transmissão e refração), iluminados por
// luzes de área nas posições das barras do estúdio (gl/physical.js). Do preto, a linha abre a cena
// como uma fenda. Você separa as camadas (arrastando na cena ou no controle); a linha de luz desce
// entre elas, acendendo uma por uma, e depois passa por cima do coating: atrás dela a água forma
// gotas. A câmera anda poucos graus ao longo do ato. O card 03 fica enquanto tudo se abre.
// Saída: as camadas fecham, a cena apaga e sobra uma linha vertical, no lugar exato em que a borda
// da película começa no PPF (passagem no lugar).
import * as THREE from '../../vendor/three.min.js';
import { $, $$, view, pointer, state, clamp, lerp, span, smooth, smoother, env, rng, css } from '../core.js';
import { post } from '../gl/engine.js';
import { StudioLights, sharedUniforms, dropGeometry, backdrop, typePlane } from '../gl/studio.js';
import { physicalLayer, waterBead, AreaBars, loadLTC, studioEnvironment } from '../gl/physical.js';
import { Act, cardState } from './act.js';

const W = 1.5, D = 1.0;
// de baixo para cima
const LAYERS = [
  { kind: 'metal', t: 0.075 },
  { kind: 'primer', t: 0.032 },
  { kind: 'base', t: 0.032 },
  { kind: 'clear', t: 0.05 },
  { kind: 'film', t: 0.016 },
];
const crown = (x, z) => 0.055 * (1 - (x / (W * 0.62)) ** 2) + 0.03 * (1 - (z / (D * 0.6)) ** 2);
const TOTAL_T = LAYERS.reduce((a, l) => a + l.t, 0);

// linha do tempo (p do ato)
const T = {
  open: [0.0, 0.05], card3: [0.03, 0.1], sep: [0.1, 0.34], scan: [0.4, 0.54], act: [0.56, 0.7],
  close: [0.8, 0.88], out: [0.86, 0.95], seam: [0.88, 0.96],
};

function panelGeometry(t, seg = [72, 48]) {
  const g = new THREE.BoxGeometry(W, t, D, seg[0], 1, seg[1]);
  g.translate(0, t / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + crown(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  return g;
}

export class CeramicAct extends Act {
  constructor(el, { engine, quality }) {
    super(el);
    this.gl = !!engine;
    this.card3 = $('[data-card="ceramic"]', el);
    this.slit = Object.assign(document.createElement('div'), { className: 'slit', innerHTML: '<i></i>' });
    this.slit.setAttribute('aria-hidden', 'true');
    this.stage.append(this.slit);
    this.seam = $('.seam', el);
    this.labels = $$('.layer-labels li', el);
    this.sepWrap = $('.separator', el);
    this.sepInput = $('#sep', el);
    this.s = 0;
    this.userS = null;
    this.quality = quality;
    this.engine = engine;
    this.ready = !engine;
    // o controle: o último a mexer vence (rolagem ou a pessoa)
    this.sepInput.addEventListener('input', () => { this.userS = this.sepInput.value / 100; this.userSAt = this.raw; this.dirty = true; });
    // movimento reduzido: o foco no controle mostra o estado da cena que ele controla
    this.sepInput.addEventListener('focus', () => { if (state.flat && this.gl) { this.forced = this.hold; this.dirty = true; } });
    // arrastar na cena: no mouse a separação é vertical; no toque é horizontal (o gesto vertical
    // continua rolando a página, o palco tem touch-action: pan-y)
    let drag = null;
    this.stage.addEventListener('pointerdown', e => {
      if (e.target.closest('.card, input, button, a')) return;
      drag = { x: e.clientX, y: e.clientY, s: this.s, mouse: e.pointerType === 'mouse' };
    });
    addEventListener('pointermove', e => {
      if (!drag) return;
      const d = drag.mouse ? -(e.clientY - drag.y) / (view.h * 0.35) : (e.clientX - drag.x) / (view.w * 0.6);
      this.userS = clamp(drag.s + d); this.userSAt = this.raw;
      this.dirty = true;
    });
    const end = () => { drag = null; };
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
    if (engine) this.build(quality);
  }

  build(quality) {
    const low = quality.name !== 'high';
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0, 0, 0);
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.05, 80);
    this.lights = new StudioLights();
    this.shared = sharedUniforms();
    this.scene.add(this.lights.group);
    const { sky, floor } = backdrop(this.lights, this.shared);
    floor.position.y = -0.002;
    this.scene.add(sky, floor);
    this.floor = floor; this.sky = sky;
    this.slabs = LAYERS.map(L => {
      const m = new THREE.Mesh(panelGeometry(L.t, low ? [48, 32] : [72, 48]), physicalLayer(L.kind, null));
      this.scene.add(m);
      return m;
    });
    // as barras como luzes de área: entram na cena quando as tabelas LTC carregam (load)
    this.area = new AreaBars(6);
    // sombra de contato da chapa no piso
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.5, D * 1.6), new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec2 vUv; void main(){ vec2 q = (vUv - 0.5) * vec2(1.5, 1.6) / vec2(1.0, 1.0); float d = length(max(abs(q) - vec2(0.42, 0.38), 0.0)); float a = exp(-d * d / 0.012) * 0.85; gl_FragColor = vec4(0.0, 0.0, 0.0, a); }',
      transparent: true, depthWrite: false,
    }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.0005;
    this.shadow = sh;
    this.scene.add(sh);
    // gotas no coating
    const R = rng(41);
    const n = low ? 70 : 120;
    this.beadMat = waterBead(null);
    this.beads = new THREE.InstancedMesh(dropGeometry(), this.beadMat, n);
    this.beads.frustumCulled = false;
    this.beadData = [];
    for (let i = 0; i < n; i++) {
      const x = (R() - 0.5) * (W - 0.12), z = (R() - 0.5) * (D - 0.12);
      this.beadData.push({ x, z, r: 0.012 + R() ** 2.2 * 0.034, b: R() });
    }
    this.scene.add(this.beads);
    this.M = new THREE.Matrix4(); this.Q = new THREE.Quaternion(); this.S3 = new THREE.Vector3(); this.P3 = new THREE.Vector3(); this.N3 = new THREE.Vector3(); this.UP = new THREE.Vector3(0, 1, 0);
    // números ao fundo
    this.num3 = typePlane('03', this.shared, { h: 2.2, color: 0.04 });
    this.num3.position.set(-1.9, 0.55, -3.8);
    this.scene.add(this.num3);
    this.tgt = new THREE.Vector3();
  }

  load() {
    if (!this.scene) return Promise.resolve();
    // materiais físicos: tabelas das luzes de área e o mapa de ambiente do estúdio
    return loadLTC().then(ok => {
      if (ok) this.scene.add(this.area.group);
      const env = studioEnvironment(this.engine.renderer);
      for (const m of [...this.slabs.map(s => s.material), this.beadMat]) { m.envMap = env; m.needsUpdate = true; }
      this.ready = true;
    });
  }

  resize(w, h) {
    if (!this.camera) return;
    this.camera.aspect = w / h;
    this.camera.fov = view.portrait ? 40 : 28;
    // o objeto fica à direita do centro no desktop (o card ocupa a esquerda)
    if (!view.portrait) this.camera.setViewOffset(w * 1.0, h, -w * 0.12, 0, w, h);
    else this.camera.setViewOffset(w, h, w * 0.12, h * 0.2, w, h);
    this.camera.updateProjectionMatrix();
  }

  focusPoint(el) {
    return el === this.sepInput || this.card3.contains(el) ? this.hold : null;
  }
  explore(btn, { jump }) {
    // sem WebGL não há cena: o botão só leva ao card
    if (!this.gl) { jump(0, this.card3.querySelector('.card-add')); return; }
    // movimento reduzido: sem rolagem presa, o botão leva a cena ao estado do controle
    if (state.flat) { this.forced = this.hold; this.sepInput.focus({ preventScroll: true }); this.dirty = true; return; }
    this.userS = null;
    jump(this.hold, this.sepInput);
  }

  key() { return `${Math.round(this.p * 2000)}|${Math.round(this.s * 400)}`; }
  get animating() { return this.dirty || Math.abs(this.s - this.sTarget) > 1e-3; }

  update(dt) {
    const p = this.p;
    // separação: base pela rolagem; a pessoa assume quando mexe (até rolar para longe)
    const sBase = smoother(span(p, T.sep[0], T.sep[1])) * (1 - smoother(span(p, T.close[0], T.close[1])));
    if (this.userS != null && Math.abs(this.raw - this.userSAt) > 0.07) this.userS = null;
    if (this.raw > T.close[1] + 0.02) this.userS = null;
    this.sTarget = this.userS ?? sBase;
    const k = state.reduce ? 1 : 1 - Math.exp(-dt / 90);
    this.s += (this.sTarget - this.s) * k;
    if (Math.abs(this.s - this.sTarget) < 1e-4) this.s = this.sTarget;
    if (document.activeElement !== this.sepInput) this.sepInput.value = Math.round(this.s * 100);
    // o que o leitor de tela anuncia (o número sozinho não diz nada)
    const sv = Number(this.sepInput.value);
    if (sv !== this.sepSaid) { this.sepSaid = sv; this.sepInput.setAttribute('aria-valuetext', sv < 3 ? 'Camadas juntas' : sv > 97 ? 'Camadas separadas' : `Camadas ${sv}% separadas`); }

    // entrada: a linha chega com o palco e abre a cena como uma fenda
    const open = smoother(span(p, T.open[0], T.open[1] + 0.02));
    const st = this.slit.style;
    st.setProperty('--vis', open < 0.999 && !state.reduce ? 'visible' : 'hidden');
    st.setProperty('--open', open.toFixed(3));
    st.setProperty('--line-a', (1 - smooth(span(open, 0.6, 1))).toFixed(3));
    // card 03: chega cedo e fica enquanto as camadas se abrem; sai quando elas fecham
    const a3 = cardState(this.card3, p, [T.card3[0], T.card3[1], T.close[0] + 0.02, T.out[0] + 0.03], 0.1);
    // rótulos das camadas e o controle de separação
    const ceramic = 1 - smooth(span(p, T.close[0], T.close[1] - 0.02));
    const ctlA = smooth(span(p, T.sep[0] - 0.04, T.sep[0] + 0.04)) * ceramic * a3;
    this.sepWrap.style.setProperty('--a', ctlA.toFixed(3));
    this.sepWrap.style.setProperty('--pe', ctlA > 0.5 ? 'auto' : 'none');
    // saída: sobra a linha vertical onde a película do PPF começa
    css(this.seam, 'opacity', state.flat ? '0' : smooth(span(p, T.seam[0], T.seam[1])).toFixed(3));
    this.renderLabels(ceramic);
  }

  settle() { this.update(16); this.s = this.sTarget; this.update(16); }

  /** Altura (y) da base de cada camada com a separação atual. */
  layerY(i) {
    const gap = (view.portrait ? 0.22 : 0.26) * this.s;
    let y = 0;
    for (let j = 0; j < i; j++) y += LAYERS[j].t;
    return y + i * gap;
  }

  renderLabels(on) {
    if (!this.camera) return;
    const v = this.P3;
    const scan = this.scanGap;
    for (const li of this.labels) {
      const j = 4 - Number(li.dataset.layer);
      const y = this.layerY(j) + LAYERS[j].t * 0.5 + crown(W / 2, 0);
      v.set(W / 2, y, D * 0.18).project(this.camera);
      const x = (v.x * 0.5 + 0.5) * view.w, yy = (0.5 - v.y * 0.5) * view.h;
      const a = clamp(on * smooth(span(this.s, 0.45 + j * 0.06, 0.75 + j * 0.05)));
      li.style.setProperty('--x', `${Math.round(x + 14)}px`);
      li.style.setProperty('--y', `${Math.round(yy)}px`);
      li.style.setProperty('--a', a.toFixed(3));
      li.classList.toggle('is-lit', scan != null && Math.abs(scan - j) < 0.5);
    }
    // controle de separação logo abaixo da amostra
    v.set(0, -0.02, D / 2).project(this.camera);
    this.sepWrap.style.setProperty('--sx', `${Math.round((v.x * 0.5 + 0.5) * view.w)}px`);
    this.sepWrap.style.setProperty('--sy', `${Math.round((0.5 - v.y * 0.5) * view.h + 28)}px`);
  }

  render(engine, now) {
    this.dirty = false;
    const p = this.p, L = this.lights, sh = this.shared, cam = this.camera;
    const s = this.s;

    // ——— Camadas ———
    LAYERS.forEach((Lr, i) => { this.slabs[i].position.y = this.layerY(i); });
    const topY = this.layerY(4) + LAYERS[4].t;
    const midY = (topY + crown(0, 0)) * 0.5;

    // ——— Câmera: três quartos, de cima; recua conforme as camadas se abrem ———
    // a câmera anda poucos graus ao longo do ato (e um pouco com o ponteiro)
    const drift = state.reduce ? 0 : lerp(-0.05, 0.05, smooth(span(p, 0.06, 0.86)));
    const yaw = 0.6 + drift + (state.reduce ? 0 : pointer.sx * 0.05);
    const dist = (view.portrait ? 7.4 : 5.0) + s * (view.portrait ? 1.8 : 1.0);
    const elev = 0.44 - drift * 0.3 - (state.reduce ? 0 : pointer.sy * 0.03);
    this.tgt.set(0, midY, 0);
    cam.position.set(Math.sin(yaw) * Math.cos(elev) * dist, this.tgt.y + Math.sin(elev) * dist, Math.cos(yaw) * Math.cos(elev) * dist);
    cam.lookAt(this.tgt);
    this.num3.rotation.y = yaw * 0.6;
    sh.uCam.value.copy(cam.position);
    sh.uFocus.value = cam.position.distanceTo(this.tgt);
    sh.uAperture.value = 0.28;

    // ——— Luzes ———
    // softbox grande no reflexo especular da câmera (o brilho largo no verniz e no coating)
    const rx = -Math.sin(yaw), rz = -Math.cos(yaw);
    L.set(0, [rx * 3.2, midY + 2.0, rz * 3.2], [-rz, 0, rx], 0.55, 1.9, [0.9, 0.9, 0.92], 0.5, false);
    // tubo vertical à direita (linhas nítidas nas bordas) e contra-luz atrás; a contra-luz só
    // aparece no reflexo (o tubo dela cairia em cima da barra do site)
    L.set(1, [2.4, 1.3, 1.2], [0, 1, 0], 0.012, 1.1, [4.2, 4.15, 4.05], 0.003, !view.portrait);
    L.set(2, [-1.4, 1.5, -2.4], [1, 0, 0], 0.012, 1.5, [2.6, 2.55, 2.5], 0.003, false);
    // a linha de luz: desce pelas frestas, rente à face da frente, e depois varre o coating
    let lineI = 0, lineC = [0, 0, 0], lineA = [1, 0, 0], lineHL = W * 0.5 + 0.04, lineHW = 0.0022, lineVis = true;
    this.scanGap = null;
    if (p > T.scan[0] - 0.01 && p < T.scan[1]) {
      const k = span(p, T.scan[0], T.scan[1]);
      // g: posição contínua, do vão acima do coating (4) até o vão entre chapa e primer (0)
      const g = lerp(4.0, 0.0, smoother(k));
      const j = Math.min(4, Math.floor(g)), fr = g - j;
      const yA = this.layerY(j) + LAYERS[j].t + crown(0, D / 2);
      const yB = j < 4 ? this.layerY(j + 1) + crown(0, D / 2) : yA + 0.18;
      lineC = [0, lerp(yA, yB, 0.5 + (fr - 0.5) * 0.2), D / 2 + 0.01];
      lineI = 5 * env(k, [0, 0.06, 0.92, 1]) * s;
      this.scanGap = j;   // índice da camada logo abaixo da linha (0 = chapa, 4 = coating)
    } else if (p >= T.act[0] - 0.01 && p < T.act[1] + 0.03) {
      const k = span(p, T.act[0], T.act[1]);
      lineC = [lerp(-W * 0.7, W * 0.7, smoother(k)), topY + 0.45, 0];
      lineA = [0, 0, 1];
      lineHL = D * 0.5 + 0.08;
      lineHW = 0.004;
      lineVis = false;
      lineI = 12 * env(p, [T.act[0] - 0.01, T.act[0] + 0.02, T.act[1], T.act[1] + 0.03]);
    }
    L.set(3, lineC, lineA, lineHW, lineHL, [lineI, lineI * 0.99, lineI * 0.96], 0.002, lineVis && lineI > 0.05);
    L.count(4);
    // as mesmas barras como luzes de área para os materiais físicos, viradas para a amostra; a
    // linha entre as camadas ilumina as duas faces do vão (uma luz para baixo, outra para cima)
    const A = this.area, mid = [0, midY, 0];
    // (o reflexo num dielétrico a ~65° é ~10% da luz: a softbox de estúdio é forte de verdade)
    A.set(0, [rx * 3.2, midY + 2.0, rz * 3.2], [-rz, 0, rx], 0.55, 1.9, [6, 6, 6.15], mid);
    A.set(1, [2.4, 1.3, 1.2], [0, 1, 0], 0.012, 1.1, [16, 15.8, 15.4], mid);
    A.set(2, [-1.4, 1.5, -2.4], [1, 0, 0], 0.012, 1.5, [10, 9.8, 9.6], mid);
    const lc = [lineI * 3, lineI * 2.97, lineI * 2.88];
    if (this.scanGap != null) {
      const gap = Math.max(0.006, (view.portrait ? 0.22 : 0.26) * s * 0.5);
      A.set(3, lineC, lineA, gap, lineHL, lc.map(v => v * 0.5), [lineC[0], lineC[1] - 1, lineC[2] - 0.2]);
      A.set(4, lineC, lineA, gap, lineHL, lc.map(v => v * 0.5), [lineC[0], lineC[1] + 1, lineC[2] - 0.2]);
    } else {
      A.set(3, lineC, lineA, lineHW, lineHL, lc, [lineC[0], topY, 0]);
      A.off(4);
    }

    // ——— Ativação: gotas se formam atrás da linha ———
    const actK = span(p, T.act[0], T.act[1]);
    const sweepX = lerp(-W * 0.75, W * 0.75, smoother(actK));
    const beadsOn = p > T.act[0] && p < T.close[1];
    this.beads.visible = beadsOn;
    this.beads.count = this.quality.secondary ? this.beadData.length : this.beadData.length >> 1;
    // a transmissão (verniz, coating, gotas) desenha de novo o que está atrás: é o assunto em foco,
    // então só cai para meia resolução no fim da escada de efeitos (junto com a multiamostragem)
    this.engine.renderer.transmissionResolutionScale = this.quality.e >= 5 ? 0.5 : 1;
    if (beadsOn) {
      const D2 = this.beadData;
      const fade = 1 - smooth(span(p, T.close[0], T.close[1]));
      for (let i = 0; i < D2.length; i++) {
        const b = D2[i];
        const g = smooth(clamp((sweepX - b.x) / 0.25 - b.b * 0.4)) * fade;
        const y = topY + crown(b.x, b.z) - LAYERS[4].t * 0 ;
        this.N3.set(-(crown(b.x + 0.01, b.z) - crown(b.x - 0.01, b.z)) / 0.02, 1, -(crown(b.x, b.z + 0.01) - crown(b.x, b.z - 0.01)) / 0.02).normalize();
        this.Q.setFromUnitVectors(this.UP, this.N3);
        this.P3.set(b.x, y - b.r * g * 0.06, b.z);
        const r = Math.max(1e-5, b.r * g);
        this.S3.set(r, r, r);
        this.M.compose(this.P3, this.Q, this.S3);
        this.beads.setMatrixAt(i, this.M);
      }
      this.beads.instanceMatrix.needsUpdate = true;
    }
    // o coating "acende" depois da passada da luz: a interferência de filme fino aparece mais
    // (fica sempre acima de zero, para o shader não recompilar)
    this.slabs[4].material.iridescence = 0.45 + 0.55 * smooth(actK);

    this.num3.material.uniforms.uAlpha.value = env(p, [0.02, 0.12, T.close[0], T.close[1]]);

    // ——— Pós ———
    // o desfoque só separa o piso e o fundo (o que está em foco fica intacto); na saída a cena apaga
    post.exposure = 1 - smooth(span(p, T.out[0], T.out[1]));
    post.vignette = 0.3;
    post.tone = 'hdr';
    post.dof = 0.8;
    engine.render(this.scene, cam);
  }
}
