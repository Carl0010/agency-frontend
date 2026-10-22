"""Builds a 128 BPM soundtrack for each short from an arrangement spec (written by build_shorts.py).

Usage: python3 make_short_music.py <spec.json> <out.wav>
Spec keys (all in beats; one beat = 0.46875 s):
  total      length in beats
  stabs      beats that get a chord stab + kick (the slammed words)
  rolls      [start, end] spans with a 16th snare roll and a rising noise sweep
  drops      beats that open a groove with a big stab and kick
  grooves    [start, end] spans of four-on-the-floor groove
  sparkle    [start, end] spans with an octave-up pluck layer
  final      the beat of the last chord, which rings out to the end
Deterministic (fixed seed). Requires numpy and scipy; loudness-normalised with FFmpeg to about -14 LUFS.
"""
import json
import os
import subprocess
import sys
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

spec = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
SR = 48000
B = 60 / 128
DUR = spec["total"] * B
N = int(SR * DUR)
rng = np.random.default_rng(spec.get("seed", 5))
L = np.zeros(N)
R = np.zeros(N)
KICKS = []


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def tt(n):
    return np.arange(n) / SR


def add(sig, start, gain=1.0, pan=0.0):
    i = int(round(start * SR))
    if i >= N or i < 0:
        return
    sig = sig[: N - i]
    L[i:i + len(sig)] += sig * gain * np.cos((pan + 1) * np.pi / 4)
    R[i:i + len(sig)] += sig * gain * np.sin((pan + 1) * np.pi / 4)


def filt(x, f, kind="low", order=2):
    return sosfilt(butter(order, f, kind, fs=SR, output="sos"), x)


def saw(f, n, detune=(0.0,)):
    t = tt(n)
    return sum(2 * ((f * 2 ** (d / 12) * t + rng.uniform()) % 1.0) - 1 for d in detune) / len(detune)


def stab(notes, dur=0.22, bright=4200):
    n = int(SR * (dur + 0.3))
    t = tt(n)
    sig = filt(sum(saw(midi(m), n, (-0.1, 0.0, 0.1)) for m in notes) / len(notes), bright)
    return sig * np.minimum(t / 0.003, 1) * np.exp(-t / (dur * 0.6)) * 1.7


def pad(notes, dur, cutoff=1800):
    n = int(SR * (dur + 0.4))
    t = tt(n)
    sig = filt(sum(saw(midi(m), n, (-0.12, 0.0, 0.12)) for m in notes) / len(notes), cutoff)
    return sig * np.minimum(t / 0.05, 1) * np.clip((dur + 0.3 - t) / 0.3, 0, 1) * 1.4


def bass(f, dur=0.2):
    n = int(SR * (dur + 0.05))
    t = tt(n)
    sig = np.sin(2 * np.pi * f * t) + 0.5 * filt(saw(f, n), 900)
    return sig * np.minimum(t / 0.004, 1) * np.exp(-t / 0.18) * np.clip((dur + 0.04 - t) / 0.04, 0, 1) * 0.5


def kick(t0, gain=0.5):
    KICKS.append(t0)
    n = int(SR * 0.45)
    t = tt(n)
    f = 48 + 110 * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.2)
    click = filt(rng.standard_normal(n), 3000, "high") * np.exp(-t / 0.004) * 0.35
    add(body * 0.5 + click, t0, gain * 0.7)


def clap(t0, gain=0.35):
    n = int(SR * 0.3)
    t = tt(n)
    add(filt(rng.standard_normal(n), [900, 6000], "band") * np.exp(-t / 0.1) * 0.6, t0, gain, 0.05)


def snare(t0, gain=0.3):
    n = int(SR * 0.2)
    t = tt(n)
    add(filt(rng.standard_normal(n), [1200, 7000], "band") * np.exp(-t / 0.06) + 0.4 * np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.04), t0, gain)


def hat(t0, open_=False, gain=0.25, pan=0.0):
    n = int(SR * (0.25 if open_ else 0.06))
    t = tt(n)
    add(filt(rng.standard_normal(n), 7500, "high") * np.exp(-t / (0.09 if open_ else 0.018)), t0, gain * 1.5, pan)


def pluck(f, t0, gain=0.12, pan=0.0):
    n = int(SR * 0.3)
    t = tt(n)
    add(filt(saw(f, n), 3800, "low", 1) * np.minimum(t / 0.002, 1) * np.exp(-t / 0.09), t0, gain * 1.8, pan)


def sweep(t0, dur, gain=0.25):
    n = int(SR * dur)
    t = tt(n)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    seg = n // 24
    for k in range(24):
        lo = 400 * (22 ** (k / 24))
        part = filt(noise[k * seg:(k + 1) * seg + 1], [lo, min(lo * 1.8, 20000)], "band")
        out[k * seg:k * seg + len(part)] = part[: n - k * seg]
    add(out * (t / dur) ** 2, t0, gain)


Am, F, C, G, E = [57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62], [56, 59, 64]
PROG = [(Am, 45), (F, 41), (C, 48), (G, 43)]

for i, b in enumerate(spec.get("stabs", [])):
    ch, root = PROG[i % 4]
    kick(b * B, 0.55)
    add(stab([m + 12 for m in ch], 0.32), b * B, 0.32)
    add(bass(midi(root), 0.35), b * B, 0.24)

for b0, b1 in spec.get("rolls", []):
    steps = int((b1 - b0) * 4)
    for k in range(steps):
        snare((b0 + k / 4) * B, 0.1 + 0.25 * k / max(steps - 1, 1))
    sweep(b0 * B, (b1 - b0) * B, 0.3)
    add(pad([m + 12 for m in E], (b1 - b0) * B, cutoff=1200), b0 * B, 0.2)

for b in spec.get("drops", []):
    kick(b * B, 0.75)
    add(stab([m + 12 for m in Am] + [81], 0.6, 6000), b * B, 0.36)

for b0, b1 in spec.get("grooves", []):
    for b in range(b0, b1):
        t0 = b * B
        kick(t0, 0.48)
        hat(t0 + B / 2, open_=True, gain=0.2, pan=0.2)
        for s in range(4):
            hat(t0 + s * B / 4, gain=0.11 if s % 2 else 0.07, pan=-0.3)
        if (b - b0) % 2 == 1:
            clap(t0)
        ch, root = PROG[((b - b0) // 4) % 4]
        add(bass(midi(root), 0.18), t0 + B / 2, 0.3)
        if (b - b0) % 4 == 0:
            add(pad([m + 12 for m in ch], 4 * B, cutoff=2600), t0, 0.16)
        if (b - b0) % 2 == 0:
            add(stab([m + 12 for m in ch], 0.18, 5000), t0 + 0.75 * B, 0.14, 0.3)
        tones = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24]
        for s in range(4):
            pluck(midi(tones[(b * 4 + s) % 4]), t0 + s * B / 4, 0.09, 0.5 if s % 2 else -0.5)

for b0, b1 in spec.get("sparkle", []):
    for b in range(b0, b1):
        ch = PROG[((b - b0) // 4) % 4][0]
        for s in range(4):
            pluck(midi(ch[(b + s) % 3] + 36), b * B + s * B / 4 + B / 8, 0.05, -0.6 if s % 2 else 0.6)

fb = spec["final"]
kick(fb * B, 0.6)
add(pad([60, 64, 67, 72, 76], DUR - fb * B, cutoff=3000), fb * B, 0.3)
add(bass(midi(36), 0.9), fb * B, 0.3)
hat(fb * B, open_=True, gain=0.3)

pump = np.ones(N)
tN = np.arange(N) / SR
for k in KICKS:
    i = int(k * SR)
    j = min(N, i + int(SR * 0.3))
    pump[i:j] = np.minimum(pump[i:j], 1 - 0.35 * np.exp(-(tN[i:j] - k) / 0.09))
L *= pump
R *= pump
ir = int(SR * 1.2)
ti = tt(ir)
irL = filt(rng.standard_normal(ir) * np.exp(-ti / 0.3), 6000) / np.sqrt(ir)
irR = filt(rng.standard_normal(ir) * np.exp(-ti / 0.3), 6000) / np.sqrt(ir)
mL = L + 0.6 * fftconvolve(L, irL)[:N]
mR = R + 0.6 * fftconvolve(R, irR)[:N]
mL, mR = filt(mL, 35, "high"), filt(mR, 35, "high")
mL, mR = mL + 0.3 * filt(mL, 1800, "high"), mR + 0.3 * filt(mR, 1800, "high")
fade = np.ones(N)
fs = int(SR * (DUR - 1.0))
fade[fs:] = np.linspace(1, 0, N - fs) ** 1.4
mL, mR = mL * fade, mR * fade
pk = max(np.abs(mL).max(), np.abs(mR).max())
mL, mR = np.tanh(mL / pk * 1.3) / np.tanh(1.3), np.tanh(mR / pk * 1.3) / np.tanh(1.3)
pcm = (np.clip(np.stack([mL, mR], 1), -1, 1) * 32767).astype(np.int16)
raw = OUT + ".raw.wav"
with wave.open(raw, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=9", "-ar", str(SR), OUT], check=True)
os.remove(raw)
print("wrote", OUT)
