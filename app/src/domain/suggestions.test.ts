import { describe, expect, it } from 'vitest';
import { COMMON_ITEMS, defaultRoom, findExisting, isExactSuggestion, quickPicks, roomForName, suggestItems } from './suggestions';
import { guessRoom } from './items';
import type { Item } from './types';

let n = 0;
const own = (name: string, over: Partial<Item> = {}) => ({ id: `i${++n}`, name, status: 'needed' as const, needsInstall: false, ...over });

describe('suggestItems', () => {
  it('suggests built-in items as you type, best match first, with their room', () => {
    expect(suggestItems('kett', [])).toEqual([{ name: 'Kettle', room: 'Kitchen' }, { name: 'Kettle descaler', room: 'Kitchen' }]);
  });

  it('is case-insensitive and also matches a later word', () => {
    expect(suggestItems('LAMP', []).map((s) => s.name)).toEqual(['Floor lamp', 'Bedside lamp']);
  });

  it('puts the household\'s own names first and marks the ones still on the list', () => {
    const items = [own('Kettle (white)', { id: 'w', room: 'Kitchen' }), own('Kettle', { id: 'k', status: 'delivered' })];
    expect(suggestItems('kett', items)).toEqual([
      { name: 'Kettle', room: 'Kitchen', id: 'k' },
      { name: 'Kettle (white)', room: 'Kitchen', id: 'w', onList: true },
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
    expect(suggestItems('toast', [own('Toaster oven', { id: 't' })])[0]).toEqual({ name: 'Toaster oven', room: 'Kitchen', id: 't', onList: true });
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
    expect(defaultRoom({ name: 'Bedside lamp', lastUsed: 'Hallway', rooms })).toBe('Bedroom');
    expect(defaultRoom({ name: 'Kettle', rooms, items: [own('Kettle', { room: 'Hallway' })] })).toBe('Hallway');
    expect(defaultRoom({ name: 'thing', lastUsed: 'Bedroom', rooms })).toBe('Bedroom');
    expect(defaultRoom({ name: 'thing', rooms })).toBe('Kitchen');
  });

  it('only ever returns a room that exists', () => {
    expect(defaultRoom({ picked: 'Garage', suggested: 'Loft', name: 'thing', lastUsed: 'Shed', rooms: ['Hallway'] })).toBe('Hallway');
    expect(defaultRoom({ name: 'thing', rooms: [] })).toBeUndefined();
  });
});

describe('roomForName: the hint and the added item agree', () => {
  it('uses the room of a suggestion with exactly that name, own items first', () => {
    expect(roomForName('kitchen BIN ', [])).toBe('Kitchen');
    expect(roomForName('Tea towels', [])).toBe('Kitchen');
    expect(roomForName('Bedside lamp', [])).toBe('Bedroom');
    expect(roomForName('Kettle', [own('Kettle', { room: 'Bedroom' })])).toBe('Bedroom');
  });

  it('then the best suggestion the name begins, then the keyword guess', () => {
    expect(roomForName('kett', [])).toBe('Kitchen');
    expect(roomForName('shoe r', [])).toBe('Hallway');
    expect(roomForName('Big fluffy duvet', [])).toBe('Bedroom');
    expect(roomForName('Picture hooks', [])).toBeUndefined();
    expect(roomForName('  ', [])).toBeUndefined();
  });

  it('every built-in suggestion goes in its own room', () => {
    for (const c of COMMON_ITEMS) expect(roomForName(c.name, [])).toBe(c.room);
  });
});

describe('guessRoom: most specific first', () => {
  it('a room named in the item wins over a generic word', () => {
    expect(guessRoom('Kitchen bin')).toBe('Kitchen');
    expect(guessRoom('Bedside lamp')).toBe('Bedroom');
    expect(guessRoom('Shower curtain')).toBe('Bathroom');
    expect(guessRoom('Hall mirror')).toBe('Hallway');
    expect(guessRoom('Tea towels')).toBe('Kitchen');
    expect(guessRoom('Bath towels')).toBe('Bathroom');
    expect(guessRoom('Bedding')).toBe('Bedroom');
  });
});

describe('findExisting: no silent copies', () => {
  it('finds the same name in any case, open items first', () => {
    const got = own('Kettle', { id: 'old', status: 'delivered' });
    const open = own('kettle ', { id: 'open' });
    expect(findExisting(' KETTLE', [got, open])?.id).toBe('open');
    expect(findExisting('Kettle', [got])?.id).toBe('old');
    expect(findExisting('Kettle descaler', [got, open])).toBeUndefined();
    expect(findExisting('', [got])).toBeUndefined();
  });
});
