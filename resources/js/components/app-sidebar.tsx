import { NavUser } from '@/components/nav-user';
import { cn, currentPath } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { type NavGroup, type NavItem, SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import {
  ChevronRightIcon,
  CloudUploadIcon,
  CogIcon,
  Globe,
  LayoutDashboardIcon,
  LogsIcon,
  MousePointerClickIcon,
  NetworkIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  ServerIcon,
  UsersIcon,
  WorkflowIcon,
} from 'lucide-react';
import AppLogo from './app-logo';
import { Icon } from '@/components/icon';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import React, { useRef, useState } from 'react';
import RecentServersFlyout from '@/components/recent-servers-flyout';
import RecentSitesNavFlyout from '@/components/recent-sites-nav-flyout';

function NavFlyout({ children, content }: { children: React.ReactNode; content: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setOpen(true), 120);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setOpen(false), 200);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="w-full">
        <PopoverAnchor asChild>
          <div className="w-full">{children}</div>
        </PopoverAnchor>
      </div>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-72 p-2 shadow-xl border bg-popover text-popover-foreground z-50 rounded-xl"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div onClick={() => setOpen(false)}>{content}</div>
      </PopoverContent>
    </Popover>
  );
}

export function AppSidebar({
  secondNavItems,
  secondNavGroups,
  secondNavTitle,
  secondNavSubtitle,
  secondNavOpen = true,
  onSecondNavOpenChange,
}: {
  secondNavItems?: NavItem[];
  secondNavGroups?: NavGroup[];
  secondNavTitle?: string;
  secondNavSubtitle?: string;
  secondNavOpen?: boolean;
  onSecondNavOpenChange?: (open: boolean) => void;
}) {
  const page = usePage<SharedData>();
  const navGroups = secondNavGroups ?? [{ title: '', items: secondNavItems ?? [] }];
  const hasSecondNav = navGroups.some((group) => group.items.length > 0);

  const currentProject = page.props.auth?.currentProject;
  const serversCount = currentProject?.servers_count;
  const sitesCount = currentProject?.sites_count;

  const mainNavItems: NavItem[] = [
    {
      title: 'Overview',
      href: route('overview'),
      onlyActivePath: route('overview'),
      icon: LayoutDashboardIcon,
    },
    {
      title: 'Networks',
      href: route('networks'),
      icon: NetworkIcon,
    },
    {
      title: 'Servers',
      href: route('servers'),
      icon: ServerIcon,
      badge: serversCount,
      flyoutContent: <RecentServersFlyout />,
    },
    {
      title: 'Sites',
      href: route('sites.all', { project: 'all' }),
      onlyActivePath: route('sites.all'),
      icon: MousePointerClickIcon,
      badge: sitesCount,
      flyoutContent: <RecentSitesNavFlyout />,
    },
    {
      title: 'Backups',
      href: route('backups.all'),
      icon: CloudUploadIcon,
    },
    {
      title: 'Workflows',
      href: route('workflows'),
      icon: WorkflowIcon,
    },
    {
      title: 'Domains',
      href: route('domains'),
      icon: Globe,
    },
    {
      title: 'Users',
      href: route('users'),
      onlyActivePath: route('users'),
      icon: UsersIcon,
      hidden: !page.props.auth.user?.is_admin,
    },
    {
      title: 'Settings',
      href: route('settings'),
      icon: CogIcon,
    },
  ];

  const footerNavItems: NavItem[] = [
    {
      title: 'Vito Logs',
      href: route('log-viewer.index'),
      icon: LogsIcon,
      hidden: !page.props.auth.user?.is_admin,
    },
  ];

  return (
    <Sidebar
      id="app-navigation"
      collapsible={hasSecondNav ? 'primary' : 'icon'}
      className="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row"
    >
      <Sidebar
        collapsible="none"
        className={cn(
          'h-auto border-r transition-[width] duration-200 ease-linear md:w-(--primary-sidebar-width)! md:group-data-[state=collapsed]:w-[calc(var(--sidebar-width-icon)_+_1px)]!',
          secondNavOpen ? 'w-[calc(var(--sidebar-width-icon)_+_1px)]!' : 'w-full!',
        )}
      >
        <SidebarHeader className="min-h-12 justify-center border-b">
          <div className="flex items-center justify-between gap-2 group-data-[state=collapsed]:justify-center">
            <Link
              href={route('overview')}
              prefetch
              className="flex min-w-0 items-center gap-2 group-data-[state=collapsed]:hidden"
              aria-label={`Vito ${page.props.version}`}
            >
              <AppLogo />
              <span className="truncate font-semibold">Vito</span>
            </Link>
            <div className="flex shrink-0 items-center gap-1">
              {hasSecondNav && !secondNavOpen && onSecondNavOpenChange && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 group-data-[state=collapsed]:hidden"
                  aria-label="Show contextual navigation"
                  aria-controls="context-navigation"
                  aria-expanded={false}
                  onClick={() => onSecondNavOpenChange(true)}
                >
                  <PanelLeftOpenIcon />
                </Button>
              )}
              <SidebarTrigger aria-label="Toggle main navigation" aria-controls="app-navigation" />
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="md:px-0">
              <SidebarMenu>
                {mainNavItems.map((item) => (
                  <SidebarMenuItem key={`${item.title}-${item.href}`}>
                    <SidebarMenuButton
                      asChild
                      isActive={item.onlyActivePath ? currentPath() === item.onlyActivePath : window.location.href.startsWith(item.href)}
                      tooltip={item.title}
                      hidden={item.hidden}
                    >
                      {item.external ? (
                        <a href={item.href} target="_blank">
                          {item.icon && <item.icon />}
                          <span>{item.title}</span>
                        </a>
                      ) : (
                        <Link href={item.href}>
                          {item.icon && <item.icon />}
                          <span>{item.title}</span>
                        </Link>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="hidden md:flex">
          <SidebarMenu>
            {footerNavItems.map((item) => (
              <SidebarMenuItem key={`${item.title}-${item.href}`} hidden={item.hidden}>
                <SidebarMenuButton asChild tooltip={item.title}>
                  <a href={item.href} target="_blank" rel="noopener noreferrer">
                    {item.icon && <Icon iconNode={item.icon} />}
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <NavUser />
        </SidebarFooter>
      </Sidebar>

      {}
      {}
      {}
      {hasSecondNav && (
        <Sidebar
          id="context-navigation"
          collapsible="none"
          aria-hidden={!secondNavOpen}
          className={cn('flex flex-1', !secondNavOpen && 'hidden')}
        >
          <SidebarHeader className="min-h-12 justify-center border-b px-3 py-2">
            <div className="flex min-w-0 items-center justify-between gap-2">
              {secondNavTitle && (
                <div className="min-w-0">
                  {secondNavSubtitle && (
                    <span className="text-muted-foreground block text-[10px] font-medium tracking-wider uppercase">{secondNavSubtitle}</span>
                  )}
                  <span className="truncate text-sm font-semibold" title={secondNavTitle}>
                    {secondNavTitle}
                  </span>
                </div>
              )}
              {onSecondNavOpenChange && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  aria-label="Hide contextual navigation"
                  aria-controls="context-navigation"
                  aria-expanded={secondNavOpen}
                  onClick={() => onSecondNavOpenChange(false)}
                >
                  <PanelLeftCloseIcon />
                </Button>
              )}
            </div>
          </SidebarHeader>
          <SidebarContent>
            {navGroups.map((navGroup) => (
              <SidebarGroup key={navGroup.title || 'navigation'}>
                {navGroup.title && <SidebarGroupLabel>{navGroup.title}</SidebarGroupLabel>}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navGroup.items.map((item) => {
                    const isActive = item.onlyActivePath ? currentPath() === item.onlyActivePath : window.location.href.startsWith(item.href);

                    if (item.children && item.children.length > 0) {
                      const groupActive =
                        isActive ||
                        item.children.some((childItem) =>
                          childItem.hidden
                            ? false
                            : childItem.onlyActivePath
                              ? currentPath() === childItem.onlyActivePath
                              : window.location.href.startsWith(childItem.href),
                        );

                      return (
                        <Collapsible key={`${item.title}-${item.href}-${groupActive}`} defaultOpen={groupActive} className="group/collapsible">
                          <SidebarMenuItem>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton isActive={groupActive} disabled={item.isDisabled || false} hidden={item.hidden}>
                                {item.icon && <item.icon />}
                                <span>{item.title}</span>
                                <ChevronRightIcon className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <SidebarMenuSub>
                                {item.children.map((childItem) => (
                                  <SidebarMenuSubItem key={`${childItem.title}-${childItem.href}`} hidden={childItem.hidden}>
                                    <SidebarMenuButton
                                      asChild
                                      isActive={
                                        childItem.onlyActivePath
                                          ? currentPath() === childItem.onlyActivePath
                                          : window.location.href.startsWith(childItem.href)
                                      }
                                    >
                                      {childItem.external ? (
                                        <a href={childItem.href} target="_blank">
                                          {childItem.icon && <childItem.icon />}
                                          <span>{childItem.title}</span>
                                        </a>
                                      ) : (
                                        <Link href={childItem.href}>
                                          {childItem.icon && <childItem.icon />}
                                          <span>{childItem.title}</span>
                                        </Link>
                                      )}
                                    </SidebarMenuButton>
                                  </SidebarMenuSubItem>
                                ))}
                              </SidebarMenuSub>
                            </CollapsibleContent>
                          </SidebarMenuItem>
                        </Collapsible>
                      );
                    }

                    if (item.flyoutContent) {
                      return (
                        <SidebarMenuItem key={`${item.title}-${item.href}`} hidden={item.hidden}>
                          <NavFlyout content={item.flyoutContent}>
                            <SidebarMenuButton isActive={isActive} asChild>
                              {item.external ? (
                                <a href={item.href} target="_blank" className="flex items-center w-full">
                                  {item.icon && <item.icon />}
                                  <span className="truncate">{item.title}</span>
                                  {item.badge !== undefined && (
                                    <span className="ml-auto text-[11px] font-mono font-medium text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded-md group-data-[collapsible=icon]:hidden">
                                      {item.badge}
                                    </span>
                                  )}
                                </a>
                              ) : (
                                <Link
                                  href={item.isDisabled ? '#' : item.href}
                                  disabled={item.isDisabled || false}
                                  className={cn('flex items-center w-full', item.isDisabled && 'pointer-events-none opacity-50')}
                                >
                                  {item.icon && <item.icon />}
                                  <span className="truncate">{item.title}</span>
                                  {item.badge !== undefined && (
                                    <span className="ml-auto text-[11px] font-mono font-medium text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded-md group-data-[collapsible=icon]:hidden">
                                      {item.badge}
                                    </span>
                                  )}
                                </Link>
                              )}
                            </SidebarMenuButton>
                          </NavFlyout>
                        </SidebarMenuItem>
                      );
                    }

                    return (
                      <SidebarMenuItem key={`${item.title}-${item.href}`} hidden={item.hidden}>
                        <SidebarMenuButton isActive={isActive} asChild>
                          {item.external ? (
                            <a href={item.href} target="_blank" className="flex items-center w-full">
                              {item.icon && <item.icon />}
                              <span className="truncate">{item.title}</span>
                              {item.badge !== undefined && (
                                <span className="ml-auto text-[11px] font-mono font-medium text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded-md group-data-[collapsible=icon]:hidden">
                                  {item.badge}
                                </span>
                              )}
                            </a>
                          ) : (
                            <Link
                              href={item.isDisabled ? '#' : item.href}
                              disabled={item.isDisabled || false}
                              className={cn('flex items-center w-full', item.isDisabled && 'pointer-events-none opacity-50')}
                            >
                              {item.icon && <item.icon />}
                              <span className="truncate">{item.title}</span>
                              {item.badge !== undefined && (
                                <span className="ml-auto text-[11px] font-mono font-medium text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded-md group-data-[collapsible=icon]:hidden">
                                  {item.badge}
                                </span>
                              )}
                            </Link>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
        </Sidebar>
      )}
    </Sidebar>
  );
}
