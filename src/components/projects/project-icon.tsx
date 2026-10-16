import { Icon, type IconName } from '@/components/icon';
import { PROJECT_ICON_BG } from '@/lib/content-colors';

const PROJECT_ICONS: readonly IconName[] = ['folder', 'board', 'briefcase', 'code', 'megaphone', 'pen', 'globe', 'rocket'];

/** Render only known icon identifiers, with the project's saved color. */
export function ProjectIcon({ project }: { project: { color: string; icon?: string } }) {
  const icon = PROJECT_ICONS.find((name) => name === project.icon) ?? 'folder';
  return <span aria-hidden="true" data-testid="project-icon" data-icon={icon} className={`inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-foreground ${PROJECT_ICON_BG[project.color] ?? 'bg-subtle'}`}><Icon name={icon} className="size-4" /></span>;
}
