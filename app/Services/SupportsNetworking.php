<?php

namespace App\Services;

use App\Exceptions\SSHError;

interface SupportsNetworking
{
    public function networkingEnabled(): bool;

    public function networkingManaged(): bool;

    public function networkingFailed(): bool;

    public function networkingSecret(): ?string;

    public function prepareNetworking(): void;

    
    public function enableNetworking(): void;

    
    public function disableNetworking(): void;

    public function networkingPort(): int;

    
    public function networkingDetails(): array;

    public function networkingProbeCommand(): string;

    public function networkingProbeRequiresRunning(): bool;

    public function parseNetworkingProbe(string $output): ?bool;

    public function rememberEffectiveNetworking(?bool $effective, bool $observed = true): void;
}
