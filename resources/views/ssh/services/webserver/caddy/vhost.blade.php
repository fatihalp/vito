{{ $site->domain }} {
#[main]
@foreach($main ?? [] as $main)
{{ $main }}
@endforeach
#[/main]
}
