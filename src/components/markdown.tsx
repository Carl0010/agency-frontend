'use client';

import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';

/** Mention token written by the composer: `@[Name](user:<uuid>)`. */
const MENTION = /@\[([^\]\n]{1,200})\]\(user:([0-9a-fA-F-]{36})\)/g;

/** Renders Markdown with mention tokens as chips. Raw HTML is never rendered. */
export function Markdown({ source }: { source: string }) {
  // Turn the token into a link with a `user:` href so the renderer can swap it for a chip.
  const text = source.replace(MENTION, (_m, name: string, id: string) => `[@${name}](user:${id})`);
  return (
    <div className="prose-sm break-words text-sm leading-relaxed">
      <ReactMarkdown
        urlTransform={(url) => (url.startsWith('user:') ? url : defaultUrlTransform(url))}
        components={{
          a: ({ href, children }) =>
            href?.startsWith('user:') ? (
              <span data-testid="mention-chip" data-user-id={href.slice(5)} className="rounded bg-primary-muted px-1 font-medium text-primary-text">
                {children}
              </span>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                {children}
              </a>
            ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
