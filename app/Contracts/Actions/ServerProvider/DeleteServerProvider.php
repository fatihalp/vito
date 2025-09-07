<?php

namespace App\Contracts\Actions\ServerProvider;

use App\Models\ServerProvider;

interface DeleteServerProvider
{
    public function delete(ServerProvider $serverProvider): void;
}
