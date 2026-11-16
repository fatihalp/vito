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
    public const array DRIVERS = ['systemd', 'docker', 'supervisor', 'systemd_user', 'rootless_docker'];

    public static function usesUser(string $driver): bool
    {
        return in_array($driver, ['systemd_user', 'rootless_docker'], true);
    }

    public function validateName(string $driver, string $name): void
    {
        Validator::make(['runtime_name' => $name], [
            'runtime_name' => ['required', 'string', 'max:128', 'regex:/^[A-Za-z0-9][A-Za-z0-9_.@:-]*$/D', Rule::notIn($driver === 'supervisor' ? ['all'] : [])],
        ])->validate();
    }

    public function validateContext(Server $server, string $driver, string $user): void
    {
        Validator::make(['driver' => $driver, 'unix_user' => $user], [
            'driver' => ['required', Rule::in(self::DRIVERS)],
            'unix_user' => ['string', 'max:32', Rule::requiredIf(self::usesUser($driver)), Rule::prohibitedIf(! self::usesUser($driver)), 'regex:/^[A-Za-z_][A-Za-z0-9_-]*$/D', Rule::notIn(['root'])],
        ])->validate();
        if (self::usesUser($driver)) {
            $registered = IsolatedUser::query()->where('server_id', $server->id)->where('username', $user)->first(['username']);
            if ($registered?->username !== $user) {
                throw ValidationException::withMessages(['unix_user' => __('Select an isolated Linux user registered on this server.')]);
            }
        }
    }

    public function prefix(Server $server, string $driver, string $user = ''): string
    {
        $this->validateContext($server, $driver, $user);
        if (! self::usesUser($driver)) {
            return 'sudo -n '.match ($driver) {
                'systemd' => 'systemctl',
                'docker' => 'docker',
                'supervisor' => 'supervisorctl',
            };
        }
        try {
            $uid = trim($server->ssh()->clearLog()->exec('id -u -- '.escapeshellarg($user), timeout: 10, outputLimit: 64));
        } catch (Throwable) {
            throw ValidationException::withMessages(['unix_user' => __('Could not verify the runtime user on this server.')]);
        }
        if (! ctype_digit($uid) || strlen($uid) > 10 || (int) $uid < 1000 || (int) $uid > 4294967294) {
            throw ValidationException::withMessages(['unix_user' => __('User runtimes require a verified, non-system Linux user.')]);
        }
        $directory = '/run/user/'.(int) $uid;
        $prefix = 'sudo -n -u '.escapeshellarg($user).' -- env XDG_RUNTIME_DIR='.escapeshellarg($directory).' DBUS_SESSION_BUS_ADDRESS='.escapeshellarg('unix:path='.$directory.'/bus');
        if ($driver === 'systemd_user') {
            return $prefix.' systemctl --user';
        }
        $socket = 'unix://'.$directory.'/docker.sock';
        $prefix .= ' DOCKER_HOST='.escapeshellarg($socket).' docker --host='.escapeshellarg($socket);
        try {
            $options = json_decode($server->ssh()->clearLog()->exec($prefix." info --format '{{json .SecurityOptions}}'", timeout: 15, outputLimit: 4096), true, flags: JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            throw ValidationException::withMessages(['runtime' => __('Could not verify the selected rootless Docker daemon.')]);
        }
        if (! is_array($options) || (! in_array('name=rootless', $options, true) && ! in_array('rootless', $options, true))) {
            throw ValidationException::withMessages(['runtime' => __('The selected Docker socket is not a verified rootless daemon.')]);
        }

        return $prefix;
    }
}
