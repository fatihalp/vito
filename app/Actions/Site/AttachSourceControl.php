<?php

namespace App\Actions\Site;

use App\Enums\SiteStatus;
use App\Exceptions\RepositoryNotFound;
use App\Exceptions\RepositoryPermissionDenied;
use App\Exceptions\SourceControlIsNotConnected;
use App\Jobs\Site\AttachSourceControlJob;
use App\Models\Site;
use App\Models\SourceControl;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class AttachSourceControl
{
    public function attach(Site $site, array $input): void
    {
        if ($site->source_control_id) {
            throw ValidationException::withMessages([
                'source_control' => 'This site already has a source control configured.',
            ]);
        }

        Validator::make($input, [
            'source_control' => SourceControl::siteValidationRules($site->server),
            'repository' => ['required', 'string'],
            'branch' => ['required', 'string'],
        ])->validate();

        $sourceControl = SourceControl::find((int) $input['source_control']);
        if (! $sourceControl instanceof SourceControl) {
            throw ValidationException::withMessages([
                'source_control' => 'Source control not found',
            ]);
        }

        try {
            $sourceControl->getRepo($input['repository']);
        } catch (SourceControlIsNotConnected) {
            throw ValidationException::withMessages([
                'source_control' => 'Source control is not connected',
            ]);
        } catch (RepositoryPermissionDenied) {
            throw ValidationException::withMessages([
                'repository' => 'You do not have permission to access this repository',
            ]);
        } catch (RepositoryNotFound) {
            throw ValidationException::withMessages([
                'repository' => 'Repository not found',
            ]);
        }

        $site->source_control_id = $sourceControl->id;
        $site->repository = $input['repository'];
        $site->branch = $input['branch'];
        $site->status = SiteStatus::INSTALLING;
        $site->setRelation('sourceControl', $sourceControl);
        $site->save();

        dispatch(new AttachSourceControlJob($site));
    }
}
