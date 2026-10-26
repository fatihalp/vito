<?php

namespace App\SSH\OS;

use App\Exceptions\SSHError;
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
                'host' => $usesToken ? '' : str($repoUrl)->after('@')->before('-'),
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
            ]),
            'set-remote',
            $site->id
        );
    }

    public function prepareSelf(Site $site): void
    {
        if (! $site->isSelf() || ! $site->path) {
            return;
        }

        $escapedPath = escapeshellarg($site->path);
        $user = $site->user ?: (string) config('core.ssh_user', 'vito');
        $escapedUser = escapeshellarg($user);
        $escapedHome = escapeshellarg(home_path($user));

        try {
            $site->server->ssh($site->user)->exec(<<<BASH
sudo -n bash -c '
  user={$escapedUser}
  home_dir={$escapedHome}
  mkdir -p "\$home_dir/.ssh"
  touch "\$home_dir/.ssh/config" "\$home_dir/.ssh/known_hosts"
  for key in /root/.ssh/id_ed25519 /root/.ssh/id_rsa /root/.ssh/id_ecdsa; do
    if [ -f "\$key" ]; then
      target="\$home_dir/.ssh/root_\$(basename "\$key")"
      cp -f "\$key" "\$target"
      chmod 600 "\$target"
      grep -qxF "IdentityFile \$target" "\$home_dir/.ssh/config" || echo "IdentityFile \$target" >> "\$home_dir/.ssh/config"
    fi
  done
  if [ -f /root/.ssh/known_hosts ]; then
    cat /root/.ssh/known_hosts >> "\$home_dir/.ssh/known_hosts"
  fi
  chmod 600 "\$home_dir/.ssh/config"
  chmod 644 "\$home_dir/.ssh/known_hosts"
  chown -R "\$user:\$user" "\$home_dir/.ssh" {$escapedPath}
' 2>/dev/null || true
git config --global --add safe.directory {$escapedPath} 2>/dev/null || true
BASH);
        } catch (\Throwable) {
        }
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
                "cd {$escapedPath} && git -c safe.directory={$escapedPath} log -1 --format=\"%H%n%an%n%ae%n%s\" 2>/dev/null || true"
            ));
            $lines = explode("\n", $output);

            if (count($lines) >= 4 && preg_match('/^[0-9a-f]{40}$/i', trim($lines[0]))) {
                return [
                    'commit_id' => trim($lines[0]),
                    'commit_data' => [
                        'name' => trim($lines[1]),
                        'email' => trim($lines[2]),
                        'message' => trim($lines[3]),
                    ],
                ];
            }
        } catch (\Throwable) {
        }

        return null;
    }
}
