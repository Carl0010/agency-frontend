'use client';

import Image from '@tiptap/extension-image';
import Mention from '@tiptap/extension-mention';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, useEditorState, type Editor, type ReactNodeViewProps } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import type { IconName } from '@/components/icon';
import { AttachmentImage } from '@/components/markdown';
import { Avatar } from '@/components/ui';
import { ToolButton } from './tool-button';
import type { RosterEntry } from '@/lib/types';

/** The mention token comments are stored with: `@[Name](user:<uuid>)`. The API reads mentions from it. */
const MENTION = /^@\[([^\]\n]{1,200})\]\(user:([0-9a-fA-F-]{36})\)/;

/** Mentions keep the stored token format, so the API and the renderer read them as before. */
const CommentMention = Mention.extend({
  renderMarkdown: (node) => `@[${String(node.attrs?.label ?? '')}](user:${String(node.attrs?.id ?? '')})`,
  markdownTokenizer: {
    name: 'mention',
    level: 'inline',
    start: (src: string) => src.indexOf('@['),
    tokenize: (src: string) => {
      const match = MENTION.exec(src);
      return match ? { type: 'mention', raw: match[0], label: match[1], id: match[2] } : undefined;
    },
  },
  parseMarkdown: (token, helpers) => helpers.createNode('mention', { id: String(token.id ?? ''), label: String(token.label ?? '') }),
});

/** Images are stored as `![name](attachment:<id>)` and shown from a short-lived URL the API issues. */
const CardImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
}).configure({ inline: false, allowBase64: false });

function ImageView({ node, selected }: ReactNodeViewProps) {
  const src = String(node.attrs.src ?? '');
  const alt = String(node.attrs.alt ?? '');
  return (
    <NodeViewWrapper className={`my-2 inline-block max-w-full rounded-md ${selected ? 'ring-2 ring-ring' : ''}`} data-drag-handle>
      <AttachmentImage src={src} alt={alt} />
    </NodeViewWrapper>
  );
}

export interface RichEditorHandle {
  focus: () => void;
  clear: () => void;
  /** Replaces the content without reporting a change, e.g. when someone else saved it. */
  setMarkdown: (markdown: string) => void;
  /** Inserts an image that is one of the card's attachments. */
  insertImage: (id: string, alt: string) => void;
  /** Inserts a link to one of the card's attachments at the cursor. */
  insertAttachment: (id: string, filename: string) => void;
}

interface MentionMenu {
  items: RosterEntry[];
  highlight: number;
  command: (item: { id: string; label: string }) => void;
}

/**
 * A formatting editor for comments that reads and writes Markdown: bold, italic, underline, strike,
 * lists, quotes, code and links, plus `@` mentions of the people `mentionable` holds. `⌘↵`/`Ctrl↵`
 * submits. Underline is written as `<u>…</u>`, which the comment renderer turns into an underline.
 */
export default function RichEditor({
  ref,
  value,
  onChange,
  onSubmit,
  onFocus,
  onBlur,
  onEscape,
  onImageFiles,
  editable = true,
  label,
  placeholder,
  autoFocus = false,
  mentionable,
  toolbar = true,
  toolbarTarget,
  actions,
  className = '',
}: {
  ref?: Ref<RichEditorHandle>;
  value: string;
  onChange: (markdown: string) => void;
  onSubmit: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onEscape?: () => void;
  /** Enables images: pasted or dropped image files are handed here to upload. */
  onImageFiles?: (files: File[]) => void;
  editable?: boolean;
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
  mentionable: RosterEntry[];
  /** Show the formatting toolbar. */
  toolbar?: boolean;
  /** Render the toolbar in this element instead of above the text, such as a heading row it replaces. */
  toolbarTarget?: HTMLElement | null;
  /** Extra toolbar buttons on the right, such as Attach. */
  actions?: ReactNode;
  className?: string;
}) {
  const people = useRef(mentionable);
  people.current = mentionable;
  const submit = useRef(onSubmit);
  submit.current = onSubmit;
  const escape = useRef(onEscape);
  escape.current = onEscape;
  const imageFiles = useRef(onImageFiles);
  imageFiles.current = onImageFiles;
  const images = Boolean(onImageFiles);
  const [menu, setMenu] = useState<MentionMenu | null>(null);
  const menuRef = useRef<MentionMenu | null>(null);
  menuRef.current = menu;

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: autoFocus ? 'end' : false,
    editable,
    content: value,
    contentType: 'markdown',
    extensions: [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: true,
          protocols: [{ scheme: 'attachment', optionalSlashes: true }],
          isAllowedUri: (url, ctx) => url.startsWith('attachment:') || ctx.defaultValidate(url),
        },
      }),
      Markdown,
      ...(images ? [CardImage] : []),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      CommentMention.configure({
        HTMLAttributes: { class: 'rounded bg-primary-muted px-1 font-medium text-primary-text', 'data-testid': 'mention-chip' },
        suggestion: {
          items: ({ query }) => {
            const q = query.toLowerCase();
            return people.current.filter((m) => m.name.toLowerCase().startsWith(q) || m.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q))).slice(0, 6);
          },
          command: ({ editor: e, range, props }) => {
            e.chain().focus().insertContentAt(range, [{ type: 'mention', attrs: props }, { type: 'text', text: ' ' }]).run();
          },
          render: () => ({
            onStart: (props: SuggestionProps<RosterEntry>) => setMenu({ items: props.items, highlight: 0, command: props.command }),
            onUpdate: (props: SuggestionProps<RosterEntry>) => setMenu((m) => ({ items: props.items, highlight: Math.min(m?.highlight ?? 0, Math.max(props.items.length - 1, 0)), command: props.command })),
            onKeyDown: ({ event }: SuggestionKeyDownProps) => {
              const current = menuRef.current;
              if (!current?.items.length) return false;
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                const step = event.key === 'ArrowDown' ? 1 : current.items.length - 1;
                setMenu({ ...current, highlight: (current.highlight + step) % current.items.length });
                return true;
              }
              if (event.key === 'Enter' || event.key === 'Tab') {
                const person = current.items[current.highlight];
                if (person) current.command({ id: person.userId, label: person.name });
                return true;
              }
              if (event.key === 'Escape') { setMenu(null); return true; }
              return false;
            },
            onExit: () => setMenu(null),
          }),
        },
      }),
    ],
    editorProps: {
      attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': label, class: 'comment-editor min-h-full px-3 py-2 text-body leading-relaxed focus:outline-none' },
      handlePaste: (_view, event) => takeImages(event.clipboardData?.files),
      handleDrop: (_view, event) => takeImages(event.dataTransfer?.files),
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); submit.current(); return true; }
        if (event.key === 'Escape' && !menuRef.current) { escape.current?.(); return Boolean(escape.current); }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getMarkdown()),
    onFocus: () => onFocus?.(),
    onBlur: () => onBlur?.(),
  });

  function takeImages(files: FileList | null | undefined): boolean {
    const pictures = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'));
    if (!pictures.length || !imageFiles.current) return false;
    imageFiles.current(pictures);
    return true;
  }

  useEffect(() => { editor?.setEditable(editable); }, [editor, editable]);

  // The parent clears the draft after posting; follow it.
  useEffect(() => {
    if (editor && value === '' && !editor.isEmpty) editor.commands.clearContent();
  }, [editor, value]);

  useImperativeHandle(ref, () => ({
    focus: () => editor?.commands.focus('end'),
    clear: () => editor?.commands.clearContent(),
    setMarkdown: (markdown) => { editor?.commands.setContent(markdown, { contentType: 'markdown', emitUpdate: false }); },
    insertImage: (id, alt) => { editor?.chain().focus().setImage({ src: `attachment:${id}`, alt }).run(); },
    insertAttachment: (id, filename) => {
      editor?.chain().focus().insertContent([{ type: 'text', text: filename, marks: [{ type: 'link', attrs: { href: `attachment:${id}` } }] }, { type: 'text', text: ' ' }]).run();
    },
  }), [editor]);

  return (
    <div className={`relative flex min-h-0 flex-col ${className}`}>
      {toolbar && editor ? toolbarTarget ? createPortal(<Toolbar editor={editor} actions={actions} inline />, toolbarTarget) : <Toolbar editor={editor} actions={actions} /> : null}
      <EditorContent editor={editor} className="min-h-0 flex-1 overflow-y-auto" />
      {menu?.items.length ? (
        <ul role="listbox" aria-label="Mention a teammate" data-testid="mention-options" className="absolute bottom-full left-0 z-30 mb-1 w-64 rounded-md border border-border bg-popover py-1 shadow-lg">
          {menu.items.map((m, i) => (
            <li
              key={m.userId}
              role="option"
              aria-selected={i === menu.highlight}
              onMouseDown={(e) => { e.preventDefault(); menu.command({ id: m.userId, label: m.name }); }}
              className={`tap flex cursor-pointer items-center gap-2 px-3 py-1.5 text-label ${i === menu.highlight ? 'bg-primary-subtle' : ''}`}
            >
              <Avatar person={{ id: m.userId, name: m.name, avatarUrl: m.avatarUrl }} size={22} />
              {m.name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const FORMATS: { name: string; icon: IconName; mark?: string; node?: string; run: (e: Editor) => void }[] = [
  { name: 'Bold', icon: 'bold', mark: 'bold', run: (e) => e.chain().focus().toggleBold().run() },
  { name: 'Italic', icon: 'italic', mark: 'italic', run: (e) => e.chain().focus().toggleItalic().run() },
  { name: 'Underline', icon: 'underline', mark: 'underline', run: (e) => e.chain().focus().toggleUnderline().run() },
  { name: 'Strikethrough', icon: 'strike', mark: 'strike', run: (e) => e.chain().focus().toggleStrike().run() },
  { name: 'Bulleted list', icon: 'list-bullet', node: 'bulletList', run: (e) => e.chain().focus().toggleBulletList().run() },
  { name: 'Numbered list', icon: 'list-ordered', node: 'orderedList', run: (e) => e.chain().focus().toggleOrderedList().run() },
  { name: 'Quote', icon: 'quote', node: 'blockquote', run: (e) => e.chain().focus().toggleBlockquote().run() },
  { name: 'Code', icon: 'code', mark: 'code', run: (e) => e.chain().focus().toggleCode().run() },
];

function Toolbar({ editor, actions, inline = false }: { editor: Editor; actions?: ReactNode; inline?: boolean }) {
  const active: Record<string, boolean> = useEditorState({
    editor,
    selector: ({ editor: e }): Record<string, boolean> => Object.fromEntries([...FORMATS.map((f): [string, boolean] => [f.name, e.isActive(f.mark ?? f.node ?? '')]), ['Link', e.isActive('link')]]),
  });
  const [linking, setLinking] = useState<string | null>(null);
  function applyLink(url: string) {
    const chain = editor.chain().focus().extendMarkRange('link');
    if (url.trim()) chain.setLink({ href: url.trim() }).run(); else chain.unsetLink().run();
    setLinking(null);
  }
  return (
    // Inline, it sits in a one-line row (one height, scrolling sideways on narrow screens) so it can swap with a label.
    <div role="toolbar" aria-label="Formatting" className={inline ? 'flex flex-wrap items-center gap-0.5 [&>button]:shrink-0 max-sm:flex-nowrap max-sm:overflow-x-auto' : 'flex flex-wrap items-center gap-0.5 border-b border-border-subtle px-1.5 py-1'}>
      {FORMATS.map((f) => (
        <ToolButton key={f.name} label={f.name} icon={f.icon} pressed={Boolean(active[f.name])} onClick={() => f.run(editor)} />
      ))}
      <ToolButton label="Link" icon="link" pressed={Boolean(active.Link) || linking !== null} onClick={() => setLinking(linking === null ? ((editor.getAttributes('link').href as string | undefined) ?? 'https://') : null)} />
      {actions ? <span className="ml-auto flex items-center gap-0.5">{actions}</span> : null}
      {linking !== null ? (
        <form className="flex w-full items-center gap-1.5 pt-1" onSubmit={(e) => { e.preventDefault(); applyLink(linking); }}>
          <input autoFocus type="url" aria-label="Link address" value={linking} onChange={(e) => setLinking(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setLinking(null); editor.commands.focus(); } }}
            className="ui-input min-h-8 flex-1 py-1 text-label" />
          <button type="submit" className="ui-button tap min-h-8 bg-primary px-2.5 text-primary-foreground">Apply</button>
          {active.Link ? <button type="button" onClick={() => applyLink('')} className="ui-button tap min-h-8 px-2.5 text-secondary-foreground hover:bg-hover">Remove</button> : null}
        </form>
      ) : null}
    </div>
  );
}
