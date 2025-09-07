<?php

namespace App\Contracts\Actions\SshKey;

use App\Models\Server;
use App\Models\SshKey;

interface DeployKeyToServer
{
    public function deploy(Server $server, SshKey $sshKey): void;
}
