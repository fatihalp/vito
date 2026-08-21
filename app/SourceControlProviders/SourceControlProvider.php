<?php

namespace App\SourceControlProviders;

use App\Exceptions\FailedToDeployGitHook;
use App\Exceptions\FailedToDeployGitKey;
use App\Exceptions\FailedToDestroyGitHook;

interface SourceControlProvider
{
    public static function id(): string;

    
    public function createRules(array $input): array;

    
    public function createData(array $input): array;

    
    public function data(): array;

    public function connect(): bool;

    public function getRepo(string $repo): mixed;

    public function fullRepoUrl(string $repo, string $key): string;

    public function getSshPort(): int;

    
    public static function editableFields(): array;

    
    public function editRules(array $input): array;

    
    public function editData(array $input): array;

    
    public function deployHook(string $repo, array $events, string $secret): array;

    
    public function destroyHook(string $repo, string $hookId): void;

    
    public function getLastCommit(string $repo, string $branch): ?array;

    
    public function deployKey(string $title, string $repo, string $key): string;

    public function deleteDeployKey(string $keyId, string $repo): void;

    
    public function getWebhookBranch(array $payload): string;

    public function getRepos(bool $useCache = true): array;

    public function getBranches(string $repo, bool $useCache = true): array;
}
