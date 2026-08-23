<?php

namespace App\Actions\Redirect;

use App\Enums\RedirectStatus;
use App\Jobs\Redirect\CreateJob;
use App\Models\Redirect;
use App\Models\Site;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class CreateRedirect
{
    
    public function create(Site $site, array $input): Redirect
    {
        $this->validate($site, $input);

        $redirect = new Redirect;

        $redirect->site_id = $site->id;
        $redirect->from = $input['from'];
        $redirect->to = $input['to'];
        $redirect->mode = $input['mode'];
        $redirect->websocket = ((int) $input['mode'] === Redirect::MODE_PROXY) && ($input['websocket'] ?? false);
        $redirect->status = RedirectStatus::CREATING;
        $redirect->save();

        dispatch(new CreateJob($site, $redirect))->onQueue('ssh');

        return $redirect->refresh();
    }

    public static function rules(Site $site, ?Redirect $ignore = null): array
    {
        return [
            'from' => [
                'required',
                'string',
                'max:255',
                'not_regex:/^http(s)?:\/\//',
                Rule::unique('redirects', 'from')->where('site_id', $site->id)->when($ignore, fn ($rule) => $rule->ignore($ignore->id)),
            ],
            'to' => [
                'required',
                'url:http,https',
            ],
            'mode' => [
                'required',
                'integer',
                Rule::in([
                    301,
                    302,
                    307,
                    308,
                    Redirect::MODE_PROXY,
                ]),
            ],
            'websocket' => [
                'nullable',
                'boolean',
            ],
        ];
    }

    private function validate(Site $site, array $input): void
    {
        Validator::make($input, self::rules($site))->validate();
    }
}
