"""Writes every banner as an HTML page in marketing/banners/src/ (rendered to PNG by render_banners.mjs).

Each banner composes the product's own pieces from brand.css: the brand mark, cards, lists, the search palette
and chat channels, using the copy in marketing/COPY.md. Sizes follow current platform guidance; text stays
inside each platform's safe area (noted per banner).
Run: python3 marketing/scripts/build_banners.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "banners", "src")

BARS = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 17V7h4v10H4Zm6 0V4h4v13h-4Zm6 0V9h4v8h-4Z" fill="{c}"/></svg>'
ICON = {
    "check": '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 12 3 3 7-7"/>',
    "comment": '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-1 1v-8.5A8.5 8.5 0 0 1 11.5 4H13a8 8 0 0 1 8 7.5Z"/>',
    "attach": '<path d="m8 12 6.5-6.5a3 3 0 0 1 4.2 4.2L10 18.4a4.5 4.5 0 0 1-6.4-6.4L13 2.6"/>',
    "search": '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    "lock": '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
}


def icon(name, size=14):
    return f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{ICON[name]}</svg>'


def mark(px, inv=False):
    return f'<span class="mark{" inv" if inv else ""}" style="width:{px}px;height:{px}px">{BARS.format(c="#196747" if inv else "#fff")}</span>'


def lockup(px, color="#fff", inv=True):
    return f'<span class="lockup" style="font-size:{px}px;color:{color};gap:{px*0.28:.0f}px">{mark(int(px*0.92), inv)}Agency</span>'


def card(title, key, label=None, lc="--l-teal", av=None, ac="--a3", facts=""):
    chip = f'<span class="chip"><span class="dot" style="background:var({lc})"></span>{label}</span>' if label else ""
    ct = f'<div class="ct"{" style=margin-top:0" if not label else ""}>{title}</div>'
    f = f'<div class="facts">{facts}</div>' if facts else ""
    a = f'<span class="av" style="background:var({ac})">{av}</span>' if av else ""
    return f'<div class="card"><div class="cb">{chip}{ct}{f}</div><div class="cf"><span class="key">{key}</span>{a}</div></div>'


BRIEF = card("Review the new client brief", "ACME-1", "Client brief", "--l-teal", "PR", "--a3",
             f'<span>{icon("check")}3/3</span><span>{icon("attach")}1</span><span>{icon("comment")}2</span><span class="due-soon">Due soon</span>')


def lst(name, cards, count=None):
    return f'<div class="list"><div class="lh">{name}<span class="cnt">{count if count is not None else len(cards)}</span></div><div class="stack">{"".join(cards)}</div></div>'


TODO = lst("To do", [BRIEF, card("Collect brand assets", "ACME-2", "Assets", "--l-orange", "DK", "--a4"),
                      card("Homepage hero copy", "ACME-3", "Copy", "--l-blue", "SA", "--a5")])
DOING = lst("In progress", [card("Logo concepts v2", "ACME-4", "Design", "--l-purple", "EO", "--a1"),
                            card("Homepage wireframe", "ACME-5", "Design", "--l-purple", "PR", "--a3")])
DONE = lst("Done", [card("Kickoff call notes", "ACME-6", None, av="EO", ac="--a1", facts=f'<span>{icon("check")}3/3</span>')])


def palette(dark=False, sel=True):
    q = "brief"
    m = f"<mark>{q}</mark>"
    return f'''<div class="pal{" dark" if dark else ""}"><div class="in">{icon("search", 18)}<span>{q}</span></div>
<div class="counts">Cards (1) · Comments (1) · Messages (1)</div>
<div class="row{" sel" if sel else ""}"><div class="meta"><b>card</b><span>Acme site rebuild</span><span class="ago">just now</span></div><div class="rt">Review the new client {m}</div></div>
<div class="row"><div class="meta"><b>comment</b><span>Acme site rebuild</span><span class="ago">just now</span></div><div class="rt">@Priya the {m} is final, starting layouts</div></div>
<div class="row"><div class="meta"><b>message</b><span>Acme site rebuild</span><span class="ago">10:42</span></div><div class="rt">Is this the final {m}?</div></div>
<div class="all">See all results for “{q}”</div></div>'''


CLIENT_CHAN = f'''<div class="chan"><div class="h">Acme site rebuild<span class="kind">Client</span></div><div class="msgs">
<div class="m"><span class="av lg" style="background:var(--a5)">SA</span><div><div class="who">Sarah<span class="guest">Guest</span><span class="tm">10:42</span></div><div class="body">Is this the final brief?</div></div></div>
<div class="m"><span class="av lg" style="background:var(--a1)">EO</span><div><div class="who">Eli<span class="tm">10:43</span></div><div class="body">Yes, it’s on ACME-1. First layouts Friday.</div><div class="ref"><span class="key">ACME-1</span>Review the new client brief</div></div></div>
</div></div>'''

TEAM_CHAN = f'''<div class="chan dark"><div class="h">{icon("lock", 16)}Team<span class="kind int">Internal</span></div><div class="msgs">
<div class="m"><span class="av lg" style="background:var(--a3)">PR</span><div><div class="who">Priya<span class="tm">10:02</span></div><div class="body">Logo v2 is up on ACME-4</div></div></div>
<div class="m"><span class="av lg" style="background:var(--a4)">DK</span><div><div class="who">Dev<span class="tm">10:03</span></div><div class="body">Client wants the green a bit darker</div></div></div>
<div class="m"><span class="av lg" style="background:var(--a3)">PR</span><div><div class="who">Priya<span class="tm">10:04</span></div><div class="body"><span class="men">@Eli</span> can you check the brief?</div></div></div>
<div class="m"><span class="av lg" style="background:var(--a1)">EO</span><div><div class="who">Eli<span class="tm">10:05</span></div><div class="body">Checked. Brief is final</div></div></div>
</div></div>'''

PILE = [("Tasks", "var(--ink)", 1.0, -6), ("Threads", "var(--green)", 0.8, 5), ("Files", "var(--a4)", 0.95, -3),
        ("Feedback", "var(--warn-text)", 0.9, 4), ("final_v4.pdf", "var(--ink3)", 0.6, -5),
        ("Who has it?", "var(--a1)", 0.75, 6), ("Re: Re: brief", "var(--a5)", 0.55, -4), ("final_v5.pdf", "var(--ink3)", 0.45, 7)]


def pile_word(i, x, y, base):
    w, c, s, r = PILE[i]
    mono = "font-family:'Geist Mono',monospace;font-weight:400;letter-spacing:-0.03em;" if w.startswith("final") else ""
    return f'<span class="abs display" style="left:{x}px;top:{y}px;font-size:{base*s:.0f}px;color:{c};transform:rotate({r}deg);{mono}">{w}</span>'


def z(x, y, zoom, html, extra=""):
    return f'<div class="abs" style="left:{x}px;top:{y}px;{extra}"><div style="zoom:{zoom}">{html}</div></div>'


def page(name, w, h, body, scale=1, bg="var(--canvas)"):
    html = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{name}</title>
<link rel="stylesheet" href="brand.css"><style>html,body{{width:{w}px;height:{h}px;background:{bg}}}</style></head>
<body data-scale="{scale}">{body}</body></html>'''
    open(os.path.join(SRC, f"{name}.html"), "w").write(html)
    return {"name": name, "width": w, "height": h, "scale": scale}


B = []

# 1. Link preview / Open Graph (1200x630; also LinkedIn 1200x627, Facebook shared image).
B.append(page("og-image", 1200, 630, f'''
<div class="abs" style="left:72px;top:64px">{lockup(44)}</div>
<h1 class="abs display" style="left:68px;top:190px;font-size:104px;color:#fff">Client work,<br><span style="color:var(--hl)">one place.</span></h1>
<p class="abs nowrap" style="left:72px;top:440px;font-size:28px;line-height:36px;color:var(--green-muted)">Boards, cards and comments<br>for agencies of five.</p>
{z(770, 168, 1.32, BRIEF)}
''', bg="var(--green)"))

# 2. X card / Twitter summary_large_image (1200x675).
B.append(page("x-card", 1200, 675, f'''
<h1 class="abs display" style="left:72px;top:64px;font-size:96px;color:var(--hl-ink)">Find anything.</h1>
{z(72, 186, 1.6, palette())}
<div class="abs" style="left:1000px;top:72px">{mark(80)}</div>
''', bg="var(--hl)"))

# 3. LinkedIn personal cover (1584x396). The profile photo covers the lower left: keep it clear.
B.append(page("linkedin-cover", 1584, 396, f'''
<div class="abs" style="left:-40px;top:-120px;zoom:1.0;display:flex;gap:16px;opacity:1;transform:rotate(-4deg)">{TODO}{DOING}</div>
<div class="abs" style="left:780px;top:70px">{lockup(40, "var(--ink)", False)}</div>
<h1 class="abs display" style="left:776px;top:150px;font-size:80px;color:var(--ink)">Client work, <span style="color:var(--green)">one place.</span></h1>
<p class="abs nowrap" style="left:780px;top:262px;font-size:28px;color:var(--ink2)">Boards, cards, team chat and a client chat for small agencies.</p>
''', bg="var(--board)"))

# 4. LinkedIn company page cover (1128x191), rendered at 2x.
B.append(page("linkedin-company-cover", 1128, 191, f'''
<div class="abs" style="left:48px;top:62px">{lockup(54)}</div>
<h1 class="abs display" style="left:400px;top:52px;font-size:52px;color:#fff">Client work, <span style="color:var(--hl)">one place.</span></h1>
<p class="abs nowrap" style="left:402px;top:114px;font-size:20px;color:var(--green-muted)">Boards, cards and comments for agencies of five.</p>
<span class="abs btn white" style="left:930px;top:66px;height:58px;padding:0 24px;font-size:20px">Start free trial</span>
''', scale=2, bg="var(--green)"))

# 5. X header (1500x500). The avatar covers the lower left; the right half carries the words.
B.append(page("x-header", 1500, 500, f'''
{z(60, 40, 1.1, TEAM_CHAN)}
<h1 class="abs display" style="left:640px;top:96px;font-size:108px;color:var(--d-green)">Too many places.</h1>
<h1 class="abs display" style="left:640px;top:210px;font-size:108px;color:#fff">Now one.</h1>
<div class="abs" style="left:646px;top:356px">{lockup(40)}</div>
''', bg="var(--d-bg)"))

# 6. YouTube channel art (2560x1440). Text sits in the 1546x423 safe area at the centre.
yt_pile = "".join([
    pile_word(0, 120, 80, 300), pile_word(1, 1150, 60, 300), pile_word(2, 2050, 140, 300),
    pile_word(3, 140, 1100, 300), pile_word(4, 1160, 1180, 300), pile_word(5, 1800, 1060, 300),
    pile_word(6, 40, 400, 200), pile_word(7, 2150, 1000, 160)])
B.append(page("youtube-banner", 2560, 1440, f'''
<div class="abs" style="inset:0;opacity:.22">{yt_pile.replace("var(--ink3)", "#fff").replace("var(--ink)", "#fff").replace("var(--green)", "#fff").replace("var(--a4)", "#fff").replace("var(--warn-text)", "#fff").replace("var(--a1)", "#fff").replace("var(--a5)", "#fff")}</div>
<div class="abs" style="left:560px;top:560px">{lockup(96)}</div>
<h1 class="abs display" style="left:1180px;top:560px;font-size:132px;color:#fff">Client work,<br><span style="color:var(--hl)">one place.</span></h1>
''', bg="var(--green)"))

# 7. Facebook page cover (851x315), rendered at 2x. Mobile crops the sides, so the centre carries it.
B.append(page("facebook-cover", 851, 315, f'''
<h1 class="abs display" style="left:96px;top:84px;font-size:62px;color:var(--ink)">Client work,<br><span style="color:var(--green)">one place.</span></h1>
<p class="abs nowrap" style="left:98px;top:222px;font-size:18px;color:var(--ink2)">Boards, cards and comments for agencies of five.</p>
{z(540, 92, 0.8, BRIEF)}
''', scale=2, bg="var(--canvas)"))

# 8-10. Instagram carousel (1080x1080).
ig_pile = "".join([pile_word(0, 70, 96, 170), pile_word(1, 600, 150, 140), pile_word(2, 690, 300, 160),
                   pile_word(6, 80, 300, 110), pile_word(3, 70, 760, 160), pile_word(4, 150, 960, 110),
                   pile_word(5, 620, 770, 110), pile_word(7, 640, 930, 80)])
B.append(page("instagram-1-too-many-places", 1080, 1080, f'''
{ig_pile}
<h1 class="abs display" style="left:70px;top:505px;font-size:132px;color:var(--ink)">Too many places.</h1>
''', bg="var(--canvas)"))
B.append(page("instagram-2-one-place", 1080, 1080, f'''
<div class="abs" style="left:96px;top:110px">{mark(200, True)}</div>
<h1 class="abs display" style="left:90px;top:420px;font-size:250px;color:#fff">Now<br>one.</h1>
<p class="abs nowrap" style="left:96px;top:900px;font-size:40px;color:var(--green-muted)">Client work, one place. <b style="color:#fff">Agency</b></p>
''', bg="var(--green)"))
B.append(page("instagram-3-guests", 1080, 1080, f'''
{z(96, 100, 2.1, CLIENT_CHAN)}
<h1 class="abs display" style="left:86px;top:700px;font-size:120px;color:var(--ink)">Guests don’t<br>use a <span style="color:var(--green)">seat.</span></h1>
''', bg="var(--canvas)"))

# 11-12. Instagram portrait (1080x1350).
B.append(page("instagram-portrait-find-anything", 1080, 1350, f'''
<h1 class="abs display" style="left:80px;top:120px;font-size:150px;color:var(--hl-ink)">Find<br>anything.</h1>
{z(84, 470, 1.58, palette())}
<p class="abs nowrap" style="left:84px;top:1180px;font-size:36px;color:var(--hl-ink)">⌘K searches cards, comments and messages.</p>
''', bg="var(--hl)"))
B.append(page("instagram-portrait-team-stays-internal", 1080, 1350, f'''
<h1 class="abs display" style="left:80px;top:120px;font-size:140px;color:var(--d-green)">Your team<br>stays internal.</h1>
{z(96, 470, 2.1, TEAM_CHAN)}
<p class="abs nowrap" style="left:84px;top:1200px;font-size:34px;color:var(--d-ink2)">Clients never see the Team channel.</p>
''', bg="var(--d-bg)"))

# 13-14. Stories (1080x1920). Words stay between 250 and 1500 px, clear of the platform's top and bottom UI.
B.append(page("story-client-work", 1080, 1920, f'''
<div class="abs" style="left:96px;top:260px">{lockup(60, "var(--ink)", False)}</div>
<h1 class="abs display" style="left:90px;top:400px;font-size:150px;color:var(--ink)">Client work,<br><span style="color:var(--green)">one place.</span></h1>
{z(156, 760, 2.4, TODO)}
''', bg="var(--board)"))
B.append(page("story-start-free-trial", 1080, 1920, f'''
<div class="abs" style="left:96px;top:270px">{mark(150, True)}</div>
<h1 class="abs display" style="left:90px;top:500px;font-size:160px;color:#fff">Too many<br>places.<br><span style="color:var(--hl)">Now one.</span></h1>
<p class="abs nowrap" style="left:96px;top:1010px;font-size:44px;line-height:56px;color:var(--green-muted)">Boards, cards, team chat<br>and a client chat,<br>for agencies of five.</p>
<span class="abs btn white" style="left:96px;top:1300px;height:120px;padding:0 60px;font-size:50px">Start free trial</span>
''', bg="var(--green)"))

# 15. Email header (1200x400).
B.append(page("email-header", 1200, 400, f'''
<div class="abs" style="left:72px;top:72px">{lockup(40, "var(--ink)", False)}</div>
<h1 class="abs display" style="left:68px;top:150px;font-size:86px;color:var(--ink)">Client work,<br><span style="color:var(--green)">one place.</span></h1>
{z(780, 74, 1.12, BRIEF)}
''', bg="var(--canvas)"))

json.dump(B, open(os.path.join(SRC, "banners.json"), "w"), indent=2)
print(len(B), "banners written")
