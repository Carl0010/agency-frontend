'use client';

import { createContext, useContext } from 'react';
import type { PortalProject } from './types';

/** The guest portal's current project and the guest's other granted projects (§3.6). */
export interface PortalValue {
  project: PortalProject;
  projects: PortalProject[];
}

export const PortalContext = createContext<PortalValue | null>(null);

export function usePortal(): PortalValue {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal outside the portal layout');
  return ctx;
}

export const portalProjectsKey = ['portal-projects'] as const;
