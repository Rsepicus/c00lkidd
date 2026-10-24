param(
  [Parameter(Mandatory = $true)][string]$SourceDir,
  [Parameter(Mandatory = $true)][string]$TargetDir
)

Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

Get-ChildItem -LiteralPath $SourceDir -Filter *.png | ForEach-Object {
  $image = [System.Drawing.Image]::FromFile($_.FullName)
  try {
    $scale = [Math]::Min(128.0 / $image.Width, 128.0 / $image.Height)
    $width = [int][Math]::Round($image.Width * $scale)
    $height = [int][Math]::Round($image.Height * $scale)
    $x = [int][Math]::Floor((128 - $width) / 2)
    $y = [int][Math]::Floor((128 - $height) / 2)

    $bitmap = New-Object System.Drawing.Bitmap 128, 128, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($image, (New-Object System.Drawing.Rectangle $x, $y, $width, $height))

    $out = Join-Path $TargetDir ($_.BaseName + '.png')
    $bitmap.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
  } finally {
    $image.Dispose()
  }
}
