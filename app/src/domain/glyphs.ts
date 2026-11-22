export const ICON_PATHS = {
  buy: 'M4 6h10M4 12h10M4 18h6M16 15l2 2 4-4',
  tasks: 'M9 4h6v3H9zM7 5.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1h-1M9 14l2 2 4-4',
  home: 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  budget: 'M5 20V10M12 20V4M19 20v-7',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 5l-7 7 7 7',
  check: 'M5 12l5 5 9-10',
  kettle: 'M6 10h9v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM15 12l4-3M6 12H4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2M8 7h5',
  microwave: 'M3 6h18v12H3zM6 9h8v6H6zM17.5 10h.01M17.5 14h.01',
  toaster: 'M4 9h16v9H4zM8 9V6h3v3M13 9V6h3v3',
  wifi: 'M4.5 10a11 11 0 0 1 15 0M7.5 13.3a6.6 6.6 0 0 1 9 0M10.5 16.5a2.2 2.2 0 0 1 3 0M12 19.5h.01',
  curtain: 'M3 5h18M5 5v14M9 5c0 5-1 9-4 14M19 5v14M15 5c0 5 1 9 4 14',
  shelf: 'M4 9h16M4 17h16M7 9V5h4v4M14 17v-4h3v4',
  lamp: 'M8 4h8l2 8H6zM12 12v6M9 20h6',
  sofa: 'M4 12V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M3 12h18v5H3zM5 17v2M19 17v2',
  box: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',
} as const;
export type IconName = keyof typeof ICON_PATHS;

/** Picks a glyph from the item name. Falls back to a generic box. */
export function glyphFor(name: string): IconName {
  const n = name.toLowerCase();
  const table: [string, IconName][] = [['kettle', 'kettle'], ['microwave', 'microwave'], ['toast', 'toaster'], ['wifi', 'wifi'], ['router', 'wifi'], ['curtain', 'curtain'], ['shel', 'shelf'], ['lamp', 'lamp'], ['sofa', 'sofa']];
  return table.find(([k]) => n.includes(k))?.[1] ?? 'box';
}
