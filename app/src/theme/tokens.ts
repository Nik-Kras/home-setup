/** Design tokens. Source of truth: docs/design-decisions.md. */
export const colors = {
  bg: '#0E1110',
  surface: '#171B19',
  surfaceRaised: '#1C2622',
  neutralFill: '#262B28',
  hairline: 'rgba(255, 255, 255, 0.10)',
  hairlineStrong: 'rgba(255, 255, 255, 0.42)',
  track: 'rgba(255,255,255,0.24)',
  text: '#F2F4F1',
  textSecondary: '#AEB8B2',
  textMuted: '#98A29C',
  mint: '#5EE0B8',
  mintFill: 'rgba(94, 224, 184, 0.16)',
  onMint: '#06241B',
  coral: '#FF8A5B',
  coralFill: 'rgba(255,138,91,0.16)',
  amber: '#FFC457',
  amberFill: 'rgba(255, 196, 87, 0.16)',
  lilac: '#B9A4FF',
} as const;

export const radius = { row: 18, card: 24, pill: 999, tile: 13 } as const;

export const fonts = {
  serif: 'InstrumentSerif_400Regular',
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
} as const;

/** Person colours. Coral is reserved for urgent in the cleaner colour scheme, so Daryna uses lilac. */
export const personColor = { nikita: colors.mint, daryna: colors.lilac } as const;

/**
 * Category colours of glyph tiles, as in the design (the user chose coloured tiles over neutral ones).
 * fg: glyph stroke; fill: small tile tint; ring: large tile border; card: opaque Home card.
 * Sky (bathroom) is not drawn in the design; it follows the same recipe.
 */
export const tileTone = {
  amber: { fg: '#FFC457', fill: 'rgba(255, 196, 87, 0.14)', ring: 'rgba(255, 196, 87, 0.35)', card: '#4A3D2B' },
  mint: { fg: '#5EE0B8', fill: 'rgba(94, 224, 184, 0.14)', ring: 'rgba(94, 224, 184, 0.35)', card: '#2E4A44' },
  lilac: { fg: '#B9A4FF', fill: 'rgba(185, 164, 255, 0.16)', ring: 'rgba(185, 164, 255, 0.38)', card: '#3B3560' },
  sky: { fg: '#8CC8FF', fill: 'rgba(140, 200, 255, 0.14)', ring: 'rgba(140, 200, 255, 0.35)', card: '#2B3F55' },
  neutral: { fg: '#D5DBD7', fill: '#262B28', ring: 'rgba(255, 255, 255, 0.14)', card: '#262B28' },
} as const;

/** Minimum touch target in dp. */
export const TARGET = 44;

/**
 * The one accent glow a screen may have (Tasks deadline card, Buy "Next up", Budget "Spent so far"):
 * raised surface, mint hairline and a soft mint shadow. Spread it into the card's style.
 */
export const glow = {
  backgroundColor: colors.surfaceRaised,
  borderColor: 'rgba(94,224,184,0.38)',
  boxShadow: '0 10px 32px -12px rgba(94,224,184,0.45)',
} as const;
