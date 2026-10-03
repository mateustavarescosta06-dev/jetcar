#!/usr/bin/env bash
# Quadros intermediários para os scrubs (v6.2): o filme tem 24 quadros por segundo e, na rolagem,
# cada quadro ocupava 9 a 20 px — a imagem andava em degraus. Este passo calcula os quadros do meio
# por compensação de movimento (ffmpeg minterpolate, bidirecional, blocos sobrepostos), sem modelo
# nenhum: os quadros originais ficam intactos e os novos são posições intermediárias do que já
# existe (testado no jato e nas gotas do capô: sem fantasma).
#
# Uso: bash scripts/frames/interp.sh <pasta de entrada> <primeiro> <último> <fator> <pasta de saída>
#   entrada: f%03d.png; saída: f%04d.png a partir de 0, (último − primeiro) × fator + 1 quadros.
# Roda em quatro partes em paralelo (o minterpolate usa um núcleo só); cada parte inclui o primeiro
# quadro da seguinte, e a emenda descarta o repetido. O último quadro de cada parte (e do filme) é o
# original: entre dois originais ficam fator − 1 quadros calculados.
set -euo pipefail
IN="$1"; A="$2"; B="$3"; K="$4"; OUT="$5"
FPS=$((24 * K))
PARTS=4
mkdir -p "$OUT"
TMP="$OUT.partes"
mkdir -p "$TMP/in"
# a entrada com três cópias do último quadro depois do fim: o minterpolate olha quadros à frente e,
# sem eles, não solta os últimos quadros do filme (as cópias só servem de apoio; não entram na saída)
for ((f = A; f <= B + 3; f++)); do ln -sf "$IN/$(printf f%03d $((f <= B ? f : B))).png" "$TMP/in/$(printf f%03d "$f").png"; done
n=$((B - A)); step=$(((n + PARTS - 1) / PARTS))
VF="format=yuv444p,minterpolate=fps=$FPS:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,format=rgb24"
i=0
for ((a = A; a < B; a += step)); do
  b=$((a + step)); [ "$b" -gt "$B" ] && b=$B
  mkdir -p "$TMP/$i"
  # a entrada segue além de b quando existe (o minterpolate precisa do vizinho para soltar o último)
  ffmpeg -v error -y -framerate 24 -start_number "$a" -i "$TMP/in/f%03d.png" -frames:v $(((b - a) * K + 1)) -vf "$VF" -start_number 0 "$TMP/$i/f%04d.png" &
  echo "$a $b" > "$TMP/$i/range"
  i=$((i + 1))
done
wait
# emenda: cada parte começa no último quadro da anterior
k=0
for ((j = 0; j < i; j++)); do
  read -r a b < "$TMP/$j/range"
  want=$(((b - a) * K + 1))
  have=$(ls "$TMP/$j" | grep -c '^f.*png$' || true)
  [ "$have" -ge "$want" ] || { echo "parte $j: $have de $want quadros" >&2; exit 1; }
  first=$((j == 0 ? 0 : 1))
  for ((f = first; f < want; f++)); do
    cp "$TMP/$j/$(printf f%04d "$f").png" "$OUT/$(printf f%04d "$k").png"
    k=$((k + 1))
  done
done
rm -rf -- "${TMP:?}"
echo "$k quadros em $OUT ($FPS por segundo de filme)"
