import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from '@inertiajs/react';
import { Editor } from '@monaco-editor/react';
import { toast } from 'sonner';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoaderCircleIcon, UploadIcon } from 'lucide-react';
import { useAppearance } from '@/hooks/use-appearance';

const PLACEHOLDER_PATTERN = /__[A-Z][A-Z0-9_]*__/g;
const SENSITIVE_PATTERN = /PASSWORD|SECRET|TOKEN|KEY/;

const EXAMPLE = JSON.stringify(
  {
    name: 'New Workflow',
    site_addresses: ['example.com'],
    nodes: [],
    edges: [],
  },
  null,
  2,
);

function collectPlaceholders(value: unknown, found: Set<string>): void {
  if (typeof value === 'string') {
    value.match(PLACEHOLDER_PATTERN)?.forEach((match) => found.add(match));
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectPlaceholders(item, found));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectPlaceholders(item, found));
  }
}

function replacePlaceholders(value: unknown, replacements: Record<string, string>): unknown {
  if (typeof value === 'string') {
    return value.replace(PLACEHOLDER_PATTERN, (match) => (match in replacements ? replacements[match] : match));
  }
  if (Array.isArray(value)) {
    return value.map((item) => replacePlaceholders(item, replacements));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replacePlaceholders(item, replacements)]));
  }
  return value;
}

function placeholderLabel(token: string): string {
  return token
    .replace(/^__|__$/g, '')
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

export default function ImportWorkflow({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { getActualAppearance } = useAppearance();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jsonText, setJsonText] = useState(EXAMPLE);
  const [replacements, setReplacements] = useState<Record<string, string>>({});

  const form = useForm<{ name: string }>({
    name: '',
  });

  const parsed = useMemo(() => {
    try {
      const data = JSON.parse(jsonText);
      return { data, error: null };
    } catch (e) {
      return { data: null, error: e as Error };
    }
  }, [jsonText]);

  const placeholders = useMemo(() => {
    const found = new Set<string>();
    if (parsed.data) {
      collectPlaceholders(parsed.data, found);
    }
    return Array.from(found).sort();
  }, [parsed.data]);

  useEffect(() => {
    setReplacements((prev) => {
      const next = { ...prev };
      let changed = false;
      placeholders.forEach((token) => {
        if (!(token in next)) {
          let defaultValue = '';
          const siteAddresses = parsed.data?.site_addresses;
          if (token === '__DOMAIN__' && Array.isArray(siteAddresses) && siteAddresses.length > 0) {
            defaultValue = String(siteAddresses[0]);
          }
          next[token] = defaultValue;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [placeholders, parsed.data]);

  const onUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    file
      .text()
      .then((text) => setJsonText(text))
      .catch(() => toast.error('Could not read the selected file.'));
    e.target.value = '';
  };

  const submit = () => {
    if (!parsed.data) {
      toast.error('Invalid JSON: ' + parsed.error);
      return;
    }

    const resolved = replacePlaceholders(parsed.data, replacements) as { name?: string; nodes?: unknown[]; edges?: unknown[] };
    const { name, nodes, edges } = resolved;

    if (!name || typeof name !== 'string' || !Array.isArray(nodes)) {
      toast.error('The JSON document must include a "name" and a "nodes" array.');
      return;
    }

    form.transform(() => ({
      name,
      nodes,
      edges: Array.isArray(edges) ? edges : [],
    }));

    form.post(route('workflows.import'), {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Import Workflow</DialogTitle>
          <DialogDescription className="sr-only">Import a workflow from a JSON document</DialogDescription>
        </DialogHeader>
        <Form id="import-workflow-form" className="p-4" onSubmit={(e) => e.preventDefault()}>
          <FormFields>
            <FormField>
              <div className="flex items-center justify-between">
                <Label htmlFor="import-json">Workflow JSON</Label>
                <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={onUpload} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <UploadIcon />
                  Upload file
                </Button>
              </div>
              <Editor
                defaultLanguage="json"
                value={jsonText}
                theme={getActualAppearance() === 'dark' ? 'vs-dark' : 'vs'}
                className="h-[350px]"
                onChange={(value) => setJsonText(value ?? '')}
                options={{
                  fontSize: 15,
                  minimap: { enabled: false },
                }}
              />
              {parsed.error && <p className="text-destructive text-sm">{parsed.error.message}</p>}
            </FormField>
            {placeholders.length > 0 && (
              <FormField>
                <Label>Placeholders</Label>
                <p className="text-muted-foreground text-sm">
                  This document contains placeholders. Fill in the values below before importing.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {placeholders.map((token) => (
                    <div key={token} className="grid gap-2">
                      <Label htmlFor={`placeholder-${token}`}>{placeholderLabel(token)}</Label>
                      <Input
                        id={`placeholder-${token}`}
                        type={SENSITIVE_PATTERN.test(token) ? 'password' : 'text'}
                        value={replacements[token] ?? ''}
                        onChange={(e) => setReplacements((prev) => ({ ...prev, [token]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              </FormField>
            )}
          </FormFields>
        </Form>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={submit} disabled={form.processing}>
            {form.processing && <LoaderCircleIcon className="animate-spin" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
