import { dragAutoScroll } from './drag-scroll';

test('wide screens keep the default auto-scroll', () => {
  expect(dragAutoScroll(false)).toBeUndefined();
});

test('a phone scrolls at most 300px a second inside a narrow edge zone', () => {
  const phone = dragAutoScroll(true)!;
  expect((phone.acceleration / phone.interval) * 1000).toBeLessThanOrEqual(300);
  expect(phone.threshold.x).toBeLessThan(0.2);
  expect(phone.threshold.y).toBeLessThan(0.2);
});
