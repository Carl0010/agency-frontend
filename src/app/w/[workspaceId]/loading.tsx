import { LoadingSkeleton } from '@/components/skeleton';

export default function WorkspaceLoading() {
  return <LoadingSkeleton variant="cards" label="Loading workspace" className="p-4 sm:p-6" />;
}
