---
description: Write a liquidation status report (sell-through, revenue vs lot cost, aging, floors, needs-you) from inventory.csv and the run logs, without touching any platform
argument-hint: "[morning|weekly|lot] [YYYY-MM-DD]"
---

Use the **flipfloor-lite** skill, §9. This command is **read-only on platforms**: build the report from the working folder (`inventory.csv`, `data/price-sheet.csv`, `offers-log.md`, `*-log-*.md`, `config.yaml`). Only open a platform if the owner asks for fresh numbers.

Arguments: $ARGUMENTS
- Report type: `morning`, `weekly` or `lot`. If none is given, use `morning`.
- Report date: a `YYYY-MM-DD` argument if given, otherwise today. It's used in the file name (`<type>-report-<date>.md`) and as the end of the period covered.

Definitions used by every report:
- **Revenue** = sum of the prices paid in `SOLD_<date>(<price>, <platform>)` flags, not list prices.
- **Fees** = revenue × `lot.fees_estimate_pct` (deducted from revenue). **Net** = revenue − fees. **Position** = net − `lot.cost_total`.
- **Sell-through by tier or for the lot** = units sold ÷ units available at the start of the period (manifest qty minus units sold before the period).
- **Sell-through by platform** = listings sold ÷ in-lot listings that were live on that platform at any point in the period (units aren't tied to one platform, so count listings).
- **Out-of-lot rows** (`in_lot = no`) are left out of every count, money figure and aging list. Mention them under **Needs you** only if the owner has to act.
- **Past the markdown age** = listing age ≥ `pricing.markdown_below_offer_floor_after_days` (age per SKILL.md §3).

Report types:
- **morning:** use `${CLAUDE_PLUGIN_ROOT}/templates/morning-report.md`. Cover the 24 hours before the report date: sales (every sale, including offers accepted), delistings, relists (old → new IDs), price changes, offers, skipped items and why, **Needs you**. If a source file a section needs is missing (e.g. no `offers-log.md`), say so in that section.
- **weekly:** use `${CLAUDE_PLUGIN_ROOT}/templates/weekly-report.md`. The 7 days before the report date. Sections: sales; sell-through by platform and by tier; average sale price as % of retail; listings past the markdown age with no sale; which platform moved what; **Needs you**.
- **lot:** whole-lot view. Units sold vs manifest units; revenue, fees, net, cost and position; recovery % of manifest retail; remaining units and retail; break-even gross still needed; then **List next**: up to 10 SKUs that have units left but **no active listing**, ranked by remaining retail (units left × unit retail). Mention under-listed SKUs (more units left than active listings) separately.

Keep it short and factual. Leave out buyer names and addresses.
