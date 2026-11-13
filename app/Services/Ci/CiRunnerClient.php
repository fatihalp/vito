<?php

namespace App\Services\Ci;

use App\Models\CiRunner;
use App\Models\Site;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use Throwable;

class CiRunnerClient
{
    public function repository(?string $repository): string
    {
        $repository = strtolower(preg_replace('/\.git$/i', '', trim($repository ?? '', " /\t\n\r")));
        if (! preg_match('~^[a-z0-9_.-]+(?:/[a-z0-9_.-]+)+$~', $repository) || strlen($repository) > 255 || in_array('..', explode('/', $repository), true)) {
            throw ValidationException::withMessages(['ci' => __('Connect a repository to this site before configuring CI.')]);
        }

        return $repository;
    }

    public function sourceIdentity(Site $site): array
    {
        $source = $site->sourceControl;
        if (! $source || $source->id !== $site->source_control_id || $source->trashed() || ! in_array($source->provider, ['github', 'github-app', 'gitlab'], true)) {
            throw ValidationException::withMessages(['ci' => __('Connect a supported source-control provider before configuring CI.')]);
        }
        if ($source->provider === 'gitlab' && (int) ($source->provider_data['ssh_port'] ?? 22) !== 22) {
            throw ValidationException::withMessages(['ci' => __('This CI protocol does not support a custom source-control SSH port.')]);
        }
        $url = in_array($source->provider, ['github', 'github-app'], true) ? 'https://github.com' : ($source->url ?: 'https://gitlab.com');
        $parts = parse_url($url);
        if (! is_array($parts) || ($parts['scheme'] ?? null) !== 'https' || empty($parts['host']) || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])) {
            throw ValidationException::withMessages(['ci' => __('The source-control origin is not supported by CI.')]);
        }
        $origin = 'https://'.strtolower($parts['host']).(isset($parts['port']) ? ':'.$parts['port'] : '').rtrim($parts['path'] ?? '', '/');

        return [
            'source_control_id' => $source->id,
            'source_origin' => $origin,
            'source_fingerprint' => hash('sha256', json_encode([$source->id, $source->provider, $source->url, $this->repository($site->repository)], JSON_THROW_ON_ERROR)),
        ];
    }

    public function info(CiRunner $runner): array
    {
        if ($runner->server->is_self) {
            throw ValidationException::withMessages(['ci' => __('CI jobs must run outside the Vito control-plane server.')]);
        }
        $key = hash('sha256', implode('|', [$runner->server_id, $runner->user, $runner->executable, $runner->repository, $runner->source_fingerprint, $runner->source_origin]));
        $info = Cache::remember('ci-runner-info:'.$key, 15, fn () => $this->exchange($runner, ['action' => 'info']));
        if (($info['protocol'] ?? null) !== 1 || ($info['source_origin'] ?? null) !== $runner->source_origin || ! is_string($info['repository'] ?? null) || $this->repository($info['repository'] ?? null) !== $runner->repository || ! is_array($info['stages'] ?? null) || ! $info['stages'] || count($info['stages']) > 20) {
            throw ValidationException::withMessages(['ci' => __('The runner does not match this repository or uses an unsupported protocol.')]);
        }
        foreach ($info['stages'] as $stage) {
            if (! is_string($stage) || ! preg_match('/^[a-z][a-z0-9-]{0,39}$/', $stage)) {
                throw ValidationException::withMessages(['ci' => __('The runner returned invalid stage information.')]);
            }
        }

        return $info;
    }

    public function request(CiRunner $runner, array $request): array
    {
        if (! $runner->enabled && ($request['action'] ?? null) === 'run') {
            throw ValidationException::withMessages(['ci' => __('CI is paused. Ask an administrator to enable the runner.')]);
        }
        $identity = $this->sourceIdentity($runner->site);
        if ($identity['source_control_id'] !== $runner->source_control_id || $identity['source_fingerprint'] !== $runner->source_fingerprint
            || $identity['source_origin'] !== $runner->source_origin || $this->repository($runner->site->repository) !== $runner->repository) {
            throw ValidationException::withMessages(['ci' => __('The site repository changed. Ask an administrator to reconnect CI.')]);
        }
        $this->info($runner);

        return $this->exchange($runner, $request);
    }

    public function assertRun(CiRunner $runner, array $run): void
    {
        if (($run['source_origin'] ?? null) !== $runner->source_origin || ! is_string($run['repository'] ?? null) || ! is_string($run['run_id'] ?? null) || $this->repository($run['repository'] ?? null) !== $runner->repository || ! preg_match('/^[a-f0-9]{16}$/', $run['run_id'] ?? '')) {
            throw ValidationException::withMessages(['ci' => __('The CI result does not belong to this repository.')]);
        }
    }

    public function reference(string $value): string
    {
        if (preg_match('/^[a-fA-F0-9]{40}$/', $value)) {
            return strtolower($value);
        }
        if (preg_match('/^pr:[1-9][0-9]{0,7}$/', $value)) {
            return $value;
        }
        $branch = str_starts_with($value, 'refs/heads/') ? substr($value, 11) : $value;
        $valid = strlen($value) <= 200 && preg_match('~^[A-Za-z0-9_][A-Za-z0-9_./-]*$~', $branch)
            && ! str_contains($branch, '..') && ! str_contains($branch, '//')
            && ! str_ends_with($branch, '/') && ! str_ends_with($branch, '.');
        foreach (explode('/', $branch) as $part) {
            $valid = $valid && ! str_starts_with($part, '.') && ! str_ends_with($part, '.lock');
        }
        if (! $valid) {
            throw ValidationException::withMessages(['ref' => __('Enter a branch, pr:N or a full 40-character commit SHA.')]);
        }

        return $value;
    }

    protected function exchange(CiRunner $runner, array $request): array
    {
        $json = json_encode($request, JSON_THROW_ON_ERROR);
        if (strlen($json) > 8192) {
            throw ValidationException::withMessages(['ci' => __('The CI request is too large.')]);
        }
        $command = 'printf %s '.escapeshellarg(base64_encode($json)).' | base64 --decode | sudo -n -u '.escapeshellarg($runner->user).' -- '.escapeshellarg($runner->executable).' api';
        try {
            $output = $runner->server->ssh()->clearLog()->exec($command, timeout: 20, outputLimit: 1048576);
            if (strlen($output) > 1048576) {
                throw new \RuntimeException('Oversized CI response');
            }
            $response = json_decode(trim($output), true, 32, JSON_THROW_ON_ERROR);
            if (! is_array($response) || ! array_key_exists('ok', $response)) {
                throw new \RuntimeException('Malformed CI response');
            }
        } catch (Throwable) {
            throw ValidationException::withMessages(['ci' => __('Could not reach the CI runner. Check its SSH connection and runner service.')]);
        }
        if ($response['ok'] !== true) {
            $error = is_string($response['error'] ?? null) ? $response['error'] : '';
            $message = match (true) {
                str_contains($error, 'A CI run is active') => __('A CI job is already running. Wait for it to finish or cancel it.'),
                str_contains($error, 'Run not found') => __('This CI result is unavailable or its retention period has expired.'),
                default => __('The runner rejected this request. Check the reference, selected stages and runner configuration.'),
            };
            throw ValidationException::withMessages(['ci' => $message]);
        }
        if (! is_array($response['data'] ?? null)) {
            throw ValidationException::withMessages(['ci' => __('The runner returned an invalid response.')]);
        }

        return $response['data'];
    }
}
