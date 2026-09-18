import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import React from 'react';
import { SelectTriggerProps } from '@radix-ui/react-select';
import { StorageProvider } from '@/types/storage-provider';
import ConnectStorageProvider from '@/pages/storage-providers/components/connect-storage-provider';
import { Button } from '@/components/ui/button';
import { WifiIcon } from 'lucide-react';

export default function StorageProviderSelect({
  value,
  onValueChange,
  excludeId,
  filter,
  ...props
}: {
  value: string;
  onValueChange: (value: string) => void;
  excludeId?: string;
  filter?: (storageProvider: StorageProvider) => boolean;
} & SelectTriggerProps) {
  const query = useQuery<StorageProvider[]>({
    queryKey: ['storageProvider'],
    queryFn: async () => {
      return (await axios.get(route('storage-providers.json'))).data;
    },
  });

  const options = (query.data ?? [])
    .filter((storageProvider) => storageProvider.id.toString() !== excludeId)
    .filter((storageProvider) => (filter ? filter(storageProvider) : true));

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={onValueChange} disabled={query.isFetching}>
        <SelectTrigger {...props}>
          <SelectValue placeholder={query.isFetching ? 'Loading...' : 'Select a provider'} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {query.isSuccess &&
              options.map((storageProvider: StorageProvider) => (
                <SelectItem key={`db-${storageProvider.name}`} value={storageProvider.id.toString()}>
                  {storageProvider.name}
                </SelectItem>
              ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <ConnectStorageProvider onProviderAdded={() => query.refetch()}>
        <Button variant="outline">
          <WifiIcon />
        </Button>
      </ConnectStorageProvider>
    </div>
  );
}
