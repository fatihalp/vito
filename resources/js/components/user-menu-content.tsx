import { useTranslate } from '@/hooks/use-translate';
import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';
import { type User } from '@/types/user';
import { Link, router, usePage } from '@inertiajs/react';
import { GlobeIcon, LogOut, PaletteIcon, Settings, ShieldCheckIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useBootstrapStore } from '@/stores/bootstrap-store';
import { clearQueryClient } from '@/lib/query-client';
import serverHelper from '@/lib/server-helper';
import siteHelper from '@/lib/site-helper';

interface UserMenuContentProps {
  user: User;
}

export function UserMenuContent({ user }: UserMenuContentProps) {
  const translateText = useTranslate();
  const { locale = 'en' } = usePage().props;
  const cleanup = useMobileNavigation();
  const { theme, setTheme } = useTheme();

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
      <DropdownMenuGroup>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <GlobeIcon className="mr-2 size-4" />
            {translateText('Language')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={String(locale)} onValueChange={(value) => router.post('/settings/profile/locale', { locale: value }, { preserveScroll: true, onSuccess: () => router.flushAll() })}>
              <DropdownMenuRadioItem value="en" lang="en">English</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="tr" lang="tr">Türkçe</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <PaletteIcon className="mr-2 size-4" />
            {translateText('Appearance')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">{translateText('Light')}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">{translateText('Dark')}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">{translateText('System')}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem asChild>
          <Link className="block w-full" href={"/settings/profile"} as="button" prefetch onClick={cleanup}>
            <Settings className="mr-2" />
            {translateText('Settings')}
          </Link>
        </DropdownMenuItem>
        {user.is_admin && (
          <>
            <DropdownMenuItem asChild>
              <Link className="block w-full" href={"/admin/vito"} as="button" prefetch onClick={cleanup}>
                <ShieldCheckIcon className="mr-2" />
                {translateText('Pure Settings')}
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link className="block w-full" method="post" href={"/logout"} as="button" onClick={handleLogout}>
          <LogOut className="mr-2" />
          {translateText('Log out')}
        </Link>
      </DropdownMenuItem>
    </>
  );
}
