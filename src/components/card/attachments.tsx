'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type DragEvent } from 'react';
import { useConfirm } from '@/components/confirmation';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';
import { formatBytes } from '@/lib/time';
import type { Attachment } from '@/lib/types';

interface Upload {
  key: number;
  name: string;
  progress: number;
}

interface UploadTicket {
  attachmentId: string;
  upload: { method: 'PUT'; url: string; headers: Record<string, string> };
}

/** PUT with progress events — fetch() cannot report upload progress. */
export function putWithProgress(url: string, file: File, headers: Record<string, string>, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error('Upload failed — check your connection.'));
    xhr.send(file);
  });
}

/**
 * Attachments (AC18): presigned PUT straight to object storage with progress.
 * Size and quota are checked by the API before any upload URL is issued, so a
 * file over 25 MB fails with 413 before a byte moves.
 */
export function Attachments({ cardId, attachments }: { cardId: string; attachments: Attachment[] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useSession();
  const confirmAction = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [over, setOver] = useState(false);
  const seq = useRef(0);

  const refresh = () => qc.invalidateQueries({ queryKey: ['card', cardId] });

  async function upload(file: File) {
    const key = ++seq.current;
    setUploads((u) => [...u, { key, name: file.name, progress: 0 }]);
    const setProgress = (progress: number) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress } : x)));
    try {
      const ticket = await api.post<UploadTicket>(`/cards/${cardId}/attachments`, {
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      });
      await putWithProgress(ticket.upload.url, file, ticket.upload.headers, setProgress);
      await api.post(`/attachments/${ticket.attachmentId}/complete`);
    } catch (err) {
      toast(err instanceof ApiError && err.status === 413 ? `${file.name}: ${err.message}` : `${file.name}: ${errorMessage(err)}`);
    } finally {
      setUploads((u) => u.filter((x) => x.key !== key));
      await refresh();
    }
  }

  function onFiles(files: FileList | null) {
    for (const f of Array.from(files ?? [])) void upload(f);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    onFiles(e.dataTransfer.files);
  }

  async function download(a: Attachment) {
    try {
      const { url } = await api.get<{ url: string }>(`/attachments/${a.id}/content?format=url`);
      // Served with Content-Disposition: attachment, so this downloads without leaving the page.
      window.location.assign(url);
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  async function remove(a: Attachment) {
    if (!await confirmAction({ title: 'Delete attachment?', description: `“${a.filename}” will be permanently deleted from this card.`, confirmLabel: 'Delete attachment' })) return;
    try {
      await api.del(`/attachments/${a.id}`);
    } catch (err) {
      toast(errorMessage(err));
    }
    await refresh();
  }

  return (
    <section aria-label="Attachments" className="space-y-2">
      <h2 className="text-sm font-semibold text-secondary-foreground">Attachments</h2>
      <ul className="space-y-1">
        {attachments.map((a) => {
          const ready = a.scanState === 'clean' && a.uploaded;
          const status = !a.uploaded ? 'Upload incomplete' : a.scanState === 'pending' ? 'Scanning…' : a.scanState === 'blocked' ? 'Blocked by virus scan' : null;
          return (
            <li key={a.id} data-testid="attachment" data-scan-state={a.scanState} className={`flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm ${ready ? '' : 'opacity-60'}`}>
              <span aria-hidden>📄</span>
              {ready ? (
                <button type="button" onClick={() => void download(a)} className="tap min-w-0 flex-1 truncate text-left text-primary hover:underline">
                  {a.filename}
                </button>
              ) : (
                <span className="min-w-0 flex-1 truncate">{a.filename}</span>
              )}
              <span className="shrink-0 text-xs text-muted-foreground">{status ?? formatBytes(a.sizeBytes)}</span>
              {a.uploadedBy.id === user?.id ? (
                <button type="button" aria-label={`Delete ${a.filename}`} onClick={() => void remove(a)} className="tap px-1 text-muted-foreground hover:text-danger-text">
                  ✕
                </button>
              ) : null}
            </li>
          );
        })}
        {uploads.map((u) => (
          <li key={u.key} className="rounded-md border border-dashed border-input px-2 py-1.5 text-sm">
            <div className="flex justify-between">
              <span className="truncate">{u.name}</span>
              <span className="text-xs text-muted-foreground" data-testid="upload-progress">
                {u.progress}%
              </span>
            </div>
            <div className="mt-1 h-1 rounded bg-muted">
              <div className="h-full rounded bg-primary transition-all" style={{ width: `${u.progress}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        data-testid="attachment-dropzone"
        className={`flex flex-wrap items-center gap-2 rounded-md border-2 border-dashed px-3 py-3 text-sm ${over ? 'border-ring bg-primary-subtle' : 'border-border text-muted-foreground'}`}
      >
        Drop files here or
        <Button variant="secondary" onClick={() => input.current?.click()}>
          choose files
        </Button>
        <span className="text-xs">Up to 25 MB each.</span>
        <input ref={input} type="file" multiple hidden aria-label="Attach files" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
      </div>
    </section>
  );
}
