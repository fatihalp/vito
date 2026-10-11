import { Head, Link, usePage } from '@inertiajs/react';
import { Site } from '@/types/site';
import ServerLayout from '@/layouts/server/layout';
import SiteBanners from '@/components/site-banners';
import { Server } from '@/types/server';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { PaginatedData } from '@/types';
import { ServerLog } from '@/types/server-log';
import { DataTable } from '@/components/data-table';
import { columns } from '@/pages/server-logs/components/columns';
import { useRealtime } from '@/hooks/use-socket-events';
import { Button } from '@/components/ui/button';

type Page = {
  server: Server;
  site: Site;
  logs: PaginatedData<ServerLog>;
};

export default function ShowSite() {
  const page = usePage<Page>();
  const [logs] = useRealtime<ServerLog>(page.props.logs, 'server-log', { site_id: page.props.site.id });

  return (
    <ServerLayout>
      <Head title={`${page.props.site.domain} - ${page.props.server.name}`} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title="Logs" description="Here you can see your site's logs" />
          {page.props.site.php_version && (
            <Button variant="outline" asChild>
              <Link
                href={route('logs.services', {
                  server: page.props.server.id,
                  key: `site:${page.props.site.id}:laravel`,
                })}
              >
                Laravel Log
              </Link>
            </Button>
          )}
        </HeaderContainer>

        <SiteBanners site={page.props.site} />

        <DataTable columns={columns} paginatedData={logs} searchable />
      </Container>
    </ServerLayout>
  );
}
