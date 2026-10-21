"""Generates compositions/board.html: nine cards fly into a Kanban board, then morph into List rows."""
import json, os

LISTS = ["To do", "In progress", "Done"]
CARDS = [  # (list, title, label, label colour var, avatar initials, avatar colour var)
    (0, "Review the new client brief", "Client brief", "--l-teal", "PR", "--a3"),
    (0, "Collect brand assets", "Assets", "--l-orange", "DK", "--a4"),
    (0, "Homepage hero copy", "Copy", "--l-blue", "SA", "--a5"),
    (1, "Logo concepts v2", "Design", "--l-purple", "EO", "--a1"),
    (1, "Homepage wireframe", "Design", "--l-purple", "PR", "--a3"),
    (1, "Social launch kit", "Social", "--l-pink", "DK", "--a4"),
    (2, "Kickoff call notes", "Admin", "--l-grey", "EO", "--a1"),
    (2, "Sitemap", "UX", "--l-teal", "SA", "--a5"),
    (2, "Moodboard", "Design", "--l-purple", "PR", "--a3"),
]
# Where each card flies in from (CSS px offsets) and its spin.
FROM = [(-900, -420, -24), (40, -760, 18), (880, -300, 22), (-760, 560, 16), (60, 820, -20), (900, 520, -14), (-1100, 60, 28), (1100, 120, -26), (-60, -900, 12)]

def card_html(k, c):
    j, title, label, lc, av, ac = c
    i = sum(1 for x in CARDS[:k] if x[0] == j)
    left, top = 12 + 336 * j, 56 + i * 133
    return f'''<div id="k-c{k}" class="card abs" style="left:{left}px;top:{top}px">
  <div class="cb"><span class="chip"><span class="dot" style="background:var({lc})"></span>{label}</span><div class="ct">{title}</div></div>
  <div class="cf"><span class="key">ACME-{k+1}</span><span class="av" style="background:var({ac})">{av}</span></div></div>'''

def row_html(k, c):
    j, title, label, lc, av, ac = c
    i = sum(1 for x in CARDS[:k] if x[0] == j)
    top = j * 160 + 40 + i * 36
    return f'''<div id="k-r{k}" class="row abs" style="top:{top}px"><span class="key">ACME-{k+1}</span><span class="rt">{title}</span>
  <span class="rav"><span class="av" style="background:var({ac})">{av}</span></span><span class="rl"><span class="chip"><span class="dot" style="background:var({lc})"></span>{label}</span></span></div>'''

def morph(k, c):
    j = c[0]
    i = sum(1 for x in CARDS[:k] if x[0] == j)
    return {"dx": -(12 + 336 * j), "dy": j * 160 + 40 + i * 36 - (56 + i * 133)}

lists = "\n".join(f'<div id="k-l{j}" class="list abs" style="left:{336*j}px"><div class="lh">{n}<span class="cnt">3</span><span class="more">···</span></div></div>' for j, n in enumerate(LISTS))
groups = "\n".join(f'<div id="k-g{j}" class="group abs" style="top:{j*160}px"><span class="chev">⌄</span>{n}<span class="cnt">3</span></div>' for j, n in enumerate(LISTS))
cards = "\n".join(card_html(k, c) for k, c in enumerate(CARDS))
rows = "\n".join(row_html(k, c) for k, c in enumerate(CARDS))
M = json.dumps([morph(k, c) for k, c in enumerate(CARDS)])
F = json.dumps(FROM)

html = f'''<template>
  <style>
    @font-face {{ font-family: 'Geist'; src: url('assets/fonts/Geist-Variable.woff2') format('woff2'); font-weight: 100 900; }}
    @font-face {{ font-family: 'Geist Mono'; src: url('assets/fonts/GeistMono-Regular.woff2') format('woff2'); font-weight: 400; }}
    #root {{ position: absolute; inset: 0; overflow: hidden; font-family: 'Geist', sans-serif; color: var(--ink); background: var(--board); }}
    #k-stage {{ position: absolute; inset: 0; }}
    .t {{ position: absolute; left: 186px; top: 96px; font-size: 180px; line-height: 190px; font-weight: 700; letter-spacing: -0.055em; white-space: nowrap; color: var(--ink); }}
    .t .w {{ display: inline-block; margin-right: 0.2em; }}
    #k-togw {{ position: absolute; left: 1440px; top: 150px; }}
    #k-tog {{ position: absolute; left: 0; top: 0; zoom: 1.6; width: 176px; height: 36px; border: 1px solid var(--border); border-radius: 8px; background: var(--subtle); }}
    #k-pill {{ position: absolute; left: 3px; top: 3px; width: 84px; height: 28px; border-radius: 6px; background: var(--surface); box-shadow: 0 1px 2px rgb(32 40 34 / 0.12); }}
    .tb {{ position: absolute; top: 3px; width: 84px; height: 28px; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; font-weight: 500; color: var(--ink2); }}
    .tb svg {{ width: 15px; height: 15px; }}
    #k-uiw {{ position: absolute; left: 192px; top: 340px; }}
    #k-ui {{ position: absolute; left: 0; top: 0; width: 992px; height: 480px; zoom: 1.3; }}
    .abs {{ position: absolute; }}
    .list {{ top: 0; width: 320px; height: 455px; background: var(--subtle); border: 1px solid var(--border); border-radius: 12px; }}
    .lh {{ position: absolute; left: 16px; right: 12px; top: 0; height: 56px; display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; }}
    .cnt {{ margin-left: auto; min-width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); font-size: 12px; font-weight: 500; }}
    .more {{ width: 24px; text-align: center; color: var(--ink3); font-weight: 700; }}
    .card {{ width: 296px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 3px 10px -3px rgb(32 40 34 / 0.12); transform-origin: 0 0; }}
    .cb {{ padding: 16px 16px 12px; }}
    .chip {{ display: inline-flex; align-items: center; gap: 6px; height: 20px; padding: 0 6px; border: 1px solid var(--border); border-radius: 4px; font-size: 12px; color: var(--ink2); background: var(--surface); }}
    .dot {{ width: 8px; height: 8px; border-radius: 9px; }}
    .ct {{ margin-top: 8px; font-size: 15px; line-height: 24px; font-weight: 500; white-space: nowrap; }}
    .cf {{ display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-subtle); padding: 8px 16px; height: 41px; }}
    .key {{ font-family: 'Geist Mono', monospace; font-size: 12px; color: var(--ink3); }}
    .av {{ display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 99px; color: #fff; font-size: 10px; font-weight: 600; }}
    .group {{ left: 0; width: 992px; height: 40px; display: flex; align-items: center; gap: 10px; padding: 0 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px 10px 0 0; font-size: 14px; font-weight: 600; }}
    .chev {{ color: var(--ink3); }}
    .row {{ left: 0; width: 992px; height: 36px; display: flex; align-items: center; gap: 14px; padding: 0 14px; background: var(--surface); border: 1px solid var(--border); border-top: 0; font-size: 14px; }}
    .rt {{ font-weight: 500; flex: 1; white-space: nowrap; }}
    .rav {{ width: 120px; }} .rl {{ width: 160px; }}
    #k-cursor {{ position: absolute; left: 0; top: 0; width: 52px; height: 76px; z-index: 30; }}
  </style>
  <div id="root" data-composition-id="board" data-width="1920" data-height="1080" data-layout-allow-overlap data-layout-allow-overflow>
    <div id="k-stage">
      <h2 id="k-t1" class="t"><span class="w">Kanban.</span></h2>
      <h2 id="k-t2" class="t"><span class="w">List.</span></h2>
      <h2 id="k-t3" class="t"><span class="w">Your</span><span class="w" style="color:var(--green)">call.</span></h2>
      <div id="k-togw"><div id="k-tog"><span id="k-pill"></span>
        <span class="tb" style="left:3px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M15 4v16"/></svg>Kanban</span>
        <span class="tb" style="left:89px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5h12M9 12h12M9 19h12"/><path d="M3 5h.01M3 12h.01M3 19h.01" stroke-width="3"/></svg>List</span>
      </div></div>
      <div id="k-uiw"><div id="k-ui">
{lists}
{groups}
{rows}
{cards}
      </div></div>
    </div>
    <svg id="k-cursor" viewBox="0 0 22 32"><path d="M1.5 1.5v24.5l6.2-6 4.3 9.4 4.2-1.9-4.2-9.2h8.6z" fill="#202822" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/></svg>
  </div>
  <script>
    (function () {{
      const B = 0.46875;
      const tl = gsap.timeline({{ paused: true }});
      const M = {M};
      const F = {F};
      const cards = M.map((_, k) => "#k-c" + k);
      const rows = M.map((_, k) => "#k-r" + k);

      // Arrive from the roll's whip: the board world drops in.
      tl.fromTo("#k-stage", {{ y: 500, filter: "blur(16px)" }}, {{ y: 0, filter: "blur(0px)", duration: 0.25, ease: "power3.out" }}, 0);
      tl.fromTo(["#k-l0", "#k-l1", "#k-l2"], {{ opacity: 0 }}, {{ opacity: 1, duration: 0.2, stagger: 0.05 }}, 0.05);
      tl.fromTo(["#k-g0", "#k-g1", "#k-g2"].concat(rows), {{ opacity: 0 }}, {{ opacity: 0, duration: 0.01 }}, 0);

      // Nine cards fly in on 16ths and land in their lists.
      cards.forEach((c, k) => {{
        tl.fromTo(c, {{ x: F[k][0], y: F[k][1], rotation: F[k][2], opacity: 0, scaleX: 1, scaleY: 1, filter: "blur(8px)" }},
          {{ x: 0, y: 0, rotation: 0, opacity: 1, filter: "blur(0px)", duration: 0.42, ease: "expo.out" }}, 0.1 + k * (B / 4));
      }});
      tl.fromTo("#k-t1 .w", {{ opacity: 0, scale: 1.3, filter: "blur(10px)" }}, {{ opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.25, ease: "expo.out" }}, 0.05);

      // The cursor flips the view: Kanban → List on beat 4.
      tl.fromTo("#k-cursor", {{ x: 1900, y: 1150, scale: 1 }}, {{ x: 1648, y: 172, duration: 0.5, ease: "power2.out" }}, 1.25);
      tl.to("#k-cursor", {{ scale: 0.86, duration: 0.05 }}, 4 * B - 0.03);
      tl.to("#k-cursor", {{ scale: 1, duration: 0.08 }}, 4 * B + 0.06);
      tl.to("#k-pill", {{ x: 86, duration: 0.22, ease: "expo.out" }}, 4 * B);
      tl.to("#k-t1 .w", {{ opacity: 0, filter: "blur(8px)", duration: 0.1 }}, 4 * B - 0.05);
      tl.fromTo("#k-t2 .w", {{ opacity: 0, scale: 1.3, filter: "blur(10px)" }}, {{ opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.25, ease: "expo.out" }}, 4 * B);

      // Cards stretch into rows; the lists give way to grouped sections.
      tl.to(["#k-l0", "#k-l1", "#k-l2"], {{ opacity: 0, duration: 0.18 }}, 4 * B);
      cards.forEach((c, k) => {{
        tl.to(c, {{ x: M[k].dx, y: M[k].dy, scaleX: 3.35, scaleY: 0.3, opacity: 0, filter: "blur(6px)", duration: 0.36, ease: "power3.inOut" }}, 4 * B + 0.02 + k * 0.025);
      }});
      tl.to(["#k-g0", "#k-g1", "#k-g2"], {{ opacity: 1, duration: 0.15, stagger: 0.05 }}, 4 * B + 0.15);
      tl.fromTo(rows, {{ opacity: 0, x: -16 }}, {{ opacity: 1, x: 0, duration: 0.22, stagger: 0.025, ease: "expo.out" }}, 4 * B + 0.2);

      tl.to("#k-cursor", {{ x: 2000, y: 700, duration: 0.5, ease: "power2.in" }}, 4 * B + 0.3);
      tl.to("#k-t2 .w", {{ opacity: 0, filter: "blur(8px)", duration: 0.1 }}, 6 * B - 0.05);
      tl.fromTo("#k-t3 .w", {{ opacity: 0, scale: 1.3, filter: "blur(10px)" }}, {{ opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.25, stagger: 0.08, ease: "expo.out" }}, 6 * B);

      // Whip left into the card.
      tl.to("#k-stage", {{ x: -1500, filter: "blur(20px)", duration: 0.22, ease: "power3.in" }}, 8 * B - 0.22);
      window.__timelines["board"] = tl;
    }})();
  </script>
</template>
'''
open(os.path.join(os.path.dirname(__file__), "..", "compositions", "board.html"), "w").write(html)
print("ok")
