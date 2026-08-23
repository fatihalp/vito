import { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import InputError from '@/components/ui/input-error';
import { Site } from '@/types/site';
import { Input } from '@/components/ui/input';
import FieldUpdateDialog from '@/components/field-update-dialog';

export default function WebDirectory({ site, children }: { site: Site; children: ReactNode }) {
  return (
    <FieldUpdateDialog
      title="Update Web Directory"
      description={`The relative path of your website from ${site.path}/`}
      initialValue={site.web_directory || ''}
      fieldName="web_directory"
      routeName="site-settings.update-web-directory"
      routeParams={{ server: site.server_id, site: site.id }}
      trigger={children}
    >
      {(form) => (
        <>
          <Label htmlFor="web_directory">Web Directory</Label>
          <Input
            id="web_directory"
            type="text"
            value={form.data.web_directory}
            placeholder="e.g., public, www, dist (leave empty for root)"
            onChange={(e) => form.setData('web_directory', e.target.value)}
          />
          <InputError message={form.errors.web_directory} />
        </>
      )}
    </FieldUpdateDialog>
  );
}
