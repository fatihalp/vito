import { useTranslate } from '@/hooks/use-translate';
import { Head, useForm, usePage } from '@inertiajs/react';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { LoaderCircleIcon, TriangleAlertIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import React, { useEffect, useState } from 'react';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import NetworkLayout from '@/layouts/network/layout';
import { useDialog } from '@/hooks/use-dialog';
import { formatDateString } from '@/lib/utils';
import { Network } from '@/types/network';

export default function NetworkSettings() {
  const translateText = useTranslate();
  const page = usePage<{ network: Network }>();
  const network = useRealtimeRecord<Network>(page.props.network, 'network')!;
  const dialog = useDialog();
  const isWireGuard = network.type_value === 'wireguard';

  const [editMode, setEditMode] = useState<string | undefined>();

  const form = useForm<{ name: string }>({
    name: network.name,
  });

  const { isDirty, setDefaults, setData } = form;

  useEffect(() => {
    if (isDirty) {
      return;
    }
    setDefaults('name', network.name);
    setData('name', network.name);
  }, [network.name, isDirty, setDefaults, setData]);

  const submit = () => {
    form.put(`/networks/${network.id}`, {
      preserveScroll: true,
      onSuccess: () => {
        setEditMode(undefined);
        form.setDefaults();
        form.reset();
      },
    });
  };

  const handleEnterKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  return (
    <NetworkLayout>
      <Head title={translateText("Settings - :value", { value: network.name })} />

      <Container>
        <HeaderContainer>
          <Heading title={translateText('Settings')} description={translateText("Manage this network's settings")} />
        </HeaderContainer>

        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between gap-2">
            <div className="space-y-2">
              <CardTitle>{translateText("Network details")}</CardTitle>
              <CardDescription>{translateText("Update network details")}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {form.isDirty && (
                <Button onClick={submit}>
                  {form.processing && <LoaderCircleIcon className="animate-spin" />}
                  {translateText('Save changes')}
                </Button>
              )}
              {(editMode || form.isDirty) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditMode(undefined);
                    form.reset();
                  }}
                >
                  {translateText('Cancel')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="bg-background">
            <div className="flex items-center justify-between p-4">
              <span>ID</span>
              <span className="text-muted-foreground">{network.id}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between p-4">
              <span>{translateText('Name')}</span>
              {editMode === 'name' ? (
                <div className="flex max-w-48 flex-col items-end gap-1">
                  <Input
                    id="name"
                    className="h-6"
                    value={form.data.name}
                    onChange={(e) => form.setData('name', e.target.value)}
                    onKeyDown={handleEnterKey}
                    autoFocus
                  />
                  <InputError message={form.errors.name} />
                </div>
              ) : (
                <button type="button" className="text-muted-foreground cursor-pointer underline" onClick={() => setEditMode('name')}>
                  {form.data.name}
                </button>
              )}
            </div>
            <Separator />
            <div className="flex items-center justify-between p-4">
              <span>{translateText('Type')}</span>
              <Badge variant={network.type_color}>{network.type}</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between p-4">
              <span>{translateText('Status')}</span>
              <Badge variant={network.status_color}>{network.status}</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between p-4">
              <span>CIDR</span>
              <span className="text-muted-foreground">{network.cidr ?? '-'}</span>
            </div>
            {isWireGuard && (
              <>
                <Separator />
                <div className="flex items-center justify-between p-4">
                  <span>{translateText("Address pool")}</span>
                  <span className="text-muted-foreground">{network.addressing_pool}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between p-4">
                  <span>{translateText("Listen port")}</span>
                  <span className="text-muted-foreground">{network.port ?? '-'}</span>
                </div>
              </>
            )}
            <Separator />
            <div className="flex items-center justify-between p-4">
              <span>{translateText('Created at')}</span>
              <span className="text-muted-foreground">{formatDateString(network.created_at)}</span>
            </div>
          </CardContent>
        </Card>

        {network.is_managed && !network.is_orphaned && !network.is_stranded && (
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>{translateText("Provider managed")}</CardTitle>
              <CardDescription>
                {translateText("This network mirrors a private network at your cloud provider. Its members are synced automatically, and it is removed from Pure when the network no longer exists at the provider.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="bg-background p-0">
              <div className="flex items-center justify-between p-4">
                <span>{translateText('Provider')}</span>
                <span className="text-muted-foreground">{network.provider ?? '-'}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between p-4">
                <span>{translateText('Region')}</span>
                <span className="text-muted-foreground">{network.region ?? '-'}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between p-4">
                <span>{translateText("Last synced")}</span>
                <span className="text-muted-foreground">{network.last_synced_at ? formatDateString(network.last_synced_at) : translateText("Never")}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {network.is_orphaned && (
          <Alert>
            <TriangleAlertIcon className="size-4" />
            <AlertTitle>{translateText("Provider connection removed")}</AlertTitle>
            <AlertDescription>
              {translateText("The cloud provider connection this network came from no longer exists, so it can no longer be synced or removed automatically. Deleting it here is the only way to clear it.")}
            </AlertDescription>
          </Alert>
        )}

        {network.is_stranded && (
          <Alert>
            <TriangleAlertIcon className="size-4" />
            <AlertTitle>{translateText("Cannot be synced")}</AlertTitle>
            <AlertDescription>
              {translateText("None of this network's servers still carries the identifier its cloud provider knows them by, so Pure can no longer sync it or remove it automatically. Deleting it here is the only way to clear it.")}
            </AlertDescription>
          </Alert>
        )}

        {(!network.is_managed || network.is_orphaned || network.is_stranded) && (
          <Card className="border-destructive/30 overflow-hidden">
            <CardHeader>
              <CardTitle>{translateText("Delete network")}</CardTitle>
              <CardDescription>{translateText("Tear this network down on all of its servers and remove it. This action cannot be undone.")}</CardDescription>
            </CardHeader>
            <CardContent className="bg-background">
              <div className="p-4">
                <Button
                  variant="destructive"
                  onClick={() =>
                    dialog.confirm.open({
                      title: translateText("Delete network [:value]", { value: network.name }),
                      description: translateText("Are you sure you want to delete :value? This tears the network down on all of its servers.", { value: network.name }),
                      variant: 'destructive',
                      confirmLabel: 'Delete',
                      method: 'delete',
                      url: `/networks/${network.id}`,
                    })
                  }
                >
                  {translateText("Delete network")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </Container>
    </NetworkLayout>
  );
}
