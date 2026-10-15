import type { ReactNode } from 'react';

/** Keep the board mounted beside the card inspector in the intercepted @modal slot. */
export default function BoardLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return (
    <div className="board-split-view relative flex h-full min-h-0 min-w-0 overflow-hidden">
      <div id="board-view" tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-y-auto focus:outline-none">
        {children}
      </div>
      {modal}
    </div>
  );
}
