import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { StorageProvider } from '@/types/storage-provider';
import axios from 'axios';
import { useState } from 'react';
import { toast } from 'sonner';
import { LoaderCircleIcon } from 'lucide-react';

export default function TestConnection({ storageProvider }: { storageProvider: StorageProvider }) {
  const [testing, setTesting] = useState(false);

  const test = async () => {
    setTesting(true);
    try {
      const { data } = await axios.post<{ connected: boolean }>(route('storage-providers.test', { storageProvider: storageProvider.id }));
      if (data.connected) {
        toast.success(`Connected: read/write access to "${storageProvider.name}" verified.`);
      } else {
        toast.error(`Could not verify read/write access to "${storageProvider.name}".`);
      }
    } catch {
      toast.error(`Could not verify read/write access to "${storageProvider.name}".`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void test(); }} disabled={testing}>
      {testing && <LoaderCircleIcon className="animate-spin" />}
      Test connection
    </DropdownMenuItem>
  );
}
