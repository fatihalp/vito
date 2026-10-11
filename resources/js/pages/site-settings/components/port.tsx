import { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import InputError from '@/components/ui/input-error';
import { Site } from '@/types/site';
import { Input } from '@/components/ui/input';
import FieldUpdateDialog from '@/components/field-update-dialog';

export default function Port({ site, children }: { site: Site; children: ReactNode }) {
  return (
    <FieldUpdateDialog
      title="Update Port"
      description="The port your application listens on. The VHost will be regenerated when you save."
      initialValue={site.port?.toString() ?? ''}
      fieldName="port"
      url={`/servers/${site.server_id}/sites/${site.id}/settings/port`}
      trigger={children}
    >
      {(form) => (
        <>
          <Label htmlFor="port">Port</Label>
          <Input
            id="port"
            type="number"
            min={1024}
            max={65535}
            value={form.data.port}
            placeholder="3000"
            onChange={(e) => form.setData('port', e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Make sure your application is configured to listen on this port (e.g., via the <code>PORT</code> environment variable). Use a
            non-privileged port (1024–65535).
          </p>
          <InputError message={form.errors.port} />
        </>
      )}
    </FieldUpdateDialog>
  );
}
