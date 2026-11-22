import { describe, expect, it } from 'vitest';
import { glyphFor, ICON_PATHS, roomTone } from './glyphs';

describe('glyphFor', () => {
  it('uses the design glyph for the design items', () => {
    expect(glyphFor('Kettle')).toBe('kettle');
    expect(glyphFor('Microwave')).toBe('microwave');
    expect(glyphFor('WiFi and router')).toBe('wifi');
    expect(glyphFor('Curtain rods x3')).toBe('curtain');
    expect(glyphFor('Hang the shelves')).toBe('shelf');
    expect(glyphFor('Bookshelf')).toBe('bookshelf');
    expect(glyphFor('Bedside table')).toBe('bedside');
    expect(glyphFor('Bed frame')).toBe('bed');
    expect(glyphFor('Hall mirror')).toBe('mirror');
    expect(glyphFor('Kettle descaler')).toBe('drop');
  });

  it('falls back to the room glyph, then a box', () => {
    expect(glyphFor('Spatula', 'Kitchen')).toBe('pot');
    expect(glyphFor('Something', 'Bedroom')).toBe('bed');
    expect(glyphFor('Something', 'Hallway')).toBe('door');
    expect(glyphFor('Something')).toBe('box');
  });

  it('every glyph has path data', () => {
    for (const d of Object.values(ICON_PATHS)) expect(d).toMatch(/^M/);
  });
});

describe('roomTone', () => {
  it('colours rooms as the design does', () => {
    expect(roomTone('Kitchen')).toBe('amber');
    expect(roomTone('Hallway')).toBe('amber');
    expect(roomTone('Living room')).toBe('mint');
    expect(roomTone('Bedroom')).toBe('lilac');
    expect(roomTone('Bathroom')).toBe('sky');
    expect(roomTone('Other')).toBe('neutral');
    expect(roomTone(undefined)).toBe('neutral');
  });
});
