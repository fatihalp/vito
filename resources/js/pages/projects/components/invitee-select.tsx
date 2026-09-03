import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ProjectInvitee } from '@/types/project-user';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { CheckIcon, ChevronsUpDownIcon, UserPlusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function InviteeSelect({
  projectId,
  value,
  onValueChange,
  onCreateUserRequest,
  id,
}: {
  projectId: number;
  value: number | null;
  onValueChange: (user: ProjectInvitee) => void;
  onCreateUserRequest?: (email: string) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<ProjectInvitee | null>(null);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedQuery(query), 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const { data: users = [], isFetching } = useQuery<ProjectInvitee[]>({
    queryKey: ['project-invitees', projectId, debouncedQuery],
    queryFn: async () => {
      const response = await axios.get(route('projects.users.json', { project: projectId, query: debouncedQuery }));
      return response.data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (value === null) {
      setSelectedUser(null);
    } else if (selectedUser && selectedUser.id !== value) {
      const matched = users.find((u) => u.id === value);
      if (matched) {
        setSelectedUser(matched);
      }
    }
  }, [value, selectedUser, users]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {selectedUser ? (
            <span className="truncate">{selectedUser.name} ({selectedUser.email})</span>
          ) : (
            <span className="text-muted-foreground">Select a user...</span>
          )}
          <ChevronsUpDownIcon className="shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search user by name or email..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty className="p-3 text-center text-xs">
              {isFetching ? (
                <span className="text-muted-foreground">Searching...</span>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-muted-foreground">No users found.</span>
                  {onCreateUserRequest && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => {
                        setOpen(false);
                        onCreateUserRequest(query);
                      }}
                    >
                      <UserPlusIcon className="size-3.5" />
                      <span>Create user</span>
                    </Button>
                  )}
                </div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={user.id.toString()}
                  onSelect={() => {
                    setSelectedUser(user);
                    onValueChange(user);
                    setOpen(false);
                  }}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{user.name}</span>
                    <span className="text-muted-foreground truncate text-xs">{user.email}</span>
                  </div>
                  <CheckIcon className={cn('ml-auto', value === user.id ? 'opacity-100' : 'opacity-0')} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
