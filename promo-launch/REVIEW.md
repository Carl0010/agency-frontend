# Review — Agency launch film (render of 2026-10-22)

## Creative calls

- Built storyline A, "Too many places → one place" (`STORYLINES.md`): kinetic type cut on a 128 BPM beat, with
  each feature in its own world (warm canvas, brand green, board canvas, dark theme, search yellow).
  B (a day at an agency) and C (one endless zoom) were not built.
- Facts on screen come from the codebase: Kanban and List views, checklists, attachments "Up to 25 MB each.",
  @mentions, "Due soon", the Client and Team (Internal) channels, "Guests don't use a seat.", ⌘K search across
  cards, comments and messages, the Dark mode / Light mode toggle, the tagline, the subline and
  "Start free trial". People, messages and card titles are illustrative data.
- No competitor is named or shown.

## What was measured, and what was only looked at

- `hyperframes check`: 0 errors. 46 `line_unread` and 4 `text_below_floor` warnings remain, all on small product
  UI shown at product scale (card keys, avatars, list rows) or on words that cut on the beat by design.
- Rendered file: 30.0 s, 1920 × 1080, 30 fps H.264, AAC stereo, about 5 MB.
- Audio: the raw render measured −20.1 LUFS (the mixer leaves headroom). It was raised once, without
  re-encoding the picture, to −15.1 LUFS integrated with −1.7 dBTP true peak and no clipping.
  Onsets fall on the beat grid (0.47, 0.94, 1.40, 1.87 …).
- Music bed alone: −13.9 LUFS, 70–78% of energy above 150 Hz.
- Looked at: the review beat sheet, the cut strips, eight in-between moments and a 12-frame sheet decoded from
  the MP4.
- Not checked: nobody has listened to it. The soundtrack is synthesised in code (no music library or generator
  was reachable); it was measured, not heard.

## Weakest moments, and what to change with more time

- The List view rows are small on a phone (1.3x). A punch-in on the "To do" group after the flip would fix it.
- "One place for everything." lands about 0.6 s before the whip; a slower roll would give it longer.
- A licensed 128 BPM track would lift the film more than any picture change.

## To re-render

Run `render`, then `scripts/finish_audio.sh renders/agency-launch.mp4` once on the fresh file.
