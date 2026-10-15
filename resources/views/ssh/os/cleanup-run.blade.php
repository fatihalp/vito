@foreach ($truncate as $path)
sudo truncate -s 0 -- {!! escapeshellarg($path) !!}
@endforeach
@foreach ($files as $path)
sudo rm -f -- {!! escapeshellarg($path) !!}
@endforeach
@foreach ($directories as $path)
sudo rm -rf -- {!! escapeshellarg($path) !!}
@endforeach
@if ($vacuumJournal)
sudo journalctl --vacuum-size=200M
@endif
@if ($cleanApt)
sudo apt-get clean
@endif
