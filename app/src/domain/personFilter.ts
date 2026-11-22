import type { Item, Person } from './types';

/** The Buy list's person filter: null shows everyone, a person shows only the items assigned to them. */
export type PersonFilter = Person | null;

export function itemsForPerson(items: readonly Item[], filter: PersonFilter): Item[] {
  return filter ? items.filter((i) => i.assignedTo === filter) : [...items];
}

/** Tapping the active disc turns the filter off; tapping the other disc switches to that person. */
export function togglePersonFilter(current: PersonFilter, tapped: Person): PersonFilter {
  return current === tapped ? null : tapped;
}
