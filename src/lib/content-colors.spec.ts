import { PROJECT_DOT, PROJECT_ICON_BG } from './content-colors';

// The API's PROJECT_COLORS (agency-mvp, migration 0020), in the picker's order: two rows of eight.
const API_PROJECT_COLORS = [
  'slate', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'teal',
  'aqua', 'blue', 'violet', 'purple', 'magenta', 'pink', 'peach', 'stone',
];

describe('project colours', () => {
  it('offers exactly the API colours, in picker order', () => {
    expect(Object.keys(PROJECT_DOT)).toEqual(API_PROJECT_COLORS);
  });

  it('gives every colour a solid icon tile with a dark glyph in dark mode', () => {
    expect(Object.keys(PROJECT_ICON_BG)).toEqual(API_PROJECT_COLORS);
    for (const value of API_PROJECT_COLORS) {
      expect(PROJECT_ICON_BG[value]).toMatch(/^bg-label-\w+ /);
      expect(PROJECT_ICON_BG[value]).not.toContain('/');
      expect(PROJECT_ICON_BG[value]).toMatch(/(^| |dark:)text-on-label$/);
    }
  });

  it('keeps the tile and glyph on the same content colour as the dot', () => {
    for (const value of API_PROJECT_COLORS) expect(PROJECT_ICON_BG[value]?.split(' ')[0]).toBe(PROJECT_DOT[value]);
  });
});
