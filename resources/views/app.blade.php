<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="dark">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <style>html { color-scheme: dark; background: #111113; } html.light { color-scheme: light; background: #f5f5f7; }</style>
        <script>
            try {
                const theme = localStorage.getItem('vito-theme');
                const light = theme === 'light' || (theme === 'system' && matchMedia('(prefers-color-scheme: light)').matches);
                document.documentElement.classList.toggle('dark', !light);
                document.documentElement.classList.toggle('light', light);
            } catch {}
        </script>

        <title data-inertia>{{ config('app.name', 'Laravel') }}</title>

        <link rel="icon" type="image/svg+xml" href="{{ asset('purepanel.svg') }}" />

        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="selection:bg-foreground selection:text-background font-sans antialiased">
        @inertia
    </body>
</html>
