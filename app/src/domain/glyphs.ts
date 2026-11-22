/* Shape helpers so every glyph is a single path (the widget renders glyphs from a path string). */
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`;
const rrect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;

/**
 * 24px stroke glyphs. The UI and item glyphs marked "design" are copied from the design sources
 * (design-ref/source/*.dc.html); the others are drawn in the same style (24 grid, round caps and joins).
 */
export const ICON_PATHS = {
  // UI (design)
  buy: 'M4 6h10M4 12h10M4 18h6M16 15l2 2 4-4',
  tasks: 'M9 4h6v3H9zM7 5.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1h-1M9 14l2 2 4-4',
  home: 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  budget: 'M5 20V10M12 20V4M19 20v-7',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  external: 'M7 17 17 7M9 7h8v8',
  sliders: 'M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4',
  check: 'M5 12l5 5 9-10',
  camera: `M4 8h3l2-3h6l2 3h3v11H4z${circle(12, 13, 3.5)}`,
  info: `${circle(12, 12, 9)}M12 8v5M12 16.5v.01`,
  bell: 'M6 8a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 19a2 2 0 0 0 4 0',
  // Items (design)
  kettle: 'M6 10h9v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM15 12l4-3M6 12H4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2M8 7h5',
  microwave: `${rrect(3, 6, 18, 12, 2)}${rrect(6, 9, 8, 6, 1)}M17.5 10h.01M17.5 14h.01`,
  toaster: `${rrect(4, 9, 16, 9, 2)}M8 9V6h3v3M13 9V6h3v3`,
  wifi: 'M4.5 10a11 11 0 0 1 15 0M7.5 13.3a6.6 6.6 0 0 1 9 0M10.5 16.5a2.2 2.2 0 0 1 3 0M12 19.5h.01',
  curtain: 'M3 5h18M5 5v14M9 5c0 5-1 9-4 14M19 5v14M15 5c0 5 1 9 4 14',
  shelf: 'M4 9h16M4 17h16M7 9V5h4v4M14 17v-4h3v4',
  lamp: 'M8 4h8l2 8H6zM12 12v6M9 20h6',
  sofa: 'M4 12V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M3 12h18v5H3zM5 17v2M19 17v2',
  bed: `M3 18V8M3 14h18v4M21 14v-3a2 2 0 0 0-2-2h-7v5${circle(7, 11, 1.5)}`,
  bedside: 'M5 8h14v10H5zM5 13h14M9 18v2M15 18v2',
  bookshelf: 'M5 20V5h14v15M5 12h14M5 8.5h14M5 15.5h14',
  mirror: `${ellipse(12, 11, 6, 8)}M12 19v2M9 21h6`,
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  flame: 'M12 3c3 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z',
  brush: 'M5 20 19 6M14 4l2 2M17 7l2 2M4 15l5 5',
  bike: `${circle(6, 17, 3)}${circle(18, 17, 3)}M6 17l4-8h5l3 8M10 9 9 6H7`,
  // Items (same style)
  pot: 'M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM2 10h2M20 10h2M10 7V5M14 7V5',
  pan: `${circle(9, 13, 6)}M15 13h7`,
  cutlery: 'M7 3v18M4 3v5a3 3 0 0 0 6 0V3M17 21V3c-2 1-3 4-3 8h3',
  mug: 'M5 8h11v8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v2M12 3v2',
  fridge: `${rrect(6, 2, 12, 20, 2)}M6 10h12M9 5v2M9 13v3`,
  washer: `${rrect(4, 2, 16, 20, 2)}${circle(12, 13, 5)}M7 5.5h.01M10 5.5h.01`,
  tv: `${rrect(2, 5, 20, 13, 2)}M8 21h8M12 18v3`,
  plant: 'M7 14h10l-1.5 7h-7zM12 14V8M12 8c0-3 2-5 5-5 0 3-2 5-5 5zM12 10c0-2.5-1.7-4-4-4 0 2.3 1.5 4 4 4z',
  chair: 'M7 3h10v8H7zM5 11h14v3H5zM7 14v7M17 14v7',
  table: 'M3 8h18M5 8v12M19 8v12M13 8v5h6',
  rug: `${rrect(5, 3, 14, 18, 1.5)}M8 3V1.5M12 3V1.5M16 3V1.5M8 22.5V21M12 22.5V21M16 22.5V21M9 9h6M9 15h6`,
  towel: 'M6 3h10a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2zM18 5h1a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2M6 15h12',
  bin: 'M4 6h16M10 3h4M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14M10 10v7M14 10v7',
  hanger: 'M12 7a2 2 0 1 1 2-2c0 1.2-2 1.6-2 3L3 15a1 1 0 0 0 .6 1.8h16.8A1 1 0 0 0 21 15z',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  tools: 'M14.5 6.5a4 4 0 0 1 5-5l-2.5 2.5 1 2 2 1 2.5-2.5a4 4 0 0 1-5 5L9 18a2 2 0 0 1-3-3z',
  plug: 'M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5',
  pillow: 'M5 6c4-1.5 10-1.5 14 0 1.5 4 1.5 8 0 12-4 1.5-10 1.5-14 0-1.5-4-1.5-8 0-12z',
  bath: 'M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2',
  door: 'M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M4 21h16M14.5 12h.01',
  key: `${circle(8, 15, 4)}M11 12l9-9M17 6l3 3M15 8l2 2`,
  box: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',
} as const;
export type IconName = keyof typeof ICON_PATHS;

/** Item-name keywords to glyphs. First match wins, so the more specific words come first. */
const BY_NAME: [RegExp, IconName][] = [
  [/descal|cleaner|detergent|soap|water|humid|moisture/, 'drop'],
  [/kettle/, 'kettle'],
  [/microwave/, 'microwave'],
  [/toast/, 'toaster'],
  [/wi-?fi|router|broadband|internet/, 'wifi'],
  [/curtain|blind/, 'curtain'],
  [/bookshel|bookcase/, 'bookshelf'],
  [/shel/, 'shelf'],
  [/bedside|nightstand|drawer|dresser/, 'bedside'],
  [/lamp|light|bulb/, 'bulb'],
  [/sofa|couch|armchair/, 'sofa'],
  [/bed|mattress/, 'bed'],
  [/mirror/, 'mirror'],
  [/gas|boiler|heater|candle/, 'flame'],
  [/brush|mop|broom|clean/, 'brush'],
  [/bike|cycle|scooter/, 'bike'],
  [/\bpans?\b|frying|wok/, 'pan'],
  [/pot\b|pots|saucepan|cookware/, 'pot'],
  [/cutlery|fork|knife|knives|spoon|utensil/, 'cutlery'],
  [/mug|cup|glass|plate|bowl/, 'mug'],
  [/fridge|freezer/, 'fridge'],
  [/wash|dryer|dishwasher/, 'washer'],
  [/table|desk/, 'table'],
  [/chair|stool/, 'chair'],
  [/\btv\b|tele|monitor|screen/, 'tv'],
  [/plant|flower|pot plant/, 'plant'],
  [/rug|carpet|mat\b/, 'rug'],
  [/towel/, 'towel'],
  [/bin\b|bins|trash|rubbish/, 'bin'],
  [/hanger|wardrobe|rail/, 'hanger'],
  [/drill|hammer|tool|screw|hook|nail/, 'tools'],
  [/plug|extension|adapter|charger|cable|socket/, 'plug'],
  [/pillow|cushion|duvet|sheet|blanket/, 'pillow'],
  [/shower|bath|toilet/, 'bath'],
  [/key|lock/, 'key'],
  [/door/, 'door'],
];

/** The room's glyph, used when the item name matches nothing. */
const BY_ROOM: [RegExp, IconName][] = [
  [/kitchen/, 'pot'],
  [/living|lounge/, 'sofa'],
  [/bed/, 'bed'],
  [/bath|toilet|wc|shower/, 'bath'],
  [/hall|entr|corridor/, 'door'],
];

/** Picks a glyph from the item name, then from the room, then a generic box. */
export function glyphFor(name: string, room?: string): IconName {
  const n = name.toLowerCase();
  const byName = BY_NAME.find(([re]) => re.test(n))?.[1];
  if (byName) return byName;
  const r = room?.toLowerCase();
  return (r && BY_ROOM.find(([re]) => re.test(r))?.[1]) || 'box';
}

/** Category colour of a room's glyph tiles, as in the design: kitchen and hallway amber, living room mint, bedroom lilac. */
export type Tone = 'amber' | 'mint' | 'lilac' | 'sky' | 'neutral';
export function roomTone(room?: string): Tone {
  const r = room?.toLowerCase() ?? '';
  if (/kitchen|hall|entr|corridor/.test(r)) return 'amber';
  if (/living|lounge/.test(r)) return 'mint';
  if (/bed/.test(r)) return 'lilac';
  if (/bath|toilet|wc|shower/.test(r)) return 'sky';
  return 'neutral';
}
