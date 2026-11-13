import { withQuery } from '@/lib/url';
import { type SharedData } from '@/types';
import { type Site } from '@/types/site';
import { router, useForm, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronsUpDownIcon, GlobeIcon, PlusIcon } from 'lucide-react';
import SiteSelect from '@/pages/sites/components/site-select';
import { CommandGroup, CommandItem } from '@/components/ui/command';
import siteHelper from '@/lib/site-helper';
import { useSidebar } from '@/components/ui/sidebar';

export function SiteSwitch() {
  const page = usePage<SharedData>();
  const { setOpenTransient: setPrimaryNavOpen } = useSidebar();
  const [open, setOpen] = useState(false);
  const currentSite = page.props.site || null;
  const [selected, setSelected] = useState<string>(currentSite?.id?.toString() ?? '');
  const form = useForm();

  useEffect(() => {
    const site = page.props.site || null;
    setSelected(site?.id?.toString() ?? '');
  }, [page.props.site?.id]);

  useEffect(() => {
    if (page.props.site) {
      siteHelper.storeSite(page.props.site, page.props.auth.user.id, page.props.server?.project_id);
    }
  }, [page.props.auth.user.id, page.props.server?.project_id, page.props.site]);

  const handleSiteChange = (value: string, site: Site) => {
    if (!site || !site.id || !site.server_id) {
      setSelected(value);
      setOpen(false);
      return;
    }
    setSelected(value);
    setOpen(false);
    setPrimaryNavOpen(false);
    siteHelper.storeSite(site, page.props.auth.user.id, site.server?.project_id ?? page.props.auth.currentProject?.id);
    form.post(`/servers/${site.server_id}/sites/${site.id}/switch`);
  };

  const footer = (
    <CommandGroup>
      <CommandItem
        value="all-sites"
        onSelect={() => {
          setOpen(false);
          setPrimaryNavOpen(false);
          router.visit(withQuery('/sites', { project: page.props.auth.projectScope }));
        }}
        className="gap-0"
      >
        <div className="flex items-center">
          <GlobeIcon size={16} />
          <span className="ml-2">All Sites</span>
        </div>
      </CommandItem>
      <CommandItem
        value="create-site"
        onSelect={() => {
          setOpen(false);
          setPrimaryNavOpen(false);
          const s = page.props.server?.is_self ? undefined : page.props.server;
          if (s) {
            router.visit(`/servers/${s.id}/sites/create`);
          } else {
            router.visit("/sites/create");
          }
        }}
        className="gap-0 cursor-pointer"
      >
        <div className="flex items-center">
          <PlusIcon size={16} />
          <span className="ml-2">Create new site</span>
        </div>
      </CommandItem>
    </CommandGroup>
  );

  const trigger = (
    <Button
      variant="ghost"
      className="px-1!"
      role="combobox"
      aria-expanded={open}
      aria-label={`Search all sites. Current site: ${currentSite?.domain ?? 'none'}`}
    >
      {currentSite ? (
        <>
          <GlobeIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="hidden max-w-48 truncate sm:flex">{currentSite?.domain}</span>
        </>
      ) : (
        <>
          <GlobeIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="hidden sm:flex">Search sites...</span>
        </>
      )}
      <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Button>
  );

  return (
    <div className="flex items-center">
      <SiteSelect
        currentServerId={page.props.server?.id}
        value={selected}
        onValueChangeAdvanced={handleSiteChange}
        trigger={trigger}
        open={open}
        onOpenChange={setOpen}
        footer={footer}
        prefetch
      />
    </div>
  );
}
