"""Generates compositions/search.html: ⌘K slams, search bursts open, then a Dark mode click irises the
whole scene into the app's dark theme. The light and dark layers share one markup template."""
import os

LIGHT = dict(ground="var(--hl)", title="var(--hl-ink)", surf="var(--surface)", ink="var(--ink)", ink3="var(--ink3)",
             border="var(--border)", bsub="var(--border-subtle)", mark="var(--hl)", markink="var(--hl-ink)",
             sel="var(--green-subtle)", link="var(--green)", tbg="var(--surface)", tink="var(--ink2)")
DARK = dict(ground="var(--d-bg)", title="var(--d-green)", surf="var(--d-surface)", ink="var(--d-ink)", ink3="var(--d-ink3)",
            border="var(--d-border)", bsub="var(--d-subtle)", mark="var(--d-hl)", markink="var(--d-hl-ink)",
            sel="var(--d-green-subtle)", link="var(--d-green)", tbg="var(--d-subtle)", tink="var(--d-ink2)")
MOON = '<path d="M20.5 13A9 9 0 0 1 11 3.5 9 9 0 1 0 20.5 13Z"/>'
SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>'

def layer(p, c, title, toggle, icon):
    q = "".join(f'<span class="q {p}-q">{ch}</span>' for ch in "brief")
    return f'''<div id="{p}-layer" class="layer" style="background:{c['ground']}">
  <h2 id="{p}-t" class="t" style="color:{c['title']}">{title}</h2>
  <div class="tw"><div class="tog" style="background:{c['tbg']};border-color:{c['border']};color:{c['tink']}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{icon}</svg>{toggle}</div></div>
  <div class="pw"><div class="pal" style="background:{c['surf']};color:{c['ink']}">
    <div class="in" style="border-color:{c['border']}"><svg viewBox="0 0 24 24" fill="none" stroke="{c['ink3']}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><span class="qs">{q}</span></div>
    <div class="counts {p}-res" style="color:{c['ink3']}">Cards (1) · Comments (1) · Messages (1)</div>
    <div class="row {p}-res" style="border-color:{c['bsub']};background:{c['sel']}"><div class="meta" style="color:{c['ink3']}"><b>card</b><span>Acme site rebuild</span><span class="ago">just now</span></div><div class="rt">Review the new client <mark style="background:{c['mark']};color:{c['markink']}">brief</mark></div></div>
    <div class="row {p}-res" style="border-color:{c['bsub']}"><div class="meta" style="color:{c['ink3']}"><b>comment</b><span>Acme site rebuild</span><span class="ago">just now</span></div><div class="rt">@Priya the <mark style="background:{c['mark']};color:{c['markink']}">brief</mark> is final</div></div>
    <div class="row {p}-res" style="border-color:{c['bsub']}"><div class="meta" style="color:{c['ink3']}"><b>message</b><span>Acme site rebuild</span><span class="ago">10:04</span></div><div class="rt">@Eli can you check the <mark style="background:{c['mark']};color:{c['markink']}">brief</mark>?</div></div>
    <div class="all {p}-res" style="color:{c['link']}">See all results for “brief”</div>
  </div></div>
</div>'''

html = f'''<template>
  <style>
    @font-face {{ font-family: 'Geist'; src: url('assets/fonts/Geist-Variable.woff2') format('woff2'); font-weight: 100 900; }}
    #root {{ position: absolute; inset: 0; overflow: hidden; font-family: 'Geist', sans-serif; background: var(--hl); }}
    #s-stage {{ position: absolute; inset: 0; }}
    #s-cam {{ position: absolute; inset: 0; }}
    .layer {{ position: absolute; inset: 0; }}
    #k-dark-wrap {{ position: absolute; inset: 0; clip-path: circle(0px at 1590px 182px); }}
    .t {{ position: absolute; left: 186px; top: 104px; font-size: 130px; line-height: 150px; font-weight: 700; letter-spacing: -0.05em; white-space: nowrap; }}
    .tw {{ position: absolute; left: 1470px; top: 150px; }}
    .tog {{ position: absolute; left: 0; top: 0; zoom: 2; height: 32px; display: flex; align-items: center; gap: 6px; padding: 0 12px; border: 1px solid; border-radius: 6px; font-size: 13px; font-weight: 500; white-space: nowrap; }}
    .tog svg {{ width: 16px; height: 16px; }}
    .pw {{ position: absolute; left: 326px; top: 330px; width: 1268px; height: 640px; }}
    .pal {{ position: absolute; left: 0; top: 0; width: 576px; height: 286px; zoom: 2.2; border-radius: 8px; overflow: hidden; box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.3); }}
    .in {{ height: 48px; display: flex; align-items: center; gap: 10px; padding: 0 16px; border-bottom: 1px solid; font-size: 16px; }}
    .in svg {{ width: 18px; height: 18px; flex: none; }}
    .q {{ display: inline-block; }}
    .counts {{ padding: 8px 16px 4px; font-size: 12px; line-height: 16px; }}
    .row {{ padding: 8px 16px; border-bottom: 1px solid; }}
    .meta {{ display: flex; align-items: baseline; gap: 8px; font-size: 12px; line-height: 16px; }}
    .meta b {{ font-weight: 500; text-transform: uppercase; }}
    .meta .ago {{ margin-left: auto; }}
    .rt {{ font-size: 14px; line-height: 24px; font-weight: 500; white-space: nowrap; }}
    mark {{ border-radius: 2px; padding: 0 1px; }}
    .all {{ padding: 8px 16px; font-size: 14px; line-height: 20px; }}
    .key {{ position: absolute; top: 390px; width: 300px; height: 300px; display: flex; align-items: center; justify-content: center; background: var(--surface); border: 4px solid var(--hl-ink); border-bottom-width: 18px; border-radius: 48px; font-size: 170px; font-weight: 600; color: var(--ink); }}
    #s-cursor {{ position: absolute; left: 0; top: 0; width: 52px; height: 76px; z-index: 30; }}
  </style>
  <div id="root" data-composition-id="search" data-width="1920" data-height="1080" data-layout-allow-overlap data-layout-allow-overflow>
    <div id="s-stage"><div id="s-cam">
      {layer("s-l", LIGHT, "Find anything.", "Dark mode", MOON)}
      <div id="k-dark-wrap">{layer("s-d", DARK, "Dark mode, too.", "Light mode", SUN)}</div>
      <div id="s-cmd" class="key" style="left:590px">⌘</div>
      <div id="s-k" class="key" style="left:1030px">K</div>
    </div></div>
    <svg id="s-cursor" viewBox="0 0 22 32"><path d="M1.5 1.5v24.5l6.2-6 4.3 9.4 4.2-1.9-4.2-9.2h8.6z" fill="#202822" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/></svg>
  </div>
  <script>
    (function () {{
      const B = 0.46875;
      const tl = gsap.timeline({{ paused: true }});
      const shake = (t) => {{
        [[14, -8], [-12, 6], [8, -4], [-4, 2], [0, 0]].forEach(([x, y], i) => tl.to("#s-cam", {{ x, y, duration: 0.033, ease: "none" }}, t + i * 0.033));
      }};

      tl.fromTo([".s-l-res", ".s-d-res", ".q", "#s-l-t", ".tw"], {{ opacity: 0 }}, {{ opacity: 0, duration: 0.01 }}, 0);
      tl.fromTo(".pw", {{ opacity: 0, scale: 0.2 }}, {{ opacity: 0, duration: 0.01 }}, 0);

      // ⌘ then K slam on beats 0 and 1.
      tl.fromTo("#s-cmd", {{ scale: 2.6, opacity: 0, filter: "blur(14px)", rotation: -12 }}, {{ scale: 1, opacity: 1, filter: "blur(0px)", rotation: -4, duration: 0.25, ease: "expo.out" }}, 0);
      shake(0.04);
      tl.fromTo("#s-k", {{ scale: 2.6, opacity: 0, filter: "blur(14px)", rotation: 12 }}, {{ scale: 1, opacity: 1, filter: "blur(0px)", rotation: 4, duration: 0.25, ease: "expo.out" }}, B);
      shake(B + 0.04);

      // Beat 2: the keys fly apart and the palette bursts open.
      tl.to("#s-cmd", {{ x: -1100, rotation: -70, scale: 0.6, opacity: 0, duration: 0.3, ease: "power3.in" }}, 2 * B - 0.05);
      tl.to("#s-k", {{ x: 1100, rotation: 70, scale: 0.6, opacity: 0, duration: 0.3, ease: "power3.in" }}, 2 * B - 0.05);
      tl.to(".pw", {{ opacity: 1, scale: 1, duration: 0.35, ease: "back.out(1.5)" }}, 2 * B);
      tl.fromTo("#s-l-t", {{ opacity: 0, scale: 1.3, filter: "blur(10px)", transformOrigin: "0% 50%" }}, {{ opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.25, ease: "expo.out" }}, 2 * B + 0.02);

      // "brief" on 16ths; three results slam on 8ths.
      tl.to(".s-l-q", {{ opacity: 1, duration: 0.01, stagger: B / 4 }}, 2 * B + 0.12);
      tl.to(".s-d-q", {{ opacity: 1, duration: 0.01, stagger: B / 4 }}, 2 * B + 0.12);
      tl.to(".s-l-res, .s-d-res", {{ opacity: 1, duration: 0.01 }}, 3.5 * B - 0.02);
      tl.fromTo(".s-l-res", {{ y: 18, filter: "blur(8px)" }}, {{ y: 0, filter: "blur(0px)", duration: 0.22, stagger: 0.06, ease: "expo.out" }}, 3.5 * B);

      // The Dark mode toggle, clicked on beat 6: an iris from it flips everything to the dark theme.
      tl.to(".tw", {{ opacity: 1, duration: 0.15 }}, 4.6 * B);
      tl.fromTo("#s-cursor", {{ x: 1960, y: 900, scale: 1 }}, {{ x: 1598, y: 188, duration: 0.45, ease: "power2.out" }}, 4.8 * B);
      tl.to("#s-cursor", {{ scale: 0.86, duration: 0.05 }}, 6 * B - 0.03);
      tl.to("#s-cursor", {{ scale: 1, duration: 0.08 }}, 6 * B + 0.06);
      tl.fromTo("#k-dark-wrap", {{ clipPath: "circle(0px at 1590px 182px)" }}, {{ clipPath: "circle(2300px at 1590px 182px)", duration: 0.5, ease: "power3.inOut" }}, 6 * B);
      tl.fromTo("#s-cursor path", {{ fill: "#202822" }}, {{ fill: "#e8eee9", duration: 0.2 }}, 6 * B + 0.1);

      // Whip into the claim.
      tl.to("#s-cursor", {{ opacity: 0, duration: 0.1 }}, 7.4 * B);
      tl.to("#s-stage", {{ x: -1600, filter: "blur(20px)", duration: 0.22, ease: "power3.in" }}, 8 * B - 0.22);
      window.__timelines["search"] = tl;
    }})();
  </script>
</template>
'''
open(os.path.join(os.path.dirname(__file__), "..", "compositions", "search.html"), "w").write(html)
print("ok")
