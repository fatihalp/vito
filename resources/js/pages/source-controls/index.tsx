import SettingsLayout from '@/layouts/settings/layout';
import { Head, router, usePage } from '@inertiajs/react';
import Container from '@/components/container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ConnectSourceControl from '@/pages/source-controls/components/connect-source-control';
import { DataTable } from '@/components/data-table';
import { columns } from '@/pages/source-controls/components/columns';
import { SourceControl } from '@/types/source-control';
import { Project } from '@/types/project';
import { User } from '@/types/user';
import { PaginatedData, SharedData } from '@/types';
import { GithubIcon, RotateCcwIcon, SearchIcon } from 'lucide-react';
import { useConfigs } from '@/stores/bootstrap-store';
import { useCallback, useEffect, useState } from 'react';

type Page = SharedData & {
  sourceControls: PaginatedData<SourceControl>;
  projects: Project[];
  users: User[];
  providers: { value: string; label: string }[];
  filters: {
    search: string;
    provider: string;
    project_id: string;
    user_id: string;
  };
};

export default function SourceControls() {
  const page = usePage<Page>();
  const configs = useConfigs()!;
  const githubAppInstalled = configs.github_app.installed;

  const [search, setSearch] = useState(page.props.filters?.search || '');
  const [provider, setProvider] = useState(page.props.filters?.provider || 'all');
  const [projectId, setProjectId] = useState(page.props.filters?.project_id || 'all');
  const [userId, setUserId] = useState(page.props.filters?.user_id || 'all');

  const updateFilters = useCallback(
    (newFilters: { search?: string; provider?: string; project_id?: string; user_id?: string }) => {
      const url = new URL(window.location.href);
      const params = url.searchParams;

      const merged = {
        search,
        provider,
        project_id: projectId,
        user_id: userId,
        ...newFilters,
      };

      if (merged.search) {
        params.set('search', merged.search);
      } else {
        params.delete('search');
      }

      if (merged.provider && merged.provider !== 'all') {
        params.set('provider', merged.provider);
      } else {
        params.delete('provider');
      }

      if (merged.project_id && merged.project_id !== 'all') {
        params.set('project_id', merged.project_id);
      } else {
        params.delete('project_id');
      }

      if (merged.user_id && merged.user_id !== 'all') {
        params.set('user_id', merged.user_id);
      } else {
        params.delete('user_id');
      }

      params.set('sourceControlsPage', '1');
      params.set('page', '1');

      router.get(url.toString(), {}, { preserveState: true, preserveScroll: true });
    },
    [search, provider, projectId, userId],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (page.props.filters?.search || '')) {
        updateFilters({ search });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, updateFilters, page.props.filters?.search]);

  const hasActiveFilters = search !== '' || provider !== 'all' || projectId !== 'all' || userId !== 'all';

  const resetFilters = () => {
    setSearch('');
    setProvider('all');
    setProjectId('all');
    setUserId('all');
    updateFilters({ search: '', provider: 'all', project_id: 'all', user_id: 'all' });
  };

  return (
    <SettingsLayout>
      <Head title="Source Controls" />
      <Container className="max-w-5xl">
        <div className="flex items-start justify-between">
          <Heading title="Source Controls" description="Here you can manage all of the source control connections" />
          <div className="flex items-center gap-2">
            {githubAppInstalled && (
              <a href={route('github-app.install')} title="Install GitHub App on an organization">
                <Button variant="outline" size="icon">
                  <GithubIcon />
                  <span className="sr-only">Install GitHub App on an organization</span>
                </Button>
              </a>
            )}
            <ConnectSourceControl>
              <Button>Connect</Button>
            </ConnectSourceControl>
          </div>
        </div>

        <div className="my-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <SearchIcon className="text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 size-4" />
            <Input
              type="search"
              placeholder="Search source controls..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <Select
            value={provider}
            onValueChange={(val) => {
              setProvider(val);
              updateFilters({ provider: val });
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Providers" />
            </SelectTrigger>
            <SelectContent>
              {page.props.providers?.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={projectId}
            onValueChange={(val) => {
              setProjectId(val);
              updateFilters({ project_id: val });
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              <SelectItem value="global">Global Only</SelectItem>
              {page.props.projects?.map((prj) => (
                <SelectItem key={prj.id} value={String(prj.id)}>
                  {prj.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {page.props.users && page.props.users.length > 1 && (
            <Select
              value={userId}
              onValueChange={(val) => {
                setUserId(val);
                updateFilters({ user_id: val });
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {page.props.users.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 px-2 text-muted-foreground hover:text-foreground">
              <RotateCcwIcon className="mr-1.5 size-3.5" />
              Reset
            </Button>
          )}
        </div>

        <DataTable columns={columns} paginatedData={page.props.sourceControls} />
      </Container>
    </SettingsLayout>
  );
}
