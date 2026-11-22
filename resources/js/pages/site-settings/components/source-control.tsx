import { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import InputError from '@/components/ui/input-error';
import { Site } from '@/types/site';
import SourceControlSelect from '@/pages/source-controls/components/source-control-select';
import SelectRepo from '@/pages/source-controls/components/select-repo';
import SelectBranch from '@/pages/source-controls/components/select-branch';
import FieldUpdateDialog from '@/components/field-update-dialog';

export default function ChangeSourceControl({ site, children }: { site: Site; children: ReactNode }) {
  return (
    <FieldUpdateDialog
      title="Change Git connection"
      description="Update the source control provider, repository, or branch without reinstalling the site."
      initialValue={site.source_control_id?.toString() || ''}
      initialValues={{
        repository: site.repository || '',
        branch: site.branch || '',
      }}
      fieldName="source_control"
      url={`/servers/${site.server_id}/sites/${site.id}/settings/source-control`}
      trigger={children}
    >
      {(form) => (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source_control">Source control</Label>
            <SourceControlSelect
              value={form.data.source_control}
              onValueChange={(value) => form.setData('source_control', value)}
              serverId={site.server_id}
            />
            <InputError message={form.errors.source_control} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="repository">Repository</Label>
            <SelectRepo
              sourceControlId={form.data.source_control}
              value={form.data.repository || ''}
              onValueChange={(value) => form.setData('repository', value)}
              placeholder="owner/repository"
            />
            <InputError message={form.errors.repository} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="branch">Branch</Label>
            <SelectBranch
              sourceControlId={form.data.source_control}
              repository={form.data.repository || ''}
              value={form.data.branch || ''}
              onValueChange={(value) => form.setData('branch', value)}
              placeholder="e.g. main, master, develop"
            />
            <InputError message={form.errors.branch} />
          </div>
        </div>
      )}
    </FieldUpdateDialog>
  );
}
