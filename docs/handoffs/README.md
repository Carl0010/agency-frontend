# Feature handoffs

Record requested capabilities here so another session can continue them.
Completed handoffs remain as implementation and contract records. Include current state, proposed API/data contracts,
authorization, acceptance criteria, test plan and what remains unimplemented.
Never represent a proposal as a completed feature.

- [Teams release and board grouping](TEAMS_RELEASE_AND_BOARD_GROUPING.md): checkpointed
  at the user's request. Access, mobile Teams, stars and grouping are implemented;
  refreshed preview capture/review remains before marking the handoff done.
- [Resolved access contract mismatch](ACCESS_CONTRACT_BLOCKER.md): backend
  `faa34c0` excludes implicit workspace administrators; real-API regression covers
  fresh projects, promotion and the sharing picker.

- [Backend contract upgrade](BACKEND_CONTRACT_UPGRADE.md): implemented on the
  feature branch: Shared channels, project-scoped access, teams, sharing,
  assignment visibility and realtime revocation. Verification is recorded in the
  release handoff; this session does not push or open a PR.
- [Project icons and personal stars](PROJECT_PERSONALIZATION.md): implemented
  picker, saved icons, personal star controls and the authoritative Starred section.
