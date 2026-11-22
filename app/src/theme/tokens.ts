/** Design tokens. Source of truth: docs/design-decisions.md. */
export const colors = {
  bg: '#0E1110',
  surface: '#171B19',
  surfaceRaised: '#1C2622',
  neutralFill: '#262B28',
  hairline: 'rgba(255,255,255,0.10)',
  hairlineStrong: 'rgba(255,255,255,0.42)',
  track: 'rgba(255,255,255,0.24)',
  text: '#F2F4F1',
  textSecondary: '#AEB8B2',
  textMuted: '#98A29C',
  mint: '#5EE0B8',
  mintFill: 'rgba(94,224,184,0.16)',
  onMint: '#06241B',
  coral: '#FF8A5B',
  coralFill: 'rgba(255,138,91,0.16)',
  amber: '#FFC457',
  amberFill: 'rgba(255,196,87,0.16)',
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
