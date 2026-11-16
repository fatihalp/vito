<?php

namespace App\Actions\SSL;

use App\Models\Server;
use App\Models\Ssl;
use Illuminate\Database\Eloquent\Builder;

class ListServerSsls
{
    public function query(Server $server): Builder
    {
        return Ssl::query()
            ->where(
                fn (Builder $query) => $query
                    ->where('server_id', $server->id)
                    ->orWhereHas('site', fn (Builder $sites) => $sites->where('server_id', $server->id))
            )
            ->with(['log', 'site:id,domain,server_id']);
    }
}
