# SPEC — Agency promo

GOAL:    a small-agency lead finishes the film wanting their client work on Agency, and remembers "Client work, one place."
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps
TIME:    32 s x 30 = 960 frames; music at 120 BPM, 15 frames a beat, 60 frames a bar

LOOK:    the product's own design system (agency-frontend `src/styles/tokens.css`).
         grounds: canvas #F7F8F5, board canvas #EEF2F6, surface #FFFFFF, subtle #F0F2EE; ink #202822,
         secondary #46534A, muted #626F65, borders #DBE1D9.
         accent: primary #196747, only on the selected state, the payoff row, "one place" and the end card.
         type: Geist (variable) 500/600, display 72 px with -0.02 em tracking for verb lines, 120 px for the claim;
         Geist Mono for card keys.
         medium: the product UI rebuilt from its own components at 1.5–2.2x real size (cards 8 px radius,
         panels 12 px, 1 px borders, shadows only for lifted cards); the app's 1.6-stroke outline icons.
         No gradients, glass, glow, grain or vignette, per the design system.
OBJECTS: the card ACME-1 "Review the new client brief" (label dot, checklist count, key, avatar);
         the board with To do / In progress / Done lists; the card details inspector with a checklist and the
         comment box; the project's Client chat with a guest's message; the Team channel locked as Internal;
         the ⌘K search palette with Card / Comment / Message results; the brand mark (three bars on green).
MOTION:  arrive expo.out / power4.out, camera and floods power2.inOut, exits and zoom-through power3.in.
         words blur 6 px → 0 in 4 frames, 2 frames apart; exits 40–50% of entrances; staggers 60 ms;
         cursor 60 px, moves 0.45 s power2.inOut, press 3 frames.
SHOTS:
  0.0–4.5   hook: "Where's the latest brief?" bubble on frame 0; five fragments pop in on beats; line
            "Client work lives everywhere"; fragments collapse into one card at 4.0 (whoosh, pop).
  4.5–11.0  board: ground floods to board canvas, the board builds around the card, card lands in To do;
            "One board per client"; cursor drags it to In progress (click, whoosh, click); "Move it";
            cursor clicks the card and the camera zooms through it.
  11.0–17.0 inspector: lands slightly large and settles; "Check it off": three checklist ticks (clicks);
            "@mention the team": comment typed letter by letter (typing), posted; whip out.
  17.0–22.0 chat: guest asks "Is this the final brief?" (notification); reply links ACME-1 (pop);
            "Guests never see the Team channel": the Team channel row flags Internal (pop).
  22.0–26.5 payoff: ⌘ K keycaps press and morph into the search palette; "brief" typed;
            card, comment and message results land (pops); first row selected in green; carry out.
  26.5–32.0 claim "Client work, one place." ("one place" in green); mark built bar by bar (riser → impact
            at 29.3 s), wordmark wipes in, subline, "Start free trial" button, hold 2 s.
BANNED:  dark void; glow; gradients; glass; everything centred (only the end card is); every element fading
         and sliding up; titles moving after they land; logo docked in a corner; three cards in a row as a
         feature list; invented screens (every label is from the codebase); naming or drawing competitors.
QA:      0.0 (thumbnail not empty), 2.6, 4.4, 6.0, 8.0, 12.6, 14.6, 18.6, 20.5, 24.0, 27.5, 31.0.
