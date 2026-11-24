import { redirect } from 'next/navigation';

/** Notification preferences are personal: they moved to Your settings. Old links still land there. */
export default async function LegacyNotificationSettings({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  redirect(`/w/${workspaceId}/me/notifications`);
}
