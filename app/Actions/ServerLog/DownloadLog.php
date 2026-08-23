<?php

namespace App\Actions\ServerLog;

use App\Models\ServerLog;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DownloadLog
{
    public function download(ServerLog $log): StreamedResponse
    {
        if ($log->is_remote) {
            $tmpName = $log->server->id.'-'.strtotime('now').'-'.$log->type.'.log';
            $tmpPath = Storage::disk('local')->path($tmpName);

            $log->server->ssh()->download($tmpPath, $log->name);

            dispatch(function () use ($tmpPath): void {
                if (File::exists($tmpPath)) {
                    File::delete($tmpPath);
                }
            })
                ->delay(now()->addMinutes(5))
                ->onQueue('default');

            return Storage::disk('local')->download($tmpName, str($log->name)->afterLast('/'));
        }

        if (! Storage::disk($log->disk)->exists($log->name)) {
            abort(404, "Log file doesn't exist or is empty!");
        }

        return Storage::disk($log->disk)->download($log->name);
    }
}
