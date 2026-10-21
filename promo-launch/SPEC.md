# SPEC — Agency launch film (client-facing)

GOAL:    an agency owner watching on a phone feels the chaos of scattered client work, then the relief of one
         app, and taps "Start free trial".
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps
TIME:    30 s x 30 = 900 frames; 128 BPM, beat 0.46875 s (14.06 frames), bar 1.875 s; 16 bars.
         Every cut and slam is on a computed beat (index x 0.46875, rounded per frame), never accumulated.

LOOK:    Agency's own palette at full saturation, used as full-bleed fields that change on the beat:
         canvas #F7F8F5, brand green #196747 (fields and the claim), ink #202822, dark-theme ground #111714 with
         dark-theme mint #86CBA5, search highlight #FAE8A6 / #644517, board canvas #EEF2F6.
         type: Geist 700, display 300–420 px with -0.05 em tracking, chapter words 150–200 px, body lines 84 px;
         Geist Mono for file names and keys.
         product UI: rebuilt from the repo's components at 1.3–2.4x, never tilted.
         no gradients, glow, glass or particles.
MOTION:  slams: scale 1.25 → 1 in 0.25 s expo.out with blur 10 → 0 px in 0.1 s; whips 0.2 s power3.in with
         20 px blur; colour fields switch on the beat with no fade; camera shake only on the claim slams
         (±10 px over 4 frames, fixed offsets); springs back.out(1.6–2) on dropped objects; stagger 16ths (0.117 s).
SHOTS (bars):
  0–2    hook: six words on six beats, six fields; "Too many places." with the words piled behind it.
  2–3    the green iris from centre, the mark tile, bars rising on 8ths, "Agency" wipes; zoom through.
  3–4    "One place for ___": the slot rolls boards → cards → chat → clients → files → search → everything.
  4–6    board: 9 cards fly in on 16ths; Kanban → List toggle (click) flips cards into rows; "Kanban." /
         "List." / "Your call."; whip.
  6–8    card on a green field: "Checklists." (3 ticks on 8ths), "Files." (pdf drops, spring),
         "@mentions." (typed), "Due dates." (Due soon badge); whip.
  8–10   dark team chat: 6 messages on 8ths, "Several people are typing…"; the frame splits, the right half
         floods to the client's light view; "Team stays internal." | "Guests don't use a seat."
  10–12  yellow field: ⌘ and K slam, the palette bursts open, "brief" typed, 3 results slam;
         the Dark mode toggle is clicked and an iris from it flips the scene to the dark theme.
  12–14  breakdown: "Client work," / "one place." slammed word by word with shake; riser.
  14–16  drop: green floods from "one place.", the white mark tile builds, "Agency", subline,
         "Start free trial" (white button), held 2.7 s.
BANNED:  dark void with small floating things; glow; gradients; glass; particles; product UI tilted in 3D;
         three cards in a row as a feature list; every element fading and sliding up; titles drifting after
         they land; logo docked in a corner; invented features or numbers; naming or drawing competitors.
QA:      0.0, 1.0, 3.2, 4.6, 6.6, 8.6, 10.2, 12.4, 14.2, 16.2, 18.0, 19.8, 21.8, 23.6, 25.5, 29.5.
