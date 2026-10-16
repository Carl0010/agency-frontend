'use client';
import { useParams } from 'next/navigation';
import { TeamScreen } from '@/components/teams/teams-screen';
export default function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  return <TeamScreen key={teamId} teamId={teamId} />;
}
