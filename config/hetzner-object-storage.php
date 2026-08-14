<?php

return [
    'regions' => [
        'fsn1' => 'Falkenstein',
        'nbg1' => 'Nuremberg',
        'hel1' => 'Helsinki',
    ],

    // Any of the three works for a project-wide credential smoke test —
    // Hetzner Object Storage keys are valid across all locations in a project.
    'default_region' => 'fsn1',
];
