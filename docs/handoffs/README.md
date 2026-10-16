# Feature handoffs

Record requested capabilities here so another session can continue them.
Completed handoffs remain as implementation and contract records. Include current state, proposed API/data contracts,
authorization, acceptance criteria, test plan and what remains unimplemented.
Never represent a proposal as a completed feature.

- [Confirmed access contract mismatch](ACCESS_CONTRACT_BLOCKER.md): release is
  paused because the access endpoint includes an editable workspace-owner grant
  that the changelog says it excludes. Includes reproduction and resume state.

- [Backend contract upgrade](BACKEND_CONTRACT_UPGRADE.md): implemented on the
  feature branch: Shared channels, project-scoped access, teams, sharing,
  assignment visibility and realtime revocation. Release status is in its PR.
- [Project icons and personal stars](PROJECT_PERSONALIZATION.md): implemented
  picker, saved icons, personal star controls and the authoritative Starred section.
