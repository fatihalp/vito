<?php

use App\Models\Project;
use App\Models\Server;
use App\Models\Site;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Server::withoutGlobalScopes()->where('is_self', true)->each(function (Server $server): void {
            Server::withoutGlobalScopes()->whereKey($server->id)->whereIn('name', ['Vito sunucusu', 'PurePanel sunucusu'])->update(['name' => 'Pure server']);
            Project::withTrashed()->whereKey($server->project_id)->whereIn('name', ['Vito', 'PurePanel'])->update(['name' => 'Pure']);
            Site::query()->where('server_id', $server->id)->whereIn('domain', ['Vito', 'PurePanel'])->update(['domain' => 'Pure']);
        });
    }

    public function down(): void
    {
        Server::withoutGlobalScopes()->where('is_self', true)->each(function (Server $server): void {
            Server::withoutGlobalScopes()->whereKey($server->id)->where('name', 'Pure server')->update(['name' => 'Vito sunucusu']);
            Project::withTrashed()->whereKey($server->project_id)->where('name', 'Pure')->update(['name' => 'Vito']);
            Site::query()->where('server_id', $server->id)->where('domain', 'Pure')->update(['domain' => 'Vito']);
        });
    }
};
