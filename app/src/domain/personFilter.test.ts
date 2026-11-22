import { describe, expect, it } from 'vitest';
import { itemsForPerson, togglePersonFilter } from './personFilter';
import type { Item, Person } from './types';

const item = (id: string, assignedTo?: Person): Item => ({
  id, name: id, status: 'needed', quantity: 1, urgent: false, needsInstall: false, addedAt: '2026-11-21T10:00:00Z', updatedBy: 'nikita', assignedTo,
});

describe('person filter', () => {
  const items = [item('a', 'nikita'), item('b', 'daryna'), item('c')];

  it('shows everyone, including unclaimed items, when no one is selected', () => {
    expect(itemsForPerson(items, null).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('shows only the items assigned to the selected person', () => {
    expect(itemsForPerson(items, 'nikita').map((i) => i.id)).toEqual(['a']);
    expect(itemsForPerson(items, 'daryna').map((i) => i.id)).toEqual(['b']);
  });

  it('turns off when the active disc is tapped and switches to the other disc', () => {
    expect(togglePersonFilter(null, 'nikita')).toBe('nikita');
    expect(togglePersonFilter('nikita', 'nikita')).toBeNull();
    expect(togglePersonFilter('nikita', 'daryna')).toBe('daryna');
  });
});
