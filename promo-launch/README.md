# Agency launch film

A 30-second, client-facing marketing film for Agency, built with
[HyperFrames](https://github.com/heygen-com/hyperframes). The finished film is
[`renders/agency-launch.mp4`](renders/agency-launch.mp4): 1920 × 1080, 30 fps, with a 128 BPM soundtrack and
sound effects.

Where `../promo` is calm and follows one card, this one is loud: giant kinetic type, full-bleed brand colour
fields that change on every beat, and each feature in its own world. Every cut lands on the music's beat
(0.46875 s). Colours, type, icons and labels come from this repository (`src/styles/tokens.css`, light and
dark themes; Geist; `src/components/icon.tsx`; the board, card inspector, chat, search and theme toggle).

## Shot list

| Time | Scene | What happens |
| --- | --- | --- |
| 0–5.6 s | `hook` | "Tasks / Threads / Files / Feedback / final_v4.pdf / Who has it?", one per beat, then "Too many places."; a green iris builds the mark and "Agency" |
| 5.6–7.5 s | `roll` | "One place for" + a slot machine: boards → cards → chat → clients → files → search → everything. |
| 7.5–11.3 s | `board` | Nine cards fly in; the cursor flips Kanban → List and the cards stretch into rows; "Your call." |
| 11.3–15 s | `card` | Checklists tick, a file drops in, an @mention is typed, the due date turns "Due soon" |
| 15–18.8 s | `chat` | Dark-mode team chat streams in; the frame splits to the client's view: "Team stays internal." / "Guests don't use a seat." |
| 18.8–22.5 s | `search` | ⌘ and K slam, search bursts open on "brief"; the Dark mode toggle irises everything into the dark theme |
| 22.5–30 s | `endcard` | "Client work, one place." slammed word by word; the drop floods green; mark, subline, "Start free trial" |

## Edit and re-render

Needs Node 22+, FFmpeg and Chrome (or `HYPERFRAMES_BROWSER_PATH` pointing at a Chromium binary).

```sh
cd promo-launch
npx hyperframes@0.8.185 preview
npx hyperframes@0.8.185 check
npx hyperframes@0.8.185 render --quality delivery --output renders/agency-launch.mp4
scripts/finish_audio.sh renders/agency-launch.mp4   # once per fresh render: brings the mix to about -15 LUFS
```

- `scripts/gen_board.py` and `scripts/gen_search.py` generate the board and search scenes from data (cards,
  light and dark themes). Edit them, re-run, and don't hand-edit the generated HTML.
- `scripts/make_music.py` (numpy, scipy, FFmpeg) rebuilds `assets/music/bed.wav` at about −14 LUFS. To use a
  licensed track, drop in a 30 s, 128 BPM file and keep its downbeats on the beat grid.
- The call to action is a composition variable (`cta`). Sound effects are from Pixabay (`assets/sfx/CREDITS.md`).
