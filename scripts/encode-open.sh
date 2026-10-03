#!/usr/bin/env bash
# Os dois filmes do desktop (v6.2), a partir do master: a abertura (f0 → f168: a aproximação até o
# capô e o jato) e o final (f84 → f0: do carro pronto até o galpão do começo, invertido).
#
# Mesmo caminho do trecho da lavagem (scripts/encode-wash.sh):
#   1. quadros do master sem perdas, na matriz BT.709 (a mesma que o navegador usa para vídeo HD);
#   2. Real-ESRGAN 4× reduzido para 2560 (scripts/frames/upscale.py);
#   3. textura do original de volta (scripts/frames/detail_blend.py);
#   4. 1920×1082;
#   5. um quadro calculado entre cada dois (scripts/frames/interp.sh): 48 por segundo de filme, os
#      originais intactos nos índices pares. Com 24, cada quadro ocupava 9 a 16 px de rolagem e a
#      imagem andava em degraus;
#   6. H.264 e VP9 (a página usa o que o aparelho decodifica por hardware, js/scrub.js), marcados
#      como BT.709, GOP 8 sem quadros B (a busca de quadro decodifica pouco e a nitidez não
#      "respira"), H.264 no nível 4.2.
# A aproximação (índices 0–250) é câmera andando: qualidade um pouco menor nela (zona do x264 e CRF
# do VP9 por trecho) e a nitidez inteira no jato (251–336), que é onde a pessoa para.
# O último quadro de cada filme troca por uma foto do mesmo quadro (wash/freeze-*, final/end-*), e
# o primeiro do final entra sobre a foto do resultado: no H.264 esses quadros vão em QP 13. O x264
# não aplica zona ao último quadro do fluxo, então o arquivo leva uma cópia dele depois do fim (a
# página nunca busca a cópia).
#
# Uso: bash scripts/encode-open.sh <pasta-de-trabalho> [pasta com os quadros 2560 já ampliados]
# A pasta de trabalho recebe src/ (quadros do master), hi/ (ampliados), blend/, d/, d48/ (48 por
# segundo) e as listas de cada filme (open/, rev/).
# Sem a segunda pasta, a ampliação roda aqui (cerca de 2 h em 4 núcleos; precisa do modelo em
# ESRGAN=<real_esrgan_general_x4v3.onnx> e de PYTHONPATH com onnxruntime, numpy, Pillow, OpenCV).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MASTER="$ROOT/source/porsche-scroll.mp4"
WORK="$1"
HI="${2:-$WORK/hi}"
LAST=168
mkdir -p "$ROOT/dist/assets/open" "$ROOT/dist/assets/final" "$WORK/src" "$HI" "$WORK/blend" "$WORK/d" "$WORK/open" "$WORK/rev"

# 1. quadros sem perdas, matriz BT.709 (select pelo número do quadro: exato)
ffmpeg -v error -y -i "$MASTER" -vf "select='lte(n\,$LAST)',scale=in_color_matrix=bt709:in_range=tv:out_range=pc:flags=lanczos+accurate_rnd+full_chroma_int+full_chroma_inp,format=rgb24" \
  -fps_mode passthrough -start_number 0 "$WORK/src/f%03d.png"

# 2. ampliação (pula os quadros que já existem)
for i in $(seq -f "%03g" 0 $LAST); do
  [ -f "$HI/f$i.png" ] || python3 "$ROOT/scripts/frames/upscale.py" "${ESRGAN:?modelo ESRGAN}" "$WORK/src/f$i.png" "$HI/f$i.png" 1.336117
done

# 3. textura do original de volta; 4. 1920×1082
for i in $(seq -f "%03g" 0 $LAST); do
  python3 "$ROOT/scripts/frames/detail_blend.py" "$WORK/src/f$i.png" "$HI/f$i.png" "$WORK/blend/f$i.png" > /dev/null
done
ffmpeg -v error -y -framerate 24 -start_number 0 -i "$WORK/blend/f%03d.png" -vf "scale=1920:1082:flags=lanczos" -start_number 0 "$WORK/d/f%03d.png"

# 5. 48 por segundo de filme: 337 quadros (f0 do master = 0, f168 = 336)
bash "$ROOT/scripts/frames/interp.sh" "$WORK/d" 0 $LAST 2 "$WORK/d48"
N=$((LAST * 2 + 1))
q() { printf f%04d "$1"; }
# abertura: os 337 e a cópia do último; final: f84 → f0 do master (índices 168 → 0) e a cópia
for i in $(seq 0 $((N - 1))); do ln -sf "$WORK/d48/$(q "$i").png" "$WORK/open/$(q "$i").png"; done
ln -sf "$WORK/d48/$(q $((N - 1))).png" "$WORK/open/$(q "$N").png"
for i in $(seq 0 168); do ln -sf "$WORK/d48/$(q $((168 - i))).png" "$WORK/rev/$(q "$i").png"; done
ln -sf "$WORK/d48/$(q 0).png" "$WORK/rev/$(q 169).png"

TAGS=(-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)
YUV="scale=out_color_matrix=bt709:out_range=tv,format=yuv420p"
h264() {  # <quadros> <n> <saída> <zonas do x264>
  ffmpeg -v error -y -framerate 48 -start_number 0 -i "$1" -frames:v "$2" -vf "$YUV" -c:v libx264 -profile:v high -level:v 4.2 -refs 4 \
    -preset slow -crf 18 -bf 0 -g 8 -keyint_min 8 -sc_threshold 0 -x264-params "ipratio=1.1:zones=$4" "${TAGS[@]}" -movflags +faststart -an "$3"
}
vp9() {  # <quadros> <primeiro> <n> <saída> <crf>
  ffmpeg -v error -y -framerate 48 -start_number "$2" -i "$1" -frames:v "$3" -vf "$YUV" -c:v libvpx-vp9 -crf "$5" -b:v 0 -g 8 -keyint_min 8 \
    -row-mt 1 -deadline good -cpu-used 1 -auto-alt-ref 0 -lag-in-frames 0 "${TAGS[@]}" -an "$4"
}
# abertura: a aproximação (0–250) com 70% da taxa; o jato (251–336) inteiro; o quadro do corte
# (336) em QP 13. No VP9 (sem zonas) os dois trechos são codificados à parte (CRF 27 e 20) e
# juntados sem recodificar. Contra os quadros de origem: H.264 41–43 dB, VP9 42–45 dB; o corte para
# a foto: 41,6 dB (H.264) e 42,0 dB (VP9). ~8,3 MB (H.264) e ~10 MB (VP9)
h264 "$WORK/open/f%04d.png" $((N + 1)) "$ROOT/dist/assets/open/open.mp4" "0,250,b=0.7/$((N - 1)),$((N - 1)),q=13"
vp9 "$WORK/d48/f%04d.png" 0 251 "$WORK/open-a.webm" 27
vp9 "$WORK/d48/f%04d.png" 251 $((N - 251)) "$WORK/open-b.webm" 20
printf "file '%s'\nfile '%s'\n" "$WORK/open-a.webm" "$WORK/open-b.webm" > "$WORK/open.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$WORK/open.txt" -c copy "$ROOT/dist/assets/open/open.webm"
# final: tudo é câmera recuando; o primeiro quadro (sobre a foto do resultado) e o último (antes de
# end-*) em QP 13
h264 "$WORK/rev/f%04d.png" 170 "$ROOT/dist/assets/final/final.mp4" "0,0,q=13/1,167,b=0.75/168,168,q=13"
vp9 "$WORK/rev/f%04d.png" 0 169 "$ROOT/dist/assets/final/final.webm" 25
# a foto do fim do filme final (o quadro 0) nos dois níveis do desktop
python3 - "$WORK/blend/f000.png" "$ROOT/dist/assets/final" <<'EOF'
import sys, subprocess, os, tempfile
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
for w, h in ((2560, 1443), (1920, 1082)):
    t = tempfile.NamedTemporaryFile(suffix='.png', delete=False).name
    (im if im.size == (w, h) else im.resize((w, h), Image.LANCZOS)).save(t)
    subprocess.run([os.environ.get('CWEBP', 'cwebp'), '-quiet', '-m', '6', '-mt', '-q', '92', '-sharp_yuv', t, '-o', f'{out}/end-{w}.webp'], check=True)
    os.unlink(t)
EOF
ls -la "$ROOT/dist/assets/open" "$ROOT/dist/assets/final"
