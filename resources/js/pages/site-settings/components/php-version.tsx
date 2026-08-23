import { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import InputError from '@/components/ui/input-error';
import { Site } from '@/types/site';
import ServiceVersionSelect from '@/pages/services/components/service-version-select';
import FieldUpdateDialog from '@/components/field-update-dialog';

export default function ChangePHPVersion({ site, children }: { site: Site; children: ReactNode }) {
  return (
    <FieldUpdateDialog
      title="Change PHP version"
      description="sr-only"
      initialValue={site.php_version || ''}
      fieldName="version"
      routeName="site-settings.update-php-version"
      routeParams={{ server: site.server_id, site: site.id }}
      trigger={children}
    >
      {(form) => (
        <>
          <Label htmlFor="version">PHP version</Label>
          <ServiceVersionSelect
            serverId={site.server_id}
            service="php"
            value={form.data.version}
            onValueChange={(value) => form.setData('version', value)}
          />
          <InputError message={form.errors.version} />
        </>
      )}
    </FieldUpdateDialog>
  );
}
