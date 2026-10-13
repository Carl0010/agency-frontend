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
  dismissedAt?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  onboardingState: OnboardingState;
  role: Role;
  subscription: { status: string; trialEndsAt: string | null } | null;
  createdAt: string;
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
  breakdown: { owner: number; admin: number; member: number; invited: number };
}

export interface InvitePreview {
  workspaceName: string;
  inviterName: string | null;
  role: Role;
  email: string;
  needsAccount: boolean;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  clientName: string | null;
  key: string;
  color: string;
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
