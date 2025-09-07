<?php

namespace App\Actions\SourceControl;

use App\Contracts\Actions\SourceControl\DeleteSourceControl as DeleteSourceControlContract;
use App\Models\SourceControl;
use Illuminate\Validation\ValidationException;

class DeleteSourceControl implements DeleteSourceControlContract
{
    public function delete(SourceControl $sourceControl): void
    {
        if ($sourceControl->sites()->exists()) {
            throw ValidationException::withMessages([
                'source_control' => __('This source control is being used by a site.'),
            ]);
        }

        $sourceControl->delete();
    }
}
