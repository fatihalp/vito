<?php

namespace App\Actions\Server;

use App\Actions\Monitoring\ScanServerCleanup;
use App\DTOs\ServiceLog;
use App\Models\Server;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class ClearServiceLog
{
    public function run(Server $server, array $input): void
    {
        $data = Validator::make($input, [
            'key' => ['required', 'string', 'max:500'],
        ])->validate();

        if (str_starts_with($data['key'], 'docker:')) {
            $path = substr($data['key'], 7);
            abort_unless(ScanServerCleanup::isDockerLogPath($path), 404);
            $server->os()->clearFile($path);

            return;
        }

        $log = app(GetServiceLogs::class)->resolve($server, $data['key']);
        abort_if($log === null, 404);

        if ($log->source !== ServiceLog::SOURCE_FILE) {
            throw ValidationException::withMessages(['key' => 'Journal logs cannot be cleared.']);
        }

        $server->os()->clearFile($log->target);
    }
}
