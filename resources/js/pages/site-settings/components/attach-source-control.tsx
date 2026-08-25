import { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import InputError from '@/components/ui/input-error';
import { Site } from '@/types/site';
import SourceControlSelect from '@/pages/source-controls/components/source-control-select';
import SelectRepo from '@/pages/source-controls/components/select-repo';
import SelectBranch from '@/pages/source-controls/components/select-branch';
import FieldUpdateDialog from '@/components/field-update-dialog';

export default function AttachSourceControl({ site, children }: { site: Site; children: ReactNode }) {
  return (
    <FieldUpdateDialog
      title="Attach source control"
      description="Connect this site to a Git repository."
      initialValue=""
      fieldName="source_control"
      routeName="site-settings.attach-source-control"
      routeParams={{ server: site.server_id, site: site.id }}
      trigger={children}
    >
      {(form) => (
        <>
          <div>
            <Label htmlFor="source_control">Source control</Label>
            <SourceControlSelect
              value={form.data.source_control}
              onValueChange={(value) => form.setData('source_control', value)}
              serverId={site.server_id}
            />
            <InputError message={form.errors.source_control} />
          </div>

          <div>
            <Label htmlFor="repository">Repository</Label>
            <SelectRepo
              sourceControlId={form.data.source_control}
              value={form.data.repository || ''}
              onValueChange={(value) => form.setData('repository', value)}
              placeholder="owner/repository"
            />
            <InputError message={form.errors.repository} />
          </div>

          <div>
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
        </>
      )}
    </FieldUpdateDialog>
  );
}
