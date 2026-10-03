#!/usr/bin/env bash
# Trecho da lavagem para scrub (controlado pela rolagem), a partir do master.
#
# O master (1916×1080) já é uma recompressão CRF 24 com ~1300 px de detalhe real. Por isso:
#   1. os 43 quadros (5,25 s a 7,0 s, f126…f168) saem do master UMA vez, sem perdas, na matriz
#      BT.709 (a mesma que o navegador usa para mostrar vídeo HD; a BT.601 padrão do ffmpeg
#      desloca até 14 níveis nas cores saturadas e o corte vídeo -> foto apareceria);
#   2. cada quadro passa pelo Real-ESRGAN 4× e é reduzido para 2560 (scripts/frames/upscale.py);
#   3. detail_blend.py devolve a textura do original onde o ESRGAN a apagou;
#   4. só então os trechos são codificados para busca de quadro: GOP denso (8 no desktop, 4 no
#      celular), sem quadros B (a nitidez não "respira" a cada GOP e a busca decodifica menos),
#      H.264 CRF 18 preset slow (Safari/iOS) e VP9 CRF 20 (Chrome/Firefox/Android), marcados
#      como BT.709. Desktop 1920×1082; celular: recorte quadrado próprio sobre o capô, 1080×1080.
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
mkdir -p "$OUT" "$WORK/src" "$HI" "$WORK/blend" "$WORK/d" "$WORK/m"

# 1. quadros sem perdas, matriz BT.709 (select pelo número do quadro: exato, sem arredondar tempo)
ffmpeg -v error -y -i "$MASTER" -vf "select='between(n\,126\,168)',scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24" \
  -fps_mode passthrough -start_number 1 "$WORK/src/f%03d.png"

# 2. ampliação (pula os quadros que já existem)
for i in $(seq -f "%03g" 1 $FRAMES); do
  [ -f "$HI/f$i.png" ] || python3 "$ROOT/scripts/frames/upscale.py" "${ESRGAN:?modelo ESRGAN}" "$WORK/src/f$i.png" "$HI/f$i.png" 1.336117
done

# 3. textura do original de volta
for i in $(seq -f "%03g" 1 $FRAMES); do
  python3 "$ROOT/scripts/frames/detail_blend.py" "$WORK/src/f$i.png" "$HI/f$i.png" "$WORK/blend/f$i.png" > /dev/null
done

# 4. desktop 1920×1082 e celular 1080×1080 (recorte de 1443 px em x=641 no quadro de 2560)
ffmpeg -v error -y -framerate 24 -i "$WORK/blend/f%03d.png" -vf "scale=1920:1082:flags=lanczos" "$WORK/d/f%03d.png"
ffmpeg -v error -y -framerate 24 -i "$WORK/blend/f%03d.png" -vf "crop=1443:1443:641:0,scale=1080:1080:flags=lanczos" "$WORK/m/f%03d.png"

TAGS=(-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)
YUV="scale=out_color_matrix=bt709:out_range=tv,format=yuv420p"
for v in d m; do
  [ "$v" = d ] && { G=8; NAME=scrub; } || { G=4; NAME=scrub-m; }
  ffmpeg -v error -y -framerate 24 -i "$WORK/$v/f%03d.png" -vf "$YUV" -c:v libx264 -profile:v high -preset slow -crf 18 \
    -bf 0 -g $G -keyint_min $G -sc_threshold 0 -x264-params "ipratio=1.1" "${TAGS[@]}" -movflags +faststart -an "$OUT/$NAME.mp4"
  ffmpeg -v error -y -framerate 24 -i "$WORK/$v/f%03d.png" -vf "$YUV" -c:v libvpx-vp9 -crf 20 -b:v 0 -g $G -keyint_min $G \
    -row-mt 1 -deadline good -cpu-used 1 -auto-alt-ref 0 -lag-in-frames 0 "${TAGS[@]}" -an "$OUT/$NAME.webm"
done
# o congelamento: o último quadro já com textura, em 2× (3832) não existe aqui; build_stills.py usa
# o quadro f168 ampliado à parte. Este é o mesmo quadro em 2560, para conferir o corte:
cp "$WORK/blend/f$(printf %03d $FRAMES).png" "$WORK/last-2560.png"
ls -la "$OUT"
