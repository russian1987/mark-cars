/**
 * Mark Cars — inventory feed for the website.
 *
 * Paste this into the "Mark Cars Inventory" sheet: Extensions > Apps Script.
 * Deploy > New deployment > Web app; Execute as: Me; Who has access: Anyone.
 * Copy the /exec URL into the website's config.
 *
 * What it does:
 *  - GET <exec URL>             -> JSON of every car row plus its photos
 *  - GET <exec URL>?refresh=1   -> same, skipping the 60-second cache
 *  - GET <exec URL>?callback=fn -> JSONP (only if a browser blocks fetch)
 *  - Any row without a Photo Folder link gets its own folder created
 *    inside "Car Photos" and the link written back into the sheet.
 *  - Photos inside each car's folder are set to "anyone with the link can
 *    view" so the public site can show them. Nothing else is shared.
 */

var CONFIG = {
  SPREADSHEET_ID: '152Dyx-0wre38mwpjj9qsAfZyg0vrkrEunY57e5Zw6cY',
  SHEET_NAME: 'Inventory',
  PHOTOS_PARENT_FOLDER_ID: '1yG6YjvfmFnVdamSFhlE8OD8pRWFM5zO4', // Mark Cars / Car Photos
  AUTO_CREATE_FOLDERS: true,
  AUTO_SHARE_PHOTOS: true,
  CACHE_SECONDS: 60,
  IMAGE_WIDTH: 1600,
  THUMB_WIDTH: 600
};

function doGet(e) {
  var params = (e && e.parameter) || {};
  var cache = CacheService.getScriptCache();
  var json = params.refresh ? null : cache.get('feed');
  if (!json) {
    var payload;
    try {
      payload = buildFeed_();
    } catch (err) {
      payload = { ok: false, error: String(err && err.message || err) };
    }
    json = JSON.stringify(payload);
    if (payload.ok && json.length < 90000) cache.put('feed', json, CONFIG.CACHE_SECONDS);
  }
  if (params.callback && /^[A-Za-z_$][\w$.]*$/.test(params.callback)) {
    return ContentService.createTextOutput(params.callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function buildFeed_() {
  var sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('Tab "' + CONFIG.SHEET_NAME + '" not found');
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var col = {};
  headers.forEach(function (h, i) { col[h] = i; });
  var folderCol = col['Photo Folder'];
  var cars = [];

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row.join('').trim() === '') continue;
    var car = {};
    headers.forEach(function (h, i) { if (h) car[toKey_(h)] = row[i]; });
    if (!car.id && !car.title) continue;

    var folderUrl = folderCol != null ? String(row[folderCol] || '') : '';
    var folderId = extractId_(folderUrl);
    if (!folderId && CONFIG.AUTO_CREATE_FOLDERS && folderCol != null) {
      var name = [car.id, car.title].filter(String).join(' ');
      var folder = DriveApp.getFolderById(CONFIG.PHOTOS_PARENT_FOLDER_ID).createFolder(name);
      folderId = folder.getId();
      folderUrl = folder.getUrl();
      sheet.getRange(r + 1, folderCol + 1).setValue(folderUrl);
    }
    car.photoFolder = folderUrl;
    car.photos = folderId ? listPhotos_(folderId) : [];
    cars.push(car);
  }
  return { ok: true, updated: new Date().toISOString(), count: cars.length, cars: cars };
}

function listPhotos_(folderId) {
  var out = [];
  var files = DriveApp.getFolderById(folderId).getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (String(f.getMimeType()).indexOf('image/') !== 0) continue;
    if (CONFIG.AUTO_SHARE_PHOTOS && f.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) {
      try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (err) {}
    }
    var id = f.getId();
    out.push({
      id: id,
      name: f.getName(),
      url: 'https://lh3.googleusercontent.com/d/' + id + '=w' + CONFIG.IMAGE_WIDTH,
      thumb: 'https://lh3.googleusercontent.com/d/' + id + '=w' + CONFIG.THUMB_WIDTH,
      fallback: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w' + CONFIG.IMAGE_WIDTH
    });
  }
  out.sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true }); });
  return out;
}

function toKey_(h) {
  // "Photo Folder" -> "photoFolder", "ID" -> "id"
  var parts = h.replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ');
  return parts.map(function (p, i) {
    p = p.toLowerCase();
    return i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1);
  }).join('');
}

function extractId_(url) {
  var m = String(url).match(/(?:folders\/|[?&]id=)([-\w]{20,})/);
  if (m) return m[1];
  return /^[-\w]{20,}$/.test(String(url).trim()) ? String(url).trim() : '';
}

/** Sheet menu: Mark Cars > Create photo folders for new cars */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Mark Cars')
    .addItem('Create photo folders for new cars', 'createMissingFolders')
    .addItem('Test the website feed', 'testFeed')
    .addToUi();
}

function createMissingFolders() {
  var feed = buildFeed_();
  CacheService.getScriptCache().remove('feed');
  SpreadsheetApp.getActive().toast('Checked ' + feed.count + ' cars. New rows now have photo folders.', 'Mark Cars');
}

function testFeed() {
  var feed = buildFeed_();
  Logger.log(JSON.stringify(feed, null, 2));
  SpreadsheetApp.getActive().toast(feed.count + ' cars, ' +
    feed.cars.reduce(function (n, c) { return n + c.photos.length; }, 0) + ' photos.', 'Mark Cars feed OK');
}
