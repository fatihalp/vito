<?php

namespace App\Contracts\Actions\ServerLog;

use App\Models\ServerLog;

interface UpdateLog
{
    public function update(ServerLog $serverLog, array $input): void;
}
