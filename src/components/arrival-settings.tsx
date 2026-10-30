'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { Button, Input, Select } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api, errorMessage } from '@/lib/api';
import { useArrivalSettings, type ArrivalSettings, type Calendar, type CalendarCountry } from '@/lib/arrival';

export function ProjectArrivalSettings({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const settings = useArrivalSettings(projectId);
  const qc = useQueryClient();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const target = useRef<HTMLInputElement>(null);
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
  return <details className="relative text-label"><summary className="ui-button tap cursor-pointer rounded-md px-2 text-secondary-foreground hover:bg-subtle">Arrival settings</summary>
    <div className="absolute right-0 z-20 mt-1 w-72 max-w-[90vw] rounded-lg border border-border bg-surface p-4 shadow-lg">
      {settings.isPending ? <p>Loading arrival settings…</p> : settings.error ? <p role="alert" className="text-danger-text">{errorMessage(settings.error)}</p> : <form key={`${settings.data.targetDate}:${settings.data.guestCardArrivals}`} onSubmit={(e) => void save(e)} className="space-y-3">
        <label className="block">Target date<Input ref={target} type="date" name="targetDate" defaultValue={settings.data.targetDate ?? ''} disabled={!canEdit || saving} className="mt-1 w-full" /></label>
        {canEdit ? <Button variant="ghost" size="sm" disabled={saving} onClick={() => { if (target.current) target.current.value = ''; }}>Clear target date</Button> : null}
        <label className="flex gap-2"><input type="checkbox" name="guestCardArrivals" defaultChecked={settings.data.guestCardArrivals} disabled={!canEdit || saving} />Show clients each card&apos;s arrival time</label>
        {canEdit ? <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button> : null}
      </form>}
    </div>
  </details>;
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
      <label className="block text-label">Country<Select name="country" required defaultValue={calendar.data.country ?? ''} disabled={!canEdit || saving} onChange={(e) => setCountry(e.target.value)} className="mt-1 w-full"><option value="" disabled>Choose a country</option>{countries.data.data.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</Select></label>
      <label className="block text-label">Timezone<Select name="timezone" defaultValue={initialZone} disabled={!canEdit || saving} className="mt-1 w-full">{[...new Set([initialZone, 'UTC', ...zones])].map((zone) => <option key={zone} value={zone}>{zone}</option>)}</Select></label>
      <p className="text-label text-secondary-foreground">Weekend: {(selected?.weekendDays ?? calendar.data.weekendDays).map((day) => weekdays[day - 1]).join(', ')}</p>
      <p className="text-label text-muted-foreground">{calendar.data.publicHolidays ? 'Weekends and public holidays of the chosen country don’t count as working days.' : calendar.data.country ? 'Public holidays are not included for this calendar.' : 'Saturday and Sunday don’t count as working days until a calendar is chosen.'}</p>
      {canEdit ? <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save working days'}</Button> : null}
    </form>}
    <p className="mt-4 text-caption text-muted-foreground">Public holiday data from date-holidays (commenthol), CC BY-SA 3.0, based on Wikipedia.</p>
  </section>;
}
