import { projectStatus, statusFilter, statusParam, statusSince } from './project-status';

describe('project status display', () => {
  it('maps each status to its label and tone', () => {
    expect(['planned', 'in_progress', 'on_hold', 'completed', 'cancelled'].map((value) => [projectStatus(value).label, projectStatus(value).tone])).toEqual([
      ['Planned', 'neutral'], ['In progress', 'info'], ['On hold', 'warning'], ['Completed', 'success'], ['Cancelled', 'muted'],
    ]);
  });
  it('renders unknown or absent values as In progress', () => {
    for (const value of ['archived', '', undefined, null]) expect(projectStatus(value).value).toBe('in_progress');
  });
  it('describes when the status changed, and nothing before the first change', () => {
    expect(statusSince('2026-10-21T12:00:00Z')).toBe('Since 21 Oct');
    expect(statusSince(null)).toBeNull();
  });
});

describe('Projects screen status filter', () => {
  it('defaults to Open, which asks the API for the open statuses', () => {
    expect(statusFilter(null)).toBe('open');
    expect(statusFilter('bogus')).toBe('open');
    expect(statusParam('open')).toBe('planned,in_progress,on_hold');
  });
  it('asks for a closed status alone, and sends no parameter for All', () => {
    expect(statusParam('completed')).toBe('completed');
    expect(statusParam('cancelled')).toBe('cancelled');
    expect(statusParam('all')).toBeNull();
  });
});
