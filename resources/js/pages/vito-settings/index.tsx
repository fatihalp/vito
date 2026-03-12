import AdminLayout from '@/layouts/admin/layout';
import { Head, usePage } from '@inertiajs/react';
import Container from '@/components/container';
import Heading from '@/components/heading';
import { Card, CardContent, CardRow } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import ExportVito from '@/pages/vito-settings/components/export';
import ImportVito from '@/pages/vito-settings/components/import';
import SSLSettings from '@/pages/vito-settings/components/ssl-settings';

export default function Users() {
  const page = usePage<{ vito_ssl: boolean; vito_domain: string; vito_mode: string }>();

  return (
    <AdminLayout>
      <Head title="Vito Settings" />

      <Container className="max-w-5xl">
        <div className="flex items-start justify-between">
          <Heading title="Vito Settings" description="Here you can manage general Vito settings" />
        </div>

        <Card>
          <CardContent>
            <CardRow>
              <span>Export all data</span>
              <ExportVito />
            </CardRow>
            <Separator />
            <CardRow>
              <span>Import</span>
              <ImportVito />
            </CardRow>
          </CardContent>
        </Card>

        {page.props.vito_mode !== 'dev' && (
          <div className="mt-6">
            <SSLSettings vitoSsl={page.props.vito_ssl} vitoDomain={page.props.vito_domain} />
          </div>
        )}
      </Container>
    </AdminLayout>
  );
}
