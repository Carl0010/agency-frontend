'use client';

import { PageHeader, RadioGroup } from '@/components/ui';
import { setThemePreference, useThemePreference, type ThemePreference } from '@/lib/theme';

/** Theme choice for this browser; the app bar switch flips between light and dark. */
export default function AppearancePage() {
  const preference = useThemePreference();
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <PageHeader title="Appearance" description="How Agency looks on this device. Other browsers keep their own choice." />
      <RadioGroup legend="Theme" name="theme" value={preference} onChange={(value) => setThemePreference(value as ThemePreference)} options={[
        { value: 'system', label: 'Match system', description: 'Follow your device’s light or dark setting.' },
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ]} />
    </main>
  );
}
