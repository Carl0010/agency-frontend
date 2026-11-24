'use client';

import { Icon } from '@/components/icon';
import { Button } from '@/components/ui';
import { setThemePreference, useTheme } from '@/lib/theme';

/** App bar switch to the other theme; Your settings → Appearance also offers System. */
export function ThemeToggle() {
  const theme = useTheme();
  const target = theme === 'dark' ? 'light' : 'dark';
  return <Button variant="ghost" aria-label={`Switch to ${target} mode`} onClick={() => setThemePreference(target)}>
    <Icon name={target === 'dark' ? 'moon' : 'sun'} /><span className="text-label">{target === 'dark' ? 'Dark mode' : 'Light mode'}</span>
  </Button>;
}
