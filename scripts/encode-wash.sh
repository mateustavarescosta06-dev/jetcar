#!/usr/bin/env bash
# Trecho da lavagem para scrub (controlado pela rolagem), a partir do master.
# Scrub exige busca rápida de quadro: GOP denso (keyframe a cada 8 quadros no desktop, 4 no
# celular), sem áudio, faststart. H.264 para Safari/iOS e VP9 (WebM) para Chrome/Firefox/Android.
# O H.264 sai do encode.sh da skill scroll-craft (mesmos parâmetros, ver SKILL.md).
#   desktop: 16:9, 1920×1080   celular: recorte quadrado no capô, 720×720
# Também extrai o quadro do congelamento (o último quadro do trecho) em PNG, nas duas versões.
# Uso: bash scripts/encode-wash.sh [pasta-de-trabalho]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MASTER="$ROOT/source/porsche-scroll.mp4"
OUT="$ROOT/dist/assets/wash"
WORK="${1:-$(mktemp -d)}"
FROM=5.25         # s no master (f126: a frente do carro, o jato vai entrar)
FRAMES=43         # até f168 (7,0 s): o quadro mais nítido do jato no capô
CROP_M="crop=1080:1080:480:0"
mkdir -p "$OUT" "$WORK"

# recorte exato (do quadro 126 ao 168) em intermediário sem perdas
ffmpeg -v error -y -ss "$FROM" -i "$MASTER" -frames:v "$FRAMES" -an -c:v libx264 -qp 0 -preset ultrafast "$WORK/seg.mp4"
ffmpeg -v error -y -i "$WORK/seg.mp4" -vf "$CROP_M" -an -c:v libx264 -qp 0 -preset ultrafast "$WORK/seg-m.mp4"

ENC="${SCROLLCRAFT_ENCODE:-$ROOT/../nateherkai/scroll-craft/plugins/nateherk-design/skills/scroll-craft/scripts/encode.sh}"
if [ -x "$ENC" ] || [ -f "$ENC" ]; then
  bash "$ENC" "$WORK/seg.mp4" "$OUT/scrub.mp4" desktop
  bash "$ENC" "$WORK/seg-m.mp4" "$OUT/scrub-m.mp4" mobile
else
  ffmpeg -v error -y -i "$WORK/seg.mp4" -vf "scale=-2:1080" -c:v libx264 -preset slow -crf 20 -g 8 -keyint_min 8 -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart -an "$OUT/scrub.mp4"
  ffmpeg -v error -y -i "$WORK/seg-m.mp4" -vf "scale=-2:720" -c:v libx264 -preset slow -crf 24 -g 4 -keyint_min 4 -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart -an "$OUT/scrub-m.mp4"
fi
ffmpeg -v error -y -i "$WORK/seg.mp4" -vf "scale=-2:1080" -c:v libvpx-vp9 -g 8 -keyint_min 8 -crf 30 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 -pix_fmt yuv420p -an "$OUT/scrub.webm"
ffmpeg -v error -y -i "$WORK/seg-m.mp4" -vf "scale=-2:720" -c:v libvpx-vp9 -g 4 -keyint_min 4 -crf 33 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 -pix_fmt yuv420p -an "$OUT/scrub-m.webm"

# congelamento: o último quadro do trecho, sem compressão (a ampliação 2× vem depois)
ffmpeg -v error -y -sseof -0.05 -i "$WORK/seg.mp4" -frames:v 1 -update 1 "$WORK/freeze.png"
ffmpeg -v error -y -sseof -0.05 -i "$WORK/seg-m.mp4" -frames:v 1 -update 1 "$WORK/freeze-m.png"
echo "trechos em $OUT; quadros do congelamento em $WORK/freeze*.png"
ls -la "$OUT"
