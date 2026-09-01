import { AppSidebar } from '@/components/app-sidebar';
import { AppHeader } from '@/components/app-header';
import { NavGroup, NavItem, SharedData } from '@/types';
import { type CSSProperties, type PropsWithChildren, useCallback, useEffect, useState } from 'react';
import { getStoredSidebarOpen, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { usePage } from '@inertiajs/react';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { type SocketEventData, useSocketEvents, useSocketListener } from '@/hooks/use-socket-events';
import { useBootstrapStore } from '@/stores/bootstrap-store';
import { Button } from '@/components/ui/button';
import { AlertCircleIcon } from 'lucide-react';
import DialogHost from '@/components/dialogs/dialog-host';
import { getQueryClient } from '@/lib/query-client';

export default function Layout({
  children,
  secondNavItems,
  secondNavGroups,
  secondNavTitle,
  secondNavSubtitle,
}: PropsWithChildren<{
  secondNavItems?: NavItem[];
  secondNavGroups?: NavGroup[];
  secondNavTitle?: string;
  secondNavSubtitle?: string;
}>) {
  const page = usePage<SharedData>();
  const queryClient = getQueryClient(page.props.auth.user.id);
  const { status: socketStatus, reconnect: socketReconnect } = useSocketEvents();
  const syncBootstrap = useBootstrapStore((s) => s.syncWithServerVersion);
  const fetchBootstrap = useBootstrapStore((s) => s.fetch);
  const bootstrapConfigsLoaded = useBootstrapStore((s) => s.configs !== null);
  const bootstrapStatus = useBootstrapStore((s) => s.status);
  const serverBootstrapVersion = page.props.bootstrap_version;
  const hasSecondNav = secondNavGroups?.some((group) => group.items.length > 0) ?? !!secondNavItems?.length;
  const [primaryNavOpen, setPrimaryNavOpen] = useState(() => (page.props.site ? false : getStoredSidebarOpen(hasSecondNav)));
  const [secondNavOpen, setSecondNavOpen] = useState(hasSecondNav);

  useEffect(() => {
    if (page.props.site) {
      setPrimaryNavOpen(false);
    } else {
      setPrimaryNavOpen(getStoredSidebarOpen(hasSecondNav));
    }
  }, [hasSecondNav, page.props.site?.id]);

  useEffect(() => {
    setSecondNavOpen(hasSecondNav);
  }, [hasSecondNav]);

  useEffect(() => {
    syncBootstrap(serverBootstrapVersion);
  }, [serverBootstrapVersion, syncBootstrap]);

  useEffect(() => {
    if (socketStatus === 'connected' && useBootstrapStore.getState().status === 'error') {
      syncBootstrap(serverBootstrapVersion);
    }
  }, [socketStatus, serverBootstrapVersion, syncBootstrap]);

  useSocketListener(
    useCallback(
      (event: SocketEventData) => {
        if (event.type === 'bootstrap.invalidated') {
          fetchBootstrap();
        }
      },
      [fetchBootstrap],
    ),
  );

  useEffect(() => {
    if (page.props.flash && page.props.flash.success) {
      toast.success(<div className="flex items-center gap-2">{page.props.flash.success}</div>);
    }
    if (page.props.flash && page.props.flash.error) {
      toast.error(<div className="flex items-center gap-2">{page.props.flash.error}</div>);
    }
    if (page.props.flash && page.props.flash.warning) {
      toast.warning(<div className="flex items-center gap-2">{page.props.flash.warning}</div>);
    }
    if (page.props.flash && page.props.flash.info) {
      toast.info(<div className="flex items-center gap-2">{page.props.flash.info}</div>);
    }
  }, [page.props.flash]);

  const showBootstrapError = bootstrapStatus === 'error' && !bootstrapConfigsLoaded;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider
          open={primaryNavOpen}
          onOpenChange={setPrimaryNavOpen}
          style={
            {
              '--primary-sidebar-width': '9.5rem',
              '--sidebar-width': hasSecondNav && secondNavOpen ? '21.5rem' : '9.5rem',
            } as CSSProperties
          }
        >
          <AppSidebar
            secondNavItems={secondNavItems}
            secondNavGroups={secondNavGroups}
            secondNavTitle={secondNavTitle}
            secondNavSubtitle={secondNavSubtitle}
            secondNavOpen={secondNavOpen}
            onSecondNavOpenChange={setSecondNavOpen}
          />
          <SidebarInset>
            <AppHeader
              socketStatus={socketStatus}
              socketReconnect={socketReconnect}
            />
            <div className="flex flex-1 flex-col">
              {showBootstrapError ? (
                <div className="flex flex-1 items-center justify-center p-6">
                  <div className="flex max-w-md flex-col items-center gap-4 text-center">
                    <AlertCircleIcon className="text-destructive size-8" />
                    <div>
                      <h2 className="text-lg font-semibold">Failed to load application data</h2>
                      <p className="text-muted-foreground mt-1 text-sm">
                        We couldn't reach the server to load configuration. Check your connection and try again.
                      </p>
                    </div>
                    <Button onClick={() => fetchBootstrap()}>Retry</Button>
                  </div>
                </div>
              ) : bootstrapConfigsLoaded ? (
                <>
                  {children}
                  <DialogHost />
                </>
              ) : null}
            </div>
            <Toaster richColors position="bottom-center" />
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
