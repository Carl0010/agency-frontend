import { cardUrl } from './card-url';
import { cardPath, cardRef } from './cards';
import { mentionablePath } from './mention-scope';

describe('card references and routes', () => {
  it('draws the home key, whatever board it is on', () => {
    expect(cardRef({ key: 'WEB', number: 42 })).toBe('WEB-42');
  });

  it('sends the project a request is made in', () => {
    expect(cardPath('c1', 'p1')).toBe('/cards/c1?project=p1');
    expect(cardPath('c1', 'p1', '/assignees/u1')).toBe('/cards/c1/assignees/u1?project=p1');
    expect(cardPath('c1', null, '/comments')).toBe('/cards/c1/comments');
  });

  it('links to the card in one of its placements, keeping the board query', () => {
    expect(cardUrl('w', { projectId: 'p2', boardId: 'b2' }, 'c1', '?full=true')).toBe('/w/w/p/p2/b/b2/c/c1?full=true');
    expect(cardUrl('w', { projectId: 'p2', boardId: 'b2' }, 'c1', 'view=list')).toBe('/w/w/p/p2/b/b2/c/c1?view=list');
    expect(cardUrl('w', { projectId: 'p2', boardId: 'b2' }, 'c1')).toBe('/w/w/p/p2/b/b2/c/c1');
  });

  it('a card composer asks the card who can be mentioned; a channel asks the roster', () => {
    expect(mentionablePath('w', { projectId: 'p', surface: 'card', cardId: 'c' })).toBe('/cards/c/mentionable?project=p');
    expect(mentionablePath('w', { projectId: 'p', surface: 'shared' })).toBe('/workspaces/w/members?mentionable=true&projectId=p&surface=shared');
  });
});
