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

/** Project icon tiles: a soft tint in light mode, the solid bright colour in dark mode (as in Asana). */
export const PROJECT_ICON_BG: Record<string, string> = {
  slate: 'bg-label-grey/20 dark:bg-label-grey', red: 'bg-label-red/20 dark:bg-label-red', orange: 'bg-label-orange/20 dark:bg-label-orange', amber: 'bg-label-amber/20 dark:bg-label-amber',
  yellow: 'bg-label-yellow/20 dark:bg-label-yellow', lime: 'bg-label-lime/20 dark:bg-label-lime', green: 'bg-label-green/20 dark:bg-label-green', teal: 'bg-label-teal/20 dark:bg-label-teal',
  aqua: 'bg-label-aqua/20 dark:bg-label-aqua', blue: 'bg-label-blue/20 dark:bg-label-blue', violet: 'bg-label-purple/20 dark:bg-label-purple', purple: 'bg-label-orchid/20 dark:bg-label-orchid',
  magenta: 'bg-label-magenta/20 dark:bg-label-magenta', pink: 'bg-label-pink/20 dark:bg-label-pink', peach: 'bg-label-peach/20 dark:bg-label-peach', stone: 'bg-label-stone/20 dark:bg-label-stone',
};

export const AVATAR_COLORS = ['bg-avatar-1', 'bg-avatar-2', 'bg-avatar-3', 'bg-avatar-4', 'bg-avatar-5', 'bg-avatar-6'];
