---
description: Read-only audit of all live listings against the B-Stock manifest (units, duplicates, oversell risks, prices vs floors, photos, titles)
argument-hint: "[platform ...] (default: all enabled platforms)"
---

Use the **flipfloor-lite** skill. Run a **read-only** inventory audit. Do not edit, relist, delist, reprice or message anything.

Platforms: $ARGUMENTS (if empty, every platform enabled in `config.yaml`).

1. Do the skill's §0 setup checks (config, price sheet, inventory file). Stop and ask if `config.yaml` still has `CHANGE_ME` values needed for these platforms. If the owner has an existing inventory in another format, import it first (skill §1, "Importing an existing inventory").
2. Visit each platform one at a time and collect every live listing: id, title, price, status, listed date / age, views or clicks, likes/watchers, photo count. Also collect recent sales (last 30 days) for sync.
3. Match each listing to a manifest line (skill §8). Fill `inventory.csv` (back it up first if it exists): `retail_each_listing`, `list_price`, `offer_floor`, `price_pct_retail`.
4. Write `audit-<YYYY-MM-DD>.md` from `${CLAUDE_PLUGIN_ROOT}/templates/audit.md` with:
   - live listing counts per platform (in-lot vs not-in-lot)
   - **oversell risks first:** any item whose live listings exceed `manifest qty − units sold`, and anything sold on one platform but still live on another
   - duplicates, price inconsistencies across platforms
   - listings below the offer floor, below the hard floor, and at/above retail
   - listings with fewer than `audit.min_photos` photos; weak titles (no brand/size); "NEW" wording on a used lot
   - manifest items not listed anywhere (listing candidates), and unmatched listings
   - gaps you couldn't fill (rows still flagged `ID_MISSING`, `DATE_MISSING` or `SOLD_UNPRICED`; fill IDs and dates from the platforms where you can)
   - sales found on a platform but missing from `inventory.csv` (add them as `sold` rows)
5. If `research.md` is missing or older than `audit.research_max_age_days`, add a short sold-comps pass (eBay sold/completed searches per product group) and write `research.md`.
6. End with a **Needs you** list.