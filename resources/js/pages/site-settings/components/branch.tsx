import { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import InputError from '@/components/ui/input-error';
import { Site } from '@/types/site';
import SelectBranch from '@/pages/source-controls/components/select-branch';
import FieldUpdateDialog from '@/components/field-update-dialog';

export default function ChangeBranch({ site, children }: { site: Site; children: ReactNode }) {
  return (
    <FieldUpdateDialog
      title="Change branch"
      description="sr-only"
      initialValue={site.branch || ''}
      fieldName="branch"
      routeName="site-settings.update-branch"
      routeParams={{ server: site.server_id, site: site.id }}
      trigger={children}
    >
      {(form) => (
        <>
          <Label htmlFor="branch">Branch</Label>
          <SelectBranch
            sourceControlId={site.source_control_id?.toString() || ''}
            repository={site.repository}
            value={form.data.branch}
            onValueChange={(value) => form.setData('branch', value)}
          />
          <InputError message={form.errors.branch} />
        </>
      )}
    </FieldUpdateDialog>
  );
}
