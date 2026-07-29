import { scopedFilter } from '../src/utils/domainQuery.js';

describe('domainQuery util — scopedFilter', () => {
  it('includes the trusted domain in the returned filter', () => {
    const filter = scopedFilter('beyond-campus');
    expect(filter).toEqual({ domain: 'beyond-campus' });
  });

  it('preserves additional query predicates alongside the domain', () => {
    const filter = scopedFilter('beyond-campus', { _id: 'agent-123', visibility: 'public' });
    expect(filter).toEqual({
      _id: 'agent-123',
      visibility: 'public',
      domain: 'beyond-campus',
    });
  });

  it('throws when domain is missing (called with no arguments)', () => {
    expect(() => scopedFilter()).toThrow(/truthy domain is required/);
  });

  it.each([null, undefined, '', 0, false, NaN])(
    'fails closed for falsy domain value: %p',
    (badDomain) => {
      expect(() => scopedFilter(badDomain, { _id: 'agent-123' })).toThrow(
        /truthy domain is required/
      );
    }
  );

  it('does not silently return an unscoped filter when domain is falsy', () => {
    let result;
    try {
      result = scopedFilter(null, { visibility: 'public' });
    } catch {
      // expected
    }
    expect(result).toBeUndefined();
  });

  it('rejects extraFilter that supplies its own competing "domain" key rather than silently overriding it', () => {
    expect(() => scopedFilter('beyond-campus', { domain: 'coursify', _id: 'agent-123' })).toThrow(
      /must not include its own "domain" key/
    );
  });

  it('rejects a caller-supplied domain even when it happens to match the trusted domain', () => {
    // Rejecting unconditionally (not only when the values differ) keeps the
    // rule simple and impossible to accidentally rely on ("it happened to
    // match, so it slipped through") — see domainQuery.js's header comment.
    expect(() => scopedFilter('beyond-campus', { domain: 'beyond-campus' })).toThrow(
      /must not include its own "domain" key/
    );
  });

  it('defaults extraFilter to an empty object when omitted', () => {
    expect(scopedFilter('persona')).toEqual({ domain: 'persona' });
  });

  it('does not mutate the extraFilter object passed in', () => {
    const original = { _id: 'agent-123' };
    scopedFilter('persona', original);
    expect(original).toEqual({ _id: 'agent-123' });
  });
});
