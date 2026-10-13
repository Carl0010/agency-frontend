import { activeMentionQuery, insertMention } from './mentions';

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('mention typeahead', () => {
  it('detects an @query right before the caret', () => {
    expect(activeMentionQuery('hi @ri', 6)).toEqual({ query: 'ri', start: 3 });
    expect(activeMentionQuery('@', 1)).toEqual({ query: '', start: 0 });
    expect(activeMentionQuery('mail me@example', 15)).toBeNull();
    expect(activeMentionQuery('hi @riya ', 9)).toBeNull();
  });

  it('inserts the token the API parses', () => {
    const r = insertMention('hi @ri thanks', 3, 6, 'Riya Shah', ID);
    expect(r.text).toBe(`hi @[Riya Shah](user:${ID})  thanks`);
    expect(r.text.slice(0, r.caret)).toBe(`hi @[Riya Shah](user:${ID}) `);
  });
});
