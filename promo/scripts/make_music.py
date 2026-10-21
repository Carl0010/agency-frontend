"""Builds the promo's music bed: assets/music/bed.wav (32 s, 120 BPM, F major, 48 kHz stereo).

Arranged to the film's scenes (index.html):
  0.0-4.5   hook: a filtered Dm(add9) pad and a quiet pulse; the scattered brief
  4.5-26.5  the product: electric piano chords, bass, soft drums and an 8th-note pluck
  22.0-26.5 payoff (search): an octave-up sparkle layer joins
  26.5-29.3 claim: drums drop out, the pad swells under the riser (Bb -> C)
  29.3      the mark lands: an F major 9 hit that rings out to 32 s

Deterministic: a fixed RNG seed for every noise source. Requires numpy and scipy.
Run from the promo folder:  python3 scripts/make_music.py
"""
import os
import subprocess

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
DUR = 32.0
BPM = 120
BEAT = 60 / BPM
N = int(SR * DUR)
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def t_of(n):
    return np.arange(n) / SR


def add(sig, start, gain=1.0, pan=0.0):
    i = int(round(start * SR))
    if i >= N:
        return
    sig = sig[: N - i]
    lg = gain * np.cos((pan + 1) * np.pi / 4)
    rg = gain * np.sin((pan + 1) * np.pi / 4)
    L[i : i + len(sig)] += sig * lg
    R[i : i + len(sig)] += sig * rg


def lowpass(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)


def highpass(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bandpass(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


# ---------- instruments ----------

def epiano(f, dur, vel=1.0):
    n = int(SR * (dur + 1.2))
    t = t_of(n)
    body = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.6)
    tine = 0.18 * np.sin(2 * np.pi * 7 * f * t) * np.exp(-t / 0.08)
    env = np.minimum(t / 0.004, 1) * np.exp(-t / 1.4)
    rel = np.clip((dur + 0.25 - t) / 0.25, 0, 1)
    trem = 1 + 0.06 * np.sin(2 * np.pi * 4.2 * t)
    return (body + tine) * env * rel * trem * vel


def pad(notes, dur, cutoff=1800, attack=0.6):
    n = int(SR * (dur + 0.8))
    t = t_of(n)
    sig = np.zeros(n)
    for m in notes:
        for det in (-0.12, 0.0, 0.11):
            f = midi(m + det)
            ph = rng.uniform(0, 1)
            sig += 2 * ((f * t + ph) % 1.0) - 1  # saw
    sig = lowpass(sig / (3 * len(notes)), cutoff, 2)
    env = np.minimum(t / attack, 1) * np.clip((dur + 0.6 - t) / 0.6, 0, 1)
    return sig * env


def bass(f, dur):
    n = int(SR * (dur + 0.1))
    t = t_of(n)
    sig = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t) + 0.08 * np.sin(2 * np.pi * 3 * f * t)
    env = np.minimum(t / 0.006, 1) * np.exp(-t / 0.9) * np.clip((dur + 0.08 - t) / 0.08, 0, 1)
    return sig * env


def pluck(f, vel=1.0):
    n = int(SR * 0.45)
    t = t_of(n)
    tri = 2 * np.abs(2 * ((f * t) % 1.0) - 1) - 1
    sig = lowpass(tri, 3200, 1) * np.minimum(t / 0.002, 1) * np.exp(-t / 0.12)
    return sig * vel


def kick():
    n = int(SR * 0.5)
    t = t_of(n)
    f = 46 + 80 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.22)
    click = highpass(rng.standard_normal(n), 2500) * np.exp(-t / 0.004) * 0.25
    return body + click


def clap():
    n = int(SR * 0.3)
    t = t_of(n)
    noise = bandpass(rng.standard_normal(n), 900, 5200)
    env = np.exp(-t / 0.09) * (1 + 0.6 * (t < 0.012))
    return noise * env * 0.5


def shaker(open_=False):
    n = int(SR * (0.22 if open_ else 0.07))
    t = t_of(n)
    noise = highpass(rng.standard_normal(n), 7000, 2)
    env = np.minimum(t / 0.003, 1) * np.exp(-t / (0.08 if open_ else 0.022))
    return noise * env * 0.35


# ---------- arrangement ----------
# Chords as MIDI notes (F major): Fmaj7, Am7, Dm9, Bbmaj7.
PROG = [
    ([53, 57, 60, 64], 41),  # Fmaj7, bass F2
    ([57, 60, 64, 67], 45),  # Am7, bass A2
    ([50, 53, 57, 60, 64], 38),  # Dm9, bass D2
    ([46, 50, 53, 57], 46),  # Bbmaj7, bass Bb2
]
BAR = 4 * BEAT  # 2 s

# Hook (0-4.5): filtered Dm(add9) pad, a soft 8th pulse that thickens toward the collapse.
add(pad([50, 57, 62, 64], 4.5, cutoff=900, attack=0.3), 0.0, 0.55)
for k in range(9):
    t0 = k * 0.5
    add(pluck(midi(62 if k % 2 == 0 else 69), 0.5 + 0.05 * k), t0, 0.25, pan=-0.3 if k % 2 else 0.3)
for k in range(18):
    add(shaker(), k * 0.25, 0.25 + 0.02 * k)

# Product section (4.5-26.5): 11 bars.
start = 4.5
for b in range(11):
    t0 = start + b * BAR
    chord, root = PROG[b % 4]
    # Electric piano: hit on beat 1, re-voiced pickup on the "and" of 3.
    for m in chord:
        add(epiano(midi(m + 12), 1.4, 0.9), t0, 0.2, pan=-0.2)
        add(epiano(midi(m + 12), 0.5, 0.6), t0 + 2.5 * BEAT, 0.13, pan=0.2)
    add(pad([m + 12 for m in chord], BAR, cutoff=2200, attack=0.4), t0, 0.16)
    # Bass on 1 and the "and" of 2.
    add(bass(midi(root), 0.7), t0, 0.17)
    add(bass(midi(root), 0.4), t0 + 1.5 * BEAT, 0.13)
    add(bass(midi(root + 7), 0.4), t0 + 3 * BEAT, 0.11)
    # Drums: kick 1 and 3, clap 2 and 4, shaker 8ths.
    for beat in range(4):
        tb = t0 + beat * BEAT
        if beat in (0, 2):
            add(kick(), tb, 0.32)
        else:
            add(clap(), tb, 0.33, pan=0.1)
        add(shaker(), tb, 0.5, pan=0.35)
        add(shaker(), tb + BEAT / 2, 0.32, pan=-0.35)
    # 8th-note pluck arpeggio of the chord tones.
    tones = chord + [chord[1] + 12]
    for e in range(8):
        add(pluck(midi(tones[e % len(tones)] + 12), 0.8), t0 + e * BEAT / 2, 0.17, pan=0.45 if e % 2 else -0.45)
    # Payoff (bars from 22 s): an octave-up sparkle and an open hat on the off-beats.
    if t0 >= 22.0 - 1e-6:
        for e in range(8):
            add(pluck(midi(tones[(e * 3) % len(tones)] + 24), 0.7), t0 + e * BEAT / 2 + BEAT / 4, 0.1, pan=-0.6 if e % 2 else 0.6)
        for beat in range(4):
            add(shaker(open_=True), t0 + beat * BEAT + BEAT / 2, 0.35)

# Claim (26.5-29.3): drums drop, the pad swells Bb -> Csus4 -> C under the riser.
add(pad([46 + 12, 50 + 12, 53 + 12, 57 + 12], 1.6, cutoff=1400, attack=1.0), 26.5, 0.32)
add(bass(midi(46), 1.5), 26.5, 0.22)
add(pad([48 + 12, 53 + 12, 55 + 12, 60 + 12], 0.6, cutoff=1800, attack=0.3), 28.1, 0.32)
add(pad([48 + 12, 52 + 12, 55 + 12, 60 + 12], 0.5, cutoff=2400, attack=0.2), 28.7, 0.32)
add(bass(midi(48), 1.2), 28.1, 0.22)
for k in range(8):  # a rising 16th pulse into the hit
    add(pluck(midi(60 + 12 + (k % 4) * 2), 0.5 + 0.06 * k), 28.3 + k * BEAT / 4, 0.1)

# The mark (29.3): F major 9 hit, ringing out.
hit = 29.3
add(kick(), hit, 0.45)
for m in [53, 57, 60, 64, 67]:
    add(epiano(midi(m + 12), 2.0, 1.0), hit, 0.14)
add(pad([53 + 12, 57 + 12, 60 + 12, 64 + 12, 67 + 12], 2.2, cutoff=2600, attack=0.05), hit, 0.3)
add(bass(midi(41), 2.0), hit, 0.2)
add(shaker(open_=True), hit, 0.4)

# ---------- mix ----------
# Small room reverb: decaying noise impulse, different per side.
ir_n = int(SR * 1.8)
tir = t_of(ir_n)
irL = rng.standard_normal(ir_n) * np.exp(-tir / 0.45)
irR = rng.standard_normal(ir_n) * np.exp(-tir / 0.45)
irL, irR = lowpass(irL, 5000) / np.sqrt(ir_n), lowpass(irR, 5000) / np.sqrt(ir_n)
wetL = fftconvolve(L, irL)[:N]
wetR = fftconvolve(R, irR)[:N]
mixL = L + 0.9 * wetL
mixR = R + 0.9 * wetR

# Keep energy above the phone-speaker floor: trim sub rumble, gentle presence lift.
mixL, mixR = highpass(mixL, 38), highpass(mixR, 38)
mixL, mixR = mixL + 0.35 * highpass(mixL, 1500), mixR + 0.35 * highpass(mixR, 1500)

# Fade out over the last 1.4 s, ending on the bar line at 32 s.
fade = np.ones(N)
fs = int(SR * 30.6)
fade[fs:] = np.linspace(1, 0, N - fs) ** 1.5
mixL *= fade
mixR *= fade

peak = max(np.abs(mixL).max(), np.abs(mixR).max())
mixL, mixR = mixL / peak * 0.9, mixR / peak * 0.9
mixL, mixR = np.tanh(mixL * 1.2) / np.tanh(1.2), np.tanh(mixR * 1.2) / np.tanh(1.2)

out = np.stack([mixL, mixR], axis=1)
pcm = (np.clip(out, -1, 1) * 32767).astype(np.int16)

here = os.path.dirname(os.path.abspath(__file__))
dest_dir = os.path.join(here, "..", "assets", "music")
os.makedirs(dest_dir, exist_ok=True)
raw = os.path.join(dest_dir, "bed-raw.wav")

import wave

with wave.open(raw, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())

# Loudness: about -16 LUFS integrated, true peak under -1.5 dBTP.
final = os.path.join(dest_dir, "bed.wav")
subprocess.run(
    ["ffmpeg", "-loglevel", "error", "-y", "-i", raw, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", str(SR), final],
    check=True,
)
os.remove(raw)
print("wrote", final)
