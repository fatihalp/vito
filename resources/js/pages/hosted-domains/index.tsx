import { useTranslate } from '@/hooks/use-translate';
import ServerLayout from '@/layouts/server/layout';
import SiteBanners from '@/components/site-banners';
import { Head, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableActionTrigger } from '@/components/table-action-trigger';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarClockIcon, EllipsisVerticalIcon, LoaderCircleIcon, LockIcon, LockOpenIcon, PlusIcon, RefreshCwIcon, ShieldCheckIcon, ShieldOffIcon } from 'lucide-react';
import { router } from '@inertiajs/react';
import { VitoTable } from '@/components/vito-table';
import ErrorIndicator from '@/components/error-indicator';
import { Site } from '@/types/site';
import { HostedDomain } from '@/types/hosted-domain';
import { useDialog } from '@/hooks/use-dialog';
import type { InertiaTableData, CellRenderProps, Row } from '@forjedio/inertia-table-react';

function CertificateCell({ row }: { row: HostedDomain }) {
  const translateText = useTranslate();
  const ssl = row.ssl as { id: number; type: string; domains: string[]; expires_at: string } | null;
  const { ssl_method } = row;
  const { site } = usePage<{ site: Site }>().props;
  const createsSiteSSLs = site.webserver_creates_site_ssls;
  const webserverName = site.webserver.charAt(0).toUpperCase() + site.webserver.slice(1);

  if (ssl_method === 'letsencrypt' && !createsSiteSSLs) {
    return <Badge variant="outline">{webserverName} {translateText("Managed SSL")}</Badge>;
  }

  if (ssl_method === 'letsencrypt' && createsSiteSSLs && ssl?.id) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="cursor-default">
              {translateText("Site Certificate")}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>ID: {ssl.id}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (!ssl) {
    return <span>-</span>;
  }

  const sslDomains = ssl.domains ?? [];

  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant="info">{(ssl.type ?? '').toUpperCase()}</Badge>
      <Badge variant="info">#{ssl.id}</Badge>
      <TooltipProvider>
        {sslDomains.map((domain) => {
          const truncated = domain.length > 20;
          const label = truncated ? domain.slice(0, 20) + '...' : domain;
          return truncated ? (
            <Tooltip key={domain}>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="cursor-default">
                  {label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{domain}</TooltipContent>
            </Tooltip>
          ) : (
            <Badge key={domain} variant="outline">
              {label}
            </Badge>
          );
        })}
      </TooltipProvider>
    </div>
  );
}

export default function HostedDomains() {
  const translateText = useTranslate();
  const page = usePage<{
    server: Server;
    site: Site;
    hostedDomains: InertiaTableData;
    hasSiteSsl: boolean;
  }>();
  const dialog = useDialog();

  const sslLocked = !page.props.site.can_configure_ssl;
  const domainsCount = (page.props.hostedDomains as unknown as { total?: number })?.total ?? page.props.site.counts?.domains;

  return (
    <ServerLayout>
      <Head title={translateText("Domains - :value", { value: page.props.server.name })} />

      <Container>
        <HeaderContainer>
          <Heading
            title={translateText("Domains:value", { value: typeof domainsCount === 'number' && domainsCount > 0 ? ` (${domainsCount})` : '' })}
            description={translateText("Manage domains and SSL assignments for this site")}
          />
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  {page.props.site.ssl_enabled ? <LockIcon /> : <LockOpenIcon />}
                  <EllipsisVerticalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {page.props.site.ssl_enabled ? (
                  <DropdownMenuItem
                    disabled={sslLocked}
                    onClick={() => !sslLocked && router.post(`/servers/${page.props.server.id}/sites/${page.props.site.id}/disable-ssl`)}
                  >
                    <LockOpenIcon />
                    {translateText("Disable SSL")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    disabled={sslLocked}
                    onClick={() => !sslLocked && router.post(`/servers/${page.props.server.id}/sites/${page.props.site.id}/enable-ssl`)}
                  >
                    <LockIcon />
                    {translateText('Enable SSL')}
                  </DropdownMenuItem>
                )}
                {page.props.site.force_ssl ? (
                  <DropdownMenuItem
                    disabled={sslLocked}
                    onClick={() =>
                      !sslLocked && router.post(`/servers/${page.props.server.id}/sites/${page.props.site.id}/settings/toggle-force-ssl`, { enabled: !page.props.site.force_ssl })
                    }
                  >
                    <ShieldOffIcon />
                    {translateText("Disable Force SSL")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    disabled={sslLocked}
                    onClick={() =>
                      !sslLocked && router.post(`/servers/${page.props.server.id}/sites/${page.props.site.id}/settings/toggle-force-ssl`, { enabled: !page.props.site.force_ssl })
                    }
                  >
                    <ShieldCheckIcon />
                    {translateText("Force SSL")}
                  </DropdownMenuItem>
                )}
                {page.props.site.webserver_creates_site_ssls && (
                  <DropdownMenuItem
                    disabled={!page.props.hasSiteSsl}
                    onClick={() =>
                      page.props.hasSiteSsl &&
                      router.post(`/servers/${page.props.server.id}/sites/${page.props.site.id}/domains/renew-ssl`)
                    }
                  >
                    <RefreshCwIcon />
                    {translateText("Force Renew SSL")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.post(`/servers/${page.props.server.id}/sites/${page.props.site.id}/domains/check-expiry`)}
                >
                  <CalendarClockIcon />
                  {translateText("Check SSL Expiry (all)")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => dialog.createHostedDomain.open({ site: page.props.site })}>
              <PlusIcon />
              <span className="hidden lg:block">{translateText('Add Domain')}</span>
            </Button>
          </div>
        </HeaderContainer>

        <SiteBanners site={page.props.site} />

        <VitoTable
          tableData={page.props.hostedDomains}
          cellRenderers={{
            certificate: ({ row }: CellRenderProps) => <CertificateCell row={row as unknown as HostedDomain} />,
          }}
          actions={(row: Row) => {
            const hd = row as unknown as HostedDomain;
            const isPrimary = hd.type === 'primary';
            const isProcessing = hd.status === 'creating' || hd.status === 'updating' || hd.status === 'deleting';

            if (isProcessing) {
              return (
                <div className="flex items-center justify-end gap-2">
                  <ErrorIndicator error={hd.error} label={`Domain "${hd.domain}" error`} />
                  <div className="flex h-8 w-8 items-center justify-center">
                    <LoaderCircleIcon className="text-muted-foreground h-4 w-4 animate-spin" />
                  </div>
                </div>
              );
            }

            const canInstallSsl =
              hd.ssl_method === 'none' &&
              hd.status === 'active' &&
              !sslLocked &&
              (!page.props.site.webserver_allowed_ssl_methods || page.props.site.webserver_allowed_ssl_methods.includes('letsencrypt'));

            return (
              <div className="flex items-center gap-2">
                {canInstallSsl && (
                  <Button variant="outline" size="sm" onClick={() => dialog.editHostedDomain.open({ hostedDomain: hd, installSsl: true })}>
                    <LockIcon />
                    {translateText("Install SSL")}
                  </Button>
                )}
                <ErrorIndicator error={hd.error} label={`Domain "${hd.domain}" error`} />
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <TableActionTrigger />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={() => dialog.editHostedDomain.open({ hostedDomain: hd })}>{translateText('Edit')}</DropdownMenuItem>
                    {hd.ssl_can_check_expiry && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() =>
                            router.post(
                              `/servers/${hd.server_id}/sites/${hd.site_id}/domains/${hd.id}/check-expiry`,
                            )
                          }
                        >
                          <CalendarClockIcon />
                          {translateText("Check SSL Expiry")}
                        </DropdownMenuItem>
                      </>
                    )}
                    {hd.status === 'pending' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() =>
                            router.post(
                              `/servers/${hd.server_id}/sites/${hd.site_id}/domains/${hd.id}/check-dns`,
                            )
                          }
                        >
                          {translateText("Validate")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            dialog.confirm.open({
                              title: 'Force Validate Domain',
                              description: translateText("The domain :value is currently pending because we could not confirm that it resolves to this server. If you force validate this domain, the server configuration will be updated regardless. This may impact your ability to generate an SSL certificate if the domain does not actually point to this server. Are you sure you want to continue?", { value: hd.domain }),
                              variant: 'destructive',
                              confirmLabel: 'Force Validate',
                              method: 'post',
                              url: `/servers/${hd.server_id}/sites/${hd.site_id}/domains/${hd.id}/force-activate`,
                            })
                          }
                        >
                          {translateText("Force Validate")}
                        </DropdownMenuItem>
                      </>
                    )}
                    {!isPrimary && (hd.status === 'active' || hd.status === 'pending') && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() =>
                            router.post(
                              `/servers/${hd.server_id}/sites/${hd.site_id}/domains/${hd.id}/deactivate`,
                            )
                          }
                        >
                          {translateText("Deactivate")}
                        </DropdownMenuItem>
                      </>
                    )}
                    {hd.status === 'inactive' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() =>
                            router.post(
                              `/servers/${hd.server_id}/sites/${hd.site_id}/domains/${hd.id}/reactivate`,
                            )
                          }
                        >
                          {translateText("Reactivate")}
                        </DropdownMenuItem>
                      </>
                    )}
                    {!isPrimary && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() =>
                            dialog.confirm.open({
                              title: 'Delete Domain',
                              description: translateText("Are you sure you want to delete :value?", { value: hd.domain }),
                              variant: 'destructive',
                              confirmLabel: 'Delete',
                              method: 'delete',
                              url: `/servers/${hd.server_id}/sites/${hd.site_id}/domains/${hd.id}`,
                            })
                          }
                        >
                          {translateText('Delete')}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          }}
        />
      </Container>
    </ServerLayout>
  );
}
