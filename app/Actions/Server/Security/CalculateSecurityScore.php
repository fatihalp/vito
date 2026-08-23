<?php

namespace App\Actions\Server\Security;

use App\Enums\SecurityControlStatus;
use App\Enums\ServiceStatus;
use App\Models\Server;
use App\Models\Service;

class CalculateSecurityScore
{
    public function calculate(Server $server): array
    {
        $state = $server->securityState();
        $fail2ban = $server->fail2ban();
        $firewall = $server->firewall();
        $ready = SecurityControlStatus::READY->value;

        $checks = [
            ['key' => 'auto_update', 'label' => 'Automatic updates enabled', 'passed' => (bool) $server->auto_update],
            ['key' => 'firewall', 'label' => 'Firewall installed', 'passed' => $firewall instanceof Service && $firewall->status === ServiceStatus::READY],
            ['key' => 'fail2ban', 'label' => 'Fail2ban installed', 'passed' => $fail2ban instanceof Service && $fail2ban->status === ServiceStatus::READY],
            ['key' => 'password_auth', 'label' => 'Password authentication disabled', 'passed' => $state['password_authentication']['enabled'] === false && $state['password_authentication']['status'] === $ready],
        ];

        if ($server->getSshUser() !== 'root') {
            $checks[] = ['key' => 'root_login', 'label' => 'Root SSH login disabled', 'passed' => $state['root_login']['enabled'] === false && $state['root_login']['status'] === $ready];
        }

        $passed = count(array_filter($checks, fn (array $check): bool => $check['passed']));

        return [
            'score' => (int) round($passed / count($checks) * 100),
            'passed' => $passed,
            'total' => count($checks),
            'checks' => $checks,
        ];
    }
}
