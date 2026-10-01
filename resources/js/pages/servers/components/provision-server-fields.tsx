import { useEffect, useState } from 'react';
import axios from 'axios';
import { FormField } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ServerProvider } from '@/types/server-provider';

export type Plan = { label: string; available: boolean; cores?: number; memory?: number; disk?: number; architecture?: string | null };

export type ServerRequirements = {
  database_size?: number | null;
  storage_gb: number | null;
  measured?: boolean;
  cores: number | null;
  memory_gb: number | null;
  architecture?: string | null;
  os?: string;
  postgresql?: string | null;
  source: string;
};

export type ProvisionServerData = { name: string; server_provider: string; region: string; plan: string };

export type PlanFit = { blocked: string | null; warnings: string[] };

export function fit(plan: Plan, requirements: ServerRequirements | null): PlanFit {
  if (!requirements) return { blocked: null, warnings: [] };

  const warnings: string[] = [];
  let blocked: string | null = null;

  if (plan.disk !== undefined && requirements.storage_gb !== null && plan.disk < requirements.storage_gb) {
    blocked = `${plan.disk} GB disk is too small`;
  }
  if (plan.architecture && requirements.architecture && plan.architecture !== requirements.architecture) {
    blocked = `${plan.architecture} processor, ${requirements.source} is ${requirements.architecture}`;
  }
  if (plan.cores !== undefined && requirements.cores !== null && plan.cores < requirements.cores) {
    warnings.push(`fewer vCPU than ${requirements.source}`);
  }
  if (plan.memory !== undefined && requirements.memory_gb !== null && plan.memory < requirements.memory_gb) {
    warnings.push(`less memory than ${requirements.source}`);
  }

  return { blocked, warnings };
}

/**
 * Name, provider, region and plan for a server Vito creates to match an existing one. Plans that cannot hold the
 * databases, or that run on another processor architecture, cannot be picked.
 */
export default function ProvisionServerFields({
  data,
  setData,
  errors,
  requirements,
  onFitChange,
  warningSuffix,
}: {
  data: ProvisionServerData;
  setData: (patch: Partial<ProvisionServerData>) => void;
  errors: Record<string, string | undefined>;
  requirements: ServerRequirements | null;
  onFitChange?: (fit: PlanFit) => void;
  warningSuffix?: string;
}) {
  const [providers, setProviders] = useState<ServerProvider[]>([]);
  const [regions, setRegions] = useState<Record<string, string>>({});
  const [plans, setPlans] = useState<Record<string, Plan>>({});
  const selected = plans[data.plan] ? fit(plans[data.plan], requirements) : null;

  useEffect(() => {
    axios
      .get<ServerProvider[]>(route('server-providers.json'))
      .then((response) => setProviders(response.data))
      .catch(() => setProviders([]));
  }, []);

  useEffect(() => {
    onFitChange?.(selected ?? { blocked: null, warnings: [] });
  }, [onFitChange, selected?.blocked, selected?.warnings.join(',')]);

  const selectProvider = (id: string) => {
    setData({ server_provider: id, region: '', plan: '' });
    setRegions({});
    setPlans({});
    axios
      .get<Record<string, string>>(route('server-providers.regions', { serverProvider: id }))
      .then((response) => setRegions(response.data))
      .catch(() => setRegions({}));
  };

  const selectRegion = (region: string) => {
    setData({ region, plan: '' });
    setPlans({});
    axios
      .get<Record<string, Plan | string>>(route('server-providers.plans', { serverProvider: data.server_provider, region }))
      .then((response) =>
        setPlans(
          Object.fromEntries(Object.entries(response.data).map(([name, plan]) => [name, typeof plan === 'string' ? { label: plan, available: true } : plan])),
        ),
      )
      .catch(() => setPlans({}));
  };

  return (
    <>
      <FormField>
        <Label htmlFor="provision-name">Server name</Label>
        <Input id="provision-name" value={data.name} onChange={(e) => setData({ name: e.target.value })} />
        <InputError message={errors.name} />
      </FormField>

      <FormField>
        <Label>Provider</Label>
        <Select value={data.server_provider} onValueChange={selectProvider}>
          <SelectTrigger>
            <SelectValue placeholder="Select a server provider" />
          </SelectTrigger>
          <SelectContent>
            {providers.map((provider) => (
              <SelectItem key={provider.id} value={String(provider.id)}>
                {provider.name} ({provider.provider})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <InputError message={errors.server_provider} />
      </FormField>

      <FormField>
        <Label>Region</Label>
        <Select value={data.region} onValueChange={selectRegion} disabled={Object.keys(regions).length === 0}>
          <SelectTrigger>
            <SelectValue placeholder="Select a region" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(regions).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <InputError message={errors.region} />
      </FormField>

      <FormField>
        <Label>Plan</Label>
        <Select value={data.plan} onValueChange={(plan) => setData({ plan })} disabled={Object.keys(plans).length === 0}>
          <SelectTrigger>
            <SelectValue placeholder="Select a plan" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(plans).map(([name, plan]) => {
              const check = fit(plan, requirements);

              return (
                <SelectItem key={name} value={name} disabled={!plan.available || check.blocked !== null}>
                  {plan.label}
                  {check.blocked ? ` — ${check.blocked}` : check.warnings.length > 0 ? ` — ${check.warnings.join(', ')}` : ''}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {selected && selected.warnings.length > 0 && (
          <p className="text-warning text-sm">
            This plan has {selected.warnings.join(' and ')}. {warningSuffix ?? `The new server may be slower than ${requirements?.source ?? 'the source'}.`}
          </p>
        )}
        <InputError message={errors.plan} />
      </FormField>
    </>
  );
}
