param(
  [int]$Port = 5187,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = [System.Net.HttpListener]::new()

function Get-ContentType([string]$Path) {
  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { return "text/html; charset=utf-8" }
    ".js" { return "text/javascript; charset=utf-8" }
    ".css" { return "text/css; charset=utf-8" }
    ".svg" { return "image/svg+xml" }
    ".png" { return "image/png" }
    ".jpg" { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".xlsx" { return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
    ".json" { return "application/json; charset=utf-8" }
    default { return "application/octet-stream" }
  }
}

function Resolve-StaticPath([string]$UrlPath) {
  $relative = [System.Uri]::UnescapeDataString($UrlPath.TrimStart("/")).Replace("/", [System.IO.Path]::DirectorySeparatorChar)
  if ([string]::IsNullOrWhiteSpace($relative)) {
    $relative = "index.html"
  }

  $candidate = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
  if (-not $candidate.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }

  if (Test-Path -LiteralPath $candidate -PathType Container) {
    $candidate = Join-Path $candidate "index.html"
  }

  if (Test-Path -LiteralPath $candidate -PathType Leaf) {
    return $candidate
  }

  return Join-Path $root "index.html"
}

while ($true) {
  try {
    $prefix = "http://127.0.0.1:$Port/"
    $listener.Prefixes.Clear()
    $listener.Prefixes.Add($prefix)
    $listener.Start()
    break
  } catch {
    if ($Port -ge 5287) {
      throw
    }
    $Port += 1
  }
}

$url = "http://127.0.0.1:$Port/"
Write-Host "LittleTank demo is running at $url"
Write-Host "Close this window to stop the demo server."

if (-not $NoBrowser) {
  Start-Process $url
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $response = $context.Response

    try {
      $filePath = Resolve-StaticPath $context.Request.Url.AbsolutePath
      if ($null -eq $filePath) {
        $response.StatusCode = 403
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("Forbidden")
      } else {
        $response.StatusCode = 200
        $response.ContentType = Get-ContentType $filePath
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
      }

      $response.ContentLength64 = $bytes.Length
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
      $response.StatusCode = 500
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($_.Exception.Message)
      $response.ContentLength64 = $bytes.Length
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } finally {
      $response.OutputStream.Close()
    }
  }
} finally {
  if ($listener.IsListening) {
    $listener.Stop()
  }
  $listener.Close()
}
