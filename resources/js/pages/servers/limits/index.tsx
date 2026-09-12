import { FormEvent, useEffect, useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import ServerLayout from '@/layouts/server/layout';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InputError from '@/components/ui/input-error';
import { LoaderCircleIcon } from 'lucide-react';

type PhpLimitData = {
  version: string;
  upload_max_filesize: string;
  post_max_size: string;
  memory_limit: string;
  max_execution_time: string;
};

type LimitsData = {
  has_nginx: boolean;
  nginx_limit: string;
  php_versions: PhpLimitData[];
  default_php?: string;
};

type PageProps = {
  server: Server;
  limits: LimitsData;
};

const NGINX_PRESETS = ['100M', '210M', '500M', '1G'];

export default function ServerLimits() {
  const { server, limits } = usePage<PageProps>().props;
  const isOffline = server.status === 'disconnected';

  const nginxForm = useForm<{
    client_max_body_size: string;
  }>({
    client_max_body_size: limits.nginx_limit || '210M',
  });

  const submitNginx = (e: FormEvent) => {
    e.preventDefault();
    nginxForm.patch(route('servers.limits.nginx', { server: server.id }), {
      preserveScroll: true,
    });
  };

  const initialPhpVersion = limits.default_php || limits.php_versions[0]?.version || '';
  const [selectedVersion, setSelectedVersion] = useState<string>(initialPhpVersion);

  const currentPhpLimit = limits.php_versions.find((p) => p.version === selectedVersion) || limits.php_versions[0];

  const phpForm = useForm<{
    version: string;
    upload_max_filesize: string;
    post_max_size: string;
    memory_limit: string;
    max_execution_time: string;
  }>({
    version: selectedVersion,
    upload_max_filesize: currentPhpLimit?.upload_max_filesize || '210M',
    post_max_size: currentPhpLimit?.post_max_size || '220M',
    memory_limit: currentPhpLimit?.memory_limit || '512M',
    max_execution_time: currentPhpLimit?.max_execution_time || '120',
  });

  useEffect(() => {
    if (!currentPhpLimit) return;
    phpForm.setData({
      version: selectedVersion,
      upload_max_filesize: currentPhpLimit.upload_max_filesize || '210M',
      post_max_size: currentPhpLimit.post_max_size || '220M',
      memory_limit: currentPhpLimit.memory_limit || '512M',
      max_execution_time: currentPhpLimit.max_execution_time || '120',
    });
  }, [selectedVersion]);

  const submitPhp = (e: FormEvent) => {
    e.preventDefault();
    phpForm.patch(route('servers.limits.php', { server: server.id }), {
      preserveScroll: true,
    });
  };

  const setRecommendedPhp = () => {
    phpForm.setData({
      ...phpForm.data,
      upload_max_filesize: '210M',
      post_max_size: '220M',
      memory_limit: '512M',
      max_execution_time: '120',
    });
  };

  return (
    <ServerLayout>
      <Head title={`Limits - ${server.name}`} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title="Limits" description="Upload and request body limits for Nginx and PHP." />
        </HeaderContainer>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card id="nginx">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-base font-medium">Nginx</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              <form onSubmit={submitNginx} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="client_max_body_size">client_max_body_size</Label>
                  <Input
                    id="client_max_body_size"
                    value={nginxForm.data.client_max_body_size}
                    onChange={(e) => nginxForm.setData('client_max_body_size', e.target.value)}
                    placeholder="210M"
                    disabled={!limits.has_nginx || isOffline || nginxForm.processing}
                  />
                  <InputError message={nginxForm.errors.client_max_body_size} />

                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {NGINX_PRESETS.map((preset) => (
                      <Button
                        key={preset}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs px-2"
                        disabled={!limits.has_nginx || isOffline || nginxForm.processing}
                        onClick={() => nginxForm.setData('client_max_body_size', preset)}
                      >
                        {preset}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!limits.has_nginx || isOffline || nginxForm.processing}
                  >
                    {nginxForm.processing && <LoaderCircleIcon className="mr-1.5 size-4 animate-spin" />}
                    Save
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card id="php">
            <CardHeader className="p-6 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">PHP-FPM</CardTitle>
                {limits.php_versions.length > 1 && (
                  <Select
                    value={selectedVersion}
                    onValueChange={(val) => {
                      setSelectedVersion(val);
                      phpForm.setData('version', val);
                    }}
                  >
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {limits.php_versions.map((p) => (
                        <SelectItem key={p.version} value={p.version} className="text-xs">
                          PHP {p.version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              {limits.php_versions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No PHP service installed.</p>
              ) : (
                <form onSubmit={submitPhp} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="upload_max_filesize">upload_max_filesize</Label>
                      <Input
                        id="upload_max_filesize"
                        value={phpForm.data.upload_max_filesize}
                        onChange={(e) => phpForm.setData('upload_max_filesize', e.target.value)}
                        placeholder="210M"
                        disabled={isOffline || phpForm.processing}
                      />
                      <InputError message={phpForm.errors.upload_max_filesize} />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="post_max_size">post_max_size</Label>
                      <Input
                        id="post_max_size"
                        value={phpForm.data.post_max_size}
                        onChange={(e) => phpForm.setData('post_max_size', e.target.value)}
                        placeholder="220M"
                        disabled={isOffline || phpForm.processing}
                      />
                      <InputError message={phpForm.errors.post_max_size} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="memory_limit">memory_limit</Label>
                      <Input
                        id="memory_limit"
                        value={phpForm.data.memory_limit}
                        onChange={(e) => phpForm.setData('memory_limit', e.target.value)}
                        placeholder="512M"
                        disabled={isOffline || phpForm.processing}
                      />
                      <InputError message={phpForm.errors.memory_limit} />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="max_execution_time">max_execution_time (s)</Label>
                      <Input
                        id="max_execution_time"
                        type="number"
                        min={0}
                        value={phpForm.data.max_execution_time}
                        onChange={(e) => phpForm.setData('max_execution_time', e.target.value)}
                        placeholder="120"
                        disabled={isOffline || phpForm.processing}
                      />
                      <InputError message={phpForm.errors.max_execution_time} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground px-0"
                      disabled={isOffline || phpForm.processing}
                      onClick={setRecommendedPhp}
                    >
                      Set 210M / 220M
                    </Button>

                    <Button type="submit" size="sm" disabled={isOffline || phpForm.processing}>
                      {phpForm.processing && <LoaderCircleIcon className="mr-1.5 size-4 animate-spin" />}
                      Save
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </Container>
    </ServerLayout>
  );
}
