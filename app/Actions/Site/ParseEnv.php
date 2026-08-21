<?php

namespace App\Actions\Site;

use App\Helpers\EnvParser;
use Illuminate\Support\Facades\Validator;

class ParseEnv
{
    
    public function parse(array $input): array
    {
        Validator::make($input, [
            'content' => ['present', 'nullable', 'string'],
        ])->validate();

        $content = (string) ($input['content'] ?? null);
        $variables = EnvParser::parse($content);

        return [
            'variables' => $variables,
            'representable' => EnvParser::isRepresentable($content, $variables),
        ];
    }
}
