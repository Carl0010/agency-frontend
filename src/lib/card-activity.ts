import type { CardActivity } from './types';

/** A part of an activity line: plain words, or a name to emphasise (a list, a label, a file). */
export type ActivityPart = string | { name: string; color?: string };

const text = (value: unknown, fallback: string) => (typeof value === 'string' && value ? value : fallback);

/**
 * What an activity entry says after the person's name, as parts the screen can style:
 * "moved this card from **To do** to **Doing**". Names are the ones stored with the entry.
 */
export function describeActivity(entry: Pick<CardActivity, 'kind' | 'data'>, formatDate: (iso: string) => string): ActivityPart[] {
  const d = entry.data;
  switch (entry.kind) {
    case 'created': return ['created this card'];
    case 'renamed': return ['renamed this card to ', { name: text(d.title, 'a new title') }];
    case 'due_changed': return typeof d.dueAt === 'string' ? ['set the due date to ', { name: formatDate(d.dueAt) }] : ['removed the due date'];
    case 'due_completed': return ['marked the due date done'];
    case 'due_reopened': return ['reopened the due date'];
    case 'description_edited': return ['edited the description'];
    case 'moved': return ['moved this card from ', { name: text(d.fromListName, 'a list') }, ' to ', { name: text(d.toListName, 'a list') }];
    case 'archived': return ['archived this card'];
    case 'restored': return ['restored this card'];
    case 'assigned': return ['assigned ', { name: text(d.name, 'someone') }];
    case 'unassigned': return ['unassigned ', { name: text(d.name, 'someone') }];
    case 'labelled': return ['added the label ', label(d)];
    case 'unlabelled': return ['removed the label ', label(d)];
    case 'placed': return typeof d.listName === 'string'
      ? ['added this card to ', { name: text(d.projectName, 'a project') }, ' in ', { name: d.listName }]
      : ['added this card to ', { name: text(d.projectName, 'a project') }];
    case 'unplaced': return ['removed this card from ', { name: text(d.projectName, 'a project') }];
    case 'rehomed': return ['moved this card’s home to ', { name: text(d.projectName, 'a project') }];
    case 'attachment_added': return ['attached ', { name: text(d.filename, 'a file') }];
    case 'attachment_deleted': return ['deleted ', { name: text(d.filename, 'a file') }];
  }
}

function label(d: Record<string, unknown>): ActivityPart {
  return { name: text(d.name, 'a label'), ...(typeof d.color === 'string' ? { color: d.color } : {}) };
}
