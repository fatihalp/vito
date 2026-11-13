import { useTranslate } from '@/hooks/use-translate';
import SettingsLayout from '@/layouts/settings/layout';
import { Head, usePage } from '@inertiajs/react';
import Heading from '@/components/heading';
import { useState } from 'react';
import Container from '@/components/container';
import InstalledPlugins from '@/pages/plugins/components/installed';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plugin } from '@/types/plugin';
import InstallDialog from '@/pages/plugins/components/install-dialog';
import DiscoveredPlugins from '@/pages/plugins/components/discovered';
import CheckForUpdates from '@/pages/plugins/components/check-updates';
import PluginList from '@/pages/plugins/components/plugin-list';
export default function Plugins() {
  const translateText = useTranslate();
  const [tab, setTab] = useState('installed');
  const page = usePage<{
    plugins: Plugin[];
  }>();

  return (
    <SettingsLayout>
      <Head title={translateText("Plugins")} />

      <Container>
        <div className="flex items-start justify-between">
          <Heading title={translateText("Plugins")} />
          <div className="flex items-center gap-2">
            <CheckForUpdates />
            <InstallDialog />
          </div>
        </div>

        <Tabs defaultValue={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="installed">{translateText('Installed')}</TabsTrigger>
            <TabsTrigger value="discovered">{translateText("Discovered")}</TabsTrigger>
            <TabsTrigger value="official">{translateText("Official")}</TabsTrigger>
            <TabsTrigger value="community">{translateText("Community")}</TabsTrigger>
          </TabsList>
          <TabsContent value="installed">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>{translateText("Installed plugins")}</CardTitle>
                <CardDescription>{translateText("All the currently installed plugins")}</CardDescription>
              </CardHeader>
              <CardContent className="bg-background">
                <InstalledPlugins plugins={page.props.plugins} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="discovered">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>{translateText("Discovered plugins")}</CardTitle>
                <CardDescription>{translateText("These plugins are present on the system, but have not been installed")}</CardDescription>
              </CardHeader>
              <CardContent className="bg-background">
                <DiscoveredPlugins plugins={page.props.plugins} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="official">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>{translateText("Official plugins")}</CardTitle>
                <CardDescription>{translateText("These plugins are developed and maintained by VitoDeploy's team")}</CardDescription>
              </CardHeader>
              <CardContent className="bg-background">
                <PluginList filter="official" />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="community">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>{translateText("Community plugins")}</CardTitle>
                <CardDescription>{translateText("These plugins are developed by the community")}</CardDescription>
              </CardHeader>
              <CardContent className="bg-background">
                <PluginList filter="community" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </Container>
    </SettingsLayout>
  );
}
