<?php

namespace App\Contracts\Actions\FirewallRule;

use App\Models\FirewallRule;
use App\Models\Server;

interface ManageRule
{
    public function create(Server $server, array $input): FirewallRule;

    public function update(FirewallRule $rule, array $input): FirewallRule;

    public function delete(FirewallRule $rule): void;
}
