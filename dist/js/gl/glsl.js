// Trechos de GLSL compartilhados.
//
// A iluminação de estúdio é feita com barras de luz analíticas: cada barra é um segmento
// luminoso no espaço (centro, eixo, meia-largura, meia-comprimento). O reflexo é calculado
// pela menor distância entre o raio refletido e o segmento, então os reflexos têm a forma
// exata das barras, deslizam pelas curvas quando a câmera ou a luz se movem e ficam nítidos
// como em um estúdio automotivo de verdade.

export const MAX_BARS = 6;

export const BARS = /* glsl */ `
#define MAX_BARS ${MAX_BARS}
uniform vec4 uBarC[MAX_BARS]; // centro.xyz, meia-largura
uniform vec4 uBarA[MAX_BARS]; // eixo.xyz (unitário), meio-comprimento
uniform vec4 uBarI[MAX_BARS]; // cor * intensidade, suavidade da borda
uniform int uBarN;
uniform vec3 uAmbTop;
uniform vec3 uAmbBottom;

// Largura do pixel no raio refletido (radianos por pixel): soma à suavidade da borda do brilho,
// que senão seria amostrado num ponto (degraus parados e cintilação quando a câmera mexe; o MSAA
// não amostra o sombreamento). Quem usa chama barsFootprint(r) no corpo principal do shader,
// fora de qualquer if (derivadas só valem em fluxo uniforme), antes de chamar barsRadiance.
float barsPix = 0.0;
void barsFootprint(vec3 r) { barsPix = length(fwidth(r)); }

// Radiância que chega pelo raio (p, r) vinda das barras. rough espalha o reflexo.
vec3 barsRadiance(vec3 p, vec3 r, float rough) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < MAX_BARS; i++) {
    if (i >= uBarN) break;
    vec3 c = uBarC[i].xyz; float w = uBarC[i].w;
    vec3 a = uBarA[i].xyz; float l = uBarA[i].w;
    vec3 w0 = p - c;
    float b = dot(r, a);
    float e = dot(w0, a);
    float den = max(1.0 - b * b, 1e-4);
    float t = (e * b - dot(w0, r)) / den;
    if (t <= 0.0) continue;
    float s = e + t * b;
    float dist = length(w0 + t * r - s * a);
    float soft = uBarI[i].w + rough * t + barsPix * t;
    float across = 1.0 - smoothstep(w, w + soft, dist);
    float along = 1.0 - smoothstep(l, l + soft * 2.0 + 0.04 * l, abs(s));
    acc += uBarI[i].rgb * across * along * (w / (w + 0.35 * soft));
  }
  return acc;
}

// Luz difusa aproximada de cada barra (ponto mais próximo do segmento).
vec3 barsDiffuse(vec3 p, vec3 n) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < MAX_BARS; i++) {
    if (i >= uBarN) break;
    vec3 c = uBarC[i].xyz; vec3 a = uBarA[i].xyz; float l = uBarA[i].w;
    vec3 q = c + clamp(dot(p - c, a), -l, l) * a;
    vec3 L = q - p;
    float d2 = dot(L, L);
    L *= inversesqrt(max(d2, 1e-6));
    acc += uBarI[i].rgb * max(dot(n, L), 0.0) * (uBarC[i].w * l) / (0.02 + d2);
  }
  return acc;
}

// Ambiente do estúdio: quase escuro, um pouco mais claro em cima.
vec3 studioAmbient(vec3 r) {
  return mix(uAmbBottom, uAmbTop, smoothstep(-0.4, 0.8, r.y));
}

float fresnel(float cosT, float f0) {
  return f0 + (1.0 - f0) * pow(1.0 - clamp(cosT, 0.0, 1.0), 5.0);
}
`;

export const NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
`;

export const COLOR = /* glsl */ `
vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;
