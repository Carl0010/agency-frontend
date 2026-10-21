"""Builds the launch film's soundtrack: assets/music/bed.wav (30 s, 128 BPM, A minor, 48 kHz stereo).

The music is the film's clock (beat = 0.46875 s). Arrangement, by beat:
  0-5    hook: a chord stab + kick on each of the six slammed words
  6-7    a 16th snare roll and a rising noise sweep under "Too many places."
  8      the drop on the brand reveal: four-on-the-floor house groove
  8-47   groove: kick, off-beat open hat, claps on 2 and 4, 16th hats, off-beat bass, side-chained chords, pluck arp
  48-51  breakdown: drums out; a kick + stab on each claim word
  52-53  snare roll into the second drop
  54-61  the end card: full groove
  62     a final C major hit that rings out to 30 s

Deterministic (fixed RNG seed). Requires numpy and scipy. Run from the project folder:
  python3 scripts/make_music.py
"""
import os
import subprocess
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
DUR = 30.0
B = 60 / 128
N = int(SR * DUR)
rng = np.random.default_rng(11)
L = np.zeros(N)
R = np.zeros(N)
KICKS = []  # kick times, for side-chain pumping


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def tt(n):
    return np.arange(n) / SR


def add(sig, start, gain=1.0, pan=0.0):
    i = int(round(start * SR))
    if i >= N or i < 0:
        return
    sig = sig[: N - i]
    L[i : i + len(sig)] += sig * gain * np.cos((pan + 1) * np.pi / 4)
    R[i : i + len(sig)] += sig * gain * np.sin((pan + 1) * np.pi / 4)


def filt(x, f, kind="low", order=2):
    return sosfilt(butter(order, f, kind, fs=SR, output="sos"), x)


def saw(f, n, detune=(0.0,)):
    t = tt(n)
    out = np.zeros(n)
    for d in detune:
        ff = f * 2 ** (d / 12)
        out += 2 * ((ff * t + rng.uniform()) % 1.0) - 1
    return out / len(detune)


# ---------- instruments ----------

def stab(notes, dur=0.22, bright=4200):
    n = int(SR * (dur + 0.3))
    t = tt(n)
    sig = sum(saw(midi(m), n, (-0.1, 0.0, 0.1)) for m in notes) / len(notes)
    sig = filt(sig, bright, "low", 2)
    env = np.minimum(t / 0.003, 1) * np.exp(-t / (dur * 0.6))
    return sig * env * 1.7


def pad(notes, dur, cutoff=1800):
    n = int(SR * (dur + 0.4))
    t = tt(n)
    sig = sum(saw(midi(m), n, (-0.12, 0.0, 0.12)) for m in notes) / len(notes)
    sig = filt(sig, cutoff, "low", 2)
    env = np.minimum(t / 0.05, 1) * np.clip((dur + 0.3 - t) / 0.3, 0, 1)
    return sig * env * 1.4


def bass(f, dur=0.2):
    n = int(SR * (dur + 0.05))
    t = tt(n)
    sig = np.sin(2 * np.pi * f * t) + 0.5 * filt(saw(f, n), 900)
    env = np.minimum(t / 0.004, 1) * np.exp(-t / 0.18) * np.clip((dur + 0.04 - t) / 0.04, 0, 1)
    return sig * env * 0.5


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
    noise = filt(rng.standard_normal(n), [900, 6000], "band")
    env = np.exp(-t / 0.1) * (1 + 0.8 * ((t % 0.011) < 0.004) * (t < 0.03))
    add(noise * env * 0.6, t0, gain, pan=0.05)


def snare(t0, gain=0.3):
    n = int(SR * 0.2)
    t = tt(n)
    sig = filt(rng.standard_normal(n), [1200, 7000], "band") * np.exp(-t / 0.06) + 0.4 * np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.04)
    add(sig, t0, gain)


def hat(t0, open_=False, gain=0.25, pan=0.0):
    n = int(SR * (0.25 if open_ else 0.06))
    t = tt(n)
    sig = filt(rng.standard_normal(n), 7500, "high", 2) * np.exp(-t / (0.09 if open_ else 0.018))
    add(sig, t0, gain * 1.5, pan)


def pluck(f, t0, gain=0.12, pan=0.0):
    n = int(SR * 0.3)
    t = tt(n)
    sig = filt(saw(f, n), 3800, "low", 1) * np.minimum(t / 0.002, 1) * np.exp(-t / 0.09)
    add(sig, t0, gain * 1.8, pan)


def sweep(t0, dur, gain=0.25):
    n = int(SR * dur)
    t = tt(n)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    seg = n // 24
    for k in range(24):  # stepped band-pass rising 400 Hz → 9 kHz
        lo = 400 * (22 ** (k / 24))
        part = filt(noise[k * seg:(k + 1) * seg + 1], [lo, min(lo * 1.8, 20000)], "band")
        out[k * seg:k * seg + len(part)] = part[: n - k * seg]
    add(out * (t / dur) ** 2, t0, gain)


# ---------- arrangement ----------
Am, F, C, G, E = [57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62], [56, 59, 64]
PROG = [(Am, 45), (F, 41), (C, 48), (G, 43)]  # chord, bass note (A2, F2, C3, G2)

# Hook: six stabs, one per word.
hook_chords = [Am, F, C, G, Am, F]
for i, ch in enumerate(hook_chords):
    t0 = i * B
    kick(t0, 0.5)
    add(stab([m + 12 for m in ch], 0.3), t0, 0.32)
    add(bass(midi(PROG[[0, 1, 2, 3, 0, 1][i]][1]), 0.35), t0, 0.22)
# Beats 6-7: snare roll and sweep, E chord tension.
for k in range(8):
    snare(6 * B + k * B / 4, 0.12 + 0.03 * k)
sweep(6 * B, 2 * B, 0.3)
add(pad([m + 12 for m in E], 2 * B, cutoff=1200), 6 * B, 0.2)


def groove(b0, b1, chords_from=0, extra=False):
    for b in range(b0, b1):
        t0 = b * B
        kick(t0, 0.48)
        hat(t0 + B / 2, open_=True, gain=0.2, pan=0.2)
        for s in (0, 1, 2, 3):
            hat(t0 + s * B / 4, gain=0.11 if s % 2 else 0.07, pan=-0.3)
        if b % 2 == 1:
            clap(t0)
        bar = (b - chords_from) // 4
        ch, root = PROG[bar % 4]
        add(bass(midi(root), 0.18), t0 + B / 2, 0.3)
        if (b - chords_from) % 4 == 0:
            add(pad([m + 12 for m in ch], 4 * B, cutoff=2600), t0, 0.16)
        if (b - chords_from) % 2 == 0:
            add(stab([m + 12 for m in ch], 0.18, 5000), t0 + 0.75 * B, 0.14, pan=0.3)
        tones = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24]
        for s in range(4):
            pluck(midi(tones[(b * 4 + s) % 4] + (12 if extra else 0)), t0 + s * B / 4, 0.09 if not extra else 0.07, pan=0.5 if s % 2 else -0.5)


# The drop on the brand (beat 8) through the search scene (to beat 48).
kick(8 * B, 0.7)
add(stab([m + 12 for m in Am] + [Am[0] + 24], 0.6, 6000), 8 * B, 0.35)
groove(8, 48, chords_from=8, extra=False)
for b in range(40, 48):  # search scene: an octave-up sparkle on the off-16ths
    ch = PROG[((b - 8) // 4) % 4][0]
    for s in range(4):
        pluck(midi(ch[(b + s) % 3] + 36), b * B + s * B / 4 + B / 8, 0.05, pan=-0.6 if s % 2 else 0.6)

# Breakdown under the claim: one hit per word.
for i, ch in enumerate([Am, F, C, G]):
    t0 = (48 + i) * B
    kick(t0, 0.55)
    add(stab([m + 12 for m in ch], 0.35), t0, 0.32)
    add(bass(midi(PROG[i][1]), 0.35), t0, 0.25)
add(pad([m + 12 for m in E], 2.5 * B, cutoff=900), 51.5 * B, 0.18)
for k in range(8):
    snare(52 * B + k * B / 4, 0.1 + 0.035 * k)
sweep(52 * B, 2 * B, 0.3)

# Second drop: the end card.
kick(54 * B, 0.75)
add(stab([m + 12 for m in C] + [72], 0.6, 6500), 54 * B, 0.36)
groove(54, 62, chords_from=54, extra=True)

# Final hit (beat 62) ringing to 30 s.
kick(62 * B, 0.6)
add(pad([60, 64, 67, 72, 76], 30 - 62 * B, cutoff=3000), 62 * B, 0.3)
add(bass(midi(36), 0.9), 62 * B, 0.3)
hat(62 * B, open_=True, gain=0.3)

# ---------- mix ----------
# Side-chain pump: dip everything but the kick a little after each kick.
pump = np.ones(N)
tN = np.arange(N) / SR
for k in KICKS:
    i = int(k * SR)
    j = min(N, i + int(SR * 0.3))
    seg = tN[i:j] - k
    pump[i:j] = np.minimum(pump[i:j], 1 - 0.35 * np.exp(-seg / 0.09))
L *= pump
R *= pump

ir_n = int(SR * 1.2)
ti = tt(ir_n)
irL = filt(rng.standard_normal(ir_n) * np.exp(-ti / 0.3), 6000) / np.sqrt(ir_n)
irR = filt(rng.standard_normal(ir_n) * np.exp(-ti / 0.3), 6000) / np.sqrt(ir_n)
mixL = L + 0.6 * fftconvolve(L, irL)[:N]
mixR = R + 0.6 * fftconvolve(R, irR)[:N]
mixL, mixR = filt(mixL, 35, "high"), filt(mixR, 35, "high")
mixL, mixR = mixL + 0.3 * filt(mixL, 1800, "high"), mixR + 0.3 * filt(mixR, 1800, "high")

fade = np.ones(N)
fs = int(SR * 29.0)
fade[fs:] = np.linspace(1, 0, N - fs) ** 1.4
mixL *= fade
mixR *= fade
peak = max(np.abs(mixL).max(), np.abs(mixR).max())
mixL, mixR = np.tanh(mixL / peak * 1.3) / np.tanh(1.3), np.tanh(mixR / peak * 1.3) / np.tanh(1.3)

pcm = (np.clip(np.stack([mixL, mixR], 1), -1, 1) * 32767).astype(np.int16)
here = os.path.dirname(os.path.abspath(__file__))
dest = os.path.join(here, "..", "assets", "music")
os.makedirs(dest, exist_ok=True)
raw = os.path.join(dest, "bed-raw.wav")
with wave.open(raw, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
final = os.path.join(dest, "bed.wav")
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=9", "-ar", str(SR), final], check=True)
os.remove(raw)
print("wrote", final)
