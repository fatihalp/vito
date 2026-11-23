pid_file={!! escapeshellarg($pidFile) !!}

if ! sudo test -f "$pid_file"; then
    exit 0
fi

pid_data=$(sudo cat "$pid_file" 2>/dev/null || true)
pid=$(printf '%s' "$pid_data" | awk '{print $1}')
start_time=$(printf '%s' "$pid_data" | awk '{print $2}')

case "$pid" in
    ''|*[!0-9]*)
        sudo rm -f "$pid_file"
        exit 0
        ;;
esac

case "$start_time" in
    ''|*[!0-9]*)
        sudo rm -f "$pid_file"
        exit 0
        ;;
esac

if [ "$pid" -le 1 ]; then
    sudo rm -f "$pid_file"
    exit 0
fi

read_start_time() {
    sudo sed 's/.*) //' "/proc/$1/stat" 2>/dev/null | awk '{print $20}' || true
}

current_start_time=$(read_start_time "$pid")

if [ -z "$current_start_time" ] || [ "$current_start_time" != "$start_time" ]; then
    sudo rm -f "$pid_file"
    exit 0
fi

collect_tree() {
    sudo ps -eo pid=,ppid= 2>/dev/null | awk -v root="$1" '
        { children[$2] = children[$2] " " $1 }
        function walk(p,    arr, n, i) {
            n = split(children[p], arr, " ")
            for (i = 1; i <= n; i++) {
                if (arr[i] != "") {
                    walk(arr[i])
                    print arr[i]
                }
            }
        }
        END { walk(root) }
    ' || true
}

targets=$(collect_tree "$pid")
pgid=$(sudo ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ' || true)

if [ -n "$targets" ]; then
    sudo kill -TERM $targets 2>/dev/null || true
fi
sudo kill -TERM "$pid" 2>/dev/null || true
if [ "$pgid" = "$pid" ]; then
    sudo kill -TERM "-$pgid" 2>/dev/null || true
fi

for _ in 1 2 3 4; do
    if [ "$(read_start_time "$pid")" != "$start_time" ]; then
        break
    fi
    sleep 0.5
done

if [ "$(read_start_time "$pid")" = "$start_time" ]; then
    remaining=$(collect_tree "$pid")
    if [ -n "$remaining" ]; then
        sudo kill -KILL $remaining 2>/dev/null || true
    fi
    sudo kill -KILL "$pid" 2>/dev/null || true
    if [ "$pgid" = "$pid" ]; then
        sudo kill -KILL "-$pgid" 2>/dev/null || true
    fi
fi

sudo rm -f "$pid_file"
