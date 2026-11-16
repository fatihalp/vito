import { useTranslate } from '@/hooks/use-translate';
import { toast } from 'sonner';
import Container from '@/components/container';
import { DataTable } from '@/components/data-table';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import Layout from '@/layouts/app/layout';
import { ProjectActions } from '@/pages/projects/components/columns';
import { columns as invitationColumns } from '@/pages/projects/components/invitations';
import { useDialog } from '@/hooks/use-dialog';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PaginatedData, SharedData } from '@/types';
import { Project } from '@/types/project';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ChevronDownIcon, CrownIcon, GlobeIcon, MailIcon, PlusIcon, ServerIcon, StarIcon } from 'lucide-react';
import { ProjectUser } from '@/types/project-user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function ProjectCard({ project }: { project: Project }) {
  const translateText = useTranslate();
  const starForm = useForm({ is_starred: project.is_starred });
  const { auth } = usePage<SharedData>().props;
  const members = project.users.filter((user) => user.type === 'user' && Boolean(user.name || user.email));
  const owner = members.find((user) => user.role === 'owner');
  const resources = [
    { label: 'Servers', count: project.servers_count ?? 0, icon: ServerIcon, href: `/servers?project=${project.id}` },
    { label: 'Sites', count: project.sites_count ?? 0, icon: GlobeIcon, href: `/sites?project=${project.id}` },
  ];
  const resourceCount = resources.reduce((total, resource) => total + resource.count, 0);

  return (
    <Collapsible asChild>
      <Card className="min-w-0 overflow-hidden">
        <div className="flex min-h-24 flex-col gap-2 bg-muted/10 p-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <Link href={`/servers?project=${project.id}`} className="flex min-w-0 items-center gap-2 text-sm font-medium hover:underline" title={project.name}>
              {project.role === 'owner' && <CrownIcon className="size-4 shrink-0 text-muted-foreground" />}
              <span className="truncate">{project.name}</span>
            </Link>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`${project.is_starred ? 'Unstar' : 'Star'} ${project.name}`}
                aria-pressed={project.is_starred}
                disabled={starForm.processing}
                onClick={() => {
                  starForm.transform(() => ({ is_starred: !project.is_starred }));
                  starForm.patch(`/settings/projects/${project.id}/star`, {
                    preserveScroll: true,
                    onError: () => toast.error('Could not update starred project.'),
                  });
                }}
              >
                <StarIcon className={project.is_starred ? 'size-4 fill-primary text-primary' : 'text-muted-foreground size-4'} />
              </Button>
              <ProjectActions project={project} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full capitalize">{project.role}</Badge>
            <Badge variant="secondary" className="rounded-full" title={members.map((user) => user.name || user.email).join(', ')}>
              {members.length} {members.length === 1 ? translateText("member") : translateText("members")}
            </Badge>
            {project.role !== 'owner' && owner && (
              <Badge variant="outline" className="max-w-full gap-1 rounded-full">
                <CrownIcon className="size-3 shrink-0" />
                <span className="truncate">{owner.name || owner.email}</span>
              </Badge>
            )}
            {project.id === auth.currentProject?.id && <Badge variant="outline" className="rounded-full">{translateText("Current")}</Badge>}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/50 bg-muted/30 px-3 py-1.5">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="group -ml-2 h-7 gap-2 text-xs" aria-label={translateText("Show resources for :value", { value: project.name })}>
              {resourceCount} {resourceCount === 1 ? translateText("resource") : translateText("resources")}
              <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          {project.monthly_cost && project.monthly_cost.amount > 0 && (
            <span className="text-muted-foreground text-xs tabular-nums">{project.monthly_cost.formatted}</span>
          )}
        </div>
        <CollapsibleContent>
          <div className="flex flex-col divide-y border-t bg-muted/20">
            {resources.map(({ label, count, icon: Icon, href }) => (
              <Link key={label} href={href} className="hover:bg-accent focus-visible:bg-accent flex items-center gap-2 px-3 py-2 text-xs transition-colors focus-visible:outline-none">
                <Icon className="text-muted-foreground size-4" />
                <span>{label}</span>
                <Badge variant="secondary" className="ml-auto tabular-nums">{count}</Badge>
              </Link>
            ))}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function Projects() {
  const translateText = useTranslate();
  const dialog = useDialog();
  const page = usePage<{
    projects: PaginatedData<Project>;
    invitations: PaginatedData<ProjectUser>;
  }>();

  return (
    <Layout>
      <Head title={translateText('Projects')} />

      <Container>
        <div className="flex items-start justify-between">
          <Heading title={translateText('Projects')} />
          <div className="flex items-center gap-2">
            <Button onClick={() => dialog.projectForm.open({})}>
              <PlusIcon />
              {translateText("Create project")}
            </Button>
          </div>
        </div>
        {page.props.invitations.data.length > 0 && (
          <Card id="invitations" className="border-primary/40 bg-primary/5 scroll-mt-16">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <MailIcon className="size-4" />
                </div>
                <div className="flex flex-col gap-1">
                  <CardTitle>{translateText("Project invitations")}</CardTitle>
                  <CardDescription>{translateText("Accept an invitation to add the project to your workspace.")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable columns={invitationColumns} paginatedData={page.props.invitations} className="rounded-none border-0 shadow-none" />
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          {page.props.projects.data.map((project) => <ProjectCard key={project.id} project={project} />)}
          <button
            type="button"
            onClick={() => dialog.projectForm.open({})}
            className="text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted/30 flex min-h-36 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring"
          >
            <PlusIcon className="size-5" />
            {translateText("New project")}
          </button>
        </div>
        {(page.props.projects.links.prev || page.props.projects.links.next) && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground text-sm">{translateText('Page')} {page.props.projects.meta.current_page}</span>
            <div className="flex gap-2">
              {page.props.projects.links.prev && <Button variant="outline" asChild><Link href={page.props.projects.links.prev} preserveScroll>{translateText('Previous')}</Link></Button>}
              {page.props.projects.links.next && <Button variant="outline" asChild><Link href={page.props.projects.links.next} preserveScroll>{translateText('Next')}</Link></Button>}
            </div>
          </div>
        )}
      </Container>
    </Layout>
  );
}
