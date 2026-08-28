import { FormEvent, useEffect, useRef, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import axios from 'axios';
import { LoaderCircleIcon, SearchIcon, ServerIcon } from 'lucide-react';
import SettingsLayout from '@/layouts/settings/layout';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { errorMessage } from '@/lib/errors';

type EnvSearchResult = {
  site_id: number;
  domain: string;
  server_id: number;
  server_name: string;
  found: boolean;
  value: string | null;
};

type SearchStatus =
  | { status: 'pending' }
  | { status: 'done'; results: EnvSearchResult[] }
  | { status: 'failed'; error: string }
  | { status: 'not_found' };

const POLL_INTERVAL_MS = 1500;

export default function EnvSearch() {
  const [key, setKey] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<EnvSearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current) {
        clearTimeout(pollTimer.current);
      }
    };
  }, []);

  const poll = (searchId: string) => {
    pollTimer.current = setTimeout(async () => {
      try {
        const response = await axios.get<SearchStatus>(route('env-search.status', { searchId }));
        const data = response.data;

        if (data.status === 'done') {
          setResults(data.results);
          setSearching(false);
        } else if (data.status === 'failed') {
          setError(data.error || 'Arama başarısız oldu.');
          setSearching(false);
        } else if (data.status === 'not_found') {
          setError('Arama sonucu bulunamadı.');
          setSearching(false);
        } else {
          poll(searchId);
        }
      } catch (e) {
        setError(errorMessage(e, 'Arama sırasında bir hata oluştu.'));
        setSearching(false);
      }
    }, POLL_INTERVAL_MS);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (key.trim() === '' || searching) {
      return;
    }

    setSearching(true);
    setError(null);
    setResults(null);

    try {
      const response = await axios.post<{ search_id: string }>(route('env-search.search'), { key: key.trim() });
      poll(response.data.search_id);
    } catch (e) {
      setError(errorMessage(e, 'Arama başlatılamadı.'));
      setSearching(false);
    }
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
          <Button type="submit" disabled={searching}>
            {searching && <LoaderCircleIcon className="size-3.5 animate-spin" />}
            {searching ? 'Aranıyor...' : 'Ara'}
          </Button>
        </form>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {!searching && results === null && !error && (
          <p className="text-muted-foreground text-sm">Bir anahtar girip aramayı başlatın.</p>
        )}

        {searching && results === null && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <LoaderCircleIcon className="size-3.5 animate-spin" />
            Sunuculardaki .env dosyaları taranıyor, bu biraz zaman alabilir...
          </p>
        )}

        {results !== null && (
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
                {results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-center">
                      Erişilebilir site bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : (
                  results.map((result) => (
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
