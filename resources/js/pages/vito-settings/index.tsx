import { useTranslate } from '@/hooks/use-translate';
import SettingsLayout from '@/layouts/settings/layout';
import { Head } from '@inertiajs/react';
import Container from '@/components/container';
import Heading from '@/components/heading';
import { Card, CardContent, CardRow } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import ExportVito from '@/pages/vito-settings/components/export';
import ImportVito from '@/pages/vito-settings/components/import';

export default function VitoSettings() {
  const translateText = useTranslate();
  return (
    <SettingsLayout>
      <Head title={translateText('Pure Settings')} />

      <Container>
        <div className="flex items-start justify-between">
          <Heading title={translateText('Pure Settings')} description={translateText("Here you can manage general Pure settings")} />
        </div>

        <Card>
          <CardContent>
            <CardRow>
              <span>{translateText("Export all data")}</span>
              <ExportVito />
            </CardRow>
            <Separator />
            <CardRow>
              <span>{translateText('Import')}</span>
              <ImportVito />
            </CardRow>
          </CardContent>
        </Card>
      </Container>
    </SettingsLayout>
  );
}
