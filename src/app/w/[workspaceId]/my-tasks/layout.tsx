import type { ReactNode } from 'react';
import MyTasksLayout from './layout-client';

export default function Layout({ children }: { children: ReactNode }) {
  return <MyTasksLayout>{children}</MyTasksLayout>;
}
