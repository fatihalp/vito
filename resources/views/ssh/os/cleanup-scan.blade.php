sudo bash <<'VITO_SCAN'
find /var/log -xdev -type f -size +1M -printf 'file\t%s\t%p\n' 2>/dev/null
find /home -xdev -maxdepth 9 \( -name .git -o -name node_modules -o -name vendor \) -prune -o -type f -size +1M \( -path '*/storage/logs/*' -o -path '*/.logs/*' \) -printf 'file\t%s\t%p\n' 2>/dev/null
for dir in /home/*/.cache/puppeteer /home/*/.cache/composer /home/*/.composer/cache /home/*/.npm/_cacache /home/*/.cache/pip /home/*/.cache/yarn /home/*/.cache/node-gyp /var/log/journal; do
    if [ -d "$dir" ]; then
        du -sb "$dir" 2>/dev/null | while IFS=$'\t' read -r size path; do printf 'dir\t%s\t%s\n' "$size" "$path"; done
    fi
done
find /var/cache/apt/archives -maxdepth 1 -type f -name '*.deb' -printf 'file\t%s\t%p\n' 2>/dev/null
true
VITO_SCAN
