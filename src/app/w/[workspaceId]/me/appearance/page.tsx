'use client';

import { PageHeader, RadioGroup } from '@/components/ui';
import { setThemePreference, useThemePreference, type ThemePreference } from '@/lib/theme';

/** The only theme control: Match system, Light or Dark, kept in this browser. */
export default function AppearancePage() {
  const preference = useThemePreference();
  return (
    <main className="ui-page">
      <PageHeader title="Appearance" description="How Agency looks on this device. Other browsers keep their own choice." />
      <RadioGroup legend="Theme" name="theme" value={preference} onChange={(value) => setThemePreference(value as ThemePreference)} options={[
        { value: 'system', label: 'Match system', description: 'Follow your device’s light or dark setting.' },
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ]} />
    </main>
  );
}
