import { type SharedData } from '@/types';
import { type Project } from '@/types/project';
import { router, useForm, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CheckIcon, ChevronsUpDownIcon, Layers3Icon, PlusIcon } from 'lucide-react';
import { useInitials } from '@/hooks/use-initials';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ProjectForm from '@/pages/projects/components/project-form';
import { ProjectSelect } from '@/components/project-select';
import { CommandGroup, CommandItem } from '@/components/ui/command';

export function ProjectSwitch() {
  const page = usePage<SharedData & { siteScope?: string }>();
  const { auth } = page.props;
  const isAllProjects = page.props.siteScope === 'all';
  const [open, setOpen] = useState(false);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [selected, setSelected] = useState<string>(isAllProjects ? 'all' : (auth.currentProject?.id?.toString() ?? ''));
  const initials = useInitials();
  const form = useForm();

  useEffect(() => {
    setSelected(isAllProjects ? 'all' : (auth.currentProject?.id?.toString() ?? ''));
  }, [auth.currentProject?.id, isAllProjects]);

  const handleProjectChange = (value: string, project: Project) => {
    setSelected(value);
    setOpen(false);
    form.patch(route('projects.switch', { project: project.id }));
  };

  const handleAllProjects = () => {
    setSelected('all');
    setOpen(false);
    router.get(route('sites.all', { project: 'all' }));
  };

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
      aria-label={`Switch project. Current project: ${isAllProjects ? 'All Projects' : (auth.currentProject?.name ?? 'none')}`}
    >
      <Avatar className="size-6 rounded-sm">
        <AvatarFallback className="rounded-sm">{isAllProjects ? 'AP' : initials(auth.currentProject?.name ?? '')}</AvatarFallback>
      </Avatar>
      <span className="hidden max-w-36 truncate sm:flex">{isAllProjects ? 'All Projects' : auth.currentProject?.name}</span>
      <ChevronsUpDownIcon size={5} />
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
