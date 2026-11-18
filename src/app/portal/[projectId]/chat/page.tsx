'use client';

import { ChannelPane } from '@/components/chat/channel-pane';
import { usePortal } from '@/lib/portal';

/** The guest's only channel: the project's `shared` one. There is nothing to switch to (§3.6). */
export default function PortalChatPage() {
  const { project } = usePortal();
  return (
    <div className="flex h-full flex-col">
      <ChannelPane
        projectId={project.id}
        kind="shared"
        audience="guest"
        canPost={project.access === 'comment'}
        linkBase={`/portal/${project.id}/chat`}
      />
    </div>
  );
}
