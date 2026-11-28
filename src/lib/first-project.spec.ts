import { BLANK_START, nameForStart, startDescription } from './first-project';
import type { TemplateSummary } from './types';

const templates: TemplateSummary[] = [
  { id: 'design-sprint', name: 'Design sprint', description: 'Five days from problem to tested prototype.', lists: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], cardCount: 8 },
  { id: 'website-build', name: 'Website build', description: 'From sitemap to launch.', lists: ['Plan', 'Build', 'Launch'], cardCount: 7 },
];

describe('nameForStart', () => {
  it('fills an empty name with the picked template', () => {
    expect(nameForStart('', null, 'design-sprint', templates)).toEqual({ name: 'Design sprint', auto: 'Design sprint' });
  });

  it('follows a new pick while the name is still the template’s', () => {
    expect(nameForStart('Design sprint', 'Design sprint', 'website-build', templates)).toEqual({ name: 'Website build', auto: 'Website build' });
  });

  it('clears a template’s name when they go back to blank', () => {
    expect(nameForStart('Design sprint', 'Design sprint', BLANK_START, templates)).toEqual({ name: '', auto: null });
  });

  it('never replaces a name they typed', () => {
    expect(nameForStart('Northwind rebrand', null, 'design-sprint', templates)).toEqual({ name: 'Northwind rebrand', auto: null });
    expect(nameForStart('Sprint for Acme', 'Design sprint', BLANK_START, templates)).toEqual({ name: 'Sprint for Acme', auto: null });
  });

  it('treats an unknown pick as blank', () => {
    expect(nameForStart('', null, 'gone', templates)).toEqual({ name: '', auto: null });
  });
});

describe('startDescription', () => {
  it('says what the board starts with', () => {
    expect(startDescription(templates[1]!)).toBe('From sitemap to launch. 3 lists, 7 example cards.');
  });
});
