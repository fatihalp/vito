<?php

namespace App\Exceptions;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Validation\ValidationException;
use Psr\Log\LogLevel;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class Handler extends ExceptionHandler
{
    
    protected $levels = [
        
    ];

    
    protected $dontReport = [
        
    ];

    
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    
    public function register(): void
    {
        $this->reportable(function (Throwable $e): void {
            
        });
    }

    public function render($request, Throwable $e): Response
    {
        if ($e instanceof ModelNotFoundException) {
            abort(404, class_basename($e->getModel()).' not found.');
        }

        if ($e instanceof SSHError) {
            if ($request->header('X-Inertia')) {
                return back()->with('error', $e->getLog()?->getContent(30) ?? $e->getMessage());
            }

            return response()->json(['error' => $e->getLog()?->getContent(30) ?? $e->getMessage()], 500);
        }

        if ($e instanceof AuthorizationException) {
            if ($request->header('X-Inertia')) {
                return back()->with('error', __('You don\'t have permission to perform this action.'));
            }
        }

        if ($e instanceof AppError) {
            if ($request->header('X-Inertia')) {
                return back()->with('error', $e->getMessage());
            }

            return response()->json(['error' => $e->getMessage()], 500);
        }

        if ($this->shouldRenderGenericError($e)) {
            $message = __('Something went wrong on our end. Please try again, and contact support if the problem continues.');

            if ($request->header('X-Inertia')) {
                return back()->with('error', $message);
            }

            return response()->json(['error' => $message], 500);
        }

        return parent::render($request, $e);
    }

    
    private function shouldRenderGenericError(Throwable $e): bool
    {
        if (config('app.debug')) {
            return false;
        }

        return ! $e instanceof HttpExceptionInterface && ! $e instanceof ValidationException;
    }
}
