<?php

namespace App\SiteTypes;

use App\Models\Deployment;

interface SiteType
{
    public static function id(): string;

    public function language(): string;

    public function requiredServices(): array;

    
    public function createRules(array $input): array;

    
    public function createFields(array $input): array;

    
    public function data(array $input): array;

    public function install(): void;

    public function assertReadyToDeploy(): void;

    
    public function baseCommands(): array;

    
    public function vhostData(): array;

    
    public function supportedWebservers(): ?array;

    public function vhostTemplate(string $webserver): ?string;

    
    public function deploymentEnvironment(): array;

    public function afterDeploy(Deployment $deployment): void;

    public function defaultDeploymentScript(): string;

    public function defaultBuildScript(): string;

    public function defaultPreFlightScript(): string;
}
