<?php

namespace App\SSH\Storage;

use App\Exceptions\SSHError;

class Local extends AbstractStorage
{
    
    public function upload(string $src, string $dest): array
    {
        $destDir = dirname($dest);
        $this->server->ssh()->exec(
            view('ssh.storage.local.upload', [
                'src' => $src,
                'destDir' => $destDir,
                'destFile' => $dest,
            ]),
            'upload-to-local'
        );

        return [
            'size' => null,
        ];
    }

    
    public function download(string $src, string $dest): void
    {
        $this->server->ssh()->exec(
            view('ssh.storage.local.download', [
                'src' => $src,
                'dest' => $dest,
            ]),
            'download-from-local'
        );
    }

    
    public function delete(string $src): void
    {
        $this->server->os()->deleteFile($src);
    }
}
