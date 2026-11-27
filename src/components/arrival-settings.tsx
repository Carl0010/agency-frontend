'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Button, Checkbox, Combobox, DatePicker } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api, errorMessage } from '@/lib/api';
import { useArrivalSettings, type ArrivalSettings, type Calendar, type CalendarCountry } from '@/lib/arrival';

/**
 * Arrival settings for one project: the target date, and whether guests see each card's estimate.
 * Shown in a dialog from the project's ⋯ menu.
 */
export function ArrivalSettingsForm({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const settings = useArrivalSettings(projectId);
  const qc = useQueryClient();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await api.patch<ArrivalSettings>(`/projects/${projectId}/arrival-settings`, { targetDate: form.get('targetDate') || null, guestCardArrivals: form.has('guestCardArrivals') });
      await qc.invalidateQueries({ queryKey: ['arrival-settings', projectId] });
      toast('Arrival settings saved.', 'info');
    } catch (error) { toast(errorMessage(error)); } finally { setSaving(false); }
  }
  return <div className="space-y-4 text-label">
    <p className="text-secondary-foreground">Agency estimates when each card will be done from how quickly your team finishes cards. Set a target date to see whether the project is on track. Turn estimates on for the board under Filters → Show arrival estimates.</p>
    {settings.isPending ? <p>Loading arrival settings…</p> : settings.error ? <p role="alert" className="text-danger-text">{errorMessage(settings.error)}</p> : <form key={`${settings.data.targetDate}:${settings.data.guestCardArrivals}`} onSubmit={(e) => void save(e)} className="space-y-3">
      <DatePicker label="Target date" name="targetDate" placeholder="No target date" defaultValue={settings.data.targetDate ?? null} disabled={!canEdit || saving} />
      <Checkbox name="guestCardArrivals" defaultChecked={settings.data.guestCardArrivals} disabled={!canEdit || saving} label="Show clients each card's arrival time" />
      {canEdit ? <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button> : null}
    </form>}
  </div>;
}

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export function WorkingDays({ workspaceId, canEdit }: { workspaceId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const calendar = useQuery({ queryKey: ['calendar', workspaceId], queryFn: () => api.get<Calendar>(`/workspaces/${workspaceId}/calendar`) });
  const countries = useQuery({ queryKey: ['calendar-countries'], queryFn: () => api.get<{ data: CalendarCountry[] }>('/calendar-countries') });
  const [country, setCountry] = useState('');
  const [saving, setSaving] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!form.get('country')) { toast('Choose a country.'); return; }
    setSaving(true);
    try {
      const saved = await api.put<Calendar>(`/workspaces/${workspaceId}/calendar`, { country: form.get('country'), timezone: form.get('timezone') });
      qc.setQueryData(['calendar', workspaceId], saved);
      toast('Working days saved.', 'info');
    } catch (error) { toast(errorMessage(error)); } finally { setSaving(false); }
  }
  const selected = countries.data?.data.find((item) => item.code === (country || calendar.data?.country));
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  const initialZone = calendar.data?.country ? calendar.data.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return <section className="mt-6 rounded-lg border border-border bg-surface p-4" aria-labelledby="working-days-heading">
    <h2 id="working-days-heading" className="font-semibold">Working days</h2>
    {calendar.isPending || countries.isPending ? <p>Loading working days…</p> : calendar.error || countries.error ? <p role="alert" className="text-danger-text">{errorMessage(calendar.error || countries.error)}</p> : <form key={`${calendar.data.country}:${calendar.data.timezone}`} onSubmit={(e) => void save(e)} className="mt-3 space-y-3">
      {/* Long lists: type to filter. */}
      <Combobox label="Country" name="country" placeholder="Choose a country" clearable={false} defaultValue={calendar.data.country} disabled={!canEdit || saving}
        onChange={(value) => setCountry(value ?? '')} options={countries.data.data.map((item) => ({ value: item.code, label: item.name }))} />
      <Combobox label="Timezone" name="timezone" placeholder="Choose a timezone" clearable={false} defaultValue={initialZone} disabled={!canEdit || saving}
        options={[...new Set([initialZone, 'UTC', ...zones])].map((zone) => ({ value: zone, label: zone }))} />
      <p className="text-label text-secondary-foreground">Weekend: {(selected?.weekendDays ?? calendar.data.weekendDays).map((day) => weekdays[day - 1]).join(', ')}</p>
      <p className="text-label text-muted-foreground">{calendar.data.publicHolidays ? 'Weekends and public holidays of the chosen country don’t count as working days.' : calendar.data.country ? 'Public holidays are not included for this calendar.' : 'Saturday and Sunday don’t count as working days until a calendar is chosen.'}</p>
      {canEdit ? <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save working days'}</Button> : null}
    </form>}
    <p className="mt-4 text-caption text-muted-foreground">Public holiday data from date-holidays (commenthol), CC BY-SA 3.0, based on Wikipedia.</p>
  </section>;
}
