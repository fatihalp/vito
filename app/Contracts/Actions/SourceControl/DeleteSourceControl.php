<?php

namespace App\Contracts\Actions\SourceControl;

use App\Models\SourceControl;

interface DeleteSourceControl
{
    public function delete(SourceControl $sourceControl): void;
}
