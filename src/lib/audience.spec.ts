import { audienceRedirect, parseAudience } from './audience';

const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';

describe('AC3 audience routing', () => {
  const guest = { m: [], g: [P1] };
  const member = { m: ['northlight'], g: [] };
  const both = { m: ['northlight'], g: [P2] };

  it('a guest is redirected off every /w/* route to their portal', () => {
    for (const path of ['/w/northlight', '/w/northlight/projects', '/w/northlight/p/x/team', '/w/northlight/settings/members', '/w/northlight/search', '/w/other/import']) {
      expect(audienceRedirect(path, guest)).toBe(`/portal/${P1}`);
    }
  });

  it('a member is redirected off every /portal/* route to their workspace', () => {
    for (const path of ['/portal', `/portal/${P1}`, `/portal/${P1}/chat`, `/portal/${P1}/c/abc`]) {
      expect(audienceRedirect(path, member)).toBe('/w/northlight/projects');
    }
  });

  it('serves each audience its own tree, and a person in both roles both trees for the right workspace', () => {
    expect(audienceRedirect(`/portal/${P1}/chat`, guest)).toBeNull();
    expect(audienceRedirect('/portal', guest)).toBeNull();
    expect(audienceRedirect('/w/northlight/projects', member)).toBeNull();
    expect(audienceRedirect('/w/northlight/projects', both)).toBeNull();
    expect(audienceRedirect(`/portal/${P2}`, both)).toBeNull();
    expect(audienceRedirect(`/portal/${P1}`, both)).toBe('/w/northlight/projects');
  });

  it('no cookie (signed out) or a non-audience path: no redirect; the page handles sign-in', () => {
    expect(audienceRedirect('/w/northlight', null)).toBeNull();
    expect(audienceRedirect('/login', guest)).toBeNull();
    expect(audienceRedirect('/wonder', guest)).toBeNull();
  });

  it('parses the API cookie and rejects garbage', () => {
    expect(parseAudience(enc({ m: ['a'], g: [P1.toUpperCase()] }))).toEqual({ m: ['a'], g: [P1] });
    expect(parseAudience('not base64 json')).toBeNull();
    expect(parseAudience(undefined)).toBeNull();
    expect(parseAudience(enc({ m: 'x', g: [1, P1] }))).toEqual({ m: [], g: [P1] });
  });
});
