<?php

namespace App\ValidationRules;

use App\Exceptions\AppError;
use App\Models\SourceControl;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class BranchExistsRule implements ValidationRule
{
    public function __construct(private readonly mixed $sourceControlId, private readonly mixed $repository) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! is_string($this->repository) || $this->repository === '') {
            return;
        }

        $sourceControl = SourceControl::query()->find($this->sourceControlId);
        if (! $sourceControl) {
            return;
        }

        try {
            $branches = $sourceControl->provider()->getBranches($this->repository, false);
        } catch (AppError $e) {
            $fail("Could not verify the branch: {$e->getMessage()}");

            return;
        }

        if ($branches === []) {
            $fail("The repository {$this->repository} has no branches yet. Push at least one commit, then try again.");

            return;
        }

        if (! in_array($value, $branches, true)) {
            $fail(sprintf(
                'Branch "%s" does not exist in %s. Available branches: %s.',
                $value,
                $this->repository,
                implode(', ', array_slice($branches, 0, 10)).(count($branches) > 10 ? ', ...' : ''),
            ));
        }
    }
}
