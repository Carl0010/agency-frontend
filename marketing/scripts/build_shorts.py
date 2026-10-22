"""Builds four vertical (1080x1920) HyperFrames shorts under marketing/shorts/<name>/.

Every short runs on the same 128 BPM grid (beat = 0.46875 s), ends on the same claim and end card, and
places each sound effect so its measured peak lands one frame after the picture it belongs to.
Words and product UI stay inside the 168-1330 px band that the platforms leave clear.

Run from the repository root:  python3 marketing/scripts/build_shorts.py
It writes each project's index.html, assets (fonts, GSAP, sound effects), music spec and soundtrack.
"""
import json
import os
import shutil
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
MKT = os.path.join(HERE, "..")
OUT = os.path.join(MKT, "shorts")
SHARED = os.path.join(MKT, "assets")  # fonts, vendor/gsap.min.js, sfx/
B = 60 / 128
W, H = 1080, 1920

# Measured peak (s into the file) and length of each effect (hyperframes audio --json / ffprobe).
SFX = {
    "pop": (0.12, 0.72), "pop-hi": (0.10, 0.648), "pop-lo": (0.14, 0.864), "click": (0.073, 0.366),
    "click-soft": (0.073, 0.366), "whoosh": (0.162, 0.575), "whoosh-hi": (0.14, 0.549), "whoosh-lo": (0.19, 0.705),
    "impact-bass-1": (0.073, 2.116), "impact-bass-2": (1.986, 2.592), "key-press": (0.076, 0.432),
    "notification": (0.229, 2.456), "typing": (0.45, 1.541), "riser": (3.472, 3.5),
}


def T(b):
    """Beat index to seconds, rounded to the frame (never accumulated)."""
    return round(b * B * 30) / 30


BARS = ('<svg viewBox="0 0 24 24" fill="none" style="width:60%;height:60%;overflow:visible">'
        '<rect id="{p}b1" x="4" y="7" width="4" height="10" fill="{c}" style="transform-box:fill-box;transform-origin:50% 100%"/>'
        '<rect id="{p}b2" x="10" y="4" width="4" height="13" fill="{c}" style="transform-box:fill-box;transform-origin:50% 100%"/>'
        '<rect id="{p}b3" x="16" y="9" width="4" height="8" fill="{c}" style="transform-box:fill-box;transform-origin:50% 100%"/></svg>')
ICON = {
    "check": '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 12 3 3 7-7"/>',
    "comment": '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-1 1v-8.5A8.5 8.5 0 0 1 11.5 4H13a8 8 0 0 1 8 7.5Z"/>',
    "attach": '<path d="m8 12 6.5-6.5a3 3 0 0 1 4.2 4.2L10 18.4a4.5 4.5 0 0 1-6.4-6.4L13 2.6"/>',
    "search": '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    "lock": '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
    "moon": '<path d="M20.5 13A9 9 0 0 1 11 3.5 9 9 0 1 0 20.5 13Z"/>',
    "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
    "tick": '<path d="m5 12 4 4L19 6"/>',
}
CURSOR = '<svg id="{id}" class="cursor" viewBox="0 0 22 32"><path d="M1.5 1.5v24.5l6.2-6 4.3 9.4 4.2-1.9-4.2-9.2h8.6z" fill="#202822" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'


def icon(n, s=14, sw=1.6):
    return f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{ICON[n]}</svg>'


def z(x, y, zoom, html, idv=None, extra=""):
    i = f' id="{idv}"' if idv else ""
    return f'<div class="abs"{i} style="left:{x}px;top:{y}px;{extra}"><div style="zoom:{zoom}">{html}</div></div>'


def card(title, key, label=None, lc="--l-teal", av=None, ac="--a3", facts="", idv=None):
    chip = f'<span class="chip"><span class="dot" style="background:var({lc})"></span>{label}</span>' if label else ""
    f = f'<div class="facts">{facts}</div>' if facts else ""
    a = f'<span class="av" style="background:var({ac})">{av}</span>' if av else ""
    i = f' id="{idv}"' if idv else ""
    return f'<div class="card"{i}><div class="cb">{chip}<div class="ct"{"" if label else " style=margin-top:0"}>{title}</div>{f}</div><div class="cf"><span class="key">{key}</span>{a}</div></div>'


class Short:
    def __init__(self, name, beats):
        self.name, self.beats, self.dur = name, beats, T(beats)
        self.html, self.js, self.sfx = [], [], []

    # ---- timeline helpers -------------------------------------------------
    def scene(self, sid, b0, b1, bg, inner, extra=""):
        self.html.append(f'<div id="{sid}" class="scene" style="background:{bg};{extra}">{inner}</div>')
        self.js.append(f'tl.set("#{sid}", {{ opacity: 1 }}, {T(b0)});')
        if b1 < self.beats:
            self.js.append(f'tl.set("#{sid}", {{ opacity: 0 }}, {T(b1)});')

    def slam(self, sel, t, scale=1.3, blur=10, origin="50% 50%", dur=0.25):
        self.js.append(f'tl.fromTo("{sel}", {{ opacity: 0, scale: {scale}, filter: "blur({blur}px)", transformOrigin: "{origin}" }}, {{ opacity: 1, scale: 1, filter: "blur(0px)", duration: {dur}, ease: "expo.out" }}, {t:.3f});')

    def out(self, sel, t, dur=0.1):
        self.js.append(f'tl.to("{sel}", {{ opacity: 0, filter: "blur(8px)", duration: {dur}, ease: "power2.in" }}, {t:.3f});')

    def hide0(self, sel):
        self.js.append(f'tl.fromTo("{sel}", {{ opacity: 0 }}, {{ opacity: 0, duration: 0.01 }}, 0);')

    def shake(self, t, amp=1.0):
        for k, (x, y) in enumerate([(14, -9), (-12, 7), (8, -4), (-4, 2), (0, 0)]):
            self.js.append(f'tl.to("#cam", {{ x: {x * amp:.1f}, y: {y * amp:.1f}, duration: 0.033, ease: "none" }}, {t + 0.03 + k * 0.033:.3f});')

    def fx(self, name, t, vol=0.8):
        peak, length = SFX[name]
        start = max(0.0, t + 0.033 - peak)
        self.sfx.append((round(start, 3), name, vol, min(length, self.dur - start)))

    # ---- shared sections --------------------------------------------------
    def word_fields(self, b0, words):
        for i, (text, bg, color, size, mono) in enumerate(words):
            sid = f"wf{b0}-{i}"
            font = "font-family:'Geist Mono',monospace;font-weight:400;letter-spacing:-0.04em;" if mono else ""
            self.scene(sid, b0 + i, b0 + i + 1, bg,
                       f'<div class="fill flexc"><div class="disp w" style="font-size:{size}px;color:{color};text-align:center;{font}">{text}</div></div>')
            if b0 + i == 0:  # frame 0 is the thumbnail: the first word is already on screen
                self.js.append(f'tl.fromTo("#{sid} .w", {{ scale: 1.12 }}, {{ scale: 1, duration: 0.3, ease: "expo.out" }}, 0);')
            else:
                self.slam(f"#{sid} .w", T(b0 + i), 1.28)

    def claim(self, b0, b1):
        rows = [("Client", "var(--ink)"), ("work,", "var(--ink)"), ("one", "var(--green)"), ("place.", "var(--green)")]
        inner = "".join(f'<div class="abs disp cw" style="left:72px;top:{300 + i * 236}px;font-size:250px;color:{c}">{t}</div>' for i, (t, c) in enumerate(rows))
        self.scene("claim", b0, b1, "var(--canvas)", inner)
        for i in range(4):
            t = T(b0 + i)
            self.slam(f"#claim .cw:nth-child({i + 1})", t, 1.6, 14, "0% 70%", 0.22)
            self.shake(t, 1 + 0.25 * i)
            self.fx("impact-bass-1", t, [0.55, 0.45, 0.6, 0.75][i])

    def endcard(self, b0):
        inner = f'''<div id="end-g" class="fill" style="background:var(--green);clip-path:circle(0px at 540px 960px)">
<div id="end-mq" class="abs disp" style="left:0;top:1500px;font-size:110px;color:var(--green-deep)">Boards · Cards · Checklists · Files · @mentions · Team chat · Client chat · Guests · Search · Dark mode</div>
<div id="end-tile" class="abs mark inv" style="left:410px;top:330px;width:260px;height:260px;border-radius:70px">{BARS.format(p="end-", c="#196747")}</div>
<div id="end-word" class="ctr disp" style="top:640px;font-size:210px;color:#fff">Agency</div>
<p id="end-sub" class="ctr" style="top:900px;font-size:48px;line-height:62px;color:var(--green-muted)">Boards, cards and comments<br>for agencies of five.</p>
<div class="ctr" style="top:1100px"><span id="end-cta" class="btn white" style="height:136px;padding:0 70px;font-size:56px;border-radius:18px" data-var-text="cta">Start free trial</span></div>
</div>'''
        self.scene("end", b0, self.beats, "var(--canvas)", inner)
        t = T(b0)
        self.js += [
            f'tl.fromTo("#end-g", {{ clipPath: "circle(0px at 540px 960px)" }}, {{ clipPath: "circle(1300px at 540px 960px)", duration: 0.38, ease: "power3.out" }}, {t});',
            f'tl.fromTo("#end-tile", {{ scale: 0, rotation: -40 }}, {{ scale: 1, rotation: 0, duration: 0.42, ease: "back.out(1.7)" }}, {t + 0.06:.3f});',
            f'tl.fromTo(["#end-b1", "#end-b2", "#end-b3"], {{ scaleY: 0 }}, {{ scaleY: 1, duration: 0.22, stagger: {B / 4:.4f}, ease: "expo.out" }}, {T(b0 + 0.5)});',
            f'tl.fromTo("#end-word", {{ clipPath: "inset(0% 50% 0% 50%)" }}, {{ clipPath: "inset(0% 0% 0% 0%)", duration: 0.42, ease: "expo.out" }}, {T(b0 + 1)});',
            f'tl.fromTo("#end-sub", {{ opacity: 0, filter: "blur(10px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.2 }}, {T(b0 + 2)});',
            f'tl.fromTo("#end-cta", {{ opacity: 0, scale: 0.6 }}, {{ opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2)" }}, {T(b0 + 3)});',
            f'tl.fromTo("#end-mq", {{ x: 0 }}, {{ x: -1700, duration: {self.dur - t:.3f}, ease: "none" }}, {t});',
        ]
        self.fx("riser", t, 0.5)
        self.fx("impact-bass-1", t, 0.95)
        self.fx("pop", T(b0 + 3), 0.8)

    def whip_out(self, sel, b, axis="y", dist=-1400):
        self.js.append(f'tl.to("{sel}", {{ {axis}: {dist}, filter: "blur(20px)", duration: 0.2, ease: "power3.in" }}, {T(b) - 0.2:.3f});')

    def build(self, music):
        os.makedirs(os.path.join(self.dir, "assets", "music"), exist_ok=True)
        tracks, ends = [], []
        audio = []
        for i, (start, name, vol, length) in enumerate(sorted(self.sfx)):
            lane = next((k for k, e in enumerate(ends) if e <= start), None)
            if lane is None:
                ends.append(0)
                lane = len(ends) - 1
            ends[lane] = start + length
            fade = ' data-fade-out="0.1"' if name == "riser" else ""
            audio.append(f'<audio id="fx-{i}" class="clip" src="assets/sfx/{name}.mp3" data-start="{start}" data-duration="{length:.3f}" data-track-index="{11 + lane}" data-volume="{vol}"{fade}></audio>')
        css = open(os.path.join(HERE, "short.css")).read()
        page = f'''<!doctype html>
<html lang="en" data-composition-variables='[{{"id":"cta","type":"string","label":"Call to action","default":"Start free trial"}}]'>
<head><meta charset="UTF-8"><meta name="viewport" content="width={W}, height={H}"><title>{self.name}</title>
<script src="assets/vendor/gsap.min.js"></script>
<style>
@font-face {{ font-family: 'Geist'; src: url('assets/fonts/Geist-Variable.woff2') format('woff2'); font-weight: 100 900; }}
@font-face {{ font-family: 'Geist Mono'; src: url('assets/fonts/GeistMono-Regular.woff2') format('woff2'); font-weight: 400; }}
{css}
</style></head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{self.dur}" data-width="{W}" data-height="{H}" data-layout-allow-overlap data-layout-allow-overflow>
<div id="cam">
{chr(10).join(self.html)}
</div>
<audio id="music" class="clip" src="assets/music/bed.wav" data-start="0" data-duration="{self.dur}" data-track-index="10" data-volume="0.95"></audio>
{chr(10).join(audio)}
</div>
<script>
window.__timelines = window.__timelines || {{}};
const tl = gsap.timeline({{ paused: true }});
{chr(10).join(self.js)}
window.__timelines["main"] = tl;
</script>
</body></html>
'''
        open(os.path.join(self.dir, "index.html"), "w").write(page)
        spec = dict(music, total=self.beats)
        sp = os.path.join(self.dir, "assets", "music", "arrangement.json")
        json.dump(spec, open(sp, "w"), indent=1)
        subprocess.run(["python3", os.path.join(HERE, "make_short_music.py"), sp, os.path.join(self.dir, "assets", "music", "bed.wav")], check=True)

    @property
    def dir(self):
        return os.path.join(OUT, self.name)


BRIEF_FACTS = f'<span>{icon("check")}0/3</span><span>{icon("comment")}1</span>'
TEAM = f'''<div class="chan dark"><div class="h">{icon("lock", 16)}<span id="team-lock-l">Team</span><span id="team-int" class="kind int">Internal</span></div><div class="msgs">
<div class="m tm-m"><span class="av lg" style="background:var(--a3)">PR</span><div><div class="who">Priya<span class="tm">10:02</span></div><div class="body">Logo v2 is up on ACME-4</div></div></div>
<div class="m tm-m"><span class="av lg" style="background:var(--a4)">DK</span><div><div class="who">Dev<span class="tm">10:03</span></div><div class="body">Client wants the green a bit darker</div></div></div>
<div class="m tm-m"><span class="av lg" style="background:var(--a3)">PR</span><div><div class="who">Priya<span class="tm">10:04</span></div><div class="body"><span class="men">@Eli</span> can you check the brief?</div></div></div>
</div></div>'''


def palette(prefix, dark=False):
    q = "".join(f'<span class="q {prefix}q">{c}</span>' for c in "brief")
    m = "<mark>brief</mark>"
    return f'''<div class="pal{" dark" if dark else ""}"><div class="in">{icon("search", 18)}<span>{q}</span></div>
<div class="counts {prefix}r">Cards (1) · Comments (1) · Messages (1)</div>
<div class="row sel {prefix}r"><div class="meta"><b>card</b><span>Acme site rebuild</span><span class="ago">just now</span></div><div class="rt">Review the new client {m}</div></div>
<div class="row {prefix}r"><div class="meta"><b>comment</b><span>Acme site rebuild</span><span class="ago">just now</span></div><div class="rt">@Priya the {m} is final</div></div>
<div class="row {prefix}r"><div class="meta"><b>message</b><span>Acme site rebuild</span><span class="ago">10:42</span></div><div class="rt">Is this the final {m}?</div></div>
<div class="all {prefix}r">See all results for “brief”</div></div>'''


def short_too_many_places():
    s = Short("too-many-places", 26)
    s.word_fields(0, [("Tasks", "var(--canvas)", "var(--ink)", 300, False), ("Threads", "var(--green)", "#fff", 250, False),
                      ("Files", "var(--d-bg)", "var(--d-green)", 330, False), ("Feedback", "var(--hl)", "var(--hl-ink)", 210, False),
                      ("final_v4.pdf", "var(--surface)", "var(--ink)", 128, True), ("Who has<br>it?", "var(--ink)", "#fff", 230, False)])
    pile = [("Tasks", 60, 230, 150, "var(--ink)", -7), ("Threads", 520, 300, 120, "var(--green)", 6), ("Files", 640, 470, 150, "var(--a4)", -4),
            ("Re: Re: brief", 70, 470, 90, "var(--a5)", 5), ("Feedback", 60, 1010, 150, "var(--warn-text)", 4),
            ("final_v4.pdf", 90, 1200, 80, "var(--ink3)", -5), ("Who has it?", 520, 1180, 100, "var(--a1)", 6), ("@anyone?", 640, 1340, 70, "var(--ink2)", -4)]
    inner = "".join(f'<span class="abs disp pw" style="left:{x}px;top:{y}px;font-size:{sz}px;color:{c};transform:rotate({r}deg);{"font-family:Geist Mono,monospace;font-weight:400;" if w.startswith("final") else ""}">{w}</span>' for w, x, y, sz, c, r in pile)
    inner += '<div id="tm-h" class="ctr disp" style="top:650px;font-size:190px;color:var(--ink)">Too many<br>places.</div>'
    s.scene("pile", 6, 8, "var(--canvas)", inner)
    s.js.append(f'tl.fromTo("#pile .pw", {{ opacity: 0, scale: 1.6 }}, {{ opacity: 1, scale: 1, duration: 0.3, stagger: 0.06, ease: "expo.out" }}, {T(6)});')
    s.slam("#tm-h", T(6), 1.4)
    # Brand reveal: green iris, the tile, the bars, the name.
    inner = f'''<div id="br-g" class="fill" style="background:var(--green);clip-path:circle(0px at 540px 960px)"></div>
<div id="br-lock" class="fill"><div id="br-tile" class="abs mark inv" style="left:390px;top:470px;width:300px;height:300px;border-radius:80px">{BARS.format(p="br-", c="#196747")}</div>
<div id="br-word" class="ctr disp" style="top:840px;font-size:230px;color:#fff">Agency</div></div>'''
    s.scene("brand", 8, 12, "var(--canvas)", inner)
    s.js += [f'tl.fromTo("#br-g", {{ clipPath: "circle(0px at 540px 960px)" }}, {{ clipPath: "circle(1300px at 540px 960px)", duration: 0.35, ease: "power3.out" }}, {T(8)});',
             f'tl.fromTo("#br-tile", {{ scale: 0, rotation: -30 }}, {{ scale: 1, rotation: 0, duration: 0.45, ease: "back.out(1.7)" }}, {T(8) + 0.06:.3f});',
             f'tl.fromTo(["#br-b1", "#br-b2", "#br-b3"], {{ scaleY: 0 }}, {{ scaleY: 1, duration: 0.25, stagger: {B / 4:.4f}, ease: "expo.out" }}, {T(8.5)});',
             f'tl.fromTo("#br-word", {{ clipPath: "inset(0% 50% 0% 50%)" }}, {{ clipPath: "inset(0% 0% 0% 0%)", duration: 0.45, ease: "expo.out" }}, {T(9.5)});',
             f'tl.fromTo("#br-lock", {{ scale: 1, opacity: 1, transformOrigin: "540px 620px" }}, {{ scale: 7, opacity: 0, duration: 0.4, ease: "power3.in", transformOrigin: "540px 620px" }}, {T(12) - 0.4:.3f});']
    s.fx("impact-bass-2", T(8), 0.7)
    s.fx("whoosh-hi", T(12) - 0.12, 0.8)
    # Slot machine.
    opts = "".join(f'<div class="opt">{w}</div>' for w in ["boards", "cards", "chat", "clients", "files", "search", "everything."])
    inner = f'''<div id="rl" class="fill"><div id="rl-1" class="abs disp" style="left:72px;top:520px;font-size:124px;color:#fff">One place for</div>
<div class="abs" style="left:66px;top:690px;width:960px;height:220px;overflow:hidden" data-layout-allow-overflow><div id="rl-col" class="abs" style="left:0;top:0">{opts}</div></div></div>'''
    s.scene("roll", 12, 16, "var(--green)", inner)
    s.slam("#rl-1", T(12), 1.2)
    s.js.append(f'tl.fromTo("#rl-col", {{ y: 220 }}, {{ y: 0, duration: 0.18, ease: "expo.out" }}, {T(12) + 0.08:.3f});')
    for i, dt in enumerate([0.24, 0.34, 0.44, 0.54, 0.64, 0.76]):
        last = i == 5
        s.js.append(f'tl.to("#rl-col", {{ y: {-(i + 1) * 220}, duration: {0.3 if last else 0.1}, ease: "{"back.out(1.6)" if last else "power2.inOut"}" }}, {T(12) + dt:.3f});')
    s.whip_out("#rl", 16)
    s.fx("whoosh-lo", T(16) - 0.1, 0.7)
    s.claim(16, 20)
    s.endcard(20)
    s.build(dict(stabs=[0, 1, 2, 3, 4, 5, 16, 17, 18, 19], rolls=[[6, 8]], drops=[8, 20], grooves=[[8, 16], [20, 25]], sparkle=[[12, 16]], final=25, seed=21))


def short_guests():
    s = Short("guests-dont-use-a-seat", 26)
    chan = f'''<div class="chan"><div class="h">Acme site rebuild<span class="kind">Client</span></div><div class="msgs">
<div class="m" id="g-m1"><span class="av lg" style="background:var(--a5)">SA</span><div><div class="who">Sarah<span class="guest">Guest</span><span class="tm">10:42</span></div><div class="body">Is this the final brief?</div></div></div>
<div class="m" id="g-m2"><span class="av lg" style="background:var(--a1)">EO</span><div><div class="who">Eli<span class="tm">10:43</span></div><div class="body">Yes, it’s on ACME-1. Layouts Friday.</div><div class="ref"><span class="key">ACME-1</span>Review the new client brief</div></div></div>
</div></div>'''
    inner = f'''<div id="g-t1" class="abs disp" style="left:72px;top:250px;font-size:120px;color:var(--ink)">Your client<br>asks.</div>
<div id="g-t2" class="abs disp" style="left:72px;top:250px;font-size:120px;color:var(--ink)">Answer<br>on the <span style="color:var(--green)">card.</span></div>
{z(78, 600, 2.2, chan)}'''
    s.scene("hook", 0, 4, "var(--canvas)", inner)
    s.hide0("#g-m2"); s.hide0("#g-t2")
    s.js.append(f'tl.fromTo("#g-m1", {{ scale: 1.08 }}, {{ scale: 1, duration: 0.4, ease: "expo.out" }}, 0);')
    s.fx("notification", 0.05, 0.45)
    s.out("#g-t1", T(2) - 0.08)
    s.slam("#g-t2", T(2), 1.25, origin="0% 50%")
    s.js.append(f'tl.fromTo("#g-m2", {{ opacity: 0, x: 60, filter: "blur(6px)" }}, {{ opacity: 1, x: 0, filter: "blur(0px)", duration: 0.25, ease: "expo.out" }}, {T(2) + 0.05:.3f});')
    s.fx("pop", T(2) + 0.08, 0.8)
    s.whip_out("#hook > *", 4, "x", -1300)
    s.fx("whoosh", T(4) - 0.08, 0.8)
    # Team channel, dark.
    inner = f'''<div id="g-tt" class="abs disp" style="left:72px;top:250px;font-size:130px;color:var(--d-green)">Your team<br>stays internal.</div>{z(78, 620, 2.2, TEAM, "g-team")}'''
    s.scene("team", 4, 6, "var(--d-bg)", inner)
    s.js.append(f'tl.fromTo("#g-team", {{ x: 1200, filter: "blur(20px)" }}, {{ x: 0, filter: "blur(0px)", duration: 0.26, ease: "power3.out" }}, {T(4)});')
    s.slam("#g-tt", T(4) + 0.04, 1.25, origin="0% 50%")
    s.js.append(f'tl.fromTo(".tm-m", {{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.2, stagger: {B / 2:.4f}, ease: "expo.out" }}, {T(4.5)});')
    s.js.append(f'tl.fromTo("#team-int", {{ scale: 1 }}, {{ scale: 1.5, duration: 0.12, yoyo: true, repeat: 1, ease: "power2.out" }}, {T(5.5)});')
    s.fx("pop-lo", T(5.5), 0.8)
    # The client's board.
    lst = f'''<div class="list"><div class="lh">To do<span class="cnt">2</span></div><div class="stack">{card("Review the new client brief", "ACME-1", "Client brief", "--l-teal", "PR", "--a3", BRIEF_FACTS)}{card("Collect brand assets", "ACME-2", "Assets", "--l-orange", "DK", "--a4")}</div></div>'''
    inner = f'''<div id="g-bt" class="abs disp" style="left:72px;top:250px;font-size:130px;color:var(--ink)">Clients see<br>their <span style="color:var(--green)">board.</span></div>{z(156, 610, 2.4, lst, "g-list")}'''
    s.scene("board", 6, 8, "var(--board)", inner)
    s.js.append(f'tl.fromTo("#g-list", {{ y: 900, filter: "blur(20px)" }}, {{ y: 0, filter: "blur(0px)", duration: 0.28, ease: "power3.out" }}, {T(6)});')
    s.slam("#g-bt", T(6) + 0.04, 1.25, origin="0% 50%")
    s.fx("whoosh-hi", T(6), 0.7)
    # Guests don't use a seat.
    rows = [("Guests", "#fff"), ("don’t", "#fff"), ("use a", "#fff"), ("seat.", "var(--hl)")]
    inner = "".join(f'<div class="abs disp gs" style="left:72px;top:{290 + i * 245}px;font-size:250px;color:{c}">{t}</div>' for i, (t, c) in enumerate(rows))
    s.scene("seat", 8, 12, "var(--green)", inner)
    for i in range(4):
        t = T(8 + i * 0.5)
        s.slam(f"#seat .gs:nth-child({i + 1})", t, 1.6, 14, "0% 70%", 0.22)
        s.shake(t, 0.8)
    s.fx("impact-bass-1", T(8), 0.8)
    s.fx("impact-bass-1", T(9.5), 0.6)
    # Invite the client, not the chaos.
    rows = [("Invite", "var(--ink)"), ("the client,", "var(--ink)"), ("not the", "var(--ink2)"), ("chaos.", "var(--green)")]
    inner = "".join(f'<div class="abs disp ic" style="left:72px;top:{380 + i * 175}px;font-size:160px;color:{c}">{t}</div>' for i, (t, c) in enumerate(rows))
    s.scene("invite", 12, 16, "var(--canvas)", inner)
    for i in range(4):
        s.slam(f"#invite .ic:nth-child({i + 1})", T(12 + i * 0.5), 1.4, 10, "0% 70%", 0.22)
    s.fx("whoosh-lo", T(12) - 0.05, 0.6)
    s.claim(16, 20)
    s.endcard(20)
    s.build(dict(stabs=[16, 17, 18, 19], drops=[8, 20], grooves=[[0, 16], [20, 25]], sparkle=[[12, 16]], final=25, seed=33))


def short_find():
    s = Short("find-anything", 26)
    inner = '<div id="f-h" class="abs disp" style="left:72px;top:560px;font-size:200px;color:var(--hl-ink)">Where’s<br>that file?</div>'
    s.scene("hook", 0, 2, "var(--hl)", inner)
    s.js.append(f'tl.fromTo("#f-h", {{ scale: 1.06, transformOrigin: "0% 50%" }}, {{ scale: 1, duration: 0.4, ease: "expo.out" }}, 0);')
    inner = '''<div id="k-cmd" class="kcap" style="left:130px;top:740px">⌘</div><div id="k-k" class="kcap" style="left:590px;top:740px">K</div>'''
    s.scene("keys", 2, 4, "var(--hl)", inner)
    for i, (sel, rot) in enumerate([("#k-cmd", -4), ("#k-k", 4)]):
        t = T(2 + i)
        s.js.append(f'tl.fromTo("{sel}", {{ scale: 2.6, opacity: 0, filter: "blur(14px)", rotation: {rot * 3} }}, {{ scale: 1, opacity: 1, filter: "blur(0px)", rotation: {rot}, duration: 0.25, ease: "expo.out" }}, {t});')
        s.shake(t, 1.2)
        s.fx("impact-bass-1", t, 0.85 - 0.15 * i)
    inner = f'''<div id="f-t" class="abs disp" style="left:72px;top:250px;font-size:150px;color:var(--hl-ink)">Find<br>anything.</div>{z(79, 640, 1.6, palette("pl"), "f-pal")}'''
    s.scene("search", 4, 8, "var(--hl)", inner)
    s.hide0(".plq"); s.hide0(".plr")
    s.js.append(f'tl.fromTo("#f-pal", {{ opacity: 0, scale: 0.2, transformOrigin: "460px 200px" }}, {{ opacity: 1, scale: 1, duration: 0.35, ease: "back.out(1.5)" }}, {T(4)});')
    s.slam("#f-t", T(4) + 0.03, 1.3, origin="0% 50%")
    s.js.append(f'tl.to(".plq", {{ opacity: 1, duration: 0.01, stagger: {B / 4:.4f} }}, {T(4.25)});')
    s.js.append(f'tl.fromTo(".plr", {{ opacity: 0, y: 16, filter: "blur(8px)" }}, {{ opacity: 1, y: 0, filter: "blur(0px)", duration: 0.22, stagger: 0.07, ease: "expo.out" }}, {T(5)});')
    s.fx("whoosh-hi", T(4), 0.7)
    s.fx("typing", T(4.25) + 0.02, 0.55)
    s.fx("pop", T(5) + 0.07, 0.8)
    s.fx("pop-hi", T(5) + 0.21, 0.7)
    s.fx("pop-lo", T(5) + 0.35, 0.8)
    s.word_fields(8, [("Cards.", "var(--green)", "#fff", 260, False), ("Comments.", "var(--d-bg)", "var(--d-green)", 190, False),
                      ("Messages.", "var(--canvas)", "var(--ink)", 190, False), ("One<br>search.", "var(--hl)", "var(--hl-ink)", 260, False)])
    # Dark mode: the toggle is clicked and an iris from it flips the scene.
    tog = lambda label, ic, dark: f'<span class="tog{" dark" if dark else ""}">{icon(ic, 16)}{label}</span>'
    light = f'''<div id="f-lt" class="abs disp" style="left:72px;top:250px;font-size:140px;color:var(--hl-ink)">Search…</div>{z(690, 176, 2, tog("Dark mode", "moon", False))}{z(79, 640, 1.6, palette("pd"))}'''
    dark = f'''<div class="abs disp" style="left:72px;top:250px;font-size:140px;color:var(--d-green)">Dark mode,<br>too.</div>{z(690, 176, 2, tog("Light mode", "sun", True))}{z(79, 640, 1.6, palette("pk", True))}'''
    inner = f'{light}<div id="f-dark" class="fill" style="background:var(--d-bg);clip-path:circle(0px at 800px 208px)">{dark}</div>{CURSOR.format(id="f-cur")}'
    s.scene("dark", 12, 16, "var(--hl)", inner)
    s.js.append(f'tl.fromTo("#f-cur", {{ x: 1100, y: 1500, scale: 1 }}, {{ x: 808, y: 218, duration: 0.4, ease: "power2.out" }}, {T(12) + 0.05:.3f});')
    s.js.append(f'tl.to("#f-cur", {{ scale: 0.86, duration: 0.05 }}, {T(13) - 0.03:.3f}); tl.to("#f-cur", {{ scale: 1, duration: 0.08 }}, {T(13) + 0.06:.3f});')
    s.js.append(f'tl.fromTo("#f-dark", {{ clipPath: "circle(0px at 800px 208px)" }}, {{ clipPath: "circle(2300px at 800px 208px)", duration: 0.5, ease: "power3.inOut" }}, {T(13)});')
    s.js.append(f'tl.fromTo("#f-cur path", {{ fill: "#202822" }}, {{ fill: "#e8eee9", duration: 0.2 }}, {T(13) + 0.1:.3f});')
    s.js.append(f'tl.to("#f-cur", {{ opacity: 0, duration: 0.15 }}, {T(15)});')
    s.fx("click", T(13), 1.0)
    s.fx("whoosh-lo", T(13) + 0.12, 0.6)
    s.whip_out("#dark > *", 16, "x", -1300)
    s.claim(16, 20)
    s.endcard(20)
    s.build(dict(stabs=[0, 1, 16, 17, 18, 19], drops=[4, 20], grooves=[[4, 16], [20, 25]], sparkle=[[12, 16]], final=25, seed=44))


def short_one_card():
    s = Short("one-card", 26)
    big = card("Review the new client brief", "ACME-1", "Client brief", "--l-teal", "PR", "--a3", BRIEF_FACTS)
    inner = f'''<div id="o-t" class="abs disp" style="left:72px;top:250px;font-size:170px;color:var(--ink)">From brief<br>to <span style="color:var(--green)">done.</span></div>{z(96, 720, 3, big, "o-card")}'''
    s.scene("hook", 0, 2, "var(--board)", inner)
    s.js.append(f'tl.fromTo("#o-card", {{ scale: 1.06, transformOrigin: "444px 220px" }}, {{ scale: 1, duration: 0.4, ease: "expo.out" }}, 0);')
    s.js.append(f'tl.to("#o-card", {{ scale: 2.4, opacity: 0, filter: "blur(12px)", transformOrigin: "444px 220px", duration: 0.3, ease: "power3.in" }}, {T(2) - 0.3:.3f});')
    s.fx("whoosh", T(2) - 0.1, 0.8)
    ch = "".join(f'<span class="ch">{"&nbsp;" if c == " " else c}</span>' for c in "@Priya ready for your review")
    panel = f'''<div class="panel"><div class="crumbs">In progress · ACME-1</div><div class="ttl">Review the new client brief</div>
<div class="due"><span class="lab">Due</span><span class="pill"><span id="o-d0" class="p0">Fri, Oct 24</span><span id="o-d1" class="p1">Due soon</span></span></div>
<div class="h">{icon("check", 16)}Brief sign-off<span class="cnt2"><span id="o-n0">0/3</span><span id="o-n1">1/3</span><span id="o-n2">2/3</span><span id="o-n3">3/3</span></span></div>
<div class="bar"><div id="o-fill"></div></div>
<div class="item"><span class="box"><span id="o-on1" class="on">{icon("tick", 14, 2.4)}</span></span>Read the brief</div>
<div class="item"><span class="box"><span id="o-on2" class="on">{icon("tick", 14, 2.4)}</span></span>Confirm scope with Acme</div>
<div class="item"><span class="box"><span id="o-on3" class="on">{icon("tick", 14, 2.4)}</span></span>Share the first concept</div>
<div class="h" style="margin-top:14px">Attachments</div>
<div class="drop"><span id="o-dt">Drop files here or choose files · Up to 25 MB each.</span><span id="o-file">{icon("attach", 16)}brief-final.pdf<span class="sz">2.4 MB</span></span></div>
<div class="h" style="margin-top:14px">Comments</div><div class="input"><span class="men" id="o-men">{ch[:6 * 25]}</span></div></div>'''
    # The mention spans: split after "@Priya".
    chars = [f'<span class="ch">{"&nbsp;" if c == " " else c}</span>' for c in "@Priya ready for your review"]
    panel = panel.replace(f'<span class="men" id="o-men">{ch[:6 * 25]}</span>', f'<span class="men" id="o-men">{"".join(chars[:6])}</span>{"".join(chars[6:])}')
    titles = ["Checklists.", "Files.", "@mentions.", "Due soon."]
    inner = "".join(f'<div id="o-w{i}" class="abs disp" style="left:72px;top:190px;font-size:150px;color:#fff">{t}</div>' for i, t in enumerate(titles))
    inner += z(82, 400, 1.95, panel, "o-panel")
    s.scene("detail", 2, 12, "var(--green)", inner)
    for sel in ["#o-n1", "#o-n2", "#o-n3", "#o-d1", "#o-on1", "#o-on2", "#o-on3", ".ch", "#o-w1", "#o-w2", "#o-w3"]:
        s.hide0(sel)
    s.js.append('tl.fromTo("#o-fill", { scaleX: 0 }, { scaleX: 0, duration: 0.01 }, 0);')
    s.js.append('tl.fromTo("#o-file", { y: -900, rotation: -18, opacity: 0 }, { y: -900, opacity: 0, duration: 0.01 }, 0);')
    s.js.append(f'tl.fromTo("#o-panel", {{ scale: 0.6, opacity: 0, filter: "blur(14px)", transformOrigin: "458px 300px" }}, {{ scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.32, ease: "expo.out" }}, {T(2)});')
    for i in range(4):
        t = T(2 + 2 * i)
        if i:
            s.out(f"#o-w{i - 1}", t - 0.06)
        s.slam(f"#o-w{i}", t, 1.3, origin="0% 50%")
    for k, b in enumerate([2.5, 3, 3.5]):
        t = T(b)
        s.js.append(f'tl.fromTo("#o-on{k + 1}", {{ opacity: 0, scale: 0.3 }}, {{ opacity: 1, scale: 1, duration: 0.2, ease: "back.out(2.4)" }}, {t});')
        s.js.append(f'tl.to("#o-n{k}", {{ opacity: 0, duration: 0.05 }}, {t}); tl.to("#o-n{k + 1}", {{ opacity: 1, duration: 0.05 }}, {t});')
        s.js.append(f'tl.to("#o-fill", {{ scaleX: {(k + 1) / 3:.4f}, duration: 0.25, ease: "expo.out" }}, {t});')
        s.fx(["click-soft", "click", "click-soft"][k], t, [1.0, 0.7, 1.0][k])
    s.js.append(f'tl.to("#o-file", {{ y: 0, rotation: 0, opacity: 1, duration: 0.3, ease: "back.out(1.8)" }}, {T(4.25)}); tl.to("#o-dt", {{ opacity: 0, duration: 0.08 }}, {T(4.25) + 0.2:.3f});')
    s.fx("pop-lo", T(4.25) + 0.26, 1.0)
    s.js.append(f'tl.to(".ch", {{ opacity: 1, duration: 0.01, stagger: {0.6 / 28:.4f} }}, {T(6) + 0.05:.3f});')
    s.js.append(f'tl.fromTo("#o-men", {{ backgroundColor: "rgba(220,236,223,0)", color: "#202822" }}, {{ backgroundColor: "rgba(220,236,223,1)", color: "#174e36", duration: 0.1 }}, {T(6) + 0.18:.3f});')
    s.fx("typing", T(6) + 0.05, 0.6)
    s.js.append(f'tl.to("#o-d0", {{ opacity: 0, duration: 0.05 }}, {T(8) + 0.05:.3f}); tl.fromTo("#o-d1", {{ opacity: 0, scale: 1.8 }}, {{ opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2.2)" }}, {T(8) + 0.05:.3f});')
    s.fx("pop-hi", T(8) + 0.1, 0.9)
    s.whip_out("#detail > *", 12)
    s.fx("whoosh-lo", T(12) - 0.1, 0.7)
    # Move it: the list swipes from To do to In progress to Done while the card stays.
    names = ["To do", "In progress", "Done"]
    heads = "".join(f'<div id="o-h{i}" class="abs lhx" style="left:{i * 336}px">{n}<span class="cnt">{[3, 2, 1][i]}</span></div>' for i, n in enumerate(names))
    mv = f'''<div class="listx"><div id="o-heads" class="abs" style="left:16px;top:0">{heads}</div>
<div class="abs" style="left:12px;top:56px">{card("Review the new client brief", "ACME-1", "Client brief", "--l-teal", "PR", "--a3", f'<span>{icon("check")}3/3</span><span>{icon("attach")}1</span><span>{icon("comment")}1</span>', idv="o-mc")}</div>
<div id="o-stamp" class="abs stamp">{icon("tick", 28, 2.6)}</div></div>'''
    inner = f'<div id="o-mt" class="abs disp" style="left:72px;top:250px;font-size:170px;color:var(--ink)">Move it.</div>{z(156, 560, 2.4, mv, "o-mv")}'
    s.scene("move", 12, 16, "var(--board)", inner)
    s.hide0("#o-stamp")
    s.js.append(f'tl.fromTo("#o-mv", {{ y: 1000, filter: "blur(20px)" }}, {{ y: 0, filter: "blur(0px)", duration: 0.26, ease: "power3.out" }}, {T(12)});')
    s.slam("#o-mt", T(12) + 0.04, 1.3, origin="0% 50%")
    for i, b in enumerate([13, 14]):
        s.js.append(f'tl.to("#o-heads", {{ x: {-(i + 1) * 336}, duration: 0.3, ease: "power3.inOut" }}, {T(b)});')
        s.js.append(f'tl.fromTo("#o-mc", {{ x: 0, rotation: 0 }}, {{ x: 0, rotation: {[3, -3][i]}, duration: 0.15, yoyo: true, repeat: 1, ease: "power2.out" }}, {T(b)});')
        s.fx(["whoosh-hi", "whoosh"][i], T(b) + 0.1, 0.6)
    s.js.append(f'tl.fromTo("#o-stamp", {{ opacity: 0, scale: 2.4 }}, {{ opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }}, {T(14.5)});')
    s.fx("pop", T(14.5), 0.9)
    s.claim(16, 20)
    s.endcard(20)
    s.build(dict(stabs=[0, 1, 16, 17, 18, 19], drops=[2, 20], grooves=[[2, 16], [20, 25]], sparkle=[[12, 16]], final=25, seed=55))


if __name__ == "__main__":
    for fn in (short_too_many_places, short_guests, short_find, short_one_card):
        name = fn.__name__.replace("short_", "")
        print("building", name)
        fn()
    # Shared assets into each project (HyperFrames resolves assets relative to the project root).
    for d in sorted(os.listdir(OUT)):
        p = os.path.join(OUT, d)
        if not os.path.isdir(p) or d.startswith("."):
            continue
        for sub in ("fonts", "vendor", "sfx"):
            dst = os.path.join(p, "assets", sub)
            if os.path.exists(dst):
                shutil.rmtree(dst)
            shutil.copytree(os.path.join(SHARED, sub), dst)
    print("done")
