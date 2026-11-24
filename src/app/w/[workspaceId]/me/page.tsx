import { redirect } from 'next/navigation';

export default async function PersonalSettingsIndex({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  redirect(`/w/${workspaceId}/me/notifications`);
}
