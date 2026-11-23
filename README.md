<p align="center"><img src="brand/logo.svg" alt="FlipFloor" width="300"></p>

<p align="center"><b>Sell fast. Never below your floor.</b><br>
Liquidation reports and listing audits for B-Stock and pallet resellers, as a Claude Code plugin.</p>

# FlipFloor Lite

FlipFloor Lite turns your lot's manifest and your listings into clear numbers:
- **Price sheet** from your B-Stock manifest: list price, offer floor and hard floor per item, plus a tier (A to D).
- **Lot report:** units sold vs. manifest, revenue vs. what you paid, recovery %, and the next items to list.
- **Morning and weekly reports:** sales, price changes, sell-through by platform and tier, and what needs you.
- **Read-only audit** of your eBay, Vinted, Depop and Facebook Marketplace listings against the manifest. It flags oversell risks, duplicates, prices below your floor, weak titles and missing photos.

Lite never changes anything on a marketplace. Want the nightly run (sync, relist, reprice, offers, crosslisting)? That's **[FlipFloor Pro](GUMROAD_LINK)**.

## Install
```
claude plugin marketplace add pcombs08/flipfloor-lite
claude plugin install flipfloor-lite@flipfloor-lite
```
Then, in your lot's folder:
1. Copy `config.example.yaml` to `config.yaml` and fill in your lot (ID, cost, manifest path).
2. Put your manifest CSV in `data/`.
3. Ask Claude: `/flipfloor-lite:report lot`.

Try the fictional sample first: open `examples/sample-lot/` and run `/flipfloor-lite:report lot`.

## Requirements
- Claude Code (needs a paid Claude plan). The audit also needs the Claude in Chrome extension.
- Optional: Node.js 16+ or Windows PowerShell for the price-sheet script.

## Lite vs Pro
| | Lite (free) | Pro |
|---|---|---|
| Price sheet, lot/morning/weekly reports | ✓ | ✓ |
| Read-only listing audit | ✓ | ✓ |
| Nightly sync, relist, reprice | | ✓ |
| Offers within your floors | | ✓ |
| Crosslisting with oversell checks | | ✓ |
| Playbook updates when sites change | | ✓ |

## Disclaimer
FlipFloor isn't affiliated with or endorsed by B-Stock, eBay, Vinted, Depop or Meta; those names only describe compatibility. You use it on your own accounts and are responsible for each platform's rules. No sales or income results are promised.

## License
MIT
