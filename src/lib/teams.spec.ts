import { defaultTeamIds } from './teams';
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
