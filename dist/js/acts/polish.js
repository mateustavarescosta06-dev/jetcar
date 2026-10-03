// 02 · POLIMENTO. Cena escura. Uma barra de LED (a linha de luz) passa devagar sobre o capô:
// o reflexo dela é uma linha nítida que corre pela pintura e, em volta dela, acendem os
// micro-riscos do verniz (eles só aparecem perto da luz, então a luz revela em vez de mostrar
// tudo). Depois a boina da politriz passa e, na segunda passada da luz, aquela faixa está limpa.
// A trajetória da luz termina na borda do card 02. O cursor inclina a barra alguns graus.
import * as THREE from '../../vendor/three.min.js';
import { $, view, pointer, state, clamp, lerp, span, smooth, smoother, env } from '../core.js';
import { post } from '../gl/engine.js';
import { hoodY, hoodGeometry, swirlTexture, StudioLights, sharedUniforms, paintMaterial, polisher, backdrop, typePlane } from '../gl/studio.js';
import { Act, cardState } from './act.js';

// Linha do tempo (p do ato): movimento -> parada nítida -> card -> movimento -> parada -> saída.
// As duas passadas da luz param no mesmo ponto do capô (PARK), onde o reflexo cruza os riscos: na
// primeira parada o card 02 chega e os riscos aparecem; na segunda (data-hold do HTML) o mesmo
// ponto está limpo, e "Ver antes" compara antes e depois sem mudar o enquadramento.
const T = { pass1: [0.06, 0.34], card: [0.34, 0.42, 0.93, 0.96], pol: [0.5, 0.66], pass2: [0.66, 0.84], close: [0.92, 0.97] };
const PARK = 0.5;   // x da barra parada (de 2,4 ali em frente até aqui; abaixo de ~0,3 o reflexo sai do quadro)

export class PolishAct extends Act {
  constructor(el, { engine, quality }) {
    super(el);
    this.gl = !!engine;
    this.card = $('.card', el);
    this.slit = Object.assign(document.createElement('div'), { className: 'slit', innerHTML: '<i></i>' });
    this.slit.setAttribute('aria-hidden', 'true');
    this.stage.append(this.slit);
    this.toggle = $('[data-explore="polish"]', el);
    this.before = false;
    this.toggle.addEventListener('click', () => {
      this.before = !this.before;
      this.toggle.setAttribute('aria-pressed', String(this.before));
      this.dirty = true;
    });
    // no toque, arrastar na cena inclina a luz
    this.drag = 0;
    let sx = null;
    this.stage.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' && !e.target.closest('.card')) sx = e.clientX; });
    this.stage.addEventListener('pointermove', e => { if (sx != null) { this.drag = clamp((e.clientX - sx) / (view.w * 0.4), -1, 1); this.dirty = true; } });
    addEventListener('pointerup', () => { sx = null; });
    addEventListener('pointercancel', () => { sx = null; });
    if (!engine) return;
    this.build(quality);
  }

  build(quality) {
    const low = quality.name !== 'high';
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0, 0, 0);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.01, 60);
    this.lights = new StudioLights();
    this.shared = sharedUniforms();
    this.scene.add(this.lights.group);
    const { sky, floor } = backdrop(this.lights, this.shared);
    this.scene.add(sky, floor);
    this.floor = floor;
    this.swirl = swirlTexture(low ? 768 : 1024, 17);
    this.paint = paintMaterial(this.lights, this.shared, this.swirl);
    this.hood = new THREE.Mesh(hoodGeometry(low ? 220 : 320, low ? 150 : 220), this.paint);
    this.scene.add(this.hood);
    this.pol = polisher(this.lights, this.shared);
    this.scene.add(this.pol);
    this.num = typePlane('02', this.shared, { h: 1.8, color: 0.055 });
    this.num.position.set(3.6, 0.12, -1.9);
    this.num.rotation.y = -Math.PI * 0.36;
    this.scene.add(this.num);
    this.cam = new THREE.Vector3(); this.tgt = new THREE.Vector3(); this.tmp = new THREE.Vector3();
  }

  resize(w, h) {
    if (!this.camera) return;
    this.camera.aspect = w / h;
    this.camera.fov = view.portrait ? 46 : 30;
    // celular: a cena fica na parte de cima (o card ocupa a de baixo)
    if (view.portrait) this.camera.setViewOffset(w, h, 0, h * 0.18, w, h); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  key() { return `${Math.round(this.p * 2000)}|${this.before}|${Math.round(this.drag * 50)}`; }
  // só a boina girando anima no tempo (enquanto a politriz passa)
  get animating() { return this.dirty || (this.p > T.pol[0] && this.p < T.pol[1]); }

  // o próprio botão alterna antes/depois; longe da segunda parada, leva até ela (é onde há o
  // que comparar)
  explore(btn, { jump }) { if (!state.flat && Math.abs(this.raw - this.hold) > 0.05) jump(this.hold, btn); }
  focusPoint() { return this.hold; }

  update() {
    const p = this.p;
    // o card chega quando a luz para no fim da primeira passada, na ponta da trajetória
    cardState(this.card, p, T.card, 0.14);
    // saída: a cena fecha numa fenda e sobra só a linha, que encolhe
    const close = smooth(span(p, T.close[0], T.close[1])), shrink = smooth(span(p, T.close[1], 1));
    const st = this.slit.style;
    st.setProperty('--vis', close > 0.001 && !state.reduce ? 'visible' : 'hidden');
    st.setProperty('--open', (1 - close).toFixed(3));
    st.setProperty('--line', (1 - shrink).toFixed(3));
    st.setProperty('--line-a', close.toFixed(3));
  }

  render(engine, now) {
    this.dirty = false;
    const p = this.p, P = this.paint.uniforms, L = this.lights, sh = this.shared, cam = this.camera;
    const portrait = view.portrait;

    // ——— Câmera: rasante, quase parada (a cena é da luz, não da câmera) ———
    const push = smooth(span(p, 0, 1));
    if (portrait) {
      this.cam.set(lerp(-0.95, -0.85, push), hoodY(-0.9, 0.2) + lerp(0.62, 0.56, push), lerp(0.3, 0.26, push));
      this.tgt.set(0.25, -0.02, -0.12);
    } else {
      this.cam.set(lerp(-1.12, -0.98, push), hoodY(-1, 0.4) + lerp(0.3, 0.27, push), lerp(0.66, 0.6, push));
      this.tgt.set(0.42, -0.04, -0.18);
    }
    const k = state.reduce ? 0 : 0.01;
    cam.position.copy(this.cam);
    cam.position.x += pointer.sy * k;
    cam.position.z += -pointer.sx * k;
    cam.lookAt(this.tgt);
    sh.uCam.value.copy(cam.position);
    const dist = cam.position.distanceTo(this.tgt);
    sh.uFocus.value = dist;
    sh.uAperture.value = 0;

    // ——— A linha de luz: barra de LED atravessada sobre o capô ———
    // primeira passada (revela os riscos), a boina passa, segunda passada (mostra a faixa limpa)
    const pass1 = smoother(span(p, T.pass1[0], T.pass1[1]));
    const pass2 = smoother(span(p, T.pass2[0], T.pass2[1]));
    const inPass2 = p > T.pass2[0];
    const sweep = inPass2 ? pass2 : pass1;
    const on = smooth(span(p, 0.02, 0.1));
    // a barra corre da frente do capô para trás (o reflexo anda em direção à câmera e ao card)
    const bx = lerp(2.4, PARK, sweep);
    // o cursor (ou arrastar no toque) inclina a barra poucos graus em torno do centro
    const tilt = (state.reduce ? 0 : pointer.sx * 0.07) + this.drag * 0.07;
    const ax = [Math.sin(tilt), 0, Math.cos(tilt)];
    const I = 12 * on;
    L.set(0, [bx, 0.78, -0.2], ax, 0.01, 1.3, [I, I * 0.985, I * 0.96], 0.0025, true);
    // softbox fraco no reflexo da câmera: um degradê largo que desenha a forma do capô
    const vx = this.tgt.x - cam.position.x, vz = this.tgt.z - cam.position.z, vl = Math.hypot(vx, vz) || 1;
    const fill = 0.32 * on;
    L.set(1, [this.tgt.x + (vx / vl) * 3.2, 1.25, this.tgt.z + (vz / vl) * 3.2], [-vz / vl, 0, vx / vl], 0.6, 2.2, [fill, fill, fill * 1.02], 0.6, false);
    L.count(2);
    P.uFill.value = 0.03;
    P.uInspSpread.value = view.portrait ? 1.2 : 2.2;
    P.uSwirlScale.value = view.portrait ? 1.6 : 1.15;
    P.uSwirlGain.value = view.portrait ? 1.6 : 3.0;

    // a luz de inspeção (riscos) acompanha o centro do reflexo da barra
    // (sem oscilar no tempo: parada é parada, os riscos não cintilam)
    this.tmp.set(bx, 0.95, -0.15);
    P.uInsp.value.copy(this.tmp);
    const insp = on * 3.2;
    P.uInspC.value.setRGB(insp, insp * 0.98, insp * 0.95);
    P.uSwirl.value = 1;
    P.uInspBar.value = 1;

    // ——— Politriz: passa entre as duas passadas da luz e deixa a faixa corrigida ———
    const pp = span(p, T.pol[0], T.pol[1]);
    this.pol.visible = pp > 0 && pp < 1;
    const zA = 1.0, zB = -1.05;
    if (this.pol.visible) {
      const x = -0.42, z = lerp(zA, zB, smooth(pp));
      this.pol.position.set(x, hoodY(x, z) + 0.012, z);
      this.pol.rotation.set(0, Math.PI * 0.55, 0);
      // giro pelo relógio (igual em 60 e 120 Hz)
      this.pol.userData.pad.rotation.y = now * 0.0084;
      this.pol.userData.foam.uniforms.uSpin.value = now * 0.003;
    }
    // faixa corrigida: z acima de uPolishZ fica sem riscos (a boina andou de zA para zB)
    let polishZ = pp <= 0 ? 9 : pp >= 1 ? zB : lerp(zA, zB, smooth(pp));
    if (this.before) polishZ = 9;
    P.uPolishZ.value = polishZ;

    // número grande ao fundo, fora de foco
    this.num.material.uniforms.uAlpha.value = env(p, [0.08, 0.3, 0.9, 1.01]);

    // o reflexo da barra na pintura é o assunto: sem desfoque nenhum na cena (o número do fundo
    // já vem desfocado na própria textura) e bloom só na barra em si, não no reflexo
    post.exposure = 1;
    post.vignette = 0.2;   // o reflexo passa pelo canto de baixo: vinheta fraca
    post.dof = 0;
    engine.render(this.scene, cam);
  }
}
