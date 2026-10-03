#!/usr/bin/env bash
# Trecho do jato para scrub no celular (v6.2: o fim do filme de abertura no celular, num quadrado),
# a partir do master. O desktop usa a abertura inteira (scripts/encode-open.sh).
#
# O master (1916×1080) já é uma recompressão CRF 24 com ~1300 px de detalhe real. Por isso:
#   1. os 43 quadros (5,25 s a 7,0 s, f126…f168) saem do master UMA vez, sem perdas, na matriz
#      BT.709 (a mesma que o navegador usa para mostrar vídeo HD; a BT.601 padrão do ffmpeg
#      desloca até 14 níveis nas cores saturadas e o corte vídeo -> foto apareceria);
#   2. cada quadro passa pelo Real-ESRGAN 4× e é reduzido para 2560 (scripts/frames/upscale.py);
#   3. detail_blend.py devolve a textura do original onde o ESRGAN a apagou;
#   4. recorte quadrado próprio sobre o capô, 1080×1080;
#   5. dois quadros calculados entre cada dois (scripts/frames/interp.sh): 72 por segundo de filme,
#      127 quadros, os originais intactos nos índices múltiplos de 3. Com 24, cada quadro ocupava
#      quase 20 px de rolagem no celular e a imagem andava em degraus;
#   6. só então o trecho é codificado para busca de quadro: GOP 8, sem quadros B (a nitidez não
#      "respira" a cada GOP e a busca decodifica menos), H.264 CRF 18 preset slow e VP9 CRF 22
#      (a página usa o que o aparelho decodifica por hardware, js/scrub.js), marcados como BT.709.
#      O último quadro (o corte para freeze-m) vai em QP 13 no H.264; o x264 não aplica zona ao
#      último quadro do fluxo, então o arquivo leva uma cópia dele depois do fim (nunca buscada).
# O congelamento (último quadro) sai do mesmo quadro por scripts/frames/build_stills.py.
#
# Uso: bash scripts/encode-wash.sh <pasta-de-trabalho> [pasta com os quadros 2560 já ampliados]
# Sem a segunda pasta, a ampliação roda aqui (cerca de 1 h em 4 núcleos; precisa do modelo em
# ESRGAN=<real_esrgan_general_x4v3.onnx> e de PYTHONPATH com onnxruntime, numpy, Pillow, OpenCV).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MASTER="$ROOT/source/porsche-scroll.mp4"
OUT="$ROOT/dist/assets/wash"
WORK="$1"
HI="${2:-$WORK/hi}"
FRAMES=43
mkdir -p "$OUT" "$WORK/src" "$HI" "$WORK/blend" "$WORK/m" "$WORK/m72p"

# 1. quadros sem perdas, matriz BT.709 (select pelo número do quadro: exato, sem arredondar tempo)
ffmpeg -v error -y -i "$MASTER" -vf "select='between(n\,126\,168)',scale=in_color_matrix=bt709:in_range=tv:out_range=pc:flags=lanczos+accurate_rnd+full_chroma_int+full_chroma_inp,format=rgb24" \
  -fps_mode passthrough -start_number 1 "$WORK/src/f%03d.png"

# 2. ampliação (pula os quadros que já existem)
for i in $(seq -f "%03g" 1 $FRAMES); do
  [ -f "$HI/f$i.png" ] || python3 "$ROOT/scripts/frames/upscale.py" "${ESRGAN:?modelo ESRGAN}" "$WORK/src/f$i.png" "$HI/f$i.png" 1.336117
done

# 3. textura do original de volta
for i in $(seq -f "%03g" 1 $FRAMES); do
  python3 "$ROOT/scripts/frames/detail_blend.py" "$WORK/src/f$i.png" "$HI/f$i.png" "$WORK/blend/f$i.png" > /dev/null
done

# 4. 1080×1080 (recorte de 1443 px em x=641 no quadro de 2560)
ffmpeg -v error -y -framerate 24 -i "$WORK/blend/f%03d.png" -vf "crop=1443:1443:641:0,scale=1080:1080:flags=lanczos" "$WORK/m/f%03d.png"

# 5. 72 por segundo de filme
bash "$ROOT/scripts/frames/interp.sh" "$WORK/m" 1 $FRAMES 3 "$WORK/m72"
N=$(((FRAMES - 1) * 3 + 1))
for i in $(seq 0 $((N - 1))); do ln -sf "$WORK/m72/$(printf f%04d "$i").png" "$WORK/m72p/$(printf f%04d "$i").png"; done
ln -sf "$WORK/m72/$(printf f%04d $((N - 1))).png" "$WORK/m72p/$(printf f%04d "$N").png"

TAGS=(-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)
YUV="scale=out_color_matrix=bt709:out_range=tv,format=yuv420p"
G=8; NAME=scrub-m
ffmpeg -v error -y -framerate 72 -start_number 0 -i "$WORK/m72p/f%04d.png" -frames:v $((N + 1)) -vf "$YUV" -c:v libx264 -profile:v high -level:v 4.2 \
  -preset slow -crf 18 -bf 0 -g $G -keyint_min $G -sc_threshold 0 -x264-params "ipratio=1.1:zones=$((N - 1)),$((N - 1)),q=13" "${TAGS[@]}" -movflags +faststart -an "$OUT/$NAME.mp4"
ffmpeg -v error -y -framerate 72 -start_number 0 -i "$WORK/m72/f%04d.png" -frames:v $N -vf "$YUV" -c:v libvpx-vp9 -crf 22 -b:v 0 -g $G -keyint_min $G \
  -row-mt 1 -deadline good -cpu-used 1 -auto-alt-ref 0 -lag-in-frames 0 "${TAGS[@]}" -an "$OUT/$NAME.webm"
# o congelamento: o último quadro já com textura, em 2× (3832) não existe aqui; build_stills.py usa
# o quadro f168 ampliado à parte. Este é o mesmo quadro em 2560, para conferir o corte:
cp "$WORK/blend/f$(printf %03d $FRAMES).png" "$WORK/last-2560.png"
ls -la "$OUT"
