import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { CheckIcon, CpuIcon, MemoryStickIcon, SearchIcon, ServerIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getHetznerPlan, hetznerPlans } from './hetzner-plans';

export default function HetznerPlanSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selectedPlan = getHetznerPlan(value);

  const filteredPlans = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return hetznerPlans;

    return hetznerPlans.filter(
      (plan) =>
        plan.name.toLowerCase().includes(q) ||
        plan.value.toLowerCase().includes(q) ||
        plan.group.toLowerCase().includes(q) ||
        plan.architecture.toLowerCase().includes(q) ||
        `${plan.cpu} vcpu`.includes(q) ||
        `${plan.ram} gb`.includes(q)
    );
  }, [search]);

  const groups = useMemo(() => [...new Set(filteredPlans.map((plan) => plan.group))], [filteredPlans]);

  const money = (amount: number) =>
    new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(amount);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-auto min-h-10 justify-between gap-3 px-3 py-2 text-left font-normal">
          {selectedPlan ? (
            <span className="grid min-w-0 gap-1">
              <span className="flex items-center gap-2 truncate font-medium">
                {selectedPlan.name}
                {selectedPlan.deprecated && (
                  <Badge variant="outline" className="text-[10px] font-normal text-amber-600 dark:text-amber-400 border-amber-500/30">
                    Deprecated
                  </Badge>
                )}
              </span>
              <span className="text-muted-foreground truncate text-xs">
                {selectedPlan.cpu} vCPU, {selectedPlan.ram} GB RAM, {selectedPlan.disk} GB SSD, {money(selectedPlan.monthlyEur)}/mo
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select Hetzner plan</span>
          )}
          <ServerIcon className="size-4 shrink-0" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] gap-0 p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Hetzner Cloud Server</DialogTitle>
          <DialogDescription>
            Germany/Finland pricing, excluding VAT and IPv4, from Hetzner's 15 June 2026 cloud price table.
          </DialogDescription>
          <div className="relative mt-2">
            <SearchIcon className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
            <Input
              type="search"
              placeholder="Search plans (e.g. CX23, CPX, 4 vCPU, 8 GB)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus={false}
            />
          </div>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-5 p-6">
            {groups.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">No plans matching "{search}".</div>
            ) : (
              groups.map((group) => (
                <section key={group} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{group}</h3>
                    <Badge variant={group.includes('Deprecated') ? 'outline' : 'secondary'} className={cn(group.includes('Deprecated') && 'text-amber-600 dark:text-amber-400 border-amber-500/30')}>
                      {filteredPlans.filter((plan) => plan.group === group).length} plans
                    </Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plan</TableHead>
                        <TableHead>CPU</TableHead>
                        <TableHead>RAM</TableHead>
                        <TableHead>Disk</TableHead>
                        <TableHead>Monthly</TableHead>
                        <TableHead>Per CPU</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPlans
                        .filter((plan) => plan.group === group)
                        .map((plan) => {
                          const selected = plan.value === value;

                          return (
                            <TableRow
                              key={plan.value}
                              className={cn('cursor-pointer hover:bg-muted/50 transition-colors', selected && 'bg-primary/5')}
                              onClick={() => {
                                onChange(plan.value);
                                setOpen(false);
                              }}
                            >
                              <TableCell>
                                <div className="grid gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{plan.name}</span>
                                    {plan.deprecated && (
                                      <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30">
                                        Deprecated
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-muted-foreground text-xs">{plan.architecture}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="inline-flex items-center gap-1">
                                  <CpuIcon className="size-3.5" />
                                  {plan.cpu}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="inline-flex items-center gap-1">
                                  <MemoryStickIcon className="size-3.5" />
                                  {plan.ram} GB
                                </span>
                              </TableCell>
                              <TableCell>{plan.disk} GB</TableCell>
                              <TableCell>{money(plan.monthlyEur)}</TableCell>
                              <TableCell>{money(plan.monthlyEur / plan.cpu)}</TableCell>

                              <TableCell>
                                {selected && (
                                  <Badge variant="success">
                                    <CheckIcon className="size-3" />
                                    Selected
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </section>
              ))
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
