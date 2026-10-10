# Bottle List Privacy Policy

Effective date: October 9, 2026

Bottle List is a Chrome extension for keeping a personal list of wines you plan to buy from online shops. This policy explains what information the extension handles and what it does with it.

## What the extension reads

When you click the Bottle List icon on a web page, the extension reads that page once to fill in the save form. It looks for the product name, link, price, currency, stock status, vintage and bottle size in the page's product data. It also scans the page's visible text for free-shipping wording; that text is not shown, saved or sent anywhere. If you click it on a CellarTracker wine page instead, it reads that wine's name, community average score and number of notes so you can attach the score to a wine already on your list. It does not read pages you have not clicked it on, does not look anything up on CellarTracker by itself, and does not run in the background on the sites you visit.

Only the fields shown in the save form are kept, and only if you click save.

## What the extension stores

Bottle List stores the following in Chrome's synced extension storage (`chrome.storage.sync`):

- the wines you save: product link, name, vintage, size, price, currency, stock status and quantity
- CellarTracker scores, note counts and links, whether typed in or read from a CellarTracker page you clicked it on
- anything else you type in: notes, and each shop's name, free-shipping threshold, case discount and notes
- whether you have marked a wine as bought

If Chrome sync is turned on with "Extensions" included, Chrome copies this data to your Google account and to other computers where you are signed in to Chrome with the same account, under Google's privacy policy. If sync is off, the data stays in Chrome on this computer.

## What the extension does not do

- It does not send your data to the developer or to any server of its own; the only copy that leaves your computer is the one Chrome sync makes. There is no account, sign-in or analytics.
- It does not sell, share or transfer your data to anyone.
- It does not use your data for advertising, credit decisions or any purpose other than showing you your own list.
- It does not buy anything, use your shopping carts, or store payment details or passwords.

## Links you choose to open

The "Find this wine on CellarTracker" and "Find prices on Wine-Searcher" links open those websites in a new tab with the wine name, and for Wine-Searcher the vintage, in the web address. This happens only when you click a link. Those sites have their own privacy policies.

## Notifications

When a shop's planned total reaches the threshold you set, the extension shows a notification on your computer. Notifications are created locally and contain only the shop name, item count and total.

## Exports

"Export CSV" and "Export backup" save a file from your list to your computer. Where that file goes afterwards is up to you.

## Deleting your data

You can delete any wine from the list. Removing the extension from Chrome on every computer where it is installed deletes all of its stored data. Export a backup first if you want to keep it.

## Changes and contact

If this policy changes, the new version will be posted at this address with a new effective date. Questions can be asked by opening an issue at https://github.com/haileiyu/bottle-list/issues.
