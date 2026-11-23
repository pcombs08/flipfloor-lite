---
name: flipfloor-lite
description: Read-only liquidation reports and listing audits for a B-Stock (or other wholesale / customer-returns) lot sold on eBay, Vinted, Depop and Facebook Marketplace. Builds a price sheet from the manifest, audits live listings against it with Claude in Chrome without changing anything, and writes lot, morning and weekly reports. Use when asked for a liquidation report, a price sheet from a manifest, or a read-only audit of resale listings.
when_to_use: The user has a liquidation lot (manifest CSV) and listings on eBay, Vinted, Depop and/or Facebook Marketplace, and asks for a price sheet, a lot/morning/weekly report, or a read-only audit.
---

# FlipFloor Lite

You help the owner of a liquidation business see where their lot stands. They bought one lot (or several) of returns / overstock on B-Stock or a similar site, and they sell it across several resale platforms.

**FlipFloor Lite is read-only on every platform.** Never edit, relist, delist, reprice, end, delete, crosslist, send or accept offers, or message anyone. If the owner asks for one of those, say it's part of FlipFloor Pro and offer to put the change in the report as a recommendation instead.

Everything specific to the owner (lot ID, lot cost, percentages, accounts, which platforms are on) lives in **`config.yaml` in the working folder**. Read it on every run.

Section numbers match FlipFloor Pro so the commands read the same. Sections 4–6 (offers and the nightly routine) are Pro-only and not included.

---

## 0. First run / setup

Paths below that start with the plugin root point into this plugin's install folder. If a path still contains a literal `CLAUDE_PLUGIN_ROOT` placeholder, find the folder with `claude plugin list` (the "Read from" line for flipfloor-lite) or look two levels up from this SKILL.md.

1. Look for `config.yaml` in the working folder. If it's missing, copy `${CLAUDE_PLUGIN_ROOT}/config.example.yaml` to `config.yaml`, then stop and ask the owner to fill in every `CHANGE_ME` value.
2. Look for the manifest at `config.yaml` → `lot.manifest_csv`. If `data/price-sheet.csv` doesn't exist, build it:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/manifest-to-price-sheet.js" --manifest <manifest_csv> --config config.yaml --out data/price-sheet.csv`
   - Windows without Node: `powershell -ExecutionPolicy Bypass -File "${CLAUDE_PLUGIN_ROOT}/scripts/manifest-to-price-sheet.ps1" -Manifest <manifest_csv> -OutPath data/price-sheet.csv` (pass `-ListPct`, `-OfferPct`, `-HardPct`, `-Rounding` and the tier thresholds from `config.yaml` → `pricing`, and the manifest column names if they differ from the B-Stock defaults).
   - Neither available: compute the same columns yourself (§3 and the script header) and write the CSV.
3. If `inventory.csv` doesn't exist, create it from `${CLAUDE_PLUGIN_ROOT}/templates/inventory.template.csv` and fill it during the first audit (`/flipfloor-lite:audit`). If the owner already tracks listings in another sheet or format, import it instead (§1, "Importing an existing inventory").
4. The audit reads the owner's listings through **Claude in Chrome**. Confirm it's connected and the owner is signed in to each enabled platform. Never type passwords or one-time codes. Reports and the price sheet don't need a browser.

## 1. Working-folder files

| File | What it is |
|---|---|
| `config.yaml` | Owner settings: lot, cost, pricing percentages, accounts, platform switches. |
| `inventory.csv` | **Source of truth.** One row per listing. Columns: `platform, listing_id, title, price, status, listed_or_relisted, age_days, views_or_clicks, likes_or_watchers, photos, product_group, manifest_item, in_lot, flags, retail_each_listing, list_price, offer_floor, price_pct_retail`. A `?` in front of `manifest_item` = best-guess match. `UNMATCHED` = no manifest line found. `age_days` = whole days from `listed_or_relisted` to the date the sheet was last updated, for every row including sold ones. **Flag formats** (`;`-separated, reports parse them): `SOLD_<date>(<sold price>, <platform>[; offer])` with status `sold` (the sold price is what the buyer paid, not the list price), `REPRICED_<date>(old->new)`, `RELISTED_<date>(from <old id>)`, `CROSSLISTED_FROM(<platform> <id>)`, `ENDED_<date>(<reason>)`, `LT4_PHOTOS`, `WEAK_TITLE`. |
| `<lot.manifest_csv>` | The B-Stock manifest: item #, description, qty, unit retail (column names mapped in config). |
| `data/price-sheet.csv` | Per SKU: retail, list price, offer floor, hard floor, tier, qty. Built by the script. |
| `research.md` | Sold comps and platform notes (written by the audit). |
| `offers-log.md`, `*-log-*.md` | Logs, if the owner keeps them. Reports read them when present. |

**`status` values** (lowercase, nothing else in the cell): `active`, `sold`, `pending`, `ended`, `blocked`, `processing`, `draft`. Put every detail in `flags`.

**`listing_id`** is required on every row: eBay item number, Vinted item id, Depop slug (the part after `/products/`), Facebook `listing_id` (from the listing's edit URL `/marketplace/edit/?listing_id=<id>`, which the owner can copy). **`listed_or_relisted`** is a `YYYY-MM-DD` date; add `DATE_ESTIMATED` when it's a best guess.

### Importing an existing inventory
1. Copy the owner's sheet to `data/inventory-import-<date>.csv`. Never edit the original.
2. Map its columns to the ones above by meaning (e.g. `list_50pct` → `list_price`, `floor_40pct` → `offer_floor`). Leave unknown columns out and list them in the report.
3. Normalize `status` to the values above and move the rest of the text into `flags`. For example:
   - `active (BO)` → `active` + `BEST_OFFER`
   - `active (was 50)` → `active` + `REPRICED_<date>(50-><price>)` + `DATE_ESTIMATED`
   - `ENDED <date> (reason)` → `ended` + `ENDED_<date>(reason)`
4. Past sales noted only as free text become `sold` rows with `SOLD_<date>(<price>, <platform>)` when the price is known. Otherwise flag them `SOLD_UNPRICED(<note>)` and list them under **Needs you**.
5. Rows without an id or a date get `ID_MISSING` / `DATE_MISSING`. The audit fills them from the platforms where it can.

Back up `inventory.csv` to `data/inventory-backup-<date>.csv` before rewriting it.

## 2. Guardrails

1. **Read-only on platforms**, always (see the top of this file).
2. Never type passwords or codes. Never open payment, shipping-label or buyer-message screens.
3. **Never open a platform's inbox page in the browser.** Vinted's `/inbox` opens the newest conversation and marks it as read. Read inbox data through the API from another page (§7).
4. Work one platform at a time at a human pace. Stop and tell the owner if a platform shows a warning, CAPTCHA, verification step or rate-limit notice. Never try to bypass any of them.
5. Leave buyer names, usernames and addresses out of every file.

## 3. Pricing (for the price sheet and reports)

Retail comes from `data/price-sheet.csv` via `inventory.csv` → `manifest_item`.

- **List price** = `unit_retail × list_pct_of_retail`, rounded per `pricing.rounding`.
- **Offer floor** = `unit_retail × offer_floor_pct` if the listing is younger than `markdown_below_offer_floor_after_days`, else `unit_retail × hard_floor_pct`.
- **Listing age** = whole days from `listed_or_relisted` to the date being reported on. "Past the markdown age" means age ≥ `markdown_below_offer_floor_after_days`. A relist resets the age.
- **Hard floor** = `unit_retail × hard_floor_pct`.
- **Retail unknown (UNMATCHED):** treat the floor as `pricing.unmatched_floor_pct_of_list` (default 80%) of the current list price.
- **Tier** (from the price sheet): A/B/C/D by unit retail, thresholds in `pricing.tier_a_min_retail`, `tier_b_min_retail` and `tier_c_min_retail`.

Reports may **recommend** changes using these rules: an old listing with many views and no sale → price is the blocker; few views → fix the title first; priced at or above retail → drop to about the list %. Lite never applies them.

## 7. Reading each platform (audit)

Coordinates aren't needed: the audit only reads pages and same-site APIs.

### General
- Long JS loops time out after about 45 seconds. Run them async, store results on `window`, and read them back in a later call.
- If a page redirects while a JS call runs ("page navigated to a different domain"), wait, re-check the tab, and run the call again.

### eBay
- **Active listings:** `https://www.ebay.com/sh/lst/active`. Parse the table rows with JS: item number, price, Buy It Now / Best Offer, quantity, views. `get_page_text` returns little on Seller Hub.
- **Orders:** `https://www.ebay.com/sh/ord/?filter=status:ALL_ORDERS` (client-rendered; open the page, then parse rows). Record item number, price and date only.
- **Open offers count:** the overview `https://www.ebay.com/sh/ovw` shows "With open offers from buyers N".
- **Sold comps:** `/sch/i.html?_nkw=<q>&LH_Sold=1&LH_Complete=1`. Base price bands on matching sold examples, not the raw median.

### Vinted
- **Domain:** `config.yaml` → `accounts.vinted.domain`. Call APIs from a Vinted page (the profile `/member/<user_id>` works).
- **Wardrobe:** `/api/v2/wardrobe/<accounts.vinted.user_id>/items?page=N&per_page=40&order=newest_first`. Fields: `is_closed`, `item_closing_action` ("sold"), `is_reserved`, `favourite_count`, `view_count`, `is_processing`, `is_hidden`, `is_draft`.
- **Full item:** `/api/v2/item_upload/items/<id>` (photos, package size). A 404 means deleted.
- **Inbox (read-only):** `/api/v2/inbox?page=N&per_page=50`. Never open `/inbox` itself.

### Depop
- **Shop:** `https://www.depop.com/<shop>/`. Scroll to the end. Cards link to `/products/<slug>/`, and sold cards contain "Sold".
- **Sales:** `https://www.depop.com/sellinghub/sold-items/`. "Ship order" status = waiting for the owner to ship (**Needs you**). A row's details open in a side panel outside `<main>`; read it from a screenshot.
- **Offers:** `https://www.depop.com/sellinghub/offers/`. Cards marked "Special offer sent" are the owner's own offers, not buyer offers.

### Facebook Marketplace
- **Selling page:** `https://www.facebook.com/marketplace/you/selling`. Scroll to load everything, then parse `[role=main]` innerText. Each listing's status (Active/Sold/Pending) comes just after its price. A reduced price shows as "$new$old". "This looks like a duplicate so we didn't post it" = `blocked`.
- **Offers:** `https://www.facebook.com/marketplace/you/shipping_offers`.

## 8. Matching listings to the manifest

- Match by brand + model/collection + size first, then UPC or MPN from item specifics, then description keywords. Prefix best guesses with `?` and list them for the owner to confirm.
- Listings with no match get `UNMATCHED` and the unmatched-floor rule. Items that may not be from this lot get `in_lot = no`.

## 9. Reports

Keep reports factual, short, and in the owner's terms. Always end with **Needs you**, ordered by urgency: oversell risks first, then shipping deadlines, then decisions. Rows with `in_lot = no` are left out of every report figure. Report templates: `${CLAUDE_PLUGIN_ROOT}/templates/morning-report.md` and `${CLAUDE_PLUGIN_ROOT}/templates/weekly-report.md`.

Want the nightly run (sales sync with delisting, relisting, repricing, offers, crosslisting)? That's FlipFloor Pro.
