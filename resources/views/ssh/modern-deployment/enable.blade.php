@php($tmpPath = $site->basePath() . '-tmp')

mv {{ $site->basePath() }} {{ $tmpPath }}

mkdir -p {{ $site->basePath() }}/releases

mv {{ $tmpPath }} {{ $site->basePath() }}/source

rsync -a {{ $site->basePath() }}/source/ {{ $site->basePath() }}/releases/initial

@if (count($sharedResources) > 0)
    @foreach ($sharedResources as $resource)
        rm -rf {!! escapeshellarg($site->basePath().'/releases/initial/'.$resource) !!}
        ln -sfn {!! escapeshellarg($site->basePath().'/source/'.$resource) !!} {!! escapeshellarg($site->basePath().'/releases/initial/'.$resource) !!}
        echo {!! escapeshellarg($resource.' linked') !!}
    @endforeach
@endif

ln -sfn {{ $site->basePath() }}/releases/initial {{ $site->basePath() }}/current
echo "Version initial activated! 🎉"
