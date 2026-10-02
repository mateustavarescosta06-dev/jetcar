// Cena do filme: abertura (escuridão → linha de luz → luzes do estúdio → aproximação),
// marca (a câmera recua por dentro do T e atravessa o A), lavagem (filme controlado pela
// rolagem, termina mergulhando na pintura escura) e o final (luzes acendendo, portão, letreiro).
import * as THREE from '../../vendor/three.min.js';
import { view, pointer, state, clamp, lerp, span, smooth, smoother, env, glerp, curve } from '../core.js';
import { C, at } from '../chapters.js';
import { FrameSequence, FILM, filmMaterial } from './film.js';
import { buildLogoWall, LOGO_TARGETS } from './logo.js';
import { post } from './engine.js';

const Z_HERO = -0.034;      // câmera logo atrás da parede: a parede some, o filme cobre a tela
const WALL_T = 0.018;       // espessura da parede do logo

/** Linha de luz física (plano emissivo fino, aditivo). */
function lightLine(color) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uI; varying vec2 vUv;
      void main() {
        float x = abs(vUv.x - 0.5) * 2.0;
        float core = exp(-x * x * 40.0);
        float halo = exp(-x * x * 4.0) * 0.25;
        float ends = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
        gl_FragColor = vec4(uColor * uI * (core + halo) * ends, 1.0);
      }`,
    uniforms: { uColor: { value: new THREE.Color(color) }, uI: { value: 0 } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  m.frustumCulled = false;
  return m;
}

function setBar(u, i, c, a, hw, hl, color, soft = 0.002) {
  u.uBarC.value[i].set(c[0], c[1], c[2], hw);
  u.uBarA.value[i].set(a[0], a[1], a[2], hl);
  u.uBarI.value[i].set(color[0], color[1], color[2], soft);
}

export class FilmShot {
  constructor(quality) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0, 0, 0);
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.0004, 40);
    const mobile = view.mobile;
    this.seq = new FrameSequence(mobile ? 'assets/film/m' : 'assets/film/d', FILM.count, { mipmaps: quality.name !== 'low' });
    this.mat = filmMaterial(quality.parallaxSteps);
    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.plane.frustumCulled = false;
    this.scene.add(this.plane);
    this.wall = buildLogoWall({ width: 1, thickness: WALL_T });
    this.scene.add(this.wall.mesh);
    this.lines = [lightLine(0xfff4e6), lightLine(0xfff7ee), lightLine(0xffffff)];
    for (const l of this.lines) this.scene.add(l);
    this.typeCanvas = document.createElement('canvas');
    this.typeCanvas.width = 2048;
    this.typeCanvas.height = 512;
    this.typeTex = new THREE.CanvasTexture(this.typeCanvas);
    this.typeTex.flipY = false;
    this.typeTex.colorSpace = THREE.NoColorSpace;
    this.mat.uniforms.tType.value = this.typeTex;
    this.typeWord = '';
    this.tmpV = new THREE.Vector3();
    // primeiros quadros já entram na fila
    this.seq.prefetch(Array.from({ length: 70 }, (_, i) => i));
    this.timeline();
  }

  /** Quando o resto da página carregou, busca os quadros que faltam (em segundo plano). */
  prefetchRest() { this.seq.prefetch(Array.from({ length: FILM.count }, (_, i) => i)); }

  timeline() {
    const H = C.marca.end;
    const p = x => x * H;
    this.H = H;
    // Tempo do filme (s) ao longo da jornada. Velocidade contínua entre as chaves.
    this.vt = curve([
      [0, 0], [p(0.2), 0.5], [p(0.3), 1.6], [p(0.45), 4.25], [p(0.56), 4.5], [p(0.75), 4.85], [p(1), 5.35],
      [at('lavagem', 0.84), 10.85], [at('lavagem', 1), 10.95],
      [at('final', 0), 11.0], [at('final', 0.18), 12.0], [at('final', 0.55), 14.4], [at('final', 0.75), 14.95], [at('final', 1), 15.0],
    ]);
    // Enquadramento em telas em pé (x do ponto de interesse no quadro, por tempo do filme).
    this.focusX = curve([[0, 0.5], [2, 0.52], [3.6, 0.46], [4.4, 0.36], [5.2, 0.5], [7, 0.55], [9, 0.62], [10.5, 0.45], [12.5, 0.45], [14, 0.47], [15, 0.42]]);
  }

  resize() {
    const { w, h } = view;
    const aspect = w / h;
    const cam = this.camera;
    // Em telas em pé, abre o campo vertical para manter um campo horizontal razoável.
    const vfov = Math.max(32, (2 * Math.atan(Math.tan((17.5 * Math.PI) / 180) / aspect) * 180) / Math.PI);
    cam.fov = Math.min(vfov, 70);
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
    const tanV = Math.tan((cam.fov * Math.PI) / 360), tanH = tanV * aspect;
    const fill = view.portrait ? 0.86 : 0.74;
    // Distância de recuo que enquadra o logo inteiro.
    this.P = Math.max(0.5 / (fill * tanH), 0.3 / (0.72 * tanV));
    this.Df = Math.max(5.5, 4.2 * this.P + 0.2);
    const dh = this.Df + Z_HERO;
    let ph = Math.max(2 * dh * tanV, (2 * dh * tanH * 9) / 16) * 1.05;
    let pw = (ph * 16) / 9;
    const needW = 1.08 * (this.P + this.Df) / this.P;
    if (pw < needW) { pw = needW; ph = (pw * 9) / 16; }
    this.plane.scale.set(pw, ph, 1);
    this.plane.position.set(0, 0, -this.Df);
    this.visFrac = Math.min(1, (2 * dh * tanH) / pw); // fração do quadro visível na horizontal
    this.mat.uniforms.uRes.value.set(Math.round(w * (this.scale || 1)), Math.round(h * (this.scale || 1)));
    for (const l of this.lines) l.scale.set(0.0045, 3.2, 1);
    this.drawType(this.typeWord, true);
  }

  setRes(W, H) { this.mat.uniforms.uRes.value.set(W, H); }

  drawType(word, force = false) {
    if (word === this.typeWord && !force) return;
    this.typeWord = word;
    const g = this.typeCanvas.getContext('2d');
    g.clearRect(0, 0, 2048, 512);
    if (!word) { this.typeTex.needsUpdate = true; return; }
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = 400;
    g.font = `italic 800 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    const wdt = g.measureText(word).width;
    if (wdt > 1960) { size = Math.floor((size * 1960) / wdt); g.font = `italic 800 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`; }
    g.fillText(word, 1024, 270);
    this.typeTex.needsUpdate = true;
  }

  active(u) { return u < C.lavagem.end || (u >= C.final.start && u < C.final.end); }

  /** Posição da câmera e dos elementos para a posição u da jornada. */
  update(u, dt) {
    const U = this.mat.uniforms;
    const cam = this.camera;
    const reduce = state.reduce;
    const H = this.H;
    const p = u / H;
    const vt = this.vt(u);
    const pair = this.seq.sample(vt + (reduce ? 0 : idleDrift(u)));
    if (pair) { U.tA.value = pair.a; U.tB.value = pair.b; U.uMix.value = pair.m; }
    this.ready = !!pair;
    U.uTime.value = state.now / 1000;

    // Enquadramento (em pé: segue o ponto de interesse; deitado: quadro inteiro).
    const fx = view.portrait ? clamp(this.focusX(vt), this.visFrac / 2, 1 - this.visFrac / 2) : 0.5;
    U.uView.value.set(fx, 0.5, 1, 0);

    // ——— Câmera ———
    const T = this.wall.toWorld(LOGO_TARGETS.T.x, LOGO_TARGETS.T.y);
    const A = this.wall.toWorld(LOGO_TARGETS.A.x, LOGO_TARGETS.A.y);
    const P = this.P;
    let x = 0, y = 0, z = Z_HERO;
    let wallOn = false;
    if (u < H) {
      if (p < 0.45) { x = lerp(0, T.x, smooth(span(p, 0.4, 0.45))); y = lerp(0, T.y, smooth(span(p, 0.4, 0.45))); }
      else if (p < 0.56) {
        // recua: atravessa a haste do T e enquadra o logo inteiro
        const t = smoother(span(p, 0.45, 0.56));
        const tc = span(t, 0, 0.12);
        if (t < 0.12) { z = lerp(Z_HERO, 0.002, tc); x = T.x; y = T.y; }
        else {
          // A posição do T na tela anda em linha reta do centro até o lugar final dele,
          // enquanto a distância cresce em progressão geométrica (o recuo parece constante).
          const tt = (t - 0.12) / 0.88;
          z = glerp(0.002, P, tt);
          const sx = (T.x / P) * tt, sy = (T.y / P) * tt;
          x = T.x - sx * z; y = T.y - sy * z;
        }
        wallOn = true;
      } else if (p < 0.7) {
        const t = span(p, 0.56, 0.7);
        z = lerp(P, P * 0.9, smooth(t)); x = 0; y = 0;
        wallOn = true;
      } else if (p < 0.92) {
        // aproxima e atravessa a perna do A
        const t = smoother(span(p, 0.7, 0.92));
        if (t < 0.9) {
          const tt = t / 0.9;
          const z0 = P * 0.9;
          z = glerp(z0, 0.002, tt);
          const sx = (A.x / z0) * (1 - tt), sy = (A.y / z0) * (1 - tt);
          x = A.x - sx * z; y = A.y - sy * z;
        } else { z = lerp(0.002, Z_HERO, (t - 0.9) / 0.1); x = A.x; y = A.y; }
        wallOn = true;
      } else {
        const t = smooth(span(p, 0.92, 1));
        x = lerp(A.x, 0, t); y = lerp(A.y, 0, t); z = Z_HERO;
      }
    }
    // Resposta mínima ao cursor: a câmera desloca poucos milímetros (o fundo quase não mexe).
    const k = reduce ? 0 : 1;
    const wobble = wallOn ? 0.012 : 0.006;
    cam.position.set(x + pointer.sx * wobble * k, y - pointer.sy * wobble * 0.6 * k, z);
    cam.lookAt(cam.position.x * 0.6, cam.position.y * 0.6, -this.Df);
    this.wall.mesh.visible = wallOn;

    // Paralaxe interna do filme acompanha a câmera (a profundidade de cada pixel reage).
    U.uParallax.value.set(-(cam.position.x - x * 0.98) * 3.2 - pointer.sx * 0.006 * k, (cam.position.y - y * 0.98) * 3.2 + pointer.sy * 0.004 * k);
    U.uFocus.value = 0.25;
    U.uDollyC.value.set(0.5, 0.55);
    U.uDolly.value = 0;
    U.uSpin.value = 0;
    U.uDof.value = 0;

    // ——— Luz ———
    let exposure = 1, reveal = 1, ambient = 1, glint = 0, flare = 0, gate = 0, fixtures = 0, fixX = 0, typeA = 0;
    let lift = 0, sweepI = 0, sweepX = 0, foam = 0;
    const lineI = [0, 0, 0], lineX = [0, 0, 0];
    if (u < H) {
      // escuridão → linha de luz → luzes do estúdio acendem
      reveal = smooth(span(p, 0.1, 0.24));
      ambient = lerp(0.015, 1, smooth(span(p, 0.12, 0.26)));
      lineI[0] = env(p, [0.01, 0.045, 0.2, 0.26]) * 5;
      lineX[0] = lerp(-0.62, 0.62, smoother(span(p, 0.035, 0.22)));
      lineI[1] = env(p, [0.12, 0.16, 0.22, 0.28]) * 4;
      lineX[1] = lerp(0.75, 0.12, smoother(span(p, 0.12, 0.27)));
      // detalhe da carroceria: uma terceira luz percorre a frente e mostra o volume do capô
      lineI[2] = env(p, [0.33, 0.37, 0.42, 0.46]) * 3.5;
      lineX[2] = lerp(-0.55, 0.3, smooth(span(p, 0.33, 0.46)));
      glint = 0.5;
      // a luz de estúdio atravessa a parede do logo da esquerda para a direita
      const st = span(p, 0.52, 0.74);
      sweepI = env(p, [0.52, 0.56, 0.7, 0.74]);
      sweepX = lerp(-2.6, 2.6, smoother(st));
    } else if (u < C.lavagem.end) {
      const t = span(u, C.lavagem.start, C.lavagem.end);
      // mergulho na pintura enquanto a espuma da lavagem cobre a lente (o estúdio a enxágua)
      const dive = smooth(span(t, 0.8, 1));
      U.uDolly.value = dive * 2.4;
      U.uDollyC.value.set(0.42, 0.66);
      exposure = 1 - smooth(span(t, 0.88, 0.995)) * 0.6;
      glint = 0.3;
      foam = smooth(span(t, 0.7, 0.975));
    } else {
      const t = span(u, C.final.start, C.final.end);
      // escuro → reflexos na pintura → recuo com as luminárias acendendo → carro inteiro →
      // letreiro atrás do carro → o portão sobe e a luz de fora recorta tudo
      exposure = smooth(span(t, 0.0, 0.08)) * (1 - smooth(span(t, 0.9, 0.985)));
      lineI[0] = env(t, [0.01, 0.05, 0.14, 0.2]) * 4;
      lineX[0] = lerp(-0.5, 0.6, smooth(span(t, 0.02, 0.2)));
      glint = 1.2 * env(t, [0.0, 0.05, 0.16, 0.24]) + 0.3;
      ambient = lerp(0.22, 1, smooth(span(t, 0.36, 0.6)));
      reveal = lerp(0.35, 1, smooth(span(t, 0.36, 0.6)));
      fixtures = smooth(span(t, 0.3, 0.36));
      fixX = lerp(-0.05, 1.05, smooth(span(t, 0.33, 0.56)));
      // o portão (atrás da câmera) sobe: a luz do dia sobe pelo carro e acende o letreiro
      gate = span(t, 0.66, 0.86);
      // e o carro sai: as rodas começam a girar e ele avança na direção da luz (da câmera)
      const go = smooth(span(t, 0.86, 0.985));
      U.uSpin.value = smooth(span(t, 0.84, 0.95)) * 2.6;
      U.uDolly.value = smooth(span(t, 0.66, 0.86)) * 0.25 + go * go * 0.9;
      U.uDollyC.value.set(0.42, 0.66);
      this.drawType(t > 0.5 ? 'JETCAR' : '');
      typeA = env(t, [0.56, 0.62, 0.9, 0.95]);
      // em pé o letreiro cabe na parte visível do quadro; deitado ocupa a largura toda
      const tw = view.portrait ? this.visFrac * 0.92 : 0.9, th = tw * (512 / 2048) * (16 / 9);
      U.uTypeRect.value.set(view.portrait ? fx - tw / 2 : 0.05, view.portrait ? 0.36 - 0.84 * th : 0.1, tw, th);
      U.uTypeDepth.value = 0.34;
      flare = env(t, [0.76, 0.84, 0.92, 0.97]) * 0.5;
      // linha de luz no chão que vira a rota do mapa
      lineI[2] = smooth(span(t, 0.88, 0.97)) * 6;
    }
    if (wallOn) {
      // dentro das letras o filme fica mais luminoso, para o logo ler bem
      lift = smooth(span(p, 0.47, 0.56)) * (1 - smooth(span(p, 0.86, 0.93)));
      exposure *= 1 + lift * 0.9;
    }
    U.uExposure.value = exposure;
    U.uReveal.value = reveal;
    U.uAmbient.value = ambient;
    U.uGlint.value = glint;
    U.uShine.value = 18;
    U.uGate.value = gate;
    U.uFixtures.value = fixtures;
    U.uFixtureX.value = fixX;
    U.uFlare.value = flare;
    U.uTypeAlpha.value = typeA;
    U.uTypeLit.value = 0;

    // Linhas de luz físicas entre a câmera e o filme (paralaxe real com o cursor). A posição de
    // cada uma na tela vai para o filme, que ilumina a faixa e acende o brilho nas curvas.
    const dLine = 1.6;
    const bars = U.uBar.value;
    bars[0].set(0, 0, 0.16, 0); bars[1].set(0, 0, 0.16, 0);
    let slot = 0;
    const tanH = Math.tan((cam.fov * Math.PI) / 360) * cam.aspect;
    for (let i = 0; i < 3; i++) {
      const L = this.lines[i];
      const floor = u >= C.final.start && i === 2;
      L.visible = lineI[i] > 0.001;
      L.material.uniforms.uI.value = lineI[i];
      if (floor) {
        // horizontal, rente ao chão: vira a rota do mapa
        L.rotation.z = Math.PI / 2;
        L.scale.set(0.004, 4, 1);
        L.position.set(0, -0.36, Z_HERO - dLine);
        continue;
      }
      L.rotation.z = 0;
      L.scale.set(0.0045, 3.2, 1);
      L.position.set(lineX[i] * dLine * tanH + cam.position.x, 0, cam.position.z - dLine);
      if (lineI[i] > 0.001 && slot < 2) {
        this.tmpV.copy(L.position).project(cam);
        bars[slot++].set(this.tmpV.x * 0.5 + 0.5, lineI[i] * 0.1, view.portrait ? 0.3 : 0.16, i === 2 ? 1.4 : 1);
      }
    }

    // ——— Luzes de estúdio refletidas na parede do logo ———
    if (wallOn) {
      const wu = this.wall.mesh.material.uniforms;
      wu.uCam.value.copy(cam.position);
      // laca preta: reflete ~4% de frente, então as luzes precisam ser fortes como num estúdio
      setBar(wu, 0, [0, 0.72, 2.2], [1, 0, 0], 0.16, 2.6, [0.55, 0.54, 0.52], 0.5);  // softbox alto, reflexo largo
      setBar(wu, 1, [sweepX, 0, 2.4], [0, 1, 0], 0.01, 3, [30 * sweepI, 29.4 * sweepI, 28.4 * sweepI], 0.003);
      setBar(wu, 2, [-1.5, 0.15, 0.8], [0, 1, 0], 0.02, 2, [6, 6, 6.3]);
      setBar(wu, 3, [1.5, 0.15, 0.8], [0, 1, 0], 0.02, 2, [6, 6, 6.3]);
      setBar(wu, 4, [0, -1.0, 1.4], [1, 0, 0], 0.08, 3, [0.5, 0.5, 0.52], 0.25);
      wu.uBarN.value = 5;
      // a mesma luz passa pelo filme dentro das letras (o reflexo e o filme acendem juntos)
      if (sweepI > 0.001) {
        const cz = cam.position.z, k2 = cz / (cz + 2.4);
        this.tmpV.set(cam.position.x + (sweepX - cam.position.x) * k2, 0, 0).project(cam);
        bars[0].set(this.tmpV.x * 0.5 + 0.5, 0.5 * sweepI, view.portrait ? 0.2 : 0.1, 1.2);
      }
      // legenda do logo logo abaixo da palavra
      this.tmpV.set(0, -(LOGO_TARGETS.base - this.wall.center.y) * this.wall.scale, 0).project(cam);
      view.logoBase = (0.5 - this.tmpV.y * 0.5) * view.h;
    }

    // farol → luz → branco → lavagem: ao atravessar o A, o farol estoura a exposição e a
    // imagem volta já na lavagem
    const flash = u < H ? env(p, [0.865, 0.902, 0.914, 0.945]) : 0;
    if (flash > 0) U.uFlare.value = Math.max(U.uFlare.value, flash * 1.5);
    post.exposure = 1 + flash * flash * flash * 46;
    post.bloom = 0.55 + flash * 1.4;
    post.threshold = 0.95;
    post.knee = 0.5;
    post.vignette = 0.6;
    post.grain = view.mobile ? 0.03 : 0.04;
    // o branco só chega no auge (as luzes estouram antes, não é uma névoa por cima da imagem)
    post.white = smooth(span(flash, 0.86, 1)) * 0.96;
    post.foam = foam;
    post.foamY = foam * 0.05;
    post.black = 0;
    post.chroma = 0;
  }
}

/** Respiração do filme quando a rolagem para: o tempo oscila de leve (nunca congela). */
let driftT = 0, lastU = 0, still = 0;
function idleDrift(u) {
  const moving = Math.abs(u - lastU) > 1e-5;
  lastU = u;
  still = moving ? 0 : Math.min(1, still + state.dt / 1600);
  driftT += (state.dt / 1000) * still;
  return Math.sin(driftT * 0.55) * 0.18 * still;
}
