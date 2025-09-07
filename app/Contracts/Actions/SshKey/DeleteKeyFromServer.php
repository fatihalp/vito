<?php

namespace App\Contracts\Actions\SshKey;

use App\Models\Server;
use App\Models\SshKey;

interface DeleteKeyFromServer
{
    public function delete(Server $server, SshKey $sshKey): void;
}
