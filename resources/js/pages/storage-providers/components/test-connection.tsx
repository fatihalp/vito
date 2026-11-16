import { useTranslate } from '@/hooks/use-translate';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { StorageProvider } from '@/types/storage-provider';
import axios from 'axios';
import { useState } from 'react';
import { toast } from 'sonner';
import { LoaderCircleIcon } from 'lucide-react';
import { requestErrorMessage } from '@/lib/request-error';

export default function TestConnection({ storageProvider }: { storageProvider: StorageProvider }) {
  const translateText = useTranslate();
  const [testing, setTesting] = useState(false);

  const test = async () => {
    setTesting(true);
    try {
      const { data } = await axios.post<{ connected: boolean; error?: string }>(`/settings/storage-providers/${storageProvider.id}/test`);
      if (data.connected) {
        toast.success(`Connected: read/write access to "${storageProvider.name}" verified.`);
      } else {
        toast.error(data.error || `Could not verify read/write access to "${storageProvider.name}".`);
      }
    } catch (error) {
      toast.error(requestErrorMessage(error, `Could not verify read/write access to "${storageProvider.name}".`));
    } finally {
      setTesting(false);
    }
  };

  return (
    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void test(); }} disabled={testing}>
      {testing && <LoaderCircleIcon className="animate-spin" />}
      {translateText("Test connection")}
    </DropdownMenuItem>
  );
}
