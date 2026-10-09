# Bottle List

Chrome extension v1.1.0. Save wines from different merchants, total up what you plan to buy per merchant, and get alerted when you reach a free-shipping threshold you set.

## Installation (Mac / Windows)

1. Download or clone this repository and keep the `bottle-list` folder. Do not move or delete it after installing.
2. Type `chrome://extensions` in the Chrome address bar.
3. Turn on "Developer mode" in the top right corner.
4. Click "Load unpacked" and select the `bottle-list` folder that contains `manifest.json`.
5. Pin Bottle List to the toolbar from the browser's puzzle-piece icon.

This package is an inspectable, personal-use build and has not been published to the Chrome Web Store. Loading an unpacked extension is Chrome's officially supported way to install for personal development: https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked

## Your new workflow

1. Find a cheap wine → open the **specific product page** → click the Bottle List icon.
2. The extension tries to read the wine name, vintage, size, price, currency and stock. Check the vintage and size, enter how many you want, and save. The price may be per case, so enter the quantity in the unit the page sells.
3. Click "Find prices on Wine-Searcher" to compare the price with other shops (the list has a "Find price" link under each price too). Click "Find this wine on CellarTracker", confirm it is the same wine and vintage, and enter the **community average score** and that wine's CT link. Do not enter critic scores from RP / WA / JS / Vinous.
4. Open "My list" → click "Shipping settings" for that merchant, e.g. USD 300 before tax. The threshold starts empty; the extension does not assume every shop offers free shipping over $300. If the shop offers a case discount, enter the minimum number of items and the percent off (e.g. 12 items, 10%).
5. Keep saving. The list shows each shop's subtotal, the amount left to reach the threshold, CT scores and product links. You can edit quantities directly in the table.
6. When a merchant goes from below to at or above its threshold, the extension sends a system notification and shows the number of merchants that reached their thresholds on the icon badge; the list also shows a green status. If notifications are disabled in macOS / Chrome, you can still check the list and the icon.
7. After ordering, click "Bought" to move the wine to your purchase history; click "Restore" if you did it by mistake. If the total drops below the threshold, you will be alerted again the next time it is reached.

Example: at one shop, $95 × 2 + $115 × 1 = $305; with a $300 threshold it shows as reached. Wines saved from another shop are not combined with it.

Case discount example: 12 × $25 = $300 with a 10% discount at 12+ items comes to $270, so a $300 threshold is not reached yet. With 11 bottles the list shows "1 more item(s) for the 10% case discount".

## Current support and limitations

- Automatic extraction relies on the product page's Product JSON-LD or product price meta tags. If the page has no reliable markup, lists several sizes that cannot be matched to the selected one, or only shows a lowest price, you will be asked to enter the price manually.
- Check discounts, vintage, size, currency and stock before saving. Page metadata may not exactly match the currently selected variant.
- Merchants are grouped by domain. `www` and non-`www` are merged; other subdomains and different domains are not merged automatically.
- Amounts are calculated in integer cents. Wines that are out of stock, have no price, use a currency different from the merchant setting, or have "Count this wine toward free shipping" unchecked are not counted. Wines with unknown stock but a valid price are counted and flagged as unverified.
- A threshold is reached when the total is **greater than or equal to** the amount you set. Tax is excluded, currencies are not converted, and promo codes are not applied automatically. Memberships, New York State shipping coverage, promotion exclusions, bottle-count shipping thresholds and the like must be checked manually; you can write them in the merchant notes. Only the amount threshold and an optional case discount are calculated automatically.
- A case discount is one rule per merchant: once the counted items reach the minimum you set, the percent comes off the whole counted order (not only full cases). Items are counted by Qty as entered, so a "6 × 750 ml" case saved with Qty 1 counts as one item. The free-shipping threshold is compared against the total **after** the case discount. Tiered or mixed-case-only discounts must be checked manually.
- **The first version does not check prices in the background, monitor stock, compare prices across the web, or search for cheap wine automatically.** Prices and stock are snapshots from when you saved them. Reopen the same product link and click the extension to update the existing entry (quantity and CT fields are kept), or edit it manually in the list.
- **CT community scores are entered manually for now**, with a CT search shortcut and a source link. The extension does not use unverified merchant scores, does not automatically match vintages across sites, and does not bypass login restrictions. The CT link is for checking the source later and does not mean the extension has verified the score.
- New wines default to USD when the page does not show a currency; check the Currency field before saving.
- All wines to buy from one merchant make up one projected order. Purchased entries are not counted; the same wine saved at two shops counts toward each shop's projected order separately.
- CSV export is suited for further work in Excel / Numbers. JSON export includes all wines and merchant settings to preserve the raw data; this version has no import screen yet.

## Data and permissions

Data is stored in `chrome.storage.sync`, so it follows your Chrome profile: on another computer signed in to Chrome with the same account, the same list appears. This needs Chrome sync turned on with "Extensions" included (Settings → You and Google → Sync). Without sync, the list stays in this browser only. Nothing is sent anywhere except through Chrome's own sync, and there is no separate account and no tracking.

- Chrome only syncs data between copies of the extension with the same ID. Copies installed from the Chrome Web Store always share one ID. An unpacked copy's ID depends on where its folder is, so two unpacked copies on different computers usually do not sync with each other.
- Earlier versions kept the list on this computer only (`chrome.storage.local`). After updating, it moves into sync storage by itself and is merged with anything another computer has already synced: wines missing from the synced list are added, and shops that are already synced keep their settings.
- Chrome sync allows about 100 KB in total, roughly a couple of hundred wines. A list that is too large to move stays on this computer, and the list page says so; it moves on the next change once there is room. When synced storage is full, saving shows an error; export a backup and delete purchased wines to make room.
- If two computers change the same wine or shop before syncing, the last change wins.
- Removing the extension from every computer, or clearing its data, erases your records, so export them first.

- `activeTab` + `scripting`: reads product markup on the current page when you click the extension. There is no permanent permission to read every site.
- `storage`: stores wines and merchant settings.
- `notifications`: sends a notification when a threshold you set is reached.

The extension does not buy anything automatically, does not touch real shopping carts, does not store payment details, and does not sign in to sites for you.

## Development

Plain JavaScript / CSS, Manifest V3, no dependencies to install, no build step. After editing, click reload on the extensions page.

- `core.mjs`: amounts, case discounts, grouping, data validation, threshold status.
- `background.js`: serialized saves, notifications, icon badge.
- `storage.mjs`: reads and writes `chrome.storage.sync`, one key per wine and merchant, and moves lists from earlier versions out of `chrome.storage.local`.
- `extract.js`: reads product info from the current page.
- `popup.*`: save and update entry point.
- `dashboard.*`: list, editing, filtering, export.
- `store/`: Chrome Web Store listing text (`LISTING.md`), images, and `build-zip.sh`, which builds the upload zip in `dist/`. The privacy policy is `PRIVACY.md`.

Run `node --test tests/*.test.mjs`: 19 tests pass, covering amount totals, case discounts, Title Case names, currency separation, threshold notification state, duplicate entries, sync storage, moving older lists into sync, and page metadata extraction. JavaScript syntax checks pass.

Installation, UI and operating-system notification testing in a real Chrome has not been done yet, and individual merchant sites have not been verified one by one; the current environment cannot download a test browser. After installing, save one or two products first, check the prices manually, then set that merchant's threshold to the current total to test the notification. Restore the real threshold when you are done.
