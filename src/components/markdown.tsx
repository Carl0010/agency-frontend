'use client';

import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Icon } from '@/components/icon';
import { api, errorMessage } from '@/lib/api';
import { useToast } from '@/components/toast';

/** Mention token written by the composer: `@[Name](user:<uuid>)`. */
const MENTION = /@\[([^\]\n]{1,200})\]\(user:([0-9a-fA-F-]{36})\)/g;
/** Underline from the rich editor: `<u>…</u>` (no other HTML is ever rendered). */
const UNDERLINE = /<u>([^<\n]{1,2000})<\/u>/gi;
const ATTACHMENT = /^attachment:([0-9a-fA-F-]{36})$/;
const SCHEMES = ['user:', 'underline:', 'attachment:'];

/**
 * Renders Markdown (with GitHub's strikethrough, task lists and tables), mention tokens as chips,
 * `<u>` as underline and `attachment:<id>` links as files that download through the API. Raw HTML
 * is never rendered.
 */
export function Markdown({ source }: { source: string }) {
  // Turn tokens into links with private schemes so the renderer can swap each for its element.
  const text = source
    .replace(MENTION, (_m, name: string, id: string) => `[@${name}](user:${id})`)
    .replace(UNDERLINE, (_m, inner: string) => `[${inner}](underline:)`);
  return (
    <div className="prose-sm break-words text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (SCHEMES.some((s) => url.startsWith(s)) ? url : defaultUrlTransform(url))}
        components={{
          img: ({ src, alt }) => (typeof src === 'string' ? <AttachmentImage src={src} alt={alt ?? ''} /> : null),
          a: ({ href, children }) => {
            if (href?.startsWith('user:')) {
              return <span data-testid="mention-chip" data-user-id={href.slice(5)} className="rounded bg-primary-muted px-1 font-medium text-primary-text">{children}</span>;
            }
            if (href === 'underline:') return <u>{children}</u>;
            const file = href ? ATTACHMENT.exec(href) : null;
            if (file?.[1]) return <AttachmentLink id={file[1]}>{children}</AttachmentLink>;
            return <a href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

/** A file attached to the card, linked from a comment: downloads through a short-lived URL from the API. */
function AttachmentLink({ id, children }: { id: string; children: ReactNode }) {
  const toast = useToast();
  async function open() {
    try {
      const { url } = await api.get<{ url: string }>(`/attachments/${id}/content?format=url`);
      window.location.assign(url);
    } catch (err) {
      toast(errorMessage(err));
    }
  }
  return (
    <button type="button" data-testid="comment-attachment" onClick={() => void open()} className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-subtle px-1.5 py-0.5 align-middle text-label font-medium text-foreground hover:border-border-hover">
      <Icon name="attachment" className="size-3.5 shrink-0" /><span className="truncate">{children}</span>
    </button>
  );
}

/**
 * An image in a description or comment. `attachment:<id>` images are the card's attachments and load
 * from a short-lived URL the API issues (refreshed before it expires); other addresses load as given.
 */
export function AttachmentImage({ src, alt }: { src: string; alt: string }) {
  const id = ATTACHMENT.exec(src)?.[1];
  const url = useQuery({
    queryKey: ['attachment-url', id],
    queryFn: () => api.get<{ url: string }>(`/attachments/${id}/content?format=url`),
    enabled: Boolean(id),
    staleTime: 4 * 60_000,
  });
  const shown = id ? url.data?.url : src;
  if (id && url.error) return <span role="alert" className="text-label text-danger-text">{alt || 'Image'}: {errorMessage(url.error)}</span>;
  if (!shown) return <span aria-label={alt || 'Image loading'} className="inline-block h-32 w-48 animate-pulse rounded-md bg-subtle" />;
  return <img src={shown} alt={alt} loading="lazy" className="max-h-96 max-w-full rounded-md border border-border object-contain" />;
}
