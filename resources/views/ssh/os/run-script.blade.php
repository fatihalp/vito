if ! cd {{ $path }}; then
    echo 'VITO_SSH_ERROR' && exit 1
fi

@if ($stepGroup)
__vito_step=0
trap 'if [ -n "${__vito_offset:-}" ] && [ "$((LINENO - __vito_offset))" != "$__vito_step" ]; then __vito_step=$((LINENO - __vito_offset)); echo "::vito-step::{{ $stepGroup }}::$__vito_step"; fi' DEBUG
__vito_offset=$LINENO
@endif
{!! $script !!}
