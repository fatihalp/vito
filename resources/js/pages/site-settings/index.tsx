import { Head, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import ServerLayout from '@/layouts/server/layout';
import SiteBanners from '@/components/site-banners';
import { PencilIcon, SlidersHorizontalIcon, TriangleAlertIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DateTime from '@/components/date-time';
import React, { type ReactNode } from 'react';
import { Site } from '@/types/site';
import { Badge } from '@/components/ui/badge';
import ChangeBranch from '@/pages/site-settings/components/branch';
import { SourceControl } from '@/types/source-control';
import CopyableBadge from '@/components/copyable-badge';
import ChangePHPVersion from '@/pages/site-settings/components/php-version';
import DeleteSite from '@/pages/site-settings/components/delete-site';
import VHost from '@/pages/site-settings/components/vhost';
import VHostPreview from '@/pages/site-settings/components/vhost-preview';
import ChangeSourceControl from '@/pages/site-settings/components/source-control';
import AttachSourceControl from '@/pages/site-settings/components/attach-source-control';
import BasicAuth from '@/pages/site-settings/components/basic-auth';
import StatsToggle from '@/pages/site-settings/components/stats-toggle';
import WebDirectory from './components/web-directory';
import { useDialog } from '@/hooks/use-dialog';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="px-3 py-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="bg-background divide-y p-0">{children}</CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-10 grid-cols-[8rem_minmax(0,1fr)] items-center gap-3 px-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Value({ children }: { children: ReactNode }) {
  return <span className="truncate">{children}</span>;
}

function EditButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="outline" size="sm" className="h-6 max-w-full" {...props}>
      <span className="truncate">{children}</span>
      <PencilIcon className="text-muted-foreground size-3" />
    </Button>
  );
}

export default function SiteSettings() {
  const dialog = useDialog();
  const page = usePage<{
    server: Server;
    site: Site;
    sourceControl?: SourceControl;
  }>();
  const site = page.props.site;
  const supportsBasicAuth = site.webserver === 'nginx' || site.webserver === 'caddy';

  return (
    <ServerLayout>
      <Head title={`Settings - ${site.domain}`} />

      <Container>
        <HeaderContainer>
          <Heading title="Settings" description="Manage how this site is built, served and deployed" />
        </HeaderContainer>

        <SiteBanners site={site} />

        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          <Section title="General">
            <Field label="Status">
              <Badge variant={site.status_color}>{site.status}</Badge>
            </Field>
            <Field label="Type">
              <Value>{site.type}</Value>
            </Field>
            <Field label="ID">
              <Value>{site.id}</Value>
            </Field>
            <Field label="User">
              <Value>{site.user}</Value>
            </Field>
            <Field label="Path">
              <CopyableBadge text={site.path} />
            </Field>
            <Field label="Created">
              <DateTime date={site.created_at} />
            </Field>
          </Section>

          <Section title="Git">
            <Field label="Source control">
              {site.source_control_id ? (
                <ChangeSourceControl site={site}>
                  <EditButton>{page.props.sourceControl?.provider}</EditButton>
                </ChangeSourceControl>
              ) : (
                <AttachSourceControl site={site}>
                  <EditButton>Attach</EditButton>
                </AttachSourceControl>
              )}
            </Field>
            <Field label="Repository">
              <Value>{site.repository || '-'}</Value>
            </Field>
            <Field label="Branch">
              {site.source_control_id || site.branch ? (
                <ChangeBranch site={site}>
                  <EditButton>{site.branch}</EditButton>
                </ChangeBranch>
              ) : (
                <Value>-</Value>
              )}
            </Field>
          </Section>

          <Section title="Web server">
            <Field label="Web directory">
              <WebDirectory site={site}>
                <EditButton>{site.web_directory || '/'}</EditButton>
              </WebDirectory>
            </Field>
            <Field
              label={
                <span className="flex items-center gap-1.5">
                  VHost
                  {site.has_custom_vhost_template && (
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <TriangleAlertIcon className="text-destructive size-4" />
                        </TooltipTrigger>
                        <TooltipContent>You are using a custom vhost template</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </span>
              }
            >
              <VHostPreview site={site}>
                <Button variant="outline" size="sm" className="h-6">
                  View
                </Button>
              </VHostPreview>
              <VHost site={site}>
                <EditButton>Template</EditButton>
              </VHost>
            </Field>
            {supportsBasicAuth && (
              <Field label="Basic auth">
                <BasicAuth site={site}>
                  <EditButton>{site.basic_auth?.enabled ? `Enabled (${site.basic_auth.users.length})` : 'Disabled'}</EditButton>
                </BasicAuth>
              </Field>
            )}
            {page.props.server.services['log_analysis'] && (
              <Field label="Statistics">
                <StatsToggle site={site}>
                  <EditButton>{site.stats_enabled ? 'Enabled' : 'Disabled'}</EditButton>
                </StatsToggle>
              </Field>
            )}
            <Field label="PHP">
              {site.php_version ? (
                <>
                  <ChangePHPVersion site={site}>
                    <EditButton>{site.php_version}</EditButton>
                  </ChangePHPVersion>
                  {site.supports_php_settings && (
                    <Button variant="outline" size="sm" className="h-6" onClick={() => dialog.phpSettings.open({ site })}>
                      <SlidersHorizontalIcon className="text-muted-foreground size-3" />
                      Settings
                    </Button>
                  )}
                </>
              ) : (
                <Value>-</Value>
              )}
            </Field>
          </Section>
        </div>

        {!site.type_data?.is_self && (
          <Card className="border-destructive/50 flex-row flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Delete site</span>
              <span className="text-muted-foreground text-sm">Permanently deletes the site and its files from the server. Databases are kept. This cannot be undone.</span>
            </div>
            <DeleteSite site={site}>
              <Button variant="destructive" size="sm">
                Delete site
              </Button>
            </DeleteSite>
          </Card>
        )}
      </Container>
    </ServerLayout>
  );
}
