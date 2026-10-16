/** Response shapes of the NestJS API (`/api/v1`). Mirrors the API's view types. */

export type Role = 'owner' | 'admin' | 'member' | 'guest';
export type MemberStatus = 'invited' | 'active' | 'deactivated';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  timezone: string;
  emailVerified: boolean;
  /** Set once the coach-mark tour was finished or skipped; it never shows again. */
  tourCompletedAt: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface OnboardingState {
  workspaceNamed?: boolean;
  projectCreated?: boolean;
  memberInvited?: boolean;
  importRun?: boolean;
  templateApplied?: string;
  startedEmpty?: boolean;
  dismissedAt?: string;
}

/** Stepper and "Finish setup (n/4)" chip state, computed by the API (§3.5). */
export interface SetupProgress {
  done: number;
  total: number;
  step: number;
  stepsDone: boolean[];
  projectId: string | null;
  completed: boolean;
  dismissed: boolean;
  showChip: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  onboardingState: OnboardingState;
  role: Role;
  subscription: { status: SubscriptionStatus; trialEndsAt: string | null } | null;
  /** null for guests. */
  setup: SetupProgress | null;
  createdAt: string;
}

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid';

export type BillingBanner =
  | { kind: 'trial'; day: 11 | 13; daysLeft: number }
  | { kind: 'grace'; graceEndsAt: string }
  | { kind: 'past_due' }
  | { kind: 'read_only'; reason: 'trial_expired' | 'unpaid' | 'canceled'; dataDeleteAfter: string | null };

/** `GET /workspaces/:id/billing` — owner only. Every number and flag is server-computed (AC18). */
export interface Billing {
  plan: { name: string; amountCents: number; currency: string; interval: string; seatsIncluded: number };
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  nextCharge: { at: string; amountCents: number; currency: string } | null;
  cancelAtPeriodEnd: boolean;
  hasPaymentMethod: boolean;
  dataDeleteAfter: string | null;
  seats: { used: number; included: number; full: boolean; overCap: boolean };
  notice: {
    trialPill: { daysLeft: number; amber: boolean } | null;
    banner: BillingBanner | null;
    readOnly: boolean;
    invitesBlocked: boolean;
  };
  invoices: {
    id: string;
    number: string | null;
    amountCents: number;
    currency: string;
    status: string | null;
    createdAt: string;
    hostedUrl: string | null;
    pdfUrl: string | null;
  }[];
  configured: boolean;
}

export interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  lists: string[];
  cardCount: number;
}

export interface Member {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  status: MemberStatus;
  inviteExpiresAt: string | null;
  joinedAt: string;
}

export interface Seats {
  used: number;
  included: number;
  full: boolean;
  overCap: boolean;
  breakdown: { owner: number; admin: number; member: number; invited: number };
}

export interface InvitePreview {
  workspaceName: string;
  inviterName: string | null;
  role: Role;
  /** Guest invites: the projects being shared. */
  projectNames: string[];
  email: string;
  needsAccount: boolean;
}

export type GuestAccess = 'read' | 'comment';

/** A granted project as the guest portal sees it (§3.6). */
export interface PortalProject {
  id: string;
  workspaceId: string;
  workspaceName: string;
  name: string;
  clientName: string | null;
  key: string;
  color: string;
  defaultBoardId: string;
  access: GuestAccess;
}

/** A guest on a project's guest panel (members only). */
export interface ProjectGuest {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  access: GuestAccess;
  status: 'invited' | 'active';
  grantedBy: { id: string; name: string };
  grantedAt: string;
}

/** What a guest sees of the roster: name and avatar only (AC8). */
export interface RosterEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  clientName: string | null;
  key: string;
  color: string;
  /** Saved icon identifier; optional while older API deployments roll forward. */
  icon?: string;
  defaultBoardId: string;
  archivedAt: string | null;
  createdAt: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  projectId?: string | null;
}

export interface PersonRef {
  id: string;
  name: string;
  avatarUrl: string | null;
  active: boolean;
  /** Comment and message authors: renders the Guest chip (§6.3). */
  guest?: boolean;
}

export interface CardTile {
  id: string;
  listId: string;
  boardId: string;
  projectId: string;
  number: number;
  title: string;
  position: number;
  hasDescription: boolean;
  dueAt: string | null;
  dueCompletedAt: string | null;
  archivedAt: string | null;
  assignees: PersonRef[];
  labels: Label[];
  commentCount: number;
  attachmentCount: number;
  checklistDone: number;
  checklistTotal: number;
}

export interface BoardList {
  id: string;
  name: string;
  position: number;
  cards: CardTile[];
}

export interface Board {
  id: string;
  name: string;
  projectId: string;
  project: {
    id: string;
    name: string;
    clientName: string | null;
    key: string;
    color: string;
    workspaceId: string;
    archivedAt: string | null;
  };
  boards: { id: string; name: string }[] | null;
  lists: BoardList[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  position: number;
  doneAt: string | null;
  doneByUserId: string | null;
}

export interface Checklist {
  id: string;
  title: string;
  position: number;
  items: ChecklistItem[];
}

export interface Attachment {
  id: string;
  kind: 'file' | 'link';
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  scanState: 'pending' | 'clean' | 'blocked';
  uploaded: boolean;
  externalUrl: string | null;
  uploadedBy: { id: string; name: string };
  createdAt: string;
}

export interface CardDetail extends CardTile {
  key: string;
  description: string | null;
  listName: string;
  createdAt: string;
  createdBy: PersonRef;
  checklists: Checklist[];
  attachments: Attachment[];
}

export interface Comment {
  id: string;
  cardId: string;
  parentCommentId: string | null;
  body: string | null;
  author: PersonRef;
  mentionedUserIds: string[];
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

export interface ErrorEnvelope {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// Slice 2: chat, notifications, search
// ---------------------------------------------------------------------------

export type ChannelKind = 'client' | 'internal';

export interface Channel {
  id: string;
  projectId: string;
  kind: ChannelKind;
  name: string;
  lastReadMessageAt: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface MessageAttachment {
  id: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  scanState: 'pending' | 'clean' | 'blocked';
  uploaded: boolean;
}

export interface Message {
  id: string;
  channelId: string;
  projectId: string;
  threadRootId: string | null;
  body: string | null;
  author: PersonRef;
  mentionedUserIds: string[];
  attachments: MessageAttachment[];
  replyCount: number;
  lastReplyAt: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export type NotificationType = 'mention' | 'assignment' | 'due_soon' | 'due_now' | 'new_message' | 'thread_reply';

export interface AppNotification {
  id: string;
  workspaceId: string;
  projectId: string | null;
  type: NotificationType;
  subjectType: 'card' | 'comment' | 'message';
  subjectId: string;
  actorUserId: string | null;
  title: string;
  body: string;
  context: string;
  url: string;
  readAt: string | null;
  createdAt: string;
  fromClient: boolean;
}

export interface NotificationFeed extends Page<AppNotification> {
  unreadCount: number;
}

export interface NotificationPreference {
  type: NotificationType;
  label: string;
  inApp: true;
  email: boolean;
  push: boolean;
}

export type SearchType = 'card' | 'comment' | 'message';

export interface SearchHit {
  type: SearchType;
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  snippet: { text: string; hit: boolean }[];
  author: { id: string; name: string } | null;
  createdAt: string;
  url: string;
  score: number;
}

export interface SearchGroup {
  count: number;
  countCapped: boolean;
  items: SearchHit[];
  nextOffset: number | null;
}

export interface SearchResult {
  q: string;
  fallback: boolean;
  groups: Record<SearchType, SearchGroup>;
}

/* Trello import (§7). Mirrors `imports.service.ts` / `import.runner.ts`. */

export type ImportSource = 'trello_csv' | 'trello_api';
export type ImportStatus = 'pending' | 'running' | 'succeeded' | 'partial' | 'failed';

/** One Trello member on the mapping screen; `userId: null` = unmatched (AC24). */
export interface ImportMemberMatch {
  externalId: string;
  name: string;
  userId: string | null;
  how: 'email' | 'name' | 'manual' | null;
}

/** A §7.4 category. `count: null` = present in Trello but not countable through this source. */
export interface ImportDrop {
  key: string;
  label: string;
  count: number | null;
  breakdown?: Record<string, number>;
  note?: string;
}

export interface ImportPreview {
  source: ImportSource;
  boardName: string | null;
  counts: {
    lists: number;
    cards: number;
    archivedCards: number;
    comments: number;
    labels: number;
    checklists: number;
    attachments: number;
    attachmentsAsFiles: number;
    attachmentsAsLinks: number;
    members: number;
    unmatchedMembers: number;
  };
  summary: string;
  members: ImportMemberMatch[];
  limit: { limit: string; actual: number; max: number; message: string } | null;
  dropped: ImportDrop[];
  notices: string[];
}

export interface ImportTally {
  created: number;
  updated: number;
  skipped: number;
}

export interface ImportStats {
  progress: { totalCards: number; processedCards: number; batchesTotal: number; batchesDone: number; batchesFailed: number };
  counts: {
    lists: ImportTally;
    labels: ImportTally;
    cards: ImportTally & { failed: number; dropped: number };
    checklists: ImportTally;
    checklistItems: ImportTally;
    comments: ImportTally & { archive: number };
    attachments: { files: number; links: number; skipped: number };
    assignees: { assigned: number; unmatched: number };
  };
  dropped: ImportDrop[];
  fieldDrops: { dueDates: number; checklists: number; unmatchedMembers: number; boardDescription: number; titlesTruncated: number };
  notices: string[];
}

export interface ImportJob {
  id: string;
  projectId: string;
  source: ImportSource;
  status: ImportStatus;
  /** Empty until the runner writes its first batch. */
  stats: Partial<ImportStats>;
  error: { code?: string; message?: string } | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface TrelloBoardSummary {
  id: string;
  name: string;
  dateLastActivity: string | null;
}
