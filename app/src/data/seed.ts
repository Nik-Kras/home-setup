import type { FlatNote, Item, Task } from '../domain/types';

/** Demo data shown before Supabase is connected. Generic on purpose: no addresses or real names. */
const now = '2026-11-21T10:00:00Z';

export const seedItems: Item[] = [
  { id: 'i1', name: 'Kettle', status: 'needed', quantity: 1, urgent: true, needsInstall: false, room: 'Kitchen', estPrice: 25, assignedTo: 'daryna', addedAt: '2026-11-20T09:00:00Z', updatedBy: 'claude' },
  { id: 'i2', name: 'Microwave', status: 'ordered', quantity: 1, urgent: false, needsInstall: false, room: 'Kitchen', estPrice: 90, assignedTo: 'nikita', addedAt: '2026-11-20T09:05:00Z', updatedBy: 'nikita' },
  { id: 'i3', name: 'Toaster', status: 'needed', quantity: 1, urgent: false, needsInstall: false, room: 'Kitchen', estPrice: 20, addedAt: '2026-11-20T09:10:00Z', updatedBy: 'claude' },
  { id: 'i4', name: 'WiFi and router', status: 'looking', quantity: 1, urgent: true, needsInstall: true, room: 'Living room', assignedTo: 'nikita', addedAt: '2026-11-20T09:15:00Z', updatedBy: 'nikita' },
  { id: 'i5', name: 'Curtain rods x3', status: 'delivered', quantity: 3, urgent: false, needsInstall: true, room: 'Bedroom', assignedTo: 'daryna', addedAt: '2026-11-19T09:00:00Z', deliveredAt: now, updatedBy: 'daryna' },
  { id: 'i6', name: 'Hang the shelves', status: 'needed', quantity: 1, urgent: false, needsInstall: true, room: 'Bedroom', assignedTo: 'nikita', addedAt: '2026-11-20T09:20:00Z', updatedBy: 'nikita' },
  { id: 'i7', name: 'Floor lamp', status: 'installed', quantity: 1, urgent: false, needsInstall: true, room: 'Living room', actualPrice: 64, boughtBy: 'daryna', addedAt: '2026-11-15T09:00:00Z', installedAt: now, updatedBy: 'daryna' },
  { id: 'i8', name: 'Sofa', status: 'delivered', quantity: 1, urgent: false, needsInstall: false, room: 'Living room', actualPrice: 380, boughtBy: 'nikita', addedAt: '2026-11-10T09:00:00Z', deliveredAt: now, updatedBy: 'nikita' },
];

const step = (id: string, title: string, done = false) => ({ id, title, done });

export const seedTasks: Task[] = [
  {
    id: 't1', title: 'Send inventory corrections to the agent', group: 'Move-in', due: '2026-11-27', urgent: true, updatedBy: 'claude',
    reference: 'Contract: 7 days from move-in',
    assignments: [{ person: 'nikita', status: 'in_progress', steps: [step('a', 'Kitchen', true), step('b', 'Living room', true), step('c', 'Bedroom', true), step('d', 'Bathroom'), step('e', 'Hallway'), step('f', 'Meters')] }],
  },
  { id: 't2', title: 'Register for Council Tax', group: 'Move-in', urgent: true, updatedBy: 'claude', assignments: [{ person: 'nikita', status: 'todo', steps: [] }] },
  { id: 't3', title: 'Send meter readings', group: 'Utilities', urgent: true, updatedBy: 'claude', assignments: [{ person: 'nikita', status: 'todo', steps: [] }] },
  { id: 't4', title: 'Check the deposit is protected', group: 'Move-in', due: '2026-12-17', urgent: false, updatedBy: 'claude', assignments: [{ person: 'nikita', status: 'todo', steps: [] }] },
  {
    id: 't5', title: 'Register with a new GP', group: 'Address', urgent: false, updatedBy: 'claude',
    assignments: [
      { person: 'nikita', status: 'todo', steps: [step('a', 'Pick a practice'), step('b', 'Send the form'), step('c', 'Bring ID and proof')] },
      { person: 'daryna', status: 'todo', steps: [step('a', 'Pick a practice'), step('b', 'Send the form'), step('c', 'Bring ID and proof')] },
    ],
  },
  {
    id: 't6', title: 'Electoral register', group: 'Address', urgent: false, updatedBy: 'claude',
    assignments: [
      { person: 'nikita', status: 'done', steps: [] },
      { person: 'daryna', status: 'todo', steps: [] },
    ],
  },
  { id: 't7', title: 'Update bank address', group: 'Address', urgent: false, updatedBy: 'claude', assignments: [{ person: 'daryna', status: 'todo', steps: [] }] },
];

/** Demo notes, generic on purpose. Real notes live only in Supabase. */
export const seedNotes: FlatNote[] = [
  { id: 'n1', title: 'Demo: is there a gas supply?', body: 'Demo note. Not confirmed yet; check the meter cupboard.', kind: 'to_confirm', sort: 1, updatedBy: 'claude' },
  { id: 'n2', title: 'Demo: no smoking inside', body: 'Demo note. An example house rule.', reference: 'Example clause 1.1', kind: 'info', sort: 2, updatedBy: 'claude' },
];
