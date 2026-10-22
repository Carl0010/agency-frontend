#!/usr/bin/env bash
# Brings a fresh HyperFrames render's soundtrack to about -15 LUFS / -2 dBTP for social playback, keeping the
# picture as rendered and the length equal to the video stream. Run once per fresh render.
# Usage: scripts/finish_audio.sh in.mp4 out.mp4
set -euo pipefail
dur=$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of csv=p=0 "$1")
ffmpeg -loglevel error -y -i "$1" -t "$dur" -c:v copy -af "loudnorm=I=-15:TP=-2:LRA=11" -ar 48000 -c:a aac -b:a 256k -movflags +faststart "$2"
