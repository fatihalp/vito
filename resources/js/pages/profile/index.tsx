import { Head, usePage } from '@inertiajs/react';
import SettingsLayout from '@/layouts/settings/layout';
import Container from '@/components/container';
import UpdatePassword from '@/pages/profile/components/update-password';
import UpdateProfile from '@/pages/profile/components/update-profile';
import Heading from '@/components/heading';
import TwoFactor from '@/pages/profile/components/two-factor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TriangleAlertIcon } from 'lucide-react';
import { SharedData } from '@/types';

export default function Profile() {
  const page = usePage<SharedData>();
  const mustChangePassword = page.props.auth.user.must_change_password;
  const [tab, setTab] = useState(mustChangePassword ? 'password' : 'info');

  return (
    <SettingsLayout>
      <Head title="Profile settings" />
      <Container className="max-w-5xl">
        <div className="flex items-start justify-between">
          <Heading title="Profile settings" description="Manage your profile settings." />
          <div className="flex items-center gap-2">
          </div>
        </div>
        {mustChangePassword && (
          <Alert variant="destructive">
            <TriangleAlertIcon size={5} />
            <AlertDescription>You must change your password before continuing.</AlertDescription>
          </Alert>
        )}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="info" disabled={mustChangePassword}>
              Info
            </TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="two_factor" disabled={mustChangePassword}>
              Two Factor
            </TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="space-y-4">
            <UpdateProfile />
          </TabsContent>
          <TabsContent value="password">
            <UpdatePassword />
          </TabsContent>
          <TabsContent value="two_factor">
            <TwoFactor />
          </TabsContent>
        </Tabs>
      </Container>
    </SettingsLayout>
  );
}
