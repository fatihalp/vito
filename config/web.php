<?php

use App\Http\Controllers\ServerController;

return [
    'pagination_size' => 25,

    'controllers' => [
        'servers' => ServerController::class,
    ],
];
