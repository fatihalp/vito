import { Head, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import { PaginatedData } from '@/types';
import ServerLayout from '@/layouts/server/layout';
import SiteBanners from '@/components/site-banners';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { ChevronDownIcon, ClockIcon, PlusIcon, ZapIcon } from 'lucide-react';
import Container from '@/components/container';
import { DataTable } from '@/components/data-table';
import { CronJob } from '@/types/cronjob';
import { columns } from '@/pages/cronjobs/components/columns';
import SyncCronJobs from '@/pages/cronjobs/components/sync-cronjobs';
import { Site } from '@/types/site';
import { useDialog } from '@/hooks/use-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CRONJOB_TEMPLATES } from '@/pages/cronjobs/components/form';

export default function CronJobIndex() {
  const page = usePage<{
    server: Server;
    cronjobs: PaginatedData<CronJob>;
    site?: Site;
    sites?: Array<{ id: number; domain: string }>;
  }>();
  const dialog = useDialog();

  return (
    <ServerLayout>
      <Head title={`Cron jobs - ${page.props.server.name}`} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading
            title="Cron jobs"
            description={page.props.site ? `Manage scheduled tasks and cron jobs for ${page.props.site.domain}` : "Manage server's cron jobs"}
          />
          <div className="flex items-center gap-2">
            <SyncCronJobs server={page.props.server} />
            <DropdownMenu>
              <div className="flex items-center rounded-md shadow-xs">
                <Button
                  className="border-primary-foreground/20 rounded-r-none border-r"
                  onClick={() => dialog.cronjobForm.open({ serverId: page.props.server.id, site: page.props.site })}
                >
                  <PlusIcon />
                  <span className="hidden lg:block">Create</span>
                </Button>
                <DropdownMenuTrigger asChild>
                  <Button className="rounded-l-none px-2" aria-label="Quick add presets">
                    <ChevronDownIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </div>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs">Quick Add (Laravel)</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {CRONJOB_TEMPLATES.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onSelect={() =>
                      dialog.cronjobForm.open({
                        serverId: page.props.server.id,
                        site: page.props.site,
                        templateId: t.id,
                      })
                    }
                  >
                    <div className="flex flex-col">
                      <span className="flex items-center gap-1.5 text-xs font-medium">
                        {t.label}
                        {t.isOfficial && <span className="bg-primary/10 py-0.2 text-primary rounded px-1 text-[9px] font-semibold">Official</span>}
                      </span>
                      <span className="text-muted-foreground line-clamp-1 font-mono text-[10px]">{t.description}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </HeaderContainer>

        {page.props.site && <SiteBanners site={page.props.site} />}

        {page.props.cronjobs.data.length === 0 && (
          <div className="bg-muted/20 mb-6 flex flex-col gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ClockIcon className="text-primary h-4 w-4" />
                <h4 className="text-sm font-semibold">Laravel Task Scheduler</h4>
                <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">Recommended</span>
              </div>
              <p className="text-muted-foreground text-xs">
                Run scheduled artisan commands seamlessly by adding Laravel's official scheduler (
                <code className="font-mono text-[11px]">* * * * * php artisan schedule:run</code>).
              </p>
            </div>
            <Button
              size="sm"
              onClick={() =>
                dialog.cronjobForm.open({
                  serverId: page.props.server.id,
                  site: page.props.site,
                  templateId: 'laravel-scheduler',
                })
              }
              className="shrink-0"
            >
              <ZapIcon className="mr-1 h-3.5 w-3.5" />
              Quick Add Scheduler
            </Button>
          </div>
        )}

        <DataTable columns={columns(page.props.site, page.props.sites)} paginatedData={page.props.cronjobs} />
      </Container>
    </ServerLayout>
  );
}
