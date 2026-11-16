sudo bash <<'VITO_SCAN'
find /var/log -xdev -type f -size +1M -printf 'file\t%s\t%p\n' 2>/dev/null
find /home -xdev -maxdepth 9 \( -name .git -o -name node_modules -o -name vendor \) -prune -o -type f -size +1M \( -path '*/storage/logs/*' -o -path '*/.logs/*' \) -printf 'file\t%s\t%p\n' 2>/dev/null
for dir in /home/*/.cache/puppeteer /home/*/.cache/composer /home/*/.composer/cache /home/*/.npm/_cacache /home/*/.cache/pip /home/*/.cache/yarn /home/*/.cache/node-gyp /var/log/journal; do
    if [ -d "$dir" ]; then
        du -sb "$dir" 2>/dev/null | while IFS=$'\t' read -r size path; do printf 'dir\t%s\t%s\n' "$size" "$path"; done
    fi
done
find /var/cache/apt/archives -maxdepth 1 -type f -name '*.deb' -printf 'file\t%s\t%p\n' 2>/dev/null
if [ -d /var/lib/docker/containers ]; then
    find /var/lib/docker/containers -xdev -maxdepth 3 -type f -size +1M \( -name '*-json.log*' -o -path '*/local-logs/container.log*' \) -printf 'file\t%s\t%p\n' 2>/dev/null
fi
if [ -d /var/lib/docker/volumes ]; then
    find /var/lib/docker/volumes -xdev -maxdepth 4 -type f -size +1M \( -name '*[A-Za-z]*.log' -o -name '*[A-Za-z]*.log.*' -o -name 'security' -o -name 'security.*' -o -name 'messages' -o -name 'messages.*' -o -name 'full' -o -name 'full.*' -o -name 'queue_log' -o -name 'queue_log.*' -o -name 'syslog' -o -name 'syslog.*' -o -name 'btmp' -o -name 'wtmp' -o -name 'debug' -o -path '*/cdr-csv/*.csv' -o -path '*/cel-custom/*.csv' \) -printf 'file\t%s\t%p\n' 2>/dev/null
fi
true
VITO_SCAN
