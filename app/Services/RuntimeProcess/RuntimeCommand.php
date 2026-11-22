<?php

namespace App\Services\RuntimeProcess;

use App\Models\IsolatedUser;
use App\Models\Server;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class RuntimeCommand
{
    private const array DRIVERS = ['docker', 'rootless_docker'];

    public function prefix(Server $server, string $driver, string $user = ''): string
    {
        $isRootless = $driver === 'rootless_docker';

        $this->validateContext($server, $driver, $user, $isRootless);

        if (! $isRootless) {
            return 'sudo -n docker';
        }

        $uid = $this->verifiedUserId($server, $user);
        $directory = '/run/user/'.$uid;
        $socket = 'unix://'.$directory.'/docker.sock';
        $prefix = implode(' ', [
            'sudo -n -u',
            escapeshellarg($user),
            '-- env XDG_RUNTIME_DIR='.escapeshellarg($directory),
            'DBUS_SESSION_BUS_ADDRESS='.escapeshellarg('unix:path='.$directory.'/bus'),
            'DOCKER_HOST='.escapeshellarg($socket),
            'docker --host='.escapeshellarg($socket),
        ]);

        $this->assertRootlessDocker($server, $prefix);

        return $prefix;
    }

    private function validateContext(Server $server, string $driver, string $user, bool $isRootless): void
    {
        Validator::make(['driver' => $driver, 'unix_user' => $user], [
            'driver' => ['required', Rule::in(self::DRIVERS)],
            'unix_user' => [
                'string',
                'max:32',
                Rule::requiredIf($isRootless),
                Rule::prohibitedIf(! $isRootless),
                'regex:/^[A-Za-z_][A-Za-z0-9_-]*$/D',
                Rule::notIn(['root']),
            ],
        ])->validate();

        if (! $isRootless) {
            return;
        }

        $registered = IsolatedUser::query()
            ->where('server_id', $server->id)
            ->where('username', $user)
            ->first(['username']);

        if ($registered?->username !== $user) {
            throw ValidationException::withMessages([
                'unix_user' => 'Select an isolated Linux user registered on this server.',
            ]);
        }
    }

    private function verifiedUserId(Server $server, string $user): int
    {
        try {
            $uid = trim($server->ssh()->clearLog()->exec(
                'id -u -- '.escapeshellarg($user),
                timeout: 10,
                outputLimit: 64,
            ));
        } catch (Throwable) {
            throw ValidationException::withMessages([
                'unix_user' => 'Could not verify the runtime user on this server.',
            ]);
        }
        $isNonSystemUser = ctype_digit($uid) && strlen($uid) <= 10 && (int) $uid >= 1000 && (int) $uid <= 4294967294;
        if (! $isNonSystemUser) {
            throw ValidationException::withMessages([
                'unix_user' => 'User runtimes require a verified, non-system Linux user.',
            ]);
        }

        return (int) $uid;
    }

    private function assertRootlessDocker(Server $server, string $prefix): void
    {
        try {
            $options = json_decode(
                $server->ssh()->clearLog()->exec(
                    $prefix." info --format '{{json .SecurityOptions}}'",
                    timeout: 15,
                    outputLimit: 4096,
                ),
                true,
                flags: JSON_THROW_ON_ERROR,
            );
        } catch (Throwable) {
            throw ValidationException::withMessages([
                'runtime' => 'Could not verify the selected rootless Docker daemon.',
            ]);
        }
        $isRootless = is_array($options)
            && (in_array('name=rootless', $options, true) || in_array('rootless', $options, true));
        if (! $isRootless) {
            throw ValidationException::withMessages([
                'runtime' => 'The selected Docker socket is not a verified rootless daemon.',
            ]);
        }
    }
}
