# Pricing rules (owner's current decisions; updated [YYYY-MM-DD])

These win over `config.yaml` and the plugin's SKILL.md wherever they differ. Write them in plain words.

- **New listings:** list at about [50]% of retail. Per-item numbers are in `data/price-sheet.csv`.
- **Offers:** accept down to about [40]% of retail.
- **Existing listings already below [40]%:** [leave them / raise them].
- **No sale after [7] days:** Claude may mark down below [40]% without asking.
- **Hard floor: [30]% of retail.** Never price below it, or accept an offer below it, without asking.
- **Sold-price rule:** if an item's real sold price on my accounts is above the list %, use the sold price as the reference.
