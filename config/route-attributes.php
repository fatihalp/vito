<?php

use Illuminate\Routing\Middleware\SubstituteBindings;

return [
    
    'enabled' => true,

    
    'directories' => [
        app_path('Http/Controllers') => [
            'prefix' => '',
            'middleware' => 'web',
            'patterns' => ['*Controller.php'],
            'not_patterns' => ['Webhook/*'],
        ],
        app_path('Http/Controllers/Webhook') => [
            'prefix' => '',
            'middleware' => 'webhook',
            'patterns' => ['*Controller.php'],
            'not_patterns' => [],
        ],
    ],

    
    'middleware' => [
        SubstituteBindings::class,
    ],

    
    'scope-bindings' => null,
];
