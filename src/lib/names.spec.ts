import { namesSentence } from './names';

describe('namesSentence', () => {
  it.each([
    [[], ''],
    [['Ana'], 'Ana'],
    [['Ana', 'Ben'], 'Ana and Ben'],
    [['Ana', 'Ben', 'Cy'], 'Ana, Ben, and Cy'],
    [['Ana', 'Ben', 'Cy', 'Di'], 'Ana, Ben, Cy, and 1 other'],
    [['Ana', 'Ben', 'Cy', 'Di', 'Ed'], 'Ana, Ben, Cy, and 2 others'],
  ])('%j → %s', (names, expected) => { expect(namesSentence(names)).toBe(expected); });
});
