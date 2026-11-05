<?php

namespace App\StorageProviders;

interface ReportsConnectionErrors
{
    public function connectionError(): ?string;
}
