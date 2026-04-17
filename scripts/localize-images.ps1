$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$blogDir = Join-Path $projectRoot 'src\content\blog'
$imagesRoot = Join-Path $projectRoot 'public\images'

New-Item -ItemType Directory -Force -Path $imagesRoot | Out-Null

function Get-ExtensionFromContentType {
  param(
    [string]$ContentType
  )

  if (-not $ContentType) {
    return $null
  }

  $normalized = $ContentType.Split(';')[0].Trim().ToLowerInvariant()
  switch ($normalized) {
    'image/jpeg' { return '.jpg' }
    'image/jpg' { return '.jpg' }
    'image/png' { return '.png' }
    'image/gif' { return '.gif' }
    'image/webp' { return '.webp' }
    'image/svg+xml' { return '.svg' }
    'image/x-icon' { return '.ico' }
    'image/bmp' { return '.bmp' }
    'image/tiff' { return '.tiff' }
    default { return $null }
  }
}

function Get-ExtensionFromUrl {
  param(
    [string]$Url
  )

  try {
    $uri = [Uri]$Url
    $ext = [IO.Path]::GetExtension($uri.AbsolutePath)
    if ($ext) {
      return $ext.ToLowerInvariant()
    }
  } catch {
    return $null
  }

  return $null
}

function Get-TargetExtension {
  param(
    [string]$Url,
    [string]$ContentType
  )

  $fromType = Get-ExtensionFromContentType -ContentType $ContentType
  if ($fromType) {
    return $fromType
  }

  $fromUrl = Get-ExtensionFromUrl -Url $Url
  if ($fromUrl) {
    return $fromUrl
  }

  return '.bin'
}

$markdownPattern = '!\[[^\]]*\]\((https?://[^)\s]+)\)'
$htmlPattern = '<img\b[^>]*?\bsrc=(["''])(https?://[^"''\s>]+)\1[^>]*>'

$results = New-Object System.Collections.Generic.List[object]

Get-ChildItem -LiteralPath $blogDir -Filter '*.md' -File | ForEach-Object {
  $file = $_
  $slug = $file.BaseName
  $fileContent = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
  $urlToLocal = @{}
  $downloadIndex = 1
  $articleImageDir = Join-Path $imagesRoot $slug
  $changed = $false

  $allMatches = @()
  $allMatches += [regex]::Matches($fileContent, $markdownPattern)
  $allMatches += [regex]::Matches($fileContent, $htmlPattern)

  if ($allMatches.Count -eq 0) {
    return
  }

  New-Item -ItemType Directory -Force -Path $articleImageDir | Out-Null

  foreach ($match in $allMatches) {
    $url = $null
    if ($match.Groups.Count -ge 3 -and $match.Groups[2].Value -like 'http*') {
      $url = $match.Groups[2].Value
    } elseif ($match.Groups.Count -ge 2) {
      $url = $match.Groups[1].Value
    }

    if (-not $url) {
      continue
    }

    if ($urlToLocal.ContainsKey($url)) {
      continue
    }

    Write-Host "Downloading [$slug] $url"
    $tempPath = Join-Path $env:TEMP ([IO.Path]::GetRandomFileName())
    $response = Invoke-WebRequest -Uri $url -OutFile $tempPath -MaximumRedirection 5 -Headers @{
      'User-Agent' = 'xrefme-image-localizer/1.0'
    }

    $contentType = $null
    try {
      if ($null -ne $response.Headers) {
        $contentType = $response.Headers['Content-Type']
      }
      $extension = Get-TargetExtension -Url $url -ContentType $contentType
      $fileName = '{0:D3}{1}' -f $downloadIndex, $extension
      $downloadIndex++

      $targetPath = Join-Path $articleImageDir $fileName
      Move-Item -LiteralPath $tempPath -Destination $targetPath -Force
    } finally {
      if (Test-Path -LiteralPath $tempPath) {
        Remove-Item -LiteralPath $tempPath -Force
      }
    }

    $urlToLocal[$url] = "/images/$slug/$fileName"
    $results.Add([pscustomobject]@{
      Article = $slug
      Url = $url
      Local = $urlToLocal[$url]
    }) | Out-Null
  }

  foreach ($url in $urlToLocal.Keys) {
    $replacement = $urlToLocal[$url]
    $fileContent = $fileContent.Replace($url, $replacement)
    $changed = $true
  }

  if ($changed) {
    Set-Content -LiteralPath $file.FullName -Value $fileContent -Encoding utf8
  }
}

Write-Host "Localized $($results.Count) images."
foreach ($entry in $results) {
  Write-Host "$($entry.Article): $($entry.Local)"
}
