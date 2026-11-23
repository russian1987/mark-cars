(function () {
  "use strict";

  var SHEET_URL = "https://docs.google.com/spreadsheets/d/152Dyx-0wre38mwpjj9qsAfZyg0vrkrEunY57e5Zw6cY/edit";
  var SAMPLE_URL = "sample-feed.json";
  var PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">' +
      '<rect width="800" height="500" fill="#e6e0d4"/>' +
      '<g fill="none" stroke="#6f675d" stroke-width="10" stroke-linejoin="round" stroke-linecap="round">' +
        '<path d="M148 332h508l-52-104H348l-58-68h-78l-46 68h-18z"/>' +
        '<circle cx="268" cy="344" r="34"/>' +
        '<circle cx="548" cy="344" r="34"/>' +
      "</g>" +
      '<text x="400" y="430" text-anchor="middle" font-family="Georgia,serif" font-size="32" fill="#5c564e">Photo unavailable</text>' +
    "</svg>"
  );

  var grid = document.getElementById("grid");
  if (!grid) return;

  var els = {
    grid: grid,
    refresh: document.getElementById("refresh"),
    refreshLabel: document.getElementById("refresh-label"),
    addCar: document.getElementById("add-car"),
    updated: document.getElementById("updated-time"),
    notice: document.getElementById("notice"),
    noticeText: document.getElementById("notice-text"),
    count: document.getElementById("count"),
    empty: document.getElementById("empty"),
    status: document.getElementById("status"),
    inventory: document.getElementById("inventory"),
    form: document.getElementById("filters"),
    q: document.getElementById("q"),
    make: document.getElementById("make"),
    type: document.getElementById("type"),
    sort: document.getElementById("sort"),
    minPrice: document.getElementById("min-price"),
    maxPrice: document.getElementById("max-price"),
    maxMiles: document.getElementById("max-miles"),
    showSold: document.getElementById("show-sold"),
    reset: document.getElementById("reset-filters"),
    statCount: document.getElementById("stat-count"),
    statPrice: document.getElementById("stat-price"),
    statTypes: document.getElementById("stat-types"),
    heroImg: document.getElementById("hero-img"),
    heroCaption: document.getElementById("hero-caption"),
    dialog: document.getElementById("car-dialog"),
    dialogClose: document.getElementById("dialog-close"),
    dialogTitle: document.getElementById("dialog-title"),
    dialogKicker: document.getElementById("dialog-kicker"),
    dialogPrice: document.getElementById("dialog-price"),
    dialogStatus: document.getElementById("dialog-status"),
    dialogSample: document.getElementById("dialog-sample"),
    dialogSpecs: document.getElementById("dialog-specs"),
    dialogDesc: document.getElementById("dialog-desc"),
    dialogCredit: document.getElementById("dialog-credit"),
    dialogContact: document.getElementById("dialog-contact"),
    galleryOpen: document.getElementById("gallery-open"),
    galleryImg: document.getElementById("gallery-img"),
    thumbs: document.getElementById("thumbs"),
    lightbox: document.getElementById("lightbox"),
    lightImg: document.getElementById("light-img"),
    lightCaption: document.getElementById("light-caption"),
    lightHint: document.getElementById("light-hint"),
    lightPrev: document.getElementById("light-prev"),
    lightNext: document.getElementById("light-next"),
    lightClose: document.getElementById("light-close")
  };

  var state = {
    cars: [],
    updated: "",
    sample: true,
    activeId: null,
    photoIndex: 0,
    lightOpen: false,
    opener: null,
    loading: false
  };

  els.addCar.href = SHEET_URL;

  els.refresh.addEventListener("click", function () { loadInventory(true); });
  els.form.addEventListener("submit", function (event) { event.preventDefault(); });
  els.q.addEventListener("input", debounce(renderGrid, 120));
  [els.make, els.type, els.sort, els.minPrice, els.maxPrice, els.maxMiles, els.showSold].forEach(function (node) {
    node.addEventListener("input", renderGrid);
    node.addEventListener("change", renderGrid);
  });
  els.reset.addEventListener("click", resetFilters);

  els.grid.addEventListener("click", function (event) {
    var link = event.target.closest("a.card-link");
    if (!link) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var id = link.getAttribute("data-id");
    if (!id || !findCar(id)) return;
    event.preventDefault();
    openCar(id, false);
  });

  document.addEventListener("click", function (event) {
    var closer = event.target.closest("[data-close]");
    if (!closer) return;
    if (closer.getAttribute("data-close") === "light") closeLight();
    else closeCar(false);
  });

  els.galleryOpen.addEventListener("click", openLight);
  els.lightPrev.addEventListener("click", function () { stepPhoto(-1); });
  els.lightNext.addEventListener("click", function () { stepPhoto(1); });
  els.thumbs.addEventListener("click", function (event) {
    var button = event.target.closest("button[data-index]");
    if (!button) return;
    state.photoIndex = Number(button.getAttribute("data-index")) || 0;
    renderGallery();
    if (state.lightOpen) renderLightbox();
  });

  els.dialogContact.addEventListener("click", function (event) {
    event.preventDefault();
    closeCar(false);
    var contact = document.getElementById("contact");
    if (contact) {
      contact.focus();
      contact.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    }
  });

  document.addEventListener("keydown", onKeydown);
  window.addEventListener("hashchange", syncFromLocation);
  window.addEventListener("popstate", syncFromLocation);

  var touchX = null;
  els.lightImg.addEventListener("touchstart", function (event) {
    touchX = event.changedTouches[0].clientX;
  }, { passive: true });
  els.lightImg.addEventListener("touchend", function (event) {
    if (touchX == null) return;
    var dx = event.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) < 48) return;
    stepPhoto(dx < 0 ? 1 : -1);
  }, { passive: true });

  loadInventory(false);

  function feedUrl() {
    return (typeof FEED_URL === "string" ? FEED_URL : "").trim();
  }

  function loadInventory(refresh) {
    if (state.loading) return;
    state.loading = true;
    setBusy(true);
    var started = Date.now();
    announce(refresh ? "Refreshing inventory." : "Loading inventory.");
    els.inventory.setAttribute("aria-busy", "true");

    var url = feedUrl();
    var task = !url
      ? loadSample(refresh).then(function (data) {
          return { data: data, sample: true, kind: "sample" };
        })
      : loadLive(url, refresh).then(function (data) {
          return { data: data, sample: false, kind: "" };
        }).catch(function () {
          return loadSample(true).then(function (data) {
            return { data: data, sample: true, kind: "error" };
          });
        });

    task.then(function (result) {
      var ingested = ingest(result.data, result.sample);
      state.cars = ingested.cars;
      state.updated = ingested.updated;
      state.sample = result.sample;
      renderAll();
      if (result.kind === "error") {
        setNotice("Couldn’t reach the live inventory, so sample listings are showing instead. These cars are examples, not vehicles for sale.", "error");
      } else if (result.sample) {
        setNotice("Sample listings. These cars are examples, not vehicles for sale. Add the Apps Script web app URL in config.js to load the Google Sheet.", "sample");
      } else {
        setNotice("", "");
      }
      var listed = visibleCars();
      announce((refresh ? "Inventory refreshed. " : "Inventory loaded. ") + countLabel(listed.length, state.cars.length) + ". Last updated " + formatWhen(state.updated) + ".");
      syncOpenCar();
    }).catch(function () {
      state.cars = [];
      state.sample = true;
      renderAll();
      setNotice("Inventory could not be loaded. Check the connection and use Refresh inventory.", "error");
      announce("Inventory could not be loaded.");
    }).then(function () {
      var wait = 350 - (Date.now() - started);
      return wait > 0 ? sleep(wait) : null;
    }).then(function () {
      state.loading = false;
      setBusy(false);
      els.inventory.setAttribute("aria-busy", "false");
    });
  }

  function loadSample(refresh) {
    var url = SAMPLE_URL + (refresh ? "?refresh=1&t=" + Date.now() : "");
    return fetchJson(url, !!refresh).then(assertFeed);
  }

  function loadLive(base, refresh) {
    var url = new URL(base, window.location.href);
    if (refresh) url.searchParams.set("refresh", "1");
    return fetchJson(url.toString(), !!refresh).then(assertFeed).catch(function () {
      return fetchJsonp(base, !!refresh).then(assertFeed);
    });
  }

  function fetchJson(url, refresh) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) controller.abort();
    }, 12000);
    return fetch(url, {
      cache: refresh ? "no-store" : "default",
      redirect: "follow",
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    }).then(function (data) {
      clearTimeout(timer);
      return data;
    }, function (error) {
      clearTimeout(timer);
      throw error;
    });
  }

  function fetchJsonp(base, refresh) {
    return new Promise(function (resolve, reject) {
      var cb = "markCarsFeed_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
      var script = document.createElement("script");
      var url;
      try {
        url = new URL(base, window.location.href);
      } catch (error) {
        reject(error);
        return;
      }
      if (refresh) url.searchParams.set("refresh", "1");
      url.searchParams.set("callback", cb);
      var timer = setTimeout(function () {
        cleanup();
        reject(new Error("timeout"));
      }, 12000);
      function cleanup() {
        clearTimeout(timer);
        try { delete window[cb]; } catch (error) { window[cb] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }
      window[cb] = function (data) {
        cleanup();
        resolve(data);
      };
      script.onerror = function () {
        cleanup();
        reject(new Error("jsonp"));
      };
      script.src = url.toString();
      document.head.appendChild(script);
    });
  }

  function assertFeed(data) {
    if (!data || data.ok !== true || !Array.isArray(data.cars)) {
      throw new Error((data && data.error) || "bad feed");
    }
    return data;
  }

  function ingest(data, useLocal) {
    var cars = data.cars.map(normalize).filter(function (car) {
      return car.id || car.title;
    });
    if (useLocal) cars = cars.map(withLocalPhotos);
    return {
      cars: cars,
      updated: data.updated || new Date().toISOString()
    };
  }

  function normalize(car) {
    var photos = Array.isArray(car.photos) ? car.photos.map(function (photo) {
      photo = photo || {};
      return {
        id: String(photo.id || ""),
        name: String(photo.name || ""),
        url: String(photo.url || ""),
        thumb: String(photo.thumb || ""),
        fallback: String(photo.fallback || "")
      };
    }) : [];
    return {
      id: String(car.id || "").trim(),
      title: String(car.title || "").trim() || "Untitled car",
      make: String(car.make || "").trim(),
      model: String(car.model || "").trim(),
      year: num(car.year),
      type: String(car.type || "").trim(),
      color: String(car.color || "").trim(),
      mileage: num(car.mileage),
      price: num(car.price),
      description: String(car.description || "").trim(),
      photoFolder: String(car.photoFolder || ""),
      status: normalizeStatus(car.status),
      photos: photos
    };
  }

  function withLocalPhotos(car) {
    var slug = String(car.id || "").trim().replace(/[^\w.-]+/g, "");
    var photos = car.photos.map(function (photo, index) {
      var local = "sample-photos/" + slug + "-" + String(index + 1).padStart(2, "0") + ".jpg";
      return {
        id: photo.id,
        name: photo.name,
        url: local,
        thumb: local,
        fallback: photo.fallback || photo.url || ""
      };
    });
    if (!photos.length && slug) {
      var only = "sample-photos/" + slug + "-01.jpg";
      photos.push({ id: "", name: slug + "-01.jpg", url: only, thumb: only, fallback: "" });
    }
    return Object.assign({}, car, { photos: photos });
  }

  function renderAll() {
    fillSelect(els.make, uniques(state.cars, "make"), "All makes");
    fillSelect(els.type, uniques(state.cars, "type"), "All types");
    renderUpdated();
    renderStats();
    renderHero();
    renderGrid();
  }

  function renderUpdated() {
    var label = formatWhen(state.updated);
    els.updated.textContent = label;
    els.updated.setAttribute("datetime", state.updated || "");
  }

  function renderStats() {
    var available = state.cars.filter(function (car) { return car.status !== "Sold"; });
    els.statCount.textContent = String(available.length);
    var prices = available.map(function (car) { return car.price; }).filter(function (price) { return !isNaN(price); });
    els.statPrice.textContent = prices.length ? money(Math.min.apply(null, prices)) : "—";
    els.statTypes.textContent = typeSummary(available);
  }

  function renderHero() {
    if (state.sample) {
      els.heroCaption.textContent = "Sample photo · 2019 Ford F-150 XLT";
      return;
    }
    var car = state.cars.filter(function (item) {
      return item.status !== "Sold" && item.photos.length;
    })[0] || state.cars[0];
    if (!car || !car.photos.length) return;
    attachFallback(els.heroImg, car.photos[0], car.title);
    els.heroCaption.textContent = [yearText(car.year), car.make, car.model].filter(Boolean).join(" ");
  }

  function renderGrid() {
    var list = visibleCars();
    var totalShownPool = state.cars.filter(function (car) {
      return els.showSold.checked || car.status !== "Sold";
    }).length;
    clear(els.grid);
    list.forEach(function (car) { els.grid.appendChild(renderCard(car)); });
    els.count.textContent = state.cars.length ? countLabel(list.length, totalShownPool) : "No cars yet";
    renderEmpty(list);
  }

  function renderEmpty(list) {
    clear(els.empty);
    if (list.length) {
      els.empty.hidden = true;
      return;
    }
    els.empty.hidden = false;
    var message = document.createElement("p");
    if (!state.cars.length) {
      message.textContent = "No cars in the inventory yet. Add a row in the sheet, put photos in that car’s folder, then refresh.";
    } else {
      message.textContent = "No cars match those filters.";
    }
    els.empty.appendChild(message);
    if (state.cars.some(function (car) { return car.status === "Sold"; }) && !els.showSold.checked) {
      var soldNote = document.createElement("p");
      soldNote.textContent = "Sold cars are hidden. Turn on Show sold cars to see them.";
      els.empty.appendChild(soldNote);
    }
    if (filtersActive()) {
      var reset = document.createElement("button");
      reset.type = "button";
      reset.className = "btn btn-line";
      reset.textContent = "Reset filters";
      reset.addEventListener("click", resetFilters);
      els.empty.appendChild(reset);
    }
  }

  function renderCard(car) {
    var article = document.createElement("article");
    article.className = "card" + (car.status === "Sold" ? " is-sold" : "");
    var link = document.createElement("a");
    link.className = "card-link";
    link.href = "#" + encodeURIComponent(car.id);
    link.setAttribute("data-id", car.id);
    link.setAttribute("aria-label", "View details for " + car.title + ", " + money(car.price) + ", " + car.status);

    var media = document.createElement("div");
    media.className = "card-media";
    var img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = "";
    attachFallback(img, car.photos[0], "");
    media.appendChild(img);

    var badges = document.createElement("div");
    badges.className = "card-badges";
    badges.appendChild(badge(car.status));
    if (isSampleCar(car) || state.sample) badges.appendChild(chip("Sample", "badge badge-sample"));
    media.appendChild(badges);

    var body = document.createElement("div");
    body.className = "card-body";
    var title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = car.title;
    var meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = [car.type, car.color, miles(car.mileage)].filter(function (part) {
      return part && part !== "—";
    }).join(" · ");
    var price = document.createElement("p");
    price.className = "price";
    price.textContent = money(car.price);
    var cue = document.createElement("span");
    cue.className = "view-cue";
    cue.textContent = "View details";
    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(price);
    body.appendChild(cue);
    link.appendChild(media);
    link.appendChild(body);
    article.appendChild(link);
    return article;
  }

  function visibleCars() {
    var query = els.q.value.trim().toLowerCase();
    var make = els.make.value;
    var type = els.type.value;
    var minPrice = numOrNull(els.minPrice.value);
    var maxPrice = numOrNull(els.maxPrice.value);
    var maxMiles = numOrNull(els.maxMiles.value);
    var showSold = els.showSold.checked;
    var list = state.cars.filter(function (car) {
      if (!showSold && car.status === "Sold") return false;
      if (make && car.make !== make) return false;
      if (type && car.type !== type) return false;
      if (minPrice != null && !(car.price >= minPrice)) return false;
      if (maxPrice != null && !(car.price <= maxPrice)) return false;
      if (maxMiles != null && !(car.mileage <= maxMiles)) return false;
      if (query) {
        var hay = [car.title, car.make, car.model, car.color, car.type, car.id, car.description, car.status, yearText(car.year)].join(" ").toLowerCase();
        if (hay.indexOf(query) === -1) return false;
      }
      return true;
    });
    var sort = els.sort.value;
    list.sort(function (a, b) {
      var diff = 0;
      if (sort === "price-asc") diff = cmpNum(a.price, b.price, "asc");
      else if (sort === "price-desc") diff = cmpNum(a.price, b.price, "desc");
      else if (sort === "mileage-asc") diff = cmpNum(a.mileage, b.mileage, "asc");
      else if (sort === "mileage-desc") diff = cmpNum(a.mileage, b.mileage, "desc");
      else if (sort === "year-asc") diff = cmpNum(a.year, b.year, "asc");
      else if (sort === "year-desc") diff = cmpNum(a.year, b.year, "desc");
      if (diff) return diff;
      return a.title.localeCompare(b.title, undefined, { numeric: true });
    });
    return list;
  }

  function syncOpenCar() {
    if (state.activeId && findCar(state.activeId)) {
      var car = findCar(state.activeId);
      if (state.photoIndex >= car.photos.length) state.photoIndex = 0;
      renderDialog();
      return;
    }
    var hashId = carIdFromHash();
    if (hashId && findCar(hashId)) openCar(hashId, true);
    else if (state.activeId) closeCar(true);
  }

  function openCar(id, fromHistory) {
    var car = findCar(id);
    if (!car) return;
    if (!state.activeId) state.opener = document.activeElement;
    var same = state.activeId === id && !els.dialog.hidden;
    state.activeId = id;
    if (!same) state.photoIndex = 0;
    renderDialog();
    els.dialog.hidden = false;
    document.body.classList.add("no-scroll");
    if (!same) els.dialogClose.focus();
    document.title = car.title + " · Mark Cars";
    if (!fromHistory) {
      var next = "#" + encodeURIComponent(id);
      if (location.hash !== next) history.pushState({ markCar: id }, "", next);
    }
  }

  function closeCar(fromHistory) {
    if (state.lightOpen) closeLight();
    var wasOpen = !els.dialog.hidden;
    els.dialog.hidden = true;
    state.activeId = null;
    if (wasOpen) document.body.classList.remove("no-scroll");
    document.title = "Mark Cars — Used cars";
    if (!fromHistory && carIdFromHash()) {
      if (history.state && history.state.markCar) history.back();
      else history.replaceState(null, "", location.pathname + location.search);
    }
    if (wasOpen && state.opener && document.contains(state.opener)) state.opener.focus();
  }

  function renderDialog() {
    var car = findCar(state.activeId);
    if (!car) return;
    els.dialogKicker.textContent = car.id ? "Stock " + car.id : "Vehicle";
    els.dialogTitle.textContent = car.title;
    els.dialogPrice.textContent = money(car.price);
    clear(els.dialogStatus);
    els.dialogStatus.appendChild(badge(car.status));
    var sample = isSampleCar(car) || state.sample;
    els.dialogSample.hidden = !sample;
    els.dialogSample.textContent = sample ? "Sample listing. This is not a vehicle for sale." : "";
    els.dialogDesc.textContent = car.description || "No description yet.";
    clear(els.dialogSpecs);
    [
      ["Year", yearText(car.year)],
      ["Make", car.make || "—"],
      ["Model", car.model || "—"],
      ["Type", car.type || "—"],
      ["Color", car.color || "—"],
      ["Mileage", miles(car.mileage)],
      ["Status", car.status],
      ["Stock ID", car.id || "—"]
    ].forEach(function (pair) {
      var wrap = document.createElement("div");
      var dt = document.createElement("dt");
      dt.textContent = pair[0];
      var dd = document.createElement("dd");
      dd.textContent = pair[1];
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      els.dialogSpecs.appendChild(wrap);
    });
    clear(els.dialogCredit);
    if (sample && car.id) {
      els.dialogCredit.hidden = false;
      els.dialogCredit.appendChild(document.createTextNode("Sample photos: "));
      var credit = document.createElement("a");
      credit.href = "credits.html#" + encodeURIComponent(car.id);
      credit.textContent = "Photo credits";
      els.dialogCredit.appendChild(credit);
    } else {
      els.dialogCredit.hidden = true;
    }
    renderGallery();
  }

  function renderGallery() {
    var car = findCar(state.activeId);
    if (!car) return;
    var photos = car.photos;
    var index = state.photoIndex;
    if (index >= photos.length) index = 0;
    state.photoIndex = index;
    var photo = photos[index] || null;
    var alt = photoAlt(car, index, photos.length);
    attachFallback(els.galleryImg, photo, alt);
    els.galleryOpen.setAttribute("aria-label", photos.length ? "Enlarge photo " + (index + 1) + " of " + photos.length : "Enlarge photo");
    var focusInside = els.thumbs.contains(document.activeElement);
    clear(els.thumbs);
    photos.forEach(function (item, itemIndex) {
      var button = document.createElement("button");
      button.type = "button";
      button.setAttribute("data-index", String(itemIndex));
      button.setAttribute("aria-label", "Show photo " + (itemIndex + 1) + " of " + photos.length);
      if (itemIndex === index) button.setAttribute("aria-current", "true");
      var img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      attachFallback(img, item, "");
      button.appendChild(img);
      els.thumbs.appendChild(button);
    });
    if (focusInside) {
      var active = els.thumbs.querySelector('[data-index="' + index + '"]');
      if (active) active.focus();
    }
    if (state.lightOpen) renderLightbox();
  }

  function openLight() {
    var car = findCar(state.activeId);
    if (!car) return;
    state.lightOpen = true;
    els.lightbox.hidden = false;
    renderLightbox();
    els.lightClose.focus();
  }

  function closeLight() {
    if (!state.lightOpen && els.lightbox.hidden) return;
    state.lightOpen = false;
    els.lightbox.hidden = true;
    if (!els.dialog.hidden) els.galleryOpen.focus();
  }

  function renderLightbox() {
    var car = findCar(state.activeId);
    if (!car) return;
    var photos = car.photos;
    var index = state.photoIndex;
    var photo = photos[index] || null;
    var alt = photoAlt(car, index, photos.length);
    attachFallback(els.lightImg, photo, alt);
    var multi = photos.length > 1;
    els.lightPrev.hidden = !multi;
    els.lightNext.hidden = !multi;
    els.lightHint.hidden = !multi;
    els.lightCaption.textContent = photos.length
      ? "Photo " + (index + 1) + " of " + photos.length + ". " + car.title
      : car.title;
  }

  function stepPhoto(delta) {
    var car = findCar(state.activeId);
    if (!car || car.photos.length < 2) return;
    var count = car.photos.length;
    state.photoIndex = (state.photoIndex + delta + count) % count;
    renderGallery();
  }

  function syncFromLocation() {
    var id = carIdFromHash();
    if (id && findCar(id)) {
      if (state.activeId !== id || els.dialog.hidden) openCar(id, true);
      return;
    }
    if (state.activeId || !els.dialog.hidden) closeCar(true);
  }

  function onKeydown(event) {
    var lightOpen = state.lightOpen && !els.lightbox.hidden;
    var dialogOpen = !!state.activeId && !els.dialog.hidden;
    if (event.key === "Escape") {
      if (lightOpen) {
        event.preventDefault();
        closeLight();
      } else if (dialogOpen) {
        event.preventDefault();
        closeCar(false);
      }
      return;
    }
    if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && (lightOpen || dialogOpen)) {
      var tag = event.target && event.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      event.preventDefault();
      stepPhoto(event.key === "ArrowRight" ? 1 : -1);
      return;
    }
    if (event.key !== "Tab") return;
    var container = lightOpen
      ? els.lightbox.querySelector(".lightbox-stage")
      : dialogOpen
        ? els.dialog.querySelector(".dialog-panel")
        : null;
    if (!container) return;
    var items = focusable(container);
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function focusable(container) {
    var selector = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
    return Array.prototype.filter.call(container.querySelectorAll(selector), function (node) {
      return !node.closest("[hidden]");
    });
  }

  function attachFallback(img, photo, alt) {
    img.alt = alt || "";
    if (img._onerr) img.removeEventListener("error", img._onerr);
    var sources = [];
    if (photo) {
      [photo.url, photo.thumb, photo.fallback].forEach(function (src) {
        if (src && sources.indexOf(src) === -1) sources.push(src);
      });
    }
    var index = 0;
    function fail() {
      index += 1;
      if (index < sources.length) {
        img.classList.remove("is-placeholder");
        img.src = sources[index];
        return;
      }
      img.removeEventListener("error", fail);
      img._onerr = null;
      img.classList.add("is-placeholder");
      if (img.src !== PLACEHOLDER) img.src = PLACEHOLDER;
    }
    img._onerr = fail;
    img.addEventListener("error", fail);
    img.classList.remove("is-placeholder");
    if (!sources.length) {
      fail();
      return;
    }
    img.src = sources[0];
  }

  function setBusy(busy) {
    els.refresh.classList.toggle("is-busy", busy);
    els.refresh.setAttribute("aria-busy", busy ? "true" : "false");
    els.refreshLabel.textContent = busy ? "Refreshing…" : "Refresh inventory";
  }

  function setNotice(text, kind) {
    if (!text) {
      els.notice.hidden = true;
      els.noticeText.textContent = "";
      els.notice.classList.remove("is-error");
      return;
    }
    els.notice.hidden = false;
    els.notice.classList.toggle("is-error", kind === "error");
    els.noticeText.textContent = text;
  }

  function announce(text) {
    els.status.textContent = "";
    window.setTimeout(function () { els.status.textContent = text; }, 30);
  }

  function findCar(id) {
    for (var i = 0; i < state.cars.length; i++) {
      if (state.cars[i].id === id) return state.cars[i];
    }
    return null;
  }

  function carIdFromHash() {
    var raw = (location.hash || "").replace(/^#/, "");
    if (!raw) return "";
    try { raw = decodeURIComponent(raw); } catch (error) { return ""; }
    if (raw === "inventory" || raw === "contact") return "";
    return raw;
  }

  function resetFilters() {
    HTMLFormElement.prototype.reset.call(els.form);
    renderGrid();
  }

  function filtersActive() {
    return !!(els.q.value.trim() || els.make.value || els.type.value || els.minPrice.value.trim() || els.maxPrice.value.trim() || els.maxMiles.value.trim());
  }

  function fillSelect(select, values, allLabel) {
    var current = select.value;
    clear(select);
    var all = document.createElement("option");
    all.value = "";
    all.textContent = allLabel;
    select.appendChild(all);
    values.forEach(function (value) {
      var option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
    select.value = values.indexOf(current) === -1 ? "" : current;
  }

  function uniques(cars, key) {
    var seen = {};
    cars.forEach(function (car) {
      if (car[key]) seen[car[key]] = true;
    });
    return Object.keys(seen).sort(function (a, b) {
      return a.localeCompare(b);
    });
  }

  function typeSummary(cars) {
    var types = uniques(cars, "type");
    if (!types.length) return "—";
    if (types.length > 3) return types.length + " styles";
    return types.join(" · ");
  }

  function badge(status) {
    var kind = status === "Sold" ? "sold" : status === "Pending" ? "pending" : status === "Available" ? "available" : "other";
    return chip(status || "Available", "badge badge-" + kind);
  }

  function chip(text, className) {
    var span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    return span;
  }

  function isSampleCar(car) {
    return (car.title + " " + car.description).toLowerCase().indexOf("sample") !== -1;
  }

  function photoAlt(car, index, total) {
    if (!total) return car.title;
    return car.title + ", photo " + (index + 1) + " of " + total;
  }

  function countLabel(shown, total) {
    if (shown === total) return shown + (shown === 1 ? " car" : " cars");
    return "Showing " + shown + " of " + total + (total === 1 ? " car" : " cars");
  }

  function normalizeStatus(value) {
    var text = String(value || "").trim();
    var lower = text.toLowerCase();
    if (!lower || lower === "available") return "Available";
    if (lower === "pending") return "Pending";
    if (lower === "sold") return "Sold";
    return text;
  }

  function num(value) {
    if (value == null || value === "") return NaN;
    var parsed = Number(String(value).replace(/[$,\s]/g, ""));
    return isNaN(parsed) ? NaN : parsed;
  }

  function numOrNull(value) {
    var text = String(value || "").trim();
    if (!text) return null;
    var parsed = Number(text.replace(/[$,\s]/g, ""));
    return isNaN(parsed) ? null : parsed;
  }

  function cmpNum(a, b, dir) {
    var aBad = a == null || isNaN(a);
    var bBad = b == null || isNaN(b);
    if (aBad && bBad) return 0;
    if (aBad) return 1;
    if (bBad) return -1;
    return dir === "desc" ? b - a : a - b;
  }

  function money(value) {
    if (value == null || isNaN(value)) return "—";
    var cents = Math.round(value * 100) % 100 !== 0;
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: cents ? 2 : 0
    });
  }

  function miles(value) {
    if (value == null || isNaN(value)) return "—";
    return Math.round(value).toLocaleString("en-US") + " mi";
  }

  function yearText(value) {
    if (value == null || isNaN(value)) return "—";
    return String(Math.round(value));
  }

  function formatWhen(value) {
    if (!value) return "—";
    var date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function debounce(fn, wait) {
    var timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, wait);
    };
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
})();
