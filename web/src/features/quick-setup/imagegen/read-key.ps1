param([Parameter(Mandatory=$true)][string]$Store)
$ErrorActionPreference = 'Stop'
try {
    Add-Type -AssemblyName System.Security
    $bytes = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($Store), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    [Console]::Out.Write([Text.Encoding]::UTF8.GetString($bytes))
} catch {
    [Console]::Error.WriteLine('WukongAi API credential unavailable. Run the WukongAi image configuration BAT for this Windows account.')
    exit 1
}
