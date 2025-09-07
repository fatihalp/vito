<?php

namespace App\Contracts\Actions\Script;

use App\Models\Script;
use App\Models\ScriptExecution;
use App\Models\User;

interface ExecuteScript
{
    public function execute(Script $script, User $user, array $input): ScriptExecution;
}
