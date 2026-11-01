#!/usr/bin/env bash
# Re-encodes the barbell samples the way uploads arrive, plus horizontally squeezed copies.
# usage: make_clips.sh <samples dir> <output dir>
set -eu
S=$1
OUT=$2
ENCODE=(-an -r 24 -c:v libx264 -preset medium -b:v 700k -maxrate 900k -bufsize 1400k -pix_fmt yuv420p -movflags +faststart)
mkdir -p "$OUT"
for n in benchpress_110kg_4reps squat_140kg_2reps deadlift_170kg_1rep; do
  [ -f "$OUT/${n}__prod.mp4" ] || ffmpeg -nostdin -v error -y -i "$S/$n.mp4" -vf "scale=540:-2:flags=bicubic" "${ENCODE[@]}" "$OUT/${n}__prod.mp4"
  H=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$OUT/${n}__prod.mp4")
  for pair in ob60:324 ob45:243; do
    tag=${pair%%:*}
    w=${pair##*:}
    [ -f "$OUT/${n}__${tag}.mp4" ] || ffmpeg -nostdin -v error -y -i "$S/$n.mp4" -vf "scale=${w}:${H}:flags=bicubic,pad=540:${H}:(ow-iw)/2:0:black" "${ENCODE[@]}" "$OUT/${n}__${tag}.mp4"
  done
done
