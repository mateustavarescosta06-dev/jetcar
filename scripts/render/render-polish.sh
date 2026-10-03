#!/usr/bin/env bash
# Renders da cena do polimento da v6.1 em alta resolução, para as fotos do Polimento da v6.2.
#   1. o site da v6.1 com o modo parado:  git worktree add /tmp/v61 088dd03
#      (cd /tmp/v61 && git apply <repo>/scripts/render/polish-still.patch)
#      ROOT=/tmp/v61/dist PORT=3200 node <repo>/scripts/serve.cjs
#   2. bash scripts/render/render-polish.sh <pasta de saída>
#   3. python3 scripts/frames/build_polish.py <pasta de saída>
# Desktop 1600×900 a 2× (3200×1800) e celular 585×1266 a 2× (1170×2532). A mesma câmera e a mesma
# luz ambiente em todas: só muda o que está aceso.
#   clean  pintura corrigida, sem a barra
#   s_<x>  luz de inspeção em três posições (riscos acesos; build_polish.py tira o máximo)
#   refl   pintura corrigida com o reflexo da barra (o reflexo perfeito)
set -euo pipefail
OUT="$1"; mkdir -p "$OUT"
HERE="$(cd "$(dirname "$0")" && pwd)"
CD="cx=0.0&ch=0.45&cz=0.75&tx=0.45&tz=0.2&fov=28"
CP="cx=0.1&ch=0.55&cz=0.9&tx=0.35&tz=0.15&fov=48"
SW="mode=swirl&bi=0&ii=2.2&spread=60&sg=1.4&ss=1.6"
run() { node "$HERE/render-polish.cjs" "$@"; }
for v in d m; do
  if [ "$v" = d ]; then SZ=(1600 900 2); C="$CD"; else SZ=(585 1266 2); C="$CP"; fi
  run "$OUT/${v}_clean.png" "${SZ[@]}" "mode=clean&bi=0&ii=0&$C"
  for bx in 0.0 1.0 2.0; do run "$OUT/${v}_s_$bx.png" "${SZ[@]}" "$SW&bx=$bx&$C"; done
  run "$OUT/${v}_refl.png" "${SZ[@]}" "mode=clean&bi=12&ii=0&bx=0.5&$C"
done
