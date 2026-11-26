import { describeActivity } from './card-activity';

const date = (iso: string) => iso.slice(0, 10);

test('moves, labels and files read with their stored names', () => {
  expect(describeActivity({ kind: 'moved', data: { fromListName: 'To do', toListName: 'Doing' } }, date)).toEqual(['moved this card from ', { name: 'To do' }, ' to ', { name: 'Doing' }]);
  expect(describeActivity({ kind: 'labelled', data: { name: 'Urgent', color: 'red' } }, date)).toEqual(['added the label ', { name: 'Urgent', color: 'red' }]);
  expect(describeActivity({ kind: 'attachment_added', data: { filename: 'brief.pdf' } }, date)).toEqual(['attached ', { name: 'brief.pdf' }]);
});

test('due dates are set or removed', () => {
  expect(describeActivity({ kind: 'due_changed', data: { dueAt: '2026-12-01T17:00:00.000Z' } }, date)).toEqual(['set the due date to ', { name: '2026-12-01' }]);
  expect(describeActivity({ kind: 'due_changed', data: { dueAt: null } }, date)).toEqual(['removed the due date']);
});

test('missing names fall back to plain words', () => {
  expect(describeActivity({ kind: 'assigned', data: {} }, date)).toEqual(['assigned ', { name: 'someone' }]);
  expect(describeActivity({ kind: 'placed', data: { projectName: 'Launch' } }, date)).toEqual(['added this card to ', { name: 'Launch' }]);
});
