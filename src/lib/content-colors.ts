/** User-selected content colors, never UI status or navigation colors. */
export const LABEL_BG: Record<string, string> = {
  grey: 'bg-label-grey', red: 'bg-label-red', orange: 'bg-label-orange',
  yellow: 'bg-label-yellow', green: 'bg-label-green', teal: 'bg-label-teal',
  blue: 'bg-label-blue', purple: 'bg-label-purple', pink: 'bg-label-pink', brown: 'bg-label-brown',
};

/** Project colours in picker order: two rows of eight, as in Asana. Must match the API's PROJECT_COLORS. */
export const PROJECT_DOT: Record<string, string> = {
  slate: 'bg-label-grey', red: 'bg-label-red', orange: 'bg-label-orange', amber: 'bg-label-amber',
  yellow: 'bg-label-yellow', lime: 'bg-label-lime', green: 'bg-label-green', teal: 'bg-label-teal',
  aqua: 'bg-label-aqua', blue: 'bg-label-blue', violet: 'bg-label-purple', purple: 'bg-label-orchid',
  magenta: 'bg-label-magenta', pink: 'bg-label-pink', peach: 'bg-label-peach', stone: 'bg-label-stone',
};

/** Project icon tiles: the solid colour in both themes, as in Asana. The glyph is white on the deeper
 * light-theme tones and dark where white would wash out (yellow, lime, orange and the like), and dark
 * on every tile in dark mode, where the content colours go bright. */
export const PROJECT_ICON_BG: Record<string, string> = {
  slate: 'bg-label-grey text-on-label-deep dark:text-on-label',
  red: 'bg-label-red text-on-label-deep dark:text-on-label',
  orange: 'bg-label-orange text-on-label',
  amber: 'bg-label-amber text-on-label',
  yellow: 'bg-label-yellow text-on-label',
  lime: 'bg-label-lime text-on-label',
  green: 'bg-label-green text-on-label-deep dark:text-on-label',
  teal: 'bg-label-teal text-on-label-deep dark:text-on-label',
  aqua: 'bg-label-aqua text-on-label',
  blue: 'bg-label-blue text-on-label-deep dark:text-on-label',
  violet: 'bg-label-purple text-on-label-deep dark:text-on-label',
  purple: 'bg-label-orchid text-on-label-deep dark:text-on-label',
  magenta: 'bg-label-magenta text-on-label-deep dark:text-on-label',
  pink: 'bg-label-pink text-on-label-deep dark:text-on-label',
  peach: 'bg-label-peach text-on-label',
  stone: 'bg-label-stone text-on-label',
};

export const AVATAR_COLORS = ['bg-avatar-1', 'bg-avatar-2', 'bg-avatar-3', 'bg-avatar-4', 'bg-avatar-5', 'bg-avatar-6'];
