import { withQuery } from '@/lib/url';
import { type SharedData } from '@/types';
import { type Server } from '@/types/server';
import { router, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CheckIcon, ChevronsUpDownIcon, PlusIcon, ServerIcon } from 'lucide-react';
import ServerSelect from '@/pages/servers/components/server-select';
import { CommandGroup, CommandItem } from '@/components/ui/command';
import serverHelper from '@/lib/server-helper';

export function ServerSwitch() {
  const page = usePage<SharedData>();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>(page.props.server?.id?.toString() ?? '');

  useEffect(() => {
    setSelected(page.props.server?.id?.toString() ?? '');
  }, [page.props.server?.id]);

  useEffect(() => {
    if (page.props.server) {
      serverHelper.storeServer(page.props.server, page.props.auth.user.id);
    }
  }, [page.props.auth.user.id, page.props.server]);

  const handleServerChange = (value: string, server: Server) => {
    setSelected(value);
    setOpen(false);
    serverHelper.storeServer(server, page.props.auth.user.id);
    router.visit(`/servers/${server.id}`);
  };

  const footer = (
    <CommandGroup>
      <CommandItem
        value="create-server"
        onSelect={() => {
          setOpen(false);
          router.visit("/servers/create");
        }}
        className="gap-0 cursor-pointer"
      >
        <div className="flex items-center">
          <PlusIcon className="size-4" />
          <span className="ml-2">Create new server</span>
        </div>
      </CommandItem>
    </CommandGroup>
  );

  const header = (
    <CommandGroup>
      <CommandItem
        value="all-servers"
        onSelect={() => {
          setSelected('');
          setOpen(false);
          router.visit(withQuery('/servers', { project: page.props.auth.projectScope }));
        }}
      >
        <ServerIcon />
        <span>All Servers</span>
        <CheckIcon className={`ml-auto ${page.props.server ? 'opacity-0' : 'opacity-100'}`} />
      </CommandItem>
    </CommandGroup>
  );

  const trigger = (
    <Button
      variant="ghost"
      className="px-1!"
      role="combobox"
      aria-expanded={open}
      aria-label={`Switch server. Current server: ${page.props.server?.name ?? 'none'}`}
    >
      {page.props.server ? (
        <>
          <ServerIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="hidden max-w-36 truncate sm:flex">{page.props.server?.name}</span>
        </>
      ) : (
        <>
          <ServerIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="hidden sm:flex">Select a server</span>
        </>
      )}
      <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Button>
  );

  return (
    <div className="flex items-center">
      <ServerSelect
        value={selected}
        projectId="all"
        onValueChangeAdvanced={handleServerChange}
        trigger={trigger}
        open={open}
        onOpenChange={setOpen}
        footer={footer}
        header={header}
        showIp={false}
        prefetch
      />
    </div>
  );
}
