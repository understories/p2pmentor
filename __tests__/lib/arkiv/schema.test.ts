import { describe, it, expect } from 'vitest';
import {
  MAX_USER_ATTRIBUTES,
  PROJECT,
  SCHEMA_VERSION,
  assertAttrName,
  entityAttributes,
  eqAttr,
  flagsFor,
  lifetimeSecondsFor,
  typedValue,
} from '@/lib/arkiv/schema';
import { attrsToRecord, getAttr, parsePayload } from '@/lib/arkiv/read';

const WALLET = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';

describe('entityAttributes', () => {
  it('adds project, type and schema_version', () => {
    const attrs = entityAttributes('ask', { status: 'open' });
    expect(attrs.project).toEqual({ type: 'str', value: PROJECT });
    expect(attrs.type).toEqual({ type: 'str', value: 'ask' });
    expect(attrs.schema_version).toEqual({ type: 'i32', value: SCHEMA_VERSION });
    expect(attrs.status).toEqual({ type: 'str', value: 'open' });
  });

  it('omits null, undefined and empty values', () => {
    const attrs = entityAttributes('ask', { a: undefined, b: null, c: '', d: 'x' });
    expect(Object.keys(attrs).sort()).toEqual(['d', 'project', 'schema_version', 'type']);
  });

  it('types wallets as addr and *_at timestamps as u64 milliseconds', () => {
    const iso = '2026-10-21T12:00:00.000Z';
    const attrs = entityAttributes('ask', { wallet: WALLET, created_at: iso });
    expect((attrs.wallet as any).type).toBe('addr');
    expect(attrs.created_at).toEqual({ type: 'u64', value: BigInt(Date.parse(iso)) });
  });

  it('keeps non-address values of wallet-like names as strings', () => {
    expect(typedValue('confirmed_by', 'system')).toEqual({ type: 'str', value: 'system' });
  });

  it('throws on over-long strings instead of truncating', () => {
    expect(() => entityAttributes('user_profile', { bio: 'x'.repeat(129) })).toThrow(/payload/);
    expect(() => entityAttributes('user_profile', { bio: 'x'.repeat(128) })).not.toThrow();
  });

  it('counts UTF-8 bytes, not characters', () => {
    expect(() => entityAttributes('ask', { label: 'é'.repeat(65) })).toThrow();
  });

  it('throws on camelCase and reserved-grammar violations', () => {
    expect(() => entityAttributes('ask', { spaceId: 'x' })).toThrow(/Invalid attribute name/);
    expect(() => assertAttrName('Type')).toThrow();
    expect(() => assertAttrName('space_id')).not.toThrow();
  });

  it('throws when there are too many attributes', () => {
    const many: Record<string, string> = {};
    for (let i = 0; i < MAX_USER_ATTRIBUTES; i++) many[`a${i}`] = 'v';
    expect(() => entityAttributes('ask', many)).toThrow(/max is/);
  });
});

describe('eqAttr', () => {
  it('uses the same typing as writes', () => {
    const node = eqAttr('wallet', WALLET) as any;
    expect(node.value).toEqual(typedValue('wallet', WALLET));
  });

  it('rejects camelCase names', () => {
    expect(() => eqAttr('spaceId', 'x')).toThrow();
  });
});

describe('lifetimes and flags', () => {
  it('uses per-type lifetimes with a default', () => {
    expect(lifetimeSecondsFor('user_profile')).toBe(365 * 24 * 60 * 60);
    expect(lifetimeSecondsFor('notification')).toBe(90 * 24 * 60 * 60);
    expect(lifetimeSecondsFor('unknown_type')).toBe(180 * 24 * 60 * 60);
  });

  it('marks append-only types readonly', () => {
    expect(flagsFor('revocation')).toEqual({ readonly: true });
    expect(flagsFor('user_profile')).toBeUndefined();
  });
});

describe('read helpers', () => {
  const iso = '2026-10-21T12:00:00.000Z';
  const entity = {
    attributes: entityAttributes('ask', { wallet: WALLET, created_at: iso, status: 'open' }),
    payload: new TextEncoder().encode(JSON.stringify({ message: 'hi' })),
  };

  it('getAttr returns plain strings', () => {
    expect(getAttr(entity, 'wallet')).toBe(WALLET);
    expect(getAttr(entity, 'created_at')).toBe(iso);
    expect(getAttr(entity, 'status')).toBe('open');
    expect(getAttr(entity, 'schema_version')).toBe(String(SCHEMA_VERSION));
    expect(getAttr(entity, 'missing')).toBe('');
    expect(getAttr(null, 'status')).toBe('');
  });

  it('attrsToRecord converts all attributes', () => {
    expect(attrsToRecord(entity)).toMatchObject({ type: 'ask', status: 'open', wallet: WALLET });
  });

  it('parsePayload decodes JSON and falls back', () => {
    expect(parsePayload(entity)).toEqual({ message: 'hi' });
    expect(parsePayload({ payload: new TextEncoder().encode('not json') }, null)).toBeNull();
    expect(parsePayload(undefined)).toEqual({});
  });
});
