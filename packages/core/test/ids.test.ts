import { describe, expect, it } from 'vitest';
import { idTimestamp, isId, newId } from '../src/ids';

describe('ids', () => {
  it('creates prefixed 26-char ids', () => {
    const id = newId('cus');
    expect(isId(id, 'cus')).toBe(true);
    expect(isId(id, 'ord')).toBe(false);
  });
  it('sorts by creation time, including within the same millisecond', () => {
    const ids = Array.from({ length: 1000 }, () => newId('ord', 1_760_000_000_000));
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(1000);
  });
  it('encodes the timestamp', () => {
    expect(idTimestamp(newId('dlv', 1_760_000_000_123)).getTime()).toBe(1_760_000_000_123);
  });
});
