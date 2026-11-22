import { describe, expect, it } from 'vitest';
import { COMMON_ITEMS, defaultRoom, isExactSuggestion, quickPicks, suggestItems } from './suggestions';
import type { Item } from './types';

const own = (name: string, over: Partial<Item> = {}) => ({ name, status: 'needed' as const, needsInstall: false, ...over });

describe('suggestItems', () => {
  it('suggests built-in items as you type, best match first, with their room', () => {
    expect(suggestItems('kett', [])).toEqual([{ name: 'Kettle', room: 'Kitchen' }, { name: 'Kettle descaler', room: 'Kitchen' }]);
  });

  it('is case-insensitive and also matches a later word', () => {
    expect(suggestItems('LAMP', []).map((s) => s.name)).toEqual(['Floor lamp', 'Bedside lamp']);
  });

  it('puts the household\'s own names first and marks the ones still on the list', () => {
    const items = [own('Kettle (white)', { room: 'Kitchen' }), own('Kettle', { status: 'delivered' })];
    expect(suggestItems('kett', items)).toEqual([
      { name: 'Kettle', room: 'Kitchen' },
      { name: 'Kettle (white)', room: 'Kitchen', onList: true },
      { name: 'Kettle descaler', room: 'Kitchen' },
    ]);
  });

  it('lists each name once and stops at the limit', () => {
    expect(suggestItems('kettle', [own('KETTLE', { status: 'installed' })]).map((s) => s.name)).toEqual(['KETTLE', 'Kettle descaler']);
    expect(suggestItems('b', [], 2)).toHaveLength(2);
  });

  it('suggests nothing for blank text or no match; short text does not match inside words', () => {
    expect(suggestItems('   ', [])).toEqual([]);
    expect(suggestItems('zzq', [])).toEqual([]);
    expect(suggestItems('et', []).some((s) => s.name === 'Kettle')).toBe(false);
  });

  it('guesses the room of an own item that has none', () => {
    expect(suggestItems('toast', [own('Toaster oven')])[0]).toEqual({ name: 'Toaster oven', room: 'Kitchen', onList: true });
  });

  it('the built-in list has unique names and every item has a room', () => {
    const names = COMMON_ITEMS.map((s) => s.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    expect(COMMON_ITEMS.every((s) => s.room)).toBe(true);
  });
});

describe('isExactSuggestion', () => {
  it('spots typed text that is already suggested', () => {
    const list = suggestItems('kettle', []);
    expect(isExactSuggestion(' Kettle ', list)).toBe(true);
    expect(isExactSuggestion('kett', list)).toBe(false);
  });
});

describe('quickPicks', () => {
  it('offers common things not on the list yet', () => {
    expect(quickPicks([], 3).map((s) => s.name)).toEqual(['Kettle', 'Kettle descaler', 'Toaster']);
    expect(quickPicks([{ name: 'kettle' }], 2).map((s) => s.name)).toEqual(['Kettle descaler', 'Toaster']);
  });
});

describe('defaultRoom', () => {
  const rooms = ['Kitchen', 'Living room', 'Bedroom', 'Bathroom', 'Hallway'];
  it('picked, then suggestion, then guessed from the name, then last used, then the first room', () => {
    expect(defaultRoom({ picked: 'Bedroom', suggested: 'Kitchen', name: 'kettle', rooms })).toBe('Bedroom');
    expect(defaultRoom({ suggested: 'Hallway', name: 'kettle', rooms })).toBe('Hallway');
    expect(defaultRoom({ name: 'new sofa', lastUsed: 'Bedroom', rooms })).toBe('Living room');
    expect(defaultRoom({ name: 'thing', lastUsed: 'Bedroom', rooms })).toBe('Bedroom');
    expect(defaultRoom({ name: 'thing', rooms })).toBe('Kitchen');
  });

  it('only ever returns a room that exists', () => {
    expect(defaultRoom({ picked: 'Garage', suggested: 'Loft', name: 'thing', lastUsed: 'Shed', rooms: ['Hallway'] })).toBe('Hallway');
    expect(defaultRoom({ name: 'thing', rooms: [] })).toBeUndefined();
  });
});
