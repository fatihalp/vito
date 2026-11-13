import { useTranslate } from '@/hooks/use-translate';
import { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import InputError from '@/components/ui/input-error';
import { Site } from '@/types/site';
import { Input } from '@/components/ui/input';
import FieldUpdateDialog from '@/components/field-update-dialog';

export default function WebDirectory({ site, children }: { site: Site; children: ReactNode }) {
  const translateText = useTranslate();
  return (
    <FieldUpdateDialog
      title={translateText("Update Web Directory")}
      description={translateText("The relative path of your website from :value/", { value: site.path })}
      initialValue={site.web_directory || ''}
      fieldName="web_directory"
      url={`/servers/${site.server_id}/sites/${site.id}/settings/web-directory`}
      trigger={children}
    >
      {(form) => (
        <>
          <Label htmlFor="web_directory">{translateText("Web Directory")}</Label>
          <Input
            id="web_directory"
            type="text"
            value={form.data.web_directory}
            placeholder={translateText("e.g., public, www, dist (leave empty for root)")}
            onChange={(e) => form.setData('web_directory', e.target.value)}
          />
          <InputError message={form.errors.web_directory} />
        </>
      )}
    </FieldUpdateDialog>
  );
}
