<?php

namespace App\SSH\OS;

use App\Models\Server;
use App\Models\Site;

class Git
{
    public function clone(Site $site, ?string $path = null, ?Server $server = null): void
    {
        $usesToken = $site->sourceControl?->isGithubApp() ?? false;
        $ssh = ($server ?? $site->server)->ssh($site->user);

        if ($usesToken) {
            $ssh = $ssh->variables($site->environmentVariables());
        }

        $repoUrl = (string) $site->getFullRepositoryUrl();
        $ssh->exec(
            view('ssh.git.clone', [
                'host' => $this->sshHost($repoUrl, $usesToken),
                'repo' => escapeshellarg($repoUrl),
                'path' => escapeshellarg((string) ($path ?? $site->path)),
                'branch' => escapeshellarg((string) $site->branch),
                'key' => $site->getSshKeyName(),
                'port' => $site->sourceControl?->provider()?->getSshPort() ?? 22,
                'usesToken' => $usesToken,
            ]),
            'clone-repository',
            $site->id
        );
    }

    public function checkout(Site $site, ?Server $server = null, ?string $path = null): void
    {
        $ssh = ($server ?? $site->server)->ssh($site->user);

        if ($site->isSelf()) {
            $this->prepareSelf($site);
            $ssh = $ssh->variables($site->environmentVariables());
        }

        $ssh->exec(
            view('ssh.git.checkout', [
                'path' => escapeshellarg((string) ($path ?? $site->path)),
                'branch' => escapeshellarg((string) $site->branch),
            ]),
            'checkout-branch',
            $site->id
        );
    }

    public function fetchOrigin(Site $site, ?Server $server = null, ?string $path = null): void
    {
        $ssh = ($server ?? $site->server)->ssh($site->user);

        if ($site->isSelf()) {
            $this->prepareSelf($site);
            $ssh = $ssh->variables($site->environmentVariables());
        } elseif ($site->sourceControl?->isGithubApp()) {
            $ssh = $ssh->variables($site->environmentVariables());
        }

        $ssh->exec(
            view('ssh.git.fetch-origin', [
                'path' => escapeshellarg((string) ($path ?? $site->path)),
            ]),
            'fetch-origin',
            $site->id
        );
    }

    public function setRemote(Site $site, string $newRepoUrl): void
    {
        $usesToken = $site->sourceControl?->isGithubApp() ?? false;
        $ssh = $site->server->ssh($site->user);

        if ($usesToken) {
            $ssh = $ssh->variables($site->environmentVariables());
        }

        $ssh->exec(
            view('ssh.git.set-remote', [
                'path' => escapeshellarg((string) $site->path),
                'newRepoUrl' => escapeshellarg($newRepoUrl),
                'usesToken' => $usesToken,
                'host' => $this->sshHost($newRepoUrl, $usesToken),
                'key' => $site->getSshKeyName(),
                'port' => $site->sourceControl?->provider()?->getSshPort() ?? 22,
            ]),
            'set-remote',
            $site->id
        );
    }

    private function sshHost(string $repoUrl, bool $usesToken): string
    {
        return $usesToken ? '' : str($repoUrl)->after('@')->before('-')->toString();
    }

    public function prepareSelf(Site $site): void
    {
        if (! $site->isSelf() || ! $site->path) {
            return;
        }

        $site->server->ssh($site->user)->exec(
            view('ssh.git.prepare-self', ['path' => escapeshellarg($site->path)]),
            'prepare-self-repository',
            $site->id
        );
    }

    public function lastCommit(Site $site, ?string $path = null): ?array
    {
        $targetPath = $path ?? $site->path;
        if (! $targetPath) {
            return null;
        }

        try {
            $escapedPath = escapeshellarg($targetPath);
            $output = trim($site->server->ssh($site->user)->exec(
                "cd {$escapedPath} && git -c safe.directory={$escapedPath} log -1 --format=\"%H%n%an%n%ae%n%s%n%cI\" 2>/dev/null || true"
            ));
            $lines = explode("\n", $output);

            if (count($lines) >= 4 && preg_match('/^[0-9a-f]{40}$/i', trim($lines[0]))) {
                return [
                    'commit_id' => trim($lines[0]),
                    'commit_data' => [
                        'name' => trim($lines[1]),
                        'email' => trim($lines[2]),
                        'message' => trim($lines[3]),
                        'date' => isset($lines[4]) && trim($lines[4]) !== '' ? trim($lines[4]) : null,
                    ],
                ];
            }
        } catch (\Throwable) {
        }

        return null;
    }
}
