# Review — Agency promo (render of 2026-10-22)

## Creative calls

- Built storyline A, "One brief, one card" (`STORYLINES.md`); B (kinetic type) and C (the night before a client
  review) were not built.
- Every screen is rebuilt from this repo's components, tokens and copy at 1.5–2.2x. The tagline
  ("Client work, one place."), the subline, "Start free trial", search's "Cards (1) · Comments (1) · Messages (1)",
  the comment placeholder and "Guests never see the Team channel" all come from the codebase.
  Names, messages and checklist items (Sarah, Eli, Priya, "Brief sign-off") are illustrative data.
- No competitor is named or drawn; the "old way" is generic messages, an email thread and stray files.

## What was measured, and what was only looked at

- `hyperframes check`: passes with 0 errors.
- Rendered file: 32.0 s, 1920 × 1080, 30 fps H.264, 48 kHz stereo AAC, 4.0 MB.
- Audio (`hyperframes audio`): −17.7 LUFS integrated, −1.5 dBTP true peak, no clipping. Effect onsets line up
  with the picture (grab 7.11 s, drop 7.96 s, open 9.8 s, checklist ticks 12.2 s and 12.7 s).
- Music bed alone: −15.2 LUFS; 75–88% of its energy sits above 150 Hz, so it carries on phone speakers.
- Looked at: review contact sheets, every cut ±0.2 s, and a 12-frame sheet decoded from the MP4.
- Not checked: nobody has listened to the film. The music is synthesised in code (no music library or
  generator was reachable from the build environment); it was measured, not heard.

## Weakest shot, and what to change with more time

- The board shot (4.5–11 s) is at 1.5x, so card keys and avatars are small on a phone. A punch-in to ~2x during
  the drag would fix it.
- The claim arrives after about 0.25 s of empty canvas following the search carry-out.
- The music is functional rather than memorable; swapping in a licensed 120 BPM track is the biggest upgrade.

## Warnings kept on purpose

- `text_below_floor` / `line_unread` on small product UI (card keys, avatars, the search placeholder,
  the typed comment): these are real interface details shown at product scale, not lines the viewer must read.
  Every line that carries the story is 64–128 px and held long enough to read.
