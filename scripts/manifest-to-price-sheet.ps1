# FlipFloor Lite: manifest CSV -> data/price-sheet.csv (Windows PowerShell port of manifest-to-price-sheet.js).
# Same output columns and math as the Node script, for machines without Node.
#
# Usage (values from config.yaml -> pricing and manifest_columns):
#   powershell -ExecutionPolicy Bypass -File manifest-to-price-sheet.ps1 -Manifest data/manifest.csv -OutPath data/price-sheet.csv `
#     -ListPct 0.50 -OfferPct 0.40 -HardPct 0.30 -Rounding 0.5 -TierA 90 -TierB 40 -TierC 20
#
# Output columns: item_no, description, brand, qty, unit_retail, ext_retail, list_price, offer_floor, hard_floor, tier, upc
#   list_price  = unit_retail x ListPct, rounded to the nearest -Rounding step (0.01 = no rounding)
#   offer_floor = unit_retail x OfferPct, rounded up to the cent
#   hard_floor  = unit_retail x HardPct, rounded up to the cent
#   tier        = A/B/C/D by unit retail (>= TierA, >= TierB, >= TierC, else D)
# Duplicate item rows (same item number) are merged and their quantities added.
param(
  [Parameter(Mandatory = $true)][string]$Manifest,
  [Parameter(Mandatory = $true)][string]$OutPath,
  [double]$ListPct = 0.50, [double]$OfferPct = 0.40, [double]$HardPct = 0.30, [double]$Rounding = 0.5,
  [double]$TierA = 90, [double]$TierB = 40, [double]$TierC = 20,
  [string]$ColItemNo = 'Item #', [string]$ColDescription = 'Item Description', [string]$ColQty = 'Qty',
  [string]$ColUnitRetail = 'Unit Retail', [string]$ColBrand = 'Brand', [string]$ColUpc = 'UPC'
)
$inv = [Globalization.CultureInfo]::InvariantCulture
function Get-Num($v) { $s = ("$v" -replace '[$,\s]', ''); $d = 0.0; if ([double]::TryParse($s, [Globalization.NumberStyles]::Float, $inv, [ref]$d)) { $d } else { [double]::NaN } }
function Round-Step($x, $step) { if ($step -gt 0) { [math]::Floor($x / $step + 0.5) * $step } else { $x } }
function Ceil-Cent($x) { [math]::Ceiling([math]::Round($x * 10000) / 100) / 100 }
function Format-Money($x) { $x.ToString('0.00', $inv) }
function Get-Tier($r) { if ($r -ge $TierA) { 'A' } elseif ($r -ge $TierB) { 'B' } elseif ($r -ge $TierC) { 'C' } else { 'D' } }

$rows = Import-Csv -LiteralPath $Manifest
if (-not $rows) { throw 'Manifest has no data rows.' }
$header = $rows[0].PSObject.Properties.Name
foreach ($c in @($ColDescription, $ColQty, $ColUnitRetail)) { if ($header -notcontains $c) { throw "Column '$c' not found. Header: $($header -join ' | '). Pass -Col... parameters to match your manifest." } }

$byItem = [ordered]@{}
$line = 1
foreach ($r in $rows) {
  $line++
  $retail = Get-Num $r.$ColUnitRetail; $qty = Get-Num $r.$ColQty; $desc = "$($r.$ColDescription)".Trim()
  if (-not $desc -and [double]::IsNaN($retail)) { continue }
  if ([double]::IsNaN($retail)) { Write-Warning "row ${line}: no unit retail for '$desc'"; continue }
  $key = if ($header -contains $ColItemNo) { "$($r.$ColItemNo)".Trim() } else { '' }
  if (-not $key) { $key = $desc }
  $q = if ([double]::IsNaN($qty)) { 1 } else { $qty }
  if ($byItem.Contains($key)) {
    $byItem[$key].qty += $q
    if ($byItem[$key].unit_retail -ne $retail) { Write-Warning "item ${key}: different unit retail on merged rows ($($byItem[$key].unit_retail) vs $retail); kept the first" }
  } else {
    $byItem[$key] = [pscustomobject]@{
      item_no = $(if ($header -contains $ColItemNo) { "$($r.$ColItemNo)".Trim() } else { '' }); description = $desc
      brand = $(if ($header -contains $ColBrand) { "$($r.$ColBrand)".Trim() } else { '' }); qty = $q; unit_retail = $retail
      upc = $(if ($header -contains $ColUpc) { ("$($r.$ColUpc)" -replace '[,\s]+$', '') } else { '' })
    }
  }
}

$items = $byItem.Values | Sort-Object { $_.unit_retail * $_.qty } -Descending
$sheet = foreach ($it in $items) {
  [pscustomobject][ordered]@{
    item_no = $it.item_no; description = $it.description; brand = $it.brand; qty = $it.qty
    unit_retail = Format-Money $it.unit_retail; ext_retail = Format-Money ($it.unit_retail * $it.qty)
    list_price = Format-Money (Round-Step ($it.unit_retail * $ListPct) $Rounding)
    offer_floor = Format-Money (Ceil-Cent ($it.unit_retail * $OfferPct))
    hard_floor = Format-Money (Ceil-Cent ($it.unit_retail * $HardPct))
    tier = Get-Tier $it.unit_retail; upc = $it.upc
  }
}
$sheet | Export-Csv -LiteralPath $OutPath -NoTypeInformation -Encoding UTF8
$units = ($items | Measure-Object qty -Sum).Sum
$retailTotal = ($items | ForEach-Object { $_.qty * $_.unit_retail } | Measure-Object -Sum).Sum
$listTotal = ($sheet | ForEach-Object { $_.qty * [double]::Parse($_.list_price, $inv) } | Measure-Object -Sum).Sum
"SKUs $(@($sheet).Count), units $units, retail `$$(Format-Money $retailTotal), at list `$$(Format-Money $listTotal) -> $OutPath"
