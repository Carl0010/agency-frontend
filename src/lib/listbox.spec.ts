import { canCreate, filterOptions, fold, moveActive, type ListOption } from './listbox';

const people: ListOption[] = [
  { value: 'u1', label: 'Dana Scully', description: 'dana@example.com' },
  { value: 'u2', label: 'Fox Mulder', description: 'fox@example.com' },
  { value: 'u3', label: 'José Álvarez' },
  { value: 'u4', label: 'Walter Skinner', disabled: true },
  { value: 'u5', label: 'Alex Krycek' },
];

describe('filterOptions', () => {
  it('returns everything for an empty or blank query', () => {
    expect(filterOptions(people, '')).toHaveLength(5);
    expect(filterOptions(people, '   ')).toHaveLength(5);
  });

  it('ignores case and accents', () => {
    expect(filterOptions(people, 'jose').map((o) => o.value)).toEqual(['u3']);
    expect(filterOptions(people, 'ÁLV').map((o) => o.value)).toEqual(['u3']);
    expect(fold('Crème Brûlée')).toBe('creme brulee');
  });

  it('ranks label prefix, then word prefix, then substring', () => {
    // "al": Alex (label prefix), Álvarez (word prefix), Walter (substring)
    expect(filterOptions(people, 'al').map((o) => o.value)).toEqual(['u5', 'u3', 'u4']);
  });

  it('matches every word, in any order, across label and description', () => {
    expect(filterOptions(people, 'mulder fox').map((o) => o.value)).toEqual(['u2']);
    expect(filterOptions(people, 'example.com dana').map((o) => o.value)).toEqual(['u1']);
    expect(filterOptions(people, 'dana fox')).toEqual([]);
  });
});

describe('moveActive', () => {
  it('moves down and up, wrapping, and skips disabled options', () => {
    expect(moveActive(people, -1, 'ArrowDown')).toBe(0);
    expect(moveActive(people, 2, 'ArrowDown')).toBe(4); // skips disabled u4
    expect(moveActive(people, 4, 'ArrowDown')).toBe(0); // wraps
    expect(moveActive(people, 0, 'ArrowUp')).toBe(4);
    expect(moveActive(people, -1, 'ArrowUp')).toBe(4);
  });

  it('jumps with Home and End and ignores other keys', () => {
    expect(moveActive(people, 2, 'Home')).toBe(0);
    expect(moveActive([...people.slice(0, 4)], 0, 'End')).toBe(2); // last is disabled
    expect(moveActive(people, 2, 'a')).toBe(2);
  });

  it('returns -1 when nothing can be active', () => {
    expect(moveActive([], -1, 'ArrowDown')).toBe(-1);
    expect(moveActive([{ disabled: true }], -1, 'ArrowDown')).toBe(-1);
  });
});

describe('canCreate', () => {
  it('offers creation only for new, non-empty text', () => {
    expect(canCreate(people, 'Monica Reyes')).toBe(true);
    expect(canCreate(people, ' fox mulder ')).toBe(false);
    expect(canCreate(people, '  ')).toBe(false);
  });
});
