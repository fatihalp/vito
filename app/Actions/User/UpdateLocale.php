<?php

namespace App\Actions\User;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class UpdateLocale
{
    public function update(array $input): string
    {
        $validated = Validator::make($input, [
            'locale' => ['required', 'string', Rule::in(['en', 'tr'])],
        ])->validate();

        return $validated['locale'];
    }
}
