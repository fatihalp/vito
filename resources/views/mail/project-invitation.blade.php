@component('mail::message')
# {{ __('You\'ve been added to :project', ['project' => $project->name]) }}

{{ __('You have been added to collaborate on the :project project in Vito.', ['project' => $project->name]) }}

{{ __('Click the button below to view the project.') }}

@component('mail::button', ['url' => $acceptUrl, 'color' => 'primary'])
{{ __('View project') }}
@endcomponent

@slot('subcopy')
{{ __('If you did not expect to receive an invitation to this project, you may safely discard this email.') }}
@endslot
@endcomponent
