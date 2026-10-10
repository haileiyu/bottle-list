# Chrome Web Store submission: Bottle List 1.1.0

Everything to enter in the Chrome Web Store developer dashboard, in the order the dashboard asks for it. Copy the text in the boxes as is.

## 1. Package

Upload `dist/bottle-list-1.1.0.zip`. To rebuild it after a change, run `sh store/build-zip.sh` from the project folder.

Each new upload must have a higher `version` in `manifest.json` than the last one (1.1.0 → 1.1.1, for example).

The name, short description (summary) and icon come from `manifest.json` automatically.

## 2. Store listing tab

**Description**

```
Bottle List is a personal wish list for wine you plan to order online. Save bottles from different wine shops in one click, see a running total for each shop, and get a notification when an order reaches the free-shipping amount you set.

HOW IT WORKS
• Open a wine's product page and click the Bottle List icon. The extension fills in the name, vintage, size, price and stock from the page so you can check them and save.
• Your list is grouped by shop. Each shop shows its subtotal, how much is left to reach its free-shipping threshold, and a progress bar.
• Set a case discount for a shop (for example 10% off 12 or more bottles). Bottle List shows the discount once you reach it, or how many more bottles you need.
• Add your own notes, target prices and CellarTracker community scores, with quick links to look a wine up on CellarTracker or compare prices on Wine-Searcher. On a wine's CellarTracker page, click the Bottle List icon to fill in its community average and number of notes, and choose which saved wine it belongs to.
• Edit quantities right in the list, mark wines as bought, and export your list as CSV or a JSON backup.

WHAT IT DOES NOT DO
• Bottle List does not sell wine, does not place orders and does not touch your shopping carts. You order from the shop yourself.
• It does not check prices in the background. Prices and stock are saved when you save the wine; open the product page again to refresh them.
• It does not look up scores by itself. A score is read only from a CellarTracker page you have open when you click the icon, and you confirm it before it is saved. Bottle List is not affiliated with CellarTracker or Wine-Searcher.

PRIVATE BY DESIGN
Your list stays in Chrome, and follows you to your other computers through Chrome sync if you have it on. There is no separate account, no server and no tracking. The extension reads a page only when you click its icon.

Please buy and drink responsibly, and follow the alcohol laws where you live.
```

**Category:** Shopping

**Language:** English

**Graphics** (all in `store/images/`):

| Dashboard field | File |
| --- | --- |
| Store icon (128×128) | `store-icon-128.png` |
| Screenshots (1280×800), in this order | `screenshot-1-list.png`, `screenshot-3-save.png`, `screenshot-4-second-shop.png`, `screenshot-2-settings.png` |
| Small promo tile (440×280) | `promo-tile-440x280.png` |
| Marquee promo tile (1400×560) | Optional; skip it |

The screenshots use made-up shops and wines.

**Official URL:** leave as "None".

**Homepage URL:**

```
https://github.com/haileiyu/bottle-list
```

**Support URL:**

```
https://github.com/haileiyu/bottle-list/issues
```

**Mature content:** your choice. The store's rules treat alcohol as a regulated product, so marking the listing as mature lowers the risk of rejection. The tradeoff is that only signed-in adult Google accounts can then see and install it.

## 3. Privacy tab

**Single purpose description**

```
Bottle List keeps a personal list of wines the user plans to buy from online shops, grouped by shop, and tells the user when a shop's planned total reaches the free-shipping amount they set.
```

**Permission justifications**

activeTab:

```
When the user clicks the extension icon on a wine's product page, activeTab gives temporary access to that one tab so the extension can read the product name, price and stock to fill in the save form, or, on a CellarTracker wine page, the community average score and number of notes. No other tabs or sites are accessed.
```

scripting:

```
Used with activeTab to run one script included in the package in the current tab after the user clicks the icon. On a shop page, extract.js reads the page's product data (JSON-LD and product meta tags) and returns it to the popup. It also scans the page's visible text for free-shipping wording, which is not shown, saved or sent anywhere. On a CellarTracker wine page, extract-ct.js reads the wine name, the community average score and the number of notes instead. Neither script changes the page.
```

storage:

```
Stores the user's saved wines and their per-shop settings (free-shipping threshold, case discount, whether the shop charges sales tax, notes) in chrome.storage.sync, so Chrome sync can carry them to the user's other computers. Nothing is sent to any other server.
```

notifications:

```
Shows a notification when the total of the wines saved for one shop reaches the free-shipping threshold the user set for that shop.
```

**Host permissions:** none are requested, so this section has nothing to fill in.

**Are you using remote code?** No, I am not using remote code.

**Data usage.** Tick only **Website content**: the extension reads product details (or, on CellarTracker, a wine's community score) from the page the user clicks it on and stores them in Chrome's own extension storage (synced by Chrome if the user has sync on). Leave every other category unticked. The extension handles no names, emails, payment details, passwords, location or browsing history.

Tick all three certifications:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:**

```
https://github.com/haileiyu/bottle-list/blob/main/PRIVACY.md
```

## 4. Distribution tab

- **Payments:** Free of charge.
- **Visibility:** Unlisted is a good first step: only people with the link can find it, so you can install it from the store and test it before switching to Public. Or choose Public straight away.
- **Regions:** All regions.

## 5. Test instructions tab (for the reviewer)

```
No account or login is needed.
1. Open any online wine shop's product page (one bottle, not a search results page) and click the Bottle List toolbar icon.
2. Check the filled-in fields and click "Add to wish list". If the page has no product markup, the price is left blank and can be typed in.
3. Click "My list" to see the saved wine grouped by shop. Click "Shipping settings" on the shop, enter a threshold at or below the current total (for example 1), and save; a "Threshold reached" notification appears and the icon shows a badge.
4. In "Shipping settings", enter a case discount (for example 2 items, 10%) and set the wine's quantity to 2 to see the discount applied.
5. Optional: open any wine's page on cellartracker.com (wine.asp?iWine=...) and click the icon. The popup shows the page's community average and number of notes; choose the saved wine and click "Attach score".
All data is kept in chrome.storage.sync. The extension does not buy anything or contact any server of its own.
```
