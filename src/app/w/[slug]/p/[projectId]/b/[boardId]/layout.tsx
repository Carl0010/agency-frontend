import type { ReactNode } from 'react';

/** The board stays mounted under the card modal (`@modal`), which intercepts `c/[cardId]` on soft navigation. */
export default function BoardLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
