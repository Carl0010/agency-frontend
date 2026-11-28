import type { ReactNode } from 'react';
import MyWorkLayout from './layout-client';

export default function Layout({ children }: { children: ReactNode }) {
  return <MyWorkLayout>{children}</MyWorkLayout>;
}
