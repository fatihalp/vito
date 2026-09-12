for ini in /etc/php/{{ $version }}/fpm/php.ini /etc/php/{{ $version }}/cli/php.ini; do
    if [ -f "$ini" ]; then
        sudo sed -i 's,^[; ]*upload_max_filesize =.*$,upload_max_filesize = {{ $upload_max_filesize }},' "$ini"
        sudo sed -i 's,^[; ]*post_max_size =.*$,post_max_size = {{ $post_max_size }},' "$ini"
@if(!empty($memory_limit))
        sudo sed -i 's,^[; ]*memory_limit =.*$,memory_limit = {{ $memory_limit }},' "$ini"
@endif
@if(!empty($max_execution_time))
        sudo sed -i 's,^[; ]*max_execution_time =.*$,max_execution_time = {{ $max_execution_time }},' "$ini"
@endif
    fi
done

if ! sudo systemctl restart php{{ $version }}-fpm 2>/dev/null && ! sudo service php{{ $version }}-fpm restart 2>/dev/null; then
    echo 'VITO_SSH_ERROR' && exit 1
fi
