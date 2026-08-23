import { Head, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import ServerLayout from '@/layouts/server/layout';
import SiteBanners from '@/components/site-banners';
import { TriangleAlertIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import DateTime from '@/components/date-time';
import React, { type ReactNode } from 'react';
import { Site } from '@/types/site';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import ChangeBranch from '@/pages/site-settings/components/branch';
import { SourceControl } from '@/types/source-control';
import CopyableBadge from '@/components/copyable-badge';
import ChangePHPVersion from '@/pages/site-settings/components/php-version';
import DeleteSite from '@/pages/site-settings/components/delete-site';
import VHost from '@/pages/site-settings/components/vhost';
import VHostPreview from '@/pages/site-settings/components/vhost-preview';
import ChangeSourceControl from '@/pages/site-settings/components/source-control';
import BasicAuth from '@/pages/site-settings/components/basic-auth';
import StatsToggle from '@/pages/site-settings/components/stats-toggle';
import WebDirectory from './components/web-directory';
import { useDialog } from '@/hooks/use-dialog';

function Field({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 border-b p-3', className)}>
      <span className="shrink-0">{label}</span>
      <div className="flex min-w-0 items-center justify-end gap-2">{children}</div>
    </div>
  );
}

export default function SiteSettings() {
  const dialog = useDialog();
  const page = usePage<{
    server: Server;
    site: Site;
    sourceControl?: SourceControl;
  }>();

  return (
    <ServerLayout>
      <Head title={`Settings - ${page.props.site.domain}`} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title="Settings" description="Here you can manage your site's settings" />
          <div className="flex items-center gap-2">
          </div>
        </HeaderContainer>

        <SiteBanners site={page.props.site} />

        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between gap-2">
            <div className="space-y-2">
              <CardTitle>Site details</CardTitle>
              <CardDescription>Update site details</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="bg-background p-0">
            <div className="grid grid-cols-1 sm:grid-cols-2">
              <Field label="ID">
                <span className="text-muted-foreground">{page.props.site.id}</span>
              </Field>

              <Field label="Status">
                <Badge variant={page.props.site.status_color}>{page.props.site.status}</Badge>
              </Field>

              <Field label="Domain" className="sm:col-span-2">
                <a href={page.props.site.url} target="_blank" className="text-muted-foreground truncate hover:underline">
                  {page.props.site.domain}
                </a>
              </Field>

              <Field label="Type">
                <span className="text-muted-foreground">{page.props.site.type}</span>
              </Field>

              <Field label="Web directory">
                <WebDirectory site={page.props.site}>
                  <Button variant="outline" className="h-6">
                    {page.props.site.web_directory || '/'}
                  </Button>
                </WebDirectory>
              </Field>

              <Field label="Source control">
                {page.props.site.source_control_id ? (
                  <ChangeSourceControl site={page.props.site}>
                    <Button variant="outline" className="h-6">
                      {page.props.sourceControl?.provider}
                    </Button>
                  </ChangeSourceControl>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </Field>

              <Field label="Branch">
                {page.props.site.source_control_id ? (
                  <ChangeBranch site={page.props.site}>
                    <Button variant="outline" className="h-6">
                      {page.props.site.branch}
                    </Button>
                  </ChangeBranch>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </Field>

              <Field label="Repository" className="sm:col-span-2">
                <span className="text-muted-foreground truncate">{page.props.site.repository || '-'}</span>
              </Field>

              <Field label="Path" className="sm:col-span-2">
                <CopyableBadge text={page.props.site.path} />
              </Field>

              <Field label="VHost">
                <VHostPreview site={page.props.site}>
                  <Button variant="outline" className="h-6">
                    View VHost
                  </Button>
                </VHostPreview>
              </Field>

              <Field
                label={
                  <div className="flex items-center gap-2">
                    <span>VHost Template</span>
                    {page.props.site.has_custom_vhost_template && (
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <TriangleAlertIcon className="text-destructive h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent>You are using a custom vhost template</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                }
              >
                <VHost site={page.props.site}>
                  <Button variant="outline" className="h-6">
                    Edit Template
                  </Button>
                </VHost>
              </Field>

              {(page.props.site.webserver === 'nginx' || page.props.site.webserver === 'caddy') && (
                <Field label="Basic Auth">
                  <BasicAuth site={page.props.site}>
                    <Button variant="outline" className="h-6">
                      {page.props.site.basic_auth?.enabled ? `Enabled (${page.props.site.basic_auth.users.length})` : 'Disabled'}
                    </Button>
                  </BasicAuth>
                </Field>
              )}

              {page.props.server.services['log_analysis'] && (
                <Field label="Statistics">
                  <StatsToggle site={page.props.site}>
                    <Button variant="outline" className="h-6">
                      {page.props.site.stats_enabled ? 'Enabled' : 'Disabled'}
                    </Button>
                  </StatsToggle>
                </Field>
              )}

              <Field label="PHP version">
                {page.props.site.php_version ? (
                  <div className="flex items-center gap-2">
                    <ChangePHPVersion site={page.props.site}>
                      <Button variant="outline" className="h-6">
                        {page.props.site.php_version}
                      </Button>
                    </ChangePHPVersion>
                    {page.props.site.supports_php_settings && (
                      <Button
                        variant="outline"
                        className="h-6"
                        aria-label="Configure PHP settings"
                        onClick={() => dialog.phpSettings.open({ site: page.props.site })}
                      >
                        Configure
                      </Button>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </Field>

              <Field label="Created at" className="sm:col-span-2 sm:border-b-0">
                <span className="text-muted-foreground">
                  <DateTime date={page.props.site.created_at} />
                </span>
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/50 overflow-hidden">
          <CardHeader>
            <CardTitle>Delete site</CardTitle>
            <CardDescription>Here you can delete the site.</CardDescription>
          </CardHeader>
          <CardContent className="bg-background">
            <div className="space-y-2 p-4">
              <p>please note that this action is irreversible and will delete all data associated with the site.</p>

              <DeleteSite site={page.props.site}>
                <Button variant="destructive">Delete site</Button>
              </DeleteSite>
            </div>
          </CardContent>
        </Card>
      </Container>
    </ServerLayout>
  );
}
