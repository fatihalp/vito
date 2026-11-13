import { useTranslate } from '@/hooks/use-translate';
import { Button } from '@/components/ui/button';
import { DownloadIcon } from 'lucide-react';

export default function ExportVito() {
  const translateText = useTranslate();
  const submit = () => {
    window.open("/admin/vito/export", '_blank');
  };

  return (
    <Button onClick={submit}>
      <DownloadIcon />
      {translateText('Export')}
    </Button>
  );
}
