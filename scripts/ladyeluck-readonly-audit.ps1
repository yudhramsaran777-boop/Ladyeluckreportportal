param(
    [string]$ProjectRoot = "C:\Users\iamsa\Claude\Projects\Employee Management App (Lady E Luck Portal Project)"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
    throw "Project directory was not found: $ProjectRoot"
}

$desktop = [Environment]::GetFolderPath("Desktop")
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputPath = Join-Path $desktop "ladyeluck-readonly-audit-$timestamp.txt"

$excludedDirectories = @(
    "\node_modules\",
    "\.next\",
    "\.git\",
    "\coverage\",
    "\dist\",
    "\build\",
    "\out\",
    "\.turbo\"
)

$codeExtensions = @(
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".json", ".sql", ".md"
)

function Test-IsExcludedPath {
    param([string]$FullName)

    foreach ($directory in $excludedDirectories) {
        if ($FullName.IndexOf($directory, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
            return $true
        }
    }

    return $false
}

function Get-RelativePath {
    param([string]$FullName)

    $rootWithSlash = $ProjectRoot.TrimEnd("\") + "\"
    if ($FullName.StartsWith($rootWithSlash, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $FullName.Substring($rootWithSlash.Length)
    }

    return $FullName
}

function Add-SelectedFile {
    param(
        [System.Collections.Generic.Dictionary[string, System.Collections.Generic.HashSet[string]]]$Map,
        [System.IO.FileInfo]$File,
        [string]$Reason
    )

    if ($null -eq $File -or -not $File.Exists) {
        return
    }

    if (-not $Map.ContainsKey($File.FullName)) {
        $Map[$File.FullName] = [System.Collections.Generic.HashSet[string]]::new(
            [System.StringComparer]::OrdinalIgnoreCase
        )
    }

    [void]$Map[$File.FullName].Add($Reason)
}

$allFiles = Get-ChildItem -LiteralPath $ProjectRoot -Recurse -File |
    Where-Object {
        -not (Test-IsExcludedPath $_.FullName) -and
        $codeExtensions -contains $_.Extension.ToLowerInvariant()
    }

$selected = [System.Collections.Generic.Dictionary[
    string,
    System.Collections.Generic.HashSet[string]
]]::new([System.StringComparer]::OrdinalIgnoreCase)

# Exact files specifically requested.
$exactRelativePaths = @(
    "src\app\api\auth\gmail\connect\route.ts",
    "src\app\api\auth\gmail\callback\route.ts"
)

foreach ($relativePath in $exactRelativePaths) {
    $fullPath = Join-Path $ProjectRoot $relativePath
    if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
        Add-SelectedFile -Map $selected -File (Get-Item -LiteralPath $fullPath) -Reason "Explicitly requested"
    }
}

foreach ($file in $allFiles) {
    $relative = Get-RelativePath $file.FullName
    $relativeLower = $relative.ToLowerInvariant()
    $nameLower = $file.Name.ToLowerInvariant()

    $isSourceFile = $relativeLower.StartsWith("src\")
    $isSupabaseFile = $relativeLower.StartsWith("supabase\")

    # Payments Dashboard and Manager Payment Accounts.
    if (
        $relativeLower.StartsWith("src\app\manager\payments\") -or
        $relativeLower.StartsWith("src\app\manager\payment-accounts\")
    ) {
        Add-SelectedFile -Map $selected -File $file -Reason "Manager payments/payment-accounts page"
    }

    # Payment/Gmail/account-related manager components.
    if (
        $relativeLower.StartsWith("src\components\") -and
        $relativeLower -match "(payment|gmail|account)"
    ) {
        Add-SelectedFile -Map $selected -File $file -Reason "Payment/Gmail/account component"
    }

    # All payment library code, which contains types, queries, parsers, Gmail sync, and flags.
    if ($relativeLower.StartsWith("src\lib\payment\")) {
        Add-SelectedFile -Map $selected -File $file -Reason "Payment library"
    }

    # Gmail/payment API routes, including manual sync, callback, connect, webhooks, and cron.
    if (
        $relativeLower.StartsWith("src\app\api\") -and
        $relativeLower -match "(gmail|payment|manual-sync|manual_sync)"
    ) {
        Add-SelectedFile -Map $selected -File $file -Reason "Payment/Gmail API route"
    }

    # Files named gmail-manager or payment-account-gmail-manager.
    if ($nameLower -match "(payment-account-gmail-manager|gmail-manager)") {
        Add-SelectedFile -Map $selected -File $file -Reason "Requested Gmail manager filename"
    }

    # Generated or handwritten database types.
    if (
        $isSourceFile -and
        $relativeLower -match "(database(\.|-|_)?types|supabase(\.|-|_)?types|types(\.|-|_)?database)"
    ) {
        Add-SelectedFile -Map $selected -File $file -Reason "Database schema types"
    }

    # Relevant Supabase schema/migration files.
    if (
        $isSupabaseFile -and
        $file.Extension.ToLowerInvariant() -eq ".sql"
    ) {
        try {
            $sqlText = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction Stop
            if ($sqlText -match "(gmail_connections|payment_accounts|shop_feature_flags|gmail_sync_enabled|payment_dashboard_enabled)") {
                Add-SelectedFile -Map $selected -File $file -Reason "Relevant Supabase schema/migration"
            }
        }
        catch {
            # The final report will note unreadable files separately.
        }
    }
}

# Content-based discovery for files whose filenames do not reveal their purpose.
foreach ($file in $allFiles | Where-Object { (Get-RelativePath $_.FullName).ToLowerInvariant().StartsWith("src\") }) {
    $text = $null

    try {
        $text = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction Stop
    }
    catch {
        continue
    }

    $hasPaymentOrGmail = $text -match "(gmail_connections|payment_accounts|payment_account_id|gmail_sync_enabled|payment_dashboard_enabled|Gmail Connections|Payments Dashboard|manual-sync|manual_sync)"
    $hasServerAction = $text -match '["'']use server["'']'
    $hasModalOrDrawer = $text -match "(Modal|Dialog|Drawer|Sheet)"
    $hasFeatureFlag = $text -match "(shop_feature_flags|feature[-_ ]flags?|gmail_sync_enabled|payment_dashboard_enabled|manager_payment_summary_enabled)"
    $hasRelevantTypes = $text -match "(interface|type)\s+\w*(Gmail|PaymentAccount|PaymentTransaction|PaymentDashboard|FeatureFlag)\w*"

    if ($hasPaymentOrGmail) {
        Add-SelectedFile -Map $selected -File $file -Reason "Contains payment/Gmail implementation"
    }

    if ($hasServerAction -and $text -match "(payment|gmail|account)") {
        Add-SelectedFile -Map $selected -File $file -Reason "Payment-account/Gmail server action"
    }

    if ($hasModalOrDrawer -and $text -match "(payment|gmail|cashtag|chime)") {
        Add-SelectedFile -Map $selected -File $file -Reason "Payment/Gmail modal or drawer"
    }

    if ($hasFeatureFlag) {
        Add-SelectedFile -Map $selected -File $file -Reason "Feature flag logic"
    }

    if ($hasRelevantTypes) {
        Add-SelectedFile -Map $selected -File $file -Reason "Payment/Gmail TypeScript types"
    }
}

# Directory inventories requested by the user.
$managerInventory = $allFiles |
    Where-Object {
        $relative = (Get-RelativePath $_.FullName).ToLowerInvariant()
        $relative.StartsWith("src\app\manager\") -and
        $relative -match "(payment|gmail|account)"
    } |
    Sort-Object FullName

$componentInventory = $allFiles |
    Where-Object {
        $relative = (Get-RelativePath $_.FullName).ToLowerInvariant()
        $relative.StartsWith("src\components\") -and
        $relative -match "(payment|gmail|account)"
    } |
    Sort-Object FullName

$orderedSelectedFiles = $selected.Keys |
    ForEach-Object { Get-Item -LiteralPath $_ } |
    Sort-Object { Get-RelativePath $_.FullName }

$builder = [System.Text.StringBuilder]::new()

[void]$builder.AppendLine("LADY E LUCK PORTAL — READ-ONLY PAYMENT/GMAIL CODE AUDIT EXPORT")
[void]$builder.AppendLine("Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')")
[void]$builder.AppendLine("Project root: $ProjectRoot")
[void]$builder.AppendLine("Selected files: $($orderedSelectedFiles.Count)")
[void]$builder.AppendLine("")
[void]$builder.AppendLine("IMPORTANT")
[void]$builder.AppendLine("- This script only reads the project.")
[void]$builder.AppendLine("- It writes this report to the Windows Desktop, outside the project.")
[void]$builder.AppendLine("- Environment files and build/dependency directories are not included.")
[void]$builder.AppendLine("")

[void]$builder.AppendLine("=" * 100)
[void]$builder.AppendLine("SRC/APP/MANAGER INVENTORY — PAYMENT, GMAIL, OR ACCOUNT FILES")
[void]$builder.AppendLine("=" * 100)
foreach ($file in $managerInventory) {
    [void]$builder.AppendLine((Get-RelativePath $file.FullName))
}
if ($managerInventory.Count -eq 0) {
    [void]$builder.AppendLine("[No matching files found]")
}
[void]$builder.AppendLine("")

[void]$builder.AppendLine("=" * 100)
[void]$builder.AppendLine("SRC/COMPONENTS INVENTORY — PAYMENT, GMAIL, OR ACCOUNT FILES")
[void]$builder.AppendLine("=" * 100)
foreach ($file in $componentInventory) {
    [void]$builder.AppendLine((Get-RelativePath $file.FullName))
}
if ($componentInventory.Count -eq 0) {
    [void]$builder.AppendLine("[No matching files found]")
}
[void]$builder.AppendLine("")

[void]$builder.AppendLine("=" * 100)
[void]$builder.AppendLine("SELECTED FILE INDEX")
[void]$builder.AppendLine("=" * 100)
$index = 0
foreach ($file in $orderedSelectedFiles) {
    $index++
    $relative = Get-RelativePath $file.FullName
    $reasons = ($selected[$file.FullName] | Sort-Object) -join "; "
    [void]$builder.AppendLine(("{0,3}. {1}" -f $index, $relative))
    [void]$builder.AppendLine("     Selected because: $reasons")
}
[void]$builder.AppendLine("")

[void]$builder.AppendLine("=" * 100)
[void]$builder.AppendLine("FULL FILE CONTENTS")
[void]$builder.AppendLine("=" * 100)

$index = 0
foreach ($file in $orderedSelectedFiles) {
    $index++
    $relative = Get-RelativePath $file.FullName
    $reasons = ($selected[$file.FullName] | Sort-Object) -join "; "

    [void]$builder.AppendLine("")
    [void]$builder.AppendLine("#" * 100)
    [void]$builder.AppendLine("FILE $index OF $($orderedSelectedFiles.Count)")
    [void]$builder.AppendLine("FULL PATH: $($file.FullName)")
    [void]$builder.AppendLine("RELATIVE PATH: $relative")
    [void]$builder.AppendLine("SELECTION REASONS: $reasons")
    [void]$builder.AppendLine("SIZE BYTES: $($file.Length)")
    [void]$builder.AppendLine("LAST WRITE: $($file.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss zzz'))")
    [void]$builder.AppendLine("#" * 100)

    try {
        $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction Stop
        [void]$builder.AppendLine($content)
    }
    catch {
        [void]$builder.AppendLine("[ERROR READING FILE: $($_.Exception.Message)]")
    }

    [void]$builder.AppendLine("")
    [void]$builder.AppendLine("END FILE: $relative")
}

[System.IO.File]::WriteAllText(
    $outputPath,
    $builder.ToString(),
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host ""
Write-Host "Read-only audit export complete." -ForegroundColor Green
Write-Host "Selected files: $($orderedSelectedFiles.Count)"
Write-Host "Report: $outputPath"
Write-Host ""
Write-Host "No project files were modified."
