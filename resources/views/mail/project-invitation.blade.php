@component('mail::message')
# {{ strtr('You\'ve been added to :project', [':project' => $project->name]) }}

{{ 'You have been added to collaborate on the '.$project->name.' project in Pure.' }}

{{ 'Click the button below to view the project.' }}

@component('mail::button', ['url' => $acceptUrl, 'color' => 'primary'])
{{ 'View project' }}
@endcomponent

@slot('subcopy')
{{ 'If you did not expect to receive an invitation to this project, you may safely discard this email.' }}
@endslot
@endcomponent
