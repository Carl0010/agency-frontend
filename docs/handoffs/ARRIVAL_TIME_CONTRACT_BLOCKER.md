# Arrival time contract blocker: supported holiday calendars

Status: resolved 2026-10-30 by backend commit `789afdc`. The API publishes
`GET /calendar-countries`, rejects unsupported selections, and reports
`publicHolidays` on the calendar view. The original finding follows.

## Finding

The working-days settings must offer the countries whose public holidays the
system supports and tell users that those holidays do not count as working
days. The calendar write contract accepts a two-letter country code and rejects
unknown regions, but neither publishes the supported holiday calendars nor
requires that an accepted region has holiday data.

Backend `countryCalendarOf` validates the code with `Intl.DisplayNames`, while
`DateHolidaysCalendar` independently uses `date-holidays`. In the installed
backend package, `NP` (Nepal) is accepted by the region validation, but
`new Holidays('NP').getHolidays(2026)` returns an empty list and
`getCountries()` does not include `NP`. The same is true for `AF`, `MM`, `KH`,
`LA`, `IQ`, `YE` and `SY`. Thus an accepted selection can silently skip no
public holidays while the requested UI promises that public holidays are
excluded. This is a source and package reproduction, not an HTTP integration
test.

Sources: `apps/api/src/domains/work/arrivals/domain/country-calendar.ts`,
`apps/api/src/domains/work/arrivals/infrastructure/date-holidays.calendar.ts`,
and the `WorkspaceCalendarView` and `SetWorkspaceCalendarRequest` schemas in
`apps/api/contract/openapi.yaml` in `/home/chandan/Desktop/agency-mvp-clone`.

## Backend resolution needed

Publish the authoritative supported country choices and define what happens
when holiday data is unavailable. Ensure the write and estimates match that
contract, including existing saved calendars, and cover unsupported countries
and the user-visible working-days promise in backend tests. Update OpenAPI and
the arrival-time handoff. The frontend must not copy a private backend package's
country list or claim holiday coverage it cannot verify.

## Frontend status

Frontend implementation continues in [ARRIVAL_TIME.md](ARRIVAL_TIME.md).
