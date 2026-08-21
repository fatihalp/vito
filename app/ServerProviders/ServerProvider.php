<?php

namespace App\ServerProviders;

interface ServerProvider
{
    public static function id(): string;

    
    public function createRules(array $input): array;

    
    public function credentialValidationRules(array $input): array;

    
    public function credentialData(array $input): array;

    
    public function data(array $input): array;

    
    public function connect(array $credentials): bool;

    
    public function plans(?string $region): array;

    
    public function availablePlans(?string $region): array;

    
    public function regions(): array;

    public function generateKeyPair(): void;

    public function create(): void;

    public function isRunning(): bool;

    public function canPowerManage(): bool;

    public function stop(): void;

    public function start(): void;

    public function delete(): void;
}
