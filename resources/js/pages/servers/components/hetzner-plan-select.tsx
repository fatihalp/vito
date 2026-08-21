import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { CheckIcon, CpuIcon, MemoryStickIcon, ServerIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getHetznerPlan, hetznerPlans } from './hetzner-plans';

export default function HetznerPlanSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selectedPlan = getHetznerPlan(value);
  const groups = useMemo(() => [...new Set(hetznerPlans.map((plan) => plan.group))], []);

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
              <span className="truncate font-medium">{selectedPlan.name}</span>
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
        </DialogHeader>
        <ScrollArea className="max-h-[66vh]">
          <div className="space-y-5 p-6">
            {groups.map((group) => (
              <section key={group} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">{group}</h3>
                  <Badge variant="outline">{hetznerPlans.filter((plan) => plan.group === group).length} plans</Badge>
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

                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hetznerPlans
                      .filter((plan) => plan.group === group)
                      .map((plan) => {
                        const selected = plan.value === value;

                        return (
                          <TableRow
                            key={plan.value}
                            className={cn('cursor-pointer', selected && 'bg-primary/5')}
                            onClick={() => {
                              onChange(plan.value);
                              setOpen(false);
                            }}
                          >
                            <TableCell>
                              <div className="grid gap-1">
                                <span className="font-medium">{plan.name}</span>
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
            ))}
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
