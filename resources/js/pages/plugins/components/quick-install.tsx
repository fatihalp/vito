import { useTranslate } from '@/hooks/use-translate';
import { Button } from '@/components/ui/button';
import { useForm, usePage } from '@inertiajs/react';
import { LoaderCircleIcon } from 'lucide-react';
import { Plugin } from '@/types/plugin';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function QuickInstall({ url }: { url: string }) {
  const translateText = useTranslate();
  const form = useForm({
    url: url,
  });

  const page = usePage<{
    plugins: Plugin[];
  }>();

  const isInstalled = page.props.plugins.some((plugin) => plugin.repo === url);

  const submit = () => {
    form.post("/admin/plugins/install/github", {
      onSuccess: () => {},
    });
  };

  return (
    <Tooltip>
      <TooltipTrigger>
        <Button variant="default" onClick={submit} disabled={form.processing || isInstalled}>
          {form.processing && <LoaderCircleIcon className="animate-spin" />}
          {translateText('Install')}
        </Button>
      </TooltipTrigger>
      {isInstalled && <TooltipContent>{translateText("Already Installed")}</TooltipContent>}
    </Tooltip>
  );
}
