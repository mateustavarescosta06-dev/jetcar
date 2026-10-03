// Materiais físicos (Three.js MeshPhysicalMaterial) do capô do Ceramic, cena 03.
// Onde o 3D de verdade ganha da foto: a chapa, o primer, a cor metálica, o verniz e o coating
// são materiais PBR com reflexos que respondem à luz em tempo real. As barras de luz do estúdio
// (e a linha de luz da JETCAR) viram luzes de área (RectAreaLight, integração LTC analítica):
// o reflexo de uma barra num verniz liso fica nítido em qualquer distância, sem depender da
// resolução de um mapa de ambiente. O mapa de ambiente (PMREM de uma sala escura com softbox e
// tiras) dá só o reflexo largo e a luz das superfícies foscas.
import * as THREE from '../../vendor/three.min.js';

let ltc = null;
/** Tabelas LTC das luzes de área: carregadas uma vez, só por quem usa (vendor/three-ltc.js). */
export function loadLTC() {
  if (!ltc) ltc = import('../../vendor/three-ltc.js').then(m => { m.RectAreaLightUniformsLib.init(); return true; }).catch(() => false);
  return ltc;
}

/** Ambiente do estúdio para os reflexos (PMREM): sala quase preta, softbox no teto, duas tiras
 *  verticais e uma tira no fundo, nas mesmas direções das barras da cena. */
export function studioEnvironment(renderer) {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(24, 12, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.012, 0.0122, 0.013), side: THREE.BackSide }));
  room.position.y = 5;
  scene.add(room);
  const panel = (w, h, pos, rot, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k * 0.995, k * 0.98), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.rotation.set(...rot);
    scene.add(m);
  };
  panel(8, 3, [0, 7, 0.5], [Math.PI / 2, 0, 0], 3.2);        // softbox no teto
  panel(0.5, 7, [-8, 3, -1], [0, Math.PI / 2, 0], 5);        // tira à esquerda
  panel(0.5, 7, [8, 3, 1.5], [0, -Math.PI / 2, 0], 5);       // tira à direita
  panel(14, 0.5, [0, 4.5, -11], [0, 0, 0], 4);               // tira no fundo
  // fundo infinito de estúdio: uma parede clara e difusa ao redor (o metal escovado e o primer
  // refletem um degradê em vez do preto da sala)
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    panel(14, 5, [Math.sin(a) * 11.5, 2.2, Math.cos(a) * 11.5], [0, a + Math.PI, 0], 0.22);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.0015, 0.0015, 0.0016) }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.7;
  scene.add(floor);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(scene, 0.015);
  pm.dispose();
  scene.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  return rt.texture;
}

/** O alfa da cena é a nitidez da profundidade de campo (1 = em foco): estes materiais ficam em
 *  foco. Com transmissão, o Three.js copiaria o alfa do que está atrás (o fundo desfocado). */
function inFocus(m) {
  m.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n\tgl_FragColor.a = 1.0;'); };
  m.customProgramCacheKey = () => 'jetcar-focus';
  return m;
}

/** Mapa de normais dos flocos metálicos: células de 2 a 4 px, cada uma inclinada para um lado
 *  (o brilho "salta" de floco em floco quando a luz anda). Gerado uma vez, repetido na chapa. */
let flakes = null;
function flakeNormals() {
  if (flakes) return flakes;
  const N = 512, cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgb(128,128,255)';
  g.fillRect(0, 0, N, N);
  let s = 7;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 26000; i++) {
    const x = r() * N, y = r() * N, w = 2 + r() * 2.5, a = r() * 6.2832, t = 0.25 + r() * 0.55;
    const nx = Math.cos(a) * t, ny = Math.sin(a) * t, nz = Math.sqrt(1 - t * t);
    g.fillStyle = `rgb(${Math.round((nx * 0.5 + 0.5) * 255)},${Math.round((ny * 0.5 + 0.5) * 255)},${Math.round((nz * 0.5 + 0.5) * 255)})`;
    g.fillRect(x, y, w, w);
  }
  flakes = new THREE.CanvasTexture(cv);
  flakes.colorSpace = THREE.NoColorSpace;
  flakes.wrapS = flakes.wrapT = THREE.RepeatWrapping;
  flakes.repeat.set(5, 3.5);
  flakes.anisotropy = 4;
  return flakes;
}

/** Uma camada da amostra de pintura, de baixo para cima: chapa, primer, cor, verniz, coating. */
export function physicalLayer(kind, env) {
  const base = { envMap: env, envMapIntensity: 1 };
  let m;
  if (kind === 'metal') {
    // aço da chapa: metal escovado (anisotropia ao longo do comprimento)
    m = new THREE.MeshPhysicalMaterial({ ...base, color: 0xb4b8be, metalness: 1, roughness: 0.28, anisotropy: 0.8 });
  } else if (kind === 'primer') {
    m = new THREE.MeshPhysicalMaterial({ ...base, color: 0x8c8c88, metalness: 0, roughness: 0.78 });
  } else if (kind === 'base') {
    // cor grafite metálica com flocos (a base sozinha não é lisa: o brilho de espelho é do verniz)
    m = new THREE.MeshPhysicalMaterial({ ...base, color: 0x3b3d43, metalness: 0.7, roughness: 0.34, normalMap: flakeNormals(), normalScale: new THREE.Vector2(0.55, 0.55) });
  } else if (kind === 'clear') {
    // verniz: transparente de verdade (transmissão com refração), reflexo de espelho
    m = new THREE.MeshPhysicalMaterial({ ...base, color: 0xffffff, metalness: 0, roughness: 0.035, transmission: 1, thickness: 0.05, ior: 1.5 });
  } else {
    // coating cerâmico: película finíssima, mais lisa que o verniz, com interferência de filme fino
    m = new THREE.MeshPhysicalMaterial({ ...base, color: 0xffffff, metalness: 0, roughness: 0.012, transmission: 1, thickness: 0.016, ior: 1.46, iridescence: 1, iridescenceIOR: 1.33, iridescenceThicknessRange: [260, 420] });
  }
  return inFocus(m);
}

/** Gota d'água parada sobre o coating: transmissão com o índice da água. */
export function waterBead(env) {
  return inFocus(new THREE.MeshPhysicalMaterial({ envMap: env, envMapIntensity: 1, color: 0xffffff, metalness: 0, roughness: 0, transmission: 1, thickness: 0.03, ior: 1.333 }));
}

/**
 * As barras do estúdio como luzes de área. set() recebe os mesmos parâmetros das barras
 * analíticas (StudioLights.set) e mais o ponto para onde a luz se vira: a luz de área só emite
 * para um lado (o −z local), com o comprimento ao longo do eixo da barra.
 */
export class AreaBars {
  constructor(n) {
    this.lights = Array.from({ length: n }, () => {
      const l = new THREE.RectAreaLight(0xffffff, 0, 1, 1);
      l.visible = false;
      return l;
    });
    this.group = new THREE.Group();
    for (const l of this.lights) this.group.add(l);
    this._m = new THREE.Matrix4();
    this._x = new THREE.Vector3();
    this._y = new THREE.Vector3();
    this._z = new THREE.Vector3();
  }

  set(i, c, a, hw, hl, color, to) {
    const l = this.lights[i];
    const I = Math.max(color[0], color[1], color[2]);
    l.visible = I > 0.01;
    if (!l.visible) return;
    l.width = Math.max(2 * hw, 0.004);
    l.height = 2 * hl;
    l.color.setRGB(color[0] / I, color[1] / I, color[2] / I);
    l.intensity = I;
    l.position.set(c[0], c[1], c[2]);
    // base: y = eixo da barra; z = do alvo para a luz (ela emite em −z, na direção do alvo)
    this._y.set(a[0], a[1], a[2]).normalize();
    this._z.set(c[0] - to[0], c[1] - to[1], c[2] - to[2]);
    this._z.addScaledVector(this._y, -this._z.dot(this._y)).normalize();
    this._x.crossVectors(this._y, this._z);
    this._m.makeBasis(this._x, this._y, this._z);
    l.quaternion.setFromRotationMatrix(this._m);
  }

  off(i) { this.lights[i].visible = false; }
}
