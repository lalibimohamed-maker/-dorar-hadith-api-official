import { describe, expect, it } from 'vitest';
import { RIGHTS, resolveRights } from '../src/book-rights-resolver.js';

describe('book rights resolver', () => {
  it('does not treat free availability alone as redistribution permission', () => {
    expect(resolveRights([{ source: 'example', kind: 'free-download' }]).status).toBe(RIGHTS.RIGHTS_UNCLEAR);
  });

  it('recognizes explicit redistribution permission', () => {
    expect(resolveRights([{ source: 'publisher', kind: 'explicit-redistribution-permission' }]).status).toBe(RIGHTS.REDISTRIBUTABLE);
  });

  it('supports read-only and read-copy permissions', () => {
    expect(resolveRights([{ source: 'library', kind: 'read-only-permission' }]).status).toBe(RIGHTS.READ_ONLY);
    expect(resolveRights([{ source: 'library', kind: 'read-copy-permission' }]).status).toBe(RIGHTS.READ_COPY);
  });

  it('requires explicit redistribution permission for waqf redistribution', () => {
    expect(resolveRights([{ source: 'waqf-site', kind: 'waqf' }]).status).toBe(RIGHTS.RIGHTS_UNCLEAR);
    expect(resolveRights([{ source: 'waqf-site', kind: 'waqf', allowsRedistribution: true }]).status).toBe(RIGHTS.REDISTRIBUTABLE);
  });
});
