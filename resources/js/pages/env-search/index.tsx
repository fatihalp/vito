import { FormEvent, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { SearchIcon, ServerIcon } from 'lucide-react';
import SettingsLayout from '@/layouts/settings/layout';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type EnvSearchResult = {
  site_id: number;
  domain: string;
  server_id: number;
  server_name: string;
  found: boolean;
  value: string | null;
};

type Page = {
  key: string;
  results: EnvSearchResult[] | null;
};

export default function EnvSearch() {
  const page = usePage<Page>();
  const [key, setKey] = useState(page.props.key ?? '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (key.trim() === '') {
      return;
    }
    router.get(route('env-search'), { key: key.trim() }, { preserveState: true, preserveScroll: true });
  };

  return (
    <SettingsLayout>
      <Head title="Env Anahtarı Ara" />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading
            title="Env Anahtarı Ara"
            description="Sitelerinizin .env dosyalarında bir anahtarı (ör. APP_URL) arayın ve değerlerini görün"
          />
        </HeaderContainer>

        <form onSubmit={submit} className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              placeholder="APP_URL"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="pl-8"
              autoFocus
            />
          </div>
          <Button type="submit">Ara</Button>
        </form>

        {page.props.results === null ? (
          <p className="text-muted-foreground text-sm">Bir anahtar girip aramayı başlatın.</p>
        ) : (
          <div className="overflow-hidden rounded-md border shadow-2xs">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Sunucu</TableHead>
                  <TableHead>Değer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.props.results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-center">
                      Erişilebilir site bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : (
                  page.props.results.map((result) => (
                    <TableRow key={result.site_id}>
                      <TableCell>
                        <Link
                          href={route('application', { server: result.server_id, site: result.site_id })}
                          className="font-medium hover:underline"
                        >
                          {result.domain}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <ServerIcon className="size-3.5" />
                          {result.server_name}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {result.found ? (
                          result.value === '' ? (
                            <span className="text-muted-foreground italic">(boş)</span>
                          ) : (
                            result.value
                          )
                        ) : (
                          <span className="text-muted-foreground italic">Değeri yok</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Container>
    </SettingsLayout>
  );
}
