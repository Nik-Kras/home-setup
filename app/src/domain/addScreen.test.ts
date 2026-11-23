import { describe, expect, it } from 'vitest';
import { addScreenExit } from './addScreen';

describe('addScreenExit', () => {
  it('a link (widget "+") always lands on the Buy list, even when the app was open elsewhere', () => {
    expect(addScreenExit({ byLink: true, canGoBack: true, mode: 'item' })).toBe('/');
    expect(addScreenExit({ byLink: true, canGoBack: false, mode: 'task' })).toBe('/');
  });
  it('opened from a screen it goes back; with nothing behind it, to the list for its kind', () => {
    expect(addScreenExit({ byLink: false, canGoBack: true, mode: 'task' })).toBe('back');
    expect(addScreenExit({ byLink: false, canGoBack: false, mode: 'item' })).toBe('/');
    expect(addScreenExit({ byLink: false, canGoBack: false, mode: 'task' })).toBe('/tasks');
  });
});
