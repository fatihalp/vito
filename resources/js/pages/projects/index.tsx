import Container from '@/components/container';
import { DataTable } from '@/components/data-table';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import Layout from '@/layouts/app/layout';
import { columns as projectColumns } from '@/pages/projects/components/columns';
import { columns as invitationColumns } from '@/pages/projects/components/invitations';
import ProjectForm from '@/pages/projects/components/project-form';
import { PaginatedData } from '@/types';
import { Project } from '@/types/project';
import { Head, usePage } from '@inertiajs/react';
import { BookOpenIcon, MailIcon, PlusIcon } from 'lucide-react';
import { ProjectUser } from '@/types/project-user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Projects() {
  const page = usePage<{
    projects: PaginatedData<Project>;
    invitations: PaginatedData<ProjectUser>;
  }>();

  return (
    <Layout>
      <Head title="Projects" />

      <Container className="max-w-5xl">
        <div className="flex items-start justify-between">
          <Heading title="Projects" />
          <div className="flex items-center gap-2">
            <ProjectForm>
              <Button>
                <PlusIcon />
                Create project
              </Button>
            </ProjectForm>
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
                  <CardTitle>Project invitations</CardTitle>
                  <CardDescription>Accept an invitation to add the project to your workspace.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable columns={invitationColumns} paginatedData={page.props.invitations} className="rounded-none border-0 shadow-none" />
            </CardContent>
          </Card>
        )}

        <DataTable columns={projectColumns} paginatedData={page.props.projects} />
      </Container>
    </Layout>
  );
}
