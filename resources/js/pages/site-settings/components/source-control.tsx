import { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import InputError from '@/components/ui/input-error';
import { Site } from '@/types/site';
import SourceControlSelect from '@/pages/source-controls/components/source-control-select';
import FieldUpdateDialog from '@/components/field-update-dialog';

export default function ChangeSourceControl({ site, children }: { site: Site; children: ReactNode }) {
  return (
    <FieldUpdateDialog
      title="Change source control"
      description="sr-only"
      initialValue={site.source_control_id?.toString() || ''}
      fieldName="source_control"
      routeName="site-settings.update-source-control"
      routeParams={{ server: site.server_id, site: site.id }}
      trigger={children}
    >
      {(form) => (
        <>
          <Label htmlFor="source_control">Source control</Label>
          <SourceControlSelect value={form.data.source_control} onValueChange={(value) => form.setData('source_control', value)} />
          <InputError message={form.errors.source_control} />
        </>
      )}
    </FieldUpdateDialog>
  );
}
