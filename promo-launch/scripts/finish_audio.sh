#!/usr/bin/env bash
# Loudness-normalises a rendered film's soundtrack for social playback (about -15 LUFS, -2 dBTP; run it once, on a fresh render) without
# re-encoding the picture. HyperFrames' mixer leaves headroom, so a render measures around -20 LUFS.
# Usage: scripts/finish_audio.sh renders/agency-launch.mp4
set -euo pipefail
in="$1"; tmp="${in%.mp4}.norm.mp4"
dur=$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of csv=p=0 "$in")
ffmpeg -loglevel error -y -i "$in" -t "$dur" -c:v copy -af "loudnorm=I=-15:TP=-2:LRA=11" -ar 48000 -c:a aac -b:a 256k -movflags +faststart "$tmp"
mv "$tmp" "$in"
