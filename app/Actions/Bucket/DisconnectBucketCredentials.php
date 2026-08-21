<?php

namespace App\Actions\Bucket;

use App\Models\BucketCredential;

class DisconnectBucketCredentials
{
    public function disconnect(BucketCredential $credential): void
    {
        $credential->delete();
    }
}
