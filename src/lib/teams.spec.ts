import { defaultTeamIds, fold, teamMatches } from './teams';
import type { Team } from './types';

const team = (id: string, name: string, myRole: Team['myRole'] = null, archivedAt: string | null = null): Team => ({ id, name, myRole, archivedAt, workspaceId: 'w', memberCount: 1, createdAt: '2026-10-16T00:00:00Z' });

describe('visible team defaults for new projects and invites', () => {
  it('chooses the caller’s active teams rather than every workspace team', () => {
    expect(defaultTeamIds([team('a', 'Design', 'member'), team('b', 'Engineering'), team('c', 'Operations', 'admin'), team('d', 'Past', 'member', '2026-10-15T00:00:00Z')])).toEqual(['a', 'c']);
  });
  it('uses Everyone only when there are no active teams belonging to the caller', () => {
    expect(defaultTeamIds([team('a', 'Everyone'), team('b', 'Design')])).toEqual(['a']);
    expect(defaultTeamIds([team('a', 'Everyone'), team('b', 'Design', 'member')])).toEqual(['b']);
  });
  it('leaves sharing empty when no supported default exists', () => {
    expect(defaultTeamIds([team('a', 'Design'), team('b', 'Everyone', null, '2026-10-15T00:00:00Z')])).toEqual([]);
  });
  it('respects the create/invite contract limit', () => {
    expect(defaultTeamIds(Array.from({ length: 51 }, (_, i) => team(String(i), `Team ${i}`, 'member')))).toHaveLength(50);
  });
});

describe('teamMatches', () => {
  const team = { name: 'Design Studio' };
  const members = [{ userId: 'u1', name: 'José Pérez' }, { userId: 'u2', name: 'Ana Lee' }];
  const emails = new Map([['u1', 'jose@example.test'], ['u2', 'ana@example.test']]);

  it('matches everything with no search and no people', () => { expect(teamMatches(team, members, emails, '  ', [])).toBe(true); });
  it('matches the team name', () => { expect(teamMatches(team, undefined, emails, 'studio', [])).toBe(true); });
  it('matches a member name without accents', () => { expect(teamMatches(team, members, emails, 'jose p', [])).toBe(true); });
  it('matches a member email', () => { expect(teamMatches(team, members, emails, 'ana@', [])).toBe(true); });
  it('rejects a search that matches nobody', () => { expect(teamMatches(team, members, emails, 'marketing', [])).toBe(false); });
  it('keeps teams with every chosen person', () => {
    expect(teamMatches(team, members, emails, '', ['u1', 'u2'])).toBe(true);
    expect(teamMatches(team, members, emails, '', ['u1', 'u3'])).toBe(false);
  });
  it('cannot match people before the members load', () => { expect(teamMatches(team, undefined, emails, '', ['u1'])).toBe(false); });
  it('folds case and accents', () => { expect(fold(' ÉLAN ')).toBe('elan'); });
});
