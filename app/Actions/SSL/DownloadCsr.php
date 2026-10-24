<?php

namespace App\Actions\SSL;

use App\Enums\SslStatus;
use App\Models\Server;
use App\Models\Ssl;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DownloadCsr
{
    /**
     * Copies the CSR from the server into local storage, streams it, and removes the copy a few minutes later.
     */
    public function download(Server $server, Ssl $ssl): StreamedResponse
    {
        $csrPath = $ssl->csr_data['csr_path'] ?? null;

        if (! $ssl->has_csr || $ssl->status !== SslStatus::CREATED || ! $csrPath) {
            abort(404, 'CSR file is not available for download.');
        }

        $tmpName = $server->id.'-'.now()->timestamp.'-csr-'.$ssl->id.'.csr';
        $tmpPath = Storage::disk('local')->path($tmpName);

        $server->ssh()->download($tmpPath, $csrPath);

        dispatch(function () use ($tmpPath): void {
            File::delete($tmpPath);
        })->delay(now()->addMinutes(5))->onQueue('default');

        return Storage::disk('local')->download($tmpName, 'request.csr');
    }
}
