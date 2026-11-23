# Mark Cars

A used-car lot website for **Mark Cars**. It is a static site on GitHub Pages:

**https://russian1987.github.io/mark-cars/**

Inventory lives in the [Mark Cars Inventory](https://docs.google.com/spreadsheets/d/152Dyx-0wre38mwpjj9qsAfZyg0vrkrEunY57e5Zw6cY/edit) Google Sheet (tab `Inventory`). Each car has its own folder of photos in Google Drive. A Google Apps Script web app turns that sheet into JSON, and this site renders it.

`js/config.js` holds the Apps Script web app URL. If that feed fails, the site shows the three bundled **sample** listings and the local photos in `sample-photos/`. Those listings are examples, not cars for sale. Their photos are from Wikimedia Commons; see [Photo credits](credits.html).

## How the site loads cars

`js/config.js` has one setting:

```js
var FEED_URL = "";
```

- **Empty.** The site fetches `sample-feed.json`. Photos are mapped to local files by stock ID and order: `sample-photos/MC-001-01.jpg`, `MC-001-02.jpg`, and so on. The JSON still contains the real Drive file IDs, which work once the script is deployed and has shared those images.
- **Set to the Apps Script `/exec` URL.** The site requests that feed. **Refresh inventory** calls it again with `?refresh=1`, which skips the script’s short cache. If a normal `fetch` is blocked by the script’s redirect, the site retries with JSONP (`?callback=`). If the live feed still fails, a notice explains that, and the sample listings are shown instead.

Each photo tries `url`, then `thumb`, then `fallback`, then a neutral placeholder.

Every visit loads the feed on its own. The script keeps a 60-second cache, and the page waits up to 45 seconds so a cold start can finish. A loading line stays on screen until the cars appear. If `fetch` is blocked by the script redirect, the page retries with JSONP for the same amount of time.

**Refresh inventory** and **Add a car** are hidden from public visitors. Open the site with `?owner=markcars` on a browser you use to manage the lot. That browser remembers the choice, so later visits on the same device show both controls. **Refresh inventory** reloads the feed with `?refresh=1` (skipping the script cache), shows a spinner, and updates **Last updated**. **Add a car** opens the inventory spreadsheet in a new tab. Visit `?owner=off` to hide the controls again and forget the choice. Who can edit the sheet is controlled by its sharing settings. The public page does not mention these controls.

Sold cars are hidden until **Show sold cars** is turned on. When they are shown, they keep a Sold badge. Pending cars stay visible with a Pending badge.

Search covers title, make, model, color, type, stock ID, and description. Filters cover make, type, minimum price, maximum price, and maximum mileage. Sort covers price, mileage, and year.

Open a car for the description, specs, and gallery. Click the large photo to enlarge it. Arrow keys move between photos. Escape closes the enlarged photo, then the details.

## One-time Apps Script setup

The script in [`apps-script/Code.gs`](apps-script/Code.gs) is what the web app runs. To publish a new version:

1. Open [Mark Cars Inventory](https://docs.google.com/spreadsheets/d/152Dyx-0wre38mwpjj9qsAfZyg0vrkrEunY57e5Zw6cY/edit).
2. Choose **Extensions > Apps Script**.
3. Replace the default script with the contents of `apps-script/Code.gs`. Save.
4. Choose **Deploy > New deployment > Web app**.
5. Set **Execute as** to **Me**.
6. Set **Who has access** to **Anyone**.
7. Deploy, authorize the requested Drive and Sheets access, and copy the web app URL that ends in `/exec`.
8. Paste that URL into `js/config.js`:

   ```js
   var FEED_URL = "https://script.google.com/macros/s/…/exec";
   ```

9. Commit and push to `main`. GitHub Actions publishes the site. Then click **Refresh inventory**.

The script reads the `Inventory` tab, creates a photo folder for any row that does not have one (inside the Car Photos folder), and returns each image as `url`, `thumb`, and `fallback`. It shares only the image files inside those car folders so the public site can display them. The first request after a deploy can take a few seconds. Later requests reuse a 60-second cache unless you pass `?refresh=1`.

There is also a **Mark Cars** menu in the sheet after you reload it: **Create photo folders for new cars** and **Test the website feed**.

## How to add a car

1. Open **Mark Cars Inventory** and add a row under the last car. Fill in ID (for example `MC-004`), Title, Make, Model, Year, Type, Color, Mileage, Price, Description, and Status (`Available`, `Pending`, or `Sold`).
2. Leave **Photo Folder** blank. Use the sheet menu **Mark Cars > Create photo folders for new cars**, or click **Refresh inventory** on the website. A folder named after the car is created, and its link is written into the row.
3. Open that folder and add the car’s photos. Files are shown in name order, so `01.jpg` is the main photo.
4. On the website, click **Refresh inventory**. The new car and its photos appear.

The three cars already in the sheet are sample listings.

## Run it locally

From this folder:

```bash
python3 -m http.server 8765
```

Open http://127.0.0.1:8765/ . `fetch` of the sample feed does not work from a `file://` address, so use a local server.

## Publish

GitHub Pages is set to **GitHub Actions**. `.github/workflows/pages.yml` uploads the site with `actions/upload-pages-artifact@v3` and publishes it with `actions/deploy-pages@v4` on every push to `main`. There are no secrets. Paths are relative, so the project site works at `/mark-cars/`.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | Lot, filters, car details, lightbox |
| `credits.html` | Wikimedia photo credits |
| `js/config.js` | `FEED_URL` |
| `js/app.js` | Feed loading and the page |
| `css/styles.css` | Layout and theme |
| `sample-feed.json` | Bundled sample inventory |
| `sample-photos/` | Local sample photos, named `MC-00x-0y.jpg` |
| `apps-script/Code.gs` | Sheet web app to deploy once |
