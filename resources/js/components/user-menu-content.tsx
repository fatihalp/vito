import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';
import { type User } from '@/types/user';
import { Link, router } from '@inertiajs/react';
import { LogOut, Settings, ShieldCheckIcon } from 'lucide-react';
import AppearanceToggleTab from '@/components/appearance-tabs';
import { useBootstrapStore } from '@/stores/bootstrap-store';
import { clearQueryClient } from '@/lib/query-client';
import serverHelper from '@/lib/server-helper';
import siteHelper from '@/lib/site-helper';

interface UserMenuContentProps {
  user: User;
}

export function UserMenuContent({ user }: UserMenuContentProps) {
  const cleanup = useMobileNavigation();

  const handleLogout = () => {
    cleanup();
    router.flushAll();
    clearQueryClient();
    serverHelper.clearRecentServers(user.id);
    siteHelper.clearRecentSites(user.id);
    useBootstrapStore.getState().clear();
  };

  return (
    <>
      <DropdownMenuLabel className="p-0 font-normal">
        <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
          <UserInfo user={user} showEmail={true} />
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <AppearanceToggleTab />
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem asChild>
          <Link className="block w-full" href={route('settings')} as="button" prefetch onClick={cleanup}>
            <Settings className="mr-2" />
            Settings
          </Link>
        </DropdownMenuItem>
        {user.is_admin && (
          <DropdownMenuItem asChild>
            <Link className="block w-full" href={route('vito-settings')} as="button" prefetch onClick={cleanup}>
              <ShieldCheckIcon className="mr-2" />
              Vito Settings
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link className="block w-full" method="post" href={route('logout')} as="button" onClick={handleLogout}>
          <LogOut className="mr-2" />
          Log out
        </Link>
      </DropdownMenuItem>
    </>
  );
}
