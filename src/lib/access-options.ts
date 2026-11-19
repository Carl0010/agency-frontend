import type { GuestAccess, MemberProjectAccess } from './types';

/** Choices for the access and role pickers, worded as in the backend's ubiquitous language. */
export interface Choice<T extends string> { value: T; label: string }

export const GUEST_ACCESS: Choice<GuestAccess>[] = [
  { value: 'comment', label: 'Can comment' },
  { value: 'read', label: 'Can view' },
];

export const PROJECT_ACCESS: Choice<MemberProjectAccess>[] = [
  { value: 'edit', label: 'Can edit' },
  { value: 'admin', label: 'Project admin' },
];

export const TEAM_ROLES: Choice<'member' | 'admin'>[] = [
  { value: 'member', label: 'Team member' },
  { value: 'admin', label: 'Team admin' },
];

export const WORKSPACE_ROLES: Choice<'member' | 'admin'>[] = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
];
