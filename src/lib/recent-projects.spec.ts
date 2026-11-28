import { orderByRecent, pushRecent, RECENT_LIMIT } from './recent-projects';

describe('recent projects', () => {
  it('moves the opened project to the front without repeats and keeps a short list', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
    expect(pushRecent([], 'a')).toEqual(['a']);
    const many = Array.from({ length: RECENT_LIMIT }, (_, i) => `p${i}`);
    expect(pushRecent(many, 'new')).toHaveLength(RECENT_LIMIT);
    expect(pushRecent(many, 'new')[0]).toBe('new');
  });

  it('orders projects by when they were opened, the rest after them in their own order', () => {
    const projects = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    expect(orderByRecent(projects, ['c', 'a']).map((p) => p.id)).toEqual(['c', 'a', 'b', 'd']);
    expect(orderByRecent(projects, ['gone']).map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});
