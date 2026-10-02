#!/usr/bin/env bash
# Ferramenta de desenvolvimento: gera as versões do filme usadas no site a partir do master
# dist/assets/porsche-scroll.mp4 (que deve ser mantido). Não gera conteúdo novo: apenas
# reencoda e faz o fim do vídeo dissolver no começo (1 s) para o loop não ter corte seco.
# Uso: bash scripts/encode-film.sh
set -euo pipefail
cd "$(dirname "$0")/../dist/assets"
MASTER=porsche-scroll.mp4
FPS=24
FRAMES=$(ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 "$MASTER")
MAIN=$((FRAMES - FPS))
OFFSET=$(awk "BEGIN{printf \"%.4f\", ($MAIN - $FPS) / $FPS}")
LOOP="[0:v]trim=start_frame=$FPS,setpts=PTS-STARTPTS[main];[0:v]trim=end_frame=$FPS,setpts=PTS-STARTPTS[head];[main][head]xfade=transition=fade:duration=1:offset=$OFFSET,format=yuv420p"
X264=(-c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -g 48 -keyint_min 24 -movflags +faststart -an)

ffmpeg -v error -y -i "$MASTER" -filter_complex "$LOOP[v]" -map "[v]" "${X264[@]}" -crf 23 -maxrate 6M -bufsize 12M film-1080.mp4
ffmpeg -v error -y -i "$MASTER" -filter_complex "$LOOP,scale=1280:-2[v]" -map "[v]" "${X264[@]}" -crf 24 -maxrate 3M -bufsize 6M film-720.mp4
# Recorte vertical central para celulares em pé (a área visível é a mesma do cover).
ffmpeg -v error -y -i "$MASTER" -filter_complex "$LOOP,crop=704:1080:(iw-704)/2:0[v]" -map "[v]" "${X264[@]}" -crf 24 -maxrate 3M -bufsize 6M film-portrait.mp4

# Pôsteres = primeiro quadro do loop, para não haver salto quando a reprodução começar.
ffmpeg -v error -y -i film-1080.mp4 -frames:v 1 -vf scale=1600:-2 -c:v libwebp -quality 78 film-poster.webp
ffmpeg -v error -y -i film-portrait.mp4 -frames:v 1 -c:v libwebp -quality 78 film-poster-portrait.webp
ls -la film-*
