$ErrorActionPreference = "Stop"
$dest = Join-Path $PSScriptRoot "..\apps\web\public\demo-assets"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

$files = @{
  "reference.jpg" = "https://picsum.photos/seed/shotbro-ref/800/1000"
  "avatar-ref.jpg" = "https://picsum.photos/seed/shotbro-avatar-ref/800/800"
  "first-frame.jpg" = "https://picsum.photos/seed/shotbro-frame/900/1600"
  "storyboard-1.jpg" = "https://picsum.photos/seed/shotbro-sb1/800/450"
  "storyboard-2.jpg" = "https://picsum.photos/seed/shotbro-sb2/800/450"
  "storyboard-3.jpg" = "https://picsum.photos/seed/shotbro-sb3/800/450"
  "photo-result.jpg" = "https://picsum.photos/seed/shotbro-photo1/800/1000"
  "photo-v2.jpg" = "https://picsum.photos/seed/shotbro-photo2/800/1000"
  "avatar-result.jpg" = "https://picsum.photos/seed/shotbro-avatar/800/800"
  "video-poster.jpg" = "https://picsum.photos/seed/shotbro-poster/900/1600"
}

foreach ($entry in $files.GetEnumerator()) {
  $out = Join-Path $dest $entry.Key
  Write-Host "Downloading $($entry.Key)..."
  Invoke-WebRequest -Uri $entry.Value -OutFile $out -UseBasicParsing
}

$mp4 = Join-Path $dest "shotbro-demo.mp4"
if (-not (Test-Path $mp4)) {
  Write-Host "Downloading shotbro-demo.mp4..."
  Invoke-WebRequest -Uri "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" -OutFile $mp4 -UseBasicParsing
}

$mp3 = Join-Path $dest "voice-demo.mp3"
if (-not (Test-Path $mp3)) {
  Write-Host "Downloading voice-demo.mp3..."
  Invoke-WebRequest -Uri "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" -OutFile $mp3 -UseBasicParsing
}

Write-Host "Demo assets ready in $dest"
