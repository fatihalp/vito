import { withQuery } from '@/lib/url';
import { type SharedData } from '@/types';
import { type Project } from '@/types/project';
import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckIcon, ChevronsUpDownIcon, Layers3Icon, PlusIcon } from 'lucide-react';
import ProjectForm from '@/pages/projects/components/project-form';
import { ProjectSelect } from '@/components/project-select';
import { CommandGroup, CommandItem } from '@/components/ui/command';

export function ProjectSwitch() {
  const page = usePage<SharedData>();
  const { auth } = page.props;
  const isAllProjects = auth.projectScope === 'all';
  const currentProject = auth.currentProject;
  const selected = isAllProjects ? 'all' : (currentProject?.id.toString() ?? '');
  const [open, setOpen] = useState(false);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const pathname = page.url.split('?')[0];
  const isInsideResource = Boolean(page.props.server || page.props.network);

  const visitScope = (scope: string) => {
    setOpen(false);
    const listPath = pathname.startsWith('/sites') ? '/sites' : '/servers';
    router.visit(withQuery(isInsideResource || scope === 'all' ? listPath : pathname, { project: scope }));
  };

  const handleProjectChange = (_value: string, project: Project) => visitScope(project.id.toString());

  const handleAllProjects = () => visitScope('all');

  const header = (
    <CommandGroup>
      <CommandItem value="all-projects" onSelect={handleAllProjects}>
        <Layers3Icon />
        All Projects
        <CheckIcon className={selected === 'all' ? 'ml-auto opacity-100' : 'ml-auto opacity-0'} />
      </CommandItem>
    </CommandGroup>
  );

  const footer = (
    <CommandGroup>
      <ProjectForm defaultOpen={projectFormOpen} onOpenChange={setProjectFormOpen}>
        <CommandItem
          value="create-project"
          onSelect={() => {
            setProjectFormOpen(true);
          }}
          className="gap-0"
        >
          <div className="flex items-center">
            <PlusIcon size={5} />
            <span className="ml-2">Create new project</span>
          </div>
        </CommandItem>
      </ProjectForm>
    </CommandGroup>
  );

  const trigger = (
    <Button
      variant="ghost"
      className="px-1!"
      role="combobox"
      aria-expanded={open}
      aria-label={`Switch project. Current project: ${isAllProjects ? 'All Projects' : (currentProject?.name ?? 'none')}`}
    >
      <Layers3Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="hidden max-w-36 truncate sm:flex">{isAllProjects ? 'All Projects' : currentProject?.name}</span>
      <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Button>
  );

  return (
    <div className="flex items-center">
      <ProjectSelect
        value={selected}
        onValueChange={handleProjectChange}
        trigger={trigger}
        open={open}
        onOpenChange={setOpen}
        prefetch
        header={header}
        footer={footer}
      />
    </div>
  );
}
