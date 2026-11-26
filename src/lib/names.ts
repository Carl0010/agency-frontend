/** "Ana", "Ana and Ben", "Ana, Ben, and Cy", "Ana, Ben, Cy, and 2 others". */
export function namesSentence(names: string[], max = 3): string {
  if (names.length <= 2) return names.join(' and ');
  if (names.length <= max) return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;
  const rest = names.length - max;
  return `${names.slice(0, max).join(', ')}, and ${rest} ${rest === 1 ? 'other' : 'others'}`;
}
