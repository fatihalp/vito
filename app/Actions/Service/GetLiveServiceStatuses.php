<?php

namespace App\Actions\Service;

use App\Models\Server;

class GetLiveServiceStatuses
{
    public function get(Server $server): array
    {
        if (! $server->isReady()) {
            return [];
        }

        $services = $server->services()
            ->whereIn('status', SyncServiceStatus::SETTLED_STATUSES)
            ->get();

        $checkable = [];
        $units = [];

        foreach ($services as $service) {
            if (! $service->hasHandler()) {
                continue;
            }

            $unit = $service->handler()->unit();

            if ($unit === '') {
                continue;
            }

            $checkable[] = $service;
            $units[] = $unit;
        }

        if ($units === []) {
            return [];
        }

        $states = $server->systemd()->activeStates($units);
        $result = [];

        foreach ($checkable as $index => $service) {
            $state = $states[$index] ?? 'unknown';
            $result[$service->id] = [
                'state' => $state,
                'color' => $this->stateColor($state),
            ];
        }

        return $result;
    }

    private function stateColor(string $state): string
    {
        return match ($state) {
            'active' => 'success',
            'inactive', 'failed' => 'danger',
            'activating', 'deactivating', 'reloading' => 'warning',
            default => 'gray',
        };
    }
}
