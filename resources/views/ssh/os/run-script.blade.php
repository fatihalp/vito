@if (! empty($pidFile))
__vito_pid_file={!! escapeshellarg($pidFile) !!}
mkdir -p "$(dirname "$__vito_pid_file")"
__vito_start_time=$(sed 's/.*) //' "/proc/$$/stat" 2>/dev/null | awk '{print $20}' || echo '')
printf '%s %s\n' "$$" "$__vito_start_time" > "$__vito_pid_file"
trap 'rm -f "${__vito_pid_file:-}"' EXIT
@endif
if ! cd {{ $path }}; then
    echo 'VITO_SSH_ERROR' && exit 1
fi

@if ($stepGroup)
__vito_step=0
trap 'if [ -n "${__vito_offset:-}" ] && [ "$((LINENO - __vito_offset))" != "$__vito_step" ]; then __vito_step=$((LINENO - __vito_offset)); echo "::vito-step::{{ $stepGroup }}::$__vito_step::${EPOCHREALTIME}"; fi' DEBUG
__vito_offset=$LINENO
@endif
{!! $script !!}
