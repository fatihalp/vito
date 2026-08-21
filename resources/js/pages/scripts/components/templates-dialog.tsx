import { FormEvent, useMemo, useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SCRIPT_TEMPLATES, ScriptTemplate } from './templates';
import { useForm } from '@inertiajs/react';
import { useDialog } from '@/hooks/use-dialog';
import { Code2Icon, FileCodeIcon, LoaderCircleIcon, PencilIcon, SearchIcon, SparklesIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import InputError from '@/components/ui/input-error';

const CATEGORIES = ['All', 'Deploy', 'Cache', 'Database', 'Queues', 'Maintenance', 'Server'] as const;

export default function ScriptTemplatesDialog({
  open,
  onOpenChange,
  initialTemplateId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTemplateId?: string;
}) {
  const dialog = useDialog();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTemplateId || SCRIPT_TEMPLATES[0].id);

  const selectedTemplate = useMemo(() => {
    return SCRIPT_TEMPLATES.find((t) => t.id === selectedTemplateId) || SCRIPT_TEMPLATES[0];
  }, [selectedTemplateId]);

  const form = useForm<{
    name: string;
    content: string;
  }>({
    name: selectedTemplate.name,
    content: selectedTemplate.content,
  });

  const handleSelectTemplate = (template: ScriptTemplate) => {
    setSelectedTemplateId(template.id);
    form.setData({
      name: template.name,
      content: template.content,
    });
  };

  const filteredTemplates = useMemo(() => {
    return SCRIPT_TEMPLATES.filter((t) => {
      const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
      const matchesSearch =
        search.trim() === '' ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.label.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.content.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, search]);

  const detectedVariables = useMemo(() => {
    const matches = selectedTemplate.content.match(/\${[A-Z0-9_:-]+}/g);
    if (!matches) return [];
    const unique = Array.from(new Set(matches.map((m) => m.replace(/[${}]/g, '').split(/[:-]/)[0])));
    return unique;
  }, [selectedTemplate]);

  const handleCustomizeInEditor = () => {
    onOpenChange(false);
    dialog.scriptForm.open({
      initialName: form.data.name || selectedTemplate.name,
      initialContent: selectedTemplate.content,
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.post(route('scripts'), {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col p-0 sm:max-w-4xl">
        <DialogHeader className="border-b p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
              <SparklesIcon className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg">Laravel Script Templates</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Choose a pre-configured Laravel bash script to create immediately or customize in the editor.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          {}
          <div className="flex w-full flex-col border-b md:w-5/12 md:border-r md:border-b-0">
            <div className="space-y-2 border-b p-3">
              <div className="relative">
                <SearchIcon className="text-muted-foreground absolute top-2.5 left-2.5 size-3.5" />
                <Input
                  placeholder="Search templates..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              <div className="no-scrollbar flex gap-1 overflow-x-auto pb-1">
                {CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors',
                      selectedCategory === category
                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                    )}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[300px] flex-1 space-y-1.5 overflow-y-auto p-2 md:max-h-[420px]">
              {filteredTemplates.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center text-xs">No matching templates found.</div>
              ) : (
                filteredTemplates.map((template) => {
                  const isSelected = selectedTemplate.id === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleSelectTemplate(template)}
                      className={cn(
                        'w-full rounded-lg border p-2.5 text-left transition-all',
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-xs'
                          : 'border-border/60 bg-card hover:bg-accent/50 text-foreground',
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={cn('text-xs font-semibold', isSelected ? 'text-primary' : 'text-foreground')}>
                          {template.label}
                        </span>
                        {template.isPopular ? (
                          <span className="bg-primary/20 text-primary rounded px-1.5 py-0.5 text-[9px] font-medium">Popular</span>
                        ) : (
                          <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[9px] font-medium">
                            {template.category}
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-[11px] leading-relaxed">{template.description}</p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {}
          <div className="flex flex-1 flex-col overflow-y-auto bg-muted/10 p-4">
            <form id="template-create-form" onSubmit={submit} className="flex flex-1 flex-col space-y-3.5">
              <div className="space-y-1">
                <Label htmlFor="template-name" className="text-xs font-semibold">
                  Script Name
                </Label>
                <Input
                  id="template-name"
                  value={form.data.name}
                  onChange={(e) => form.setData('name', e.target.value)}
                  className="h-8 bg-background text-xs"
                />
                <InputError message={form.errors.name} />
              </div>

              {detectedVariables.length > 0 && (
                <div className="space-y-1">
                  <span className="text-muted-foreground text-[11px] font-medium">Configurable Variables</span>
                  <div className="flex flex-wrap gap-1">
                    {detectedVariables.map((v) => (
                      <Badge key={v} variant="gray" className="font-mono text-[10px]">
                        ${`{${v}}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-1 flex-col space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px] font-medium flex items-center gap-1">
                    <Code2Icon className="size-3" /> Bash Script Preview
                  </span>
                </div>
                <div className="relative flex-1 min-h-[160px] max-h-[260px] overflow-hidden rounded-md border bg-zinc-950 font-mono text-[11px] text-zinc-100">
                  <pre className="h-full overflow-auto p-3 leading-relaxed">
                    <code>{selectedTemplate.content}</code>
                  </pre>
                </div>
                <InputError message={form.errors.content} />
              </div>
            </form>
          </div>
        </div>

        <DialogFooter className="border-t p-3 sm:px-5 sm:py-3 bg-muted/20">
          <div className="flex w-full items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCustomizeInEditor}
              className="text-xs"
            >
              <PencilIcon className="mr-1.5 size-3.5" />
              Customize in Full Editor
            </Button>
            <div className="flex items-center gap-2">
              <DialogClose asChild>
                <Button variant="ghost" size="sm" className="text-xs">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                form="template-create-form"
                type="submit"
                size="sm"
                disabled={form.processing}
                className="text-xs"
              >
                {form.processing && <LoaderCircleIcon className="mr-1.5 size-3.5 animate-spin" />}
                <FileCodeIcon className="mr-1.5 size-3.5" />
                Create Script
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
