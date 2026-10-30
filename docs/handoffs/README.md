# Feature handoffs

Record requested capabilities here so another session can continue them.
Completed handoffs remain as implementation and contract records. Include current state, proposed API/data contracts,
authorization, acceptance criteria, test plan and what remains unimplemented.
Never represent a proposal as a completed feature.

- [Teams release and board grouping](TEAMS_RELEASE_AND_BOARD_GROUPING.md): completed
  2026-10-21, including 15 reviewed previews, 155 unit tests and all 59 browser checks.
- [Resolved access contract mismatch](ACCESS_CONTRACT_BLOCKER.md): backend
  `faa34c0` excludes implicit workspace administrators; real-API regression covers
  fresh projects, promotion and the sharing picker.

- [Backend contract upgrade](BACKEND_CONTRACT_UPGRADE.md): implemented on the
  feature branch: Shared channels, project-scoped access, teams, sharing,
  assignment visibility and realtime revocation. Verification is recorded in the
  release handoff; this session does not push or open a PR.
- [Project icons and personal stars](PROJECT_PERSONALIZATION.md): implemented
  picker, saved icons, personal star controls and the authoritative Starred section.

- [Project status](PROJECT_STATUS.md): implemented 2026-10-21. Header status menu,
  editor field, Projects filter (Open default), open-only sidebar groups; guests see none.

- [Arrival time](ARRIVAL_TIME.md) and [re-plans](ARRIVAL_TIME_REPLANS.md): frontend
  implemented. The [calendar contract blocker](ARRIVAL_TIME_CONTRACT_BLOCKER.md)
  is resolved by the backend.

- [One card in several projects](CARD_PLACEMENTS.md): implementation in the working
  tree, verification in progress. The [people-read gap](CARD_PLACEMENTS_CONTRACT_BLOCKER.md)
  was resolved by the [card-scoped reads](CARD_PLACEMENTS_PEOPLE_READS.md).
