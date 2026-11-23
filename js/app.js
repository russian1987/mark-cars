(function () {
  "use strict";

  var SHEET_URL = "https://docs.google.com/spreadsheets/d/152Dyx-0wre38mwpjj9qsAfZyg0vrkrEunY57e5Zw6cY/edit";
  var SAMPLE_URL = "sample-feed.json";
  var FEED_TIMEOUT_MS = 45000;
  var CDN = "https://cdn.jsdelivr.net/npm/";
  var contact = (typeof CONTACT === "object" && CONTACT) || {};
  var finance = (typeof FINANCE === "object" && FINANCE) || {};
  var PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#1b1916"/><text x="400" y="260" text-anchor="middle" fill="#e7e0d4" font-family="Georgia,serif" font-size="32">Photo unavailable</text></svg>'
  );

  var grid = document.getElementById("grid");
  if (!grid) return;

  var els = {
    grid: grid,
    skeletons: document.getElementById("skeletons"),
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
    sort: document.getElementById("sort"),
    priceMin: document.getElementById("price-min"),
    priceMax: document.getElementById("price-max"),
    maxMiles: document.getElementById("max-miles"),
    priceReadout: document.getElementById("price-readout"),
    milesReadout: document.getElementById("miles-readout"),
    showSold: document.getElementById("show-sold"),
    reset: document.getElementById("reset-filters"),
    makeChips: document.getElementById("make-chips"),
    typeChips: document.getElementById("type-chips"),
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
    dialogActions: document.getElementById("dialog-actions"),
    detailSwiper: document.getElementById("detail-swiper"),
    detailSlides: document.getElementById("detail-slides"),
    detailPrev: document.getElementById("detail-prev"),
    detailNext: document.getElementById("detail-next"),
    enlarge: document.getElementById("enlarge"),
    estDown: document.getElementById("est-down"),
    estTerm: document.getElementById("est-term"),
    estApr: document.getElementById("est-apr"),
    estimateOut: document.getElementById("estimate-out"),
    estimator: document.getElementById("estimator"),
    theme: document.getElementById("theme-toggle"),
    header: document.getElementById("header")
  };

  var state = {
    cars: [],
    updated: "",
    sample: true,
    activeId: null,
    opener: null,
    loading: false,
    make: "",
    type: "",
    priceTouched: false,
    milesTouched: false,
    detailSwiper: null,
    motionReady: false,
    bounds: { priceMin: 0, priceMax: 100000, milesMax: 150000 }
  };

  var lenis = null;
  var cardsAnimated = false;

  els.addCar.href = SHEET_URL;
  applyOwnerControls();
  applyTheme(document.documentElement.getAttribute("data-theme") || "dark");
  fillContact(document.getElementById("contact-actions"), null);
  var address = document.getElementById("contact-address");
  var phoneLine = document.getElementById("contact-phone");
  if (address) address.textContent = contact.address || "123 Example Street, Your City";
  if (phoneLine) phoneLine.textContent = contact.phoneDisplay || "(000) 000-0000";

  els.refresh.addEventListener("click", function () { loadInventory(true); });
  els.form.addEventListener("submit", function (event) {
    event.preventDefault();
    document.getElementById("inventory").scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
  });
  els.q.addEventListener("input", debounce(renderGrid, 120));
  els.sort.addEventListener("change", renderGrid);
  els.showSold.addEventListener("change", renderGrid);
  els.priceMin.addEventListener("input", function () {
    state.priceTouched = true;
    if (Number(els.priceMin.value) > Number(els.priceMax.value)) els.priceMax.value = els.priceMin.value;
    updateReadouts();
    renderGrid();
  });
  els.priceMax.addEventListener("input", function () {
    state.priceTouched = true;
    if (Number(els.priceMax.value) < Number(els.priceMin.value)) els.priceMin.value = els.priceMax.value;
    updateReadouts();
    renderGrid();
  });
  els.maxMiles.addEventListener("input", function () {
    state.milesTouched = true;
    updateReadouts();
    renderGrid();
  });
  els.reset.addEventListener("click", resetFilters);
  els.theme.addEventListener("click", function () {
    applyTheme(document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light");
  });
  els.dialogClose.addEventListener("click", function () { closeCar(false); });
  els.enlarge.addEventListener("click", function () { openPhotoSwipe(currentSlide()); });
  els.estimator.addEventListener("input", renderEstimate);
  els.estimator.addEventListener("submit", function (event) { event.preventDefault(); });

  document.addEventListener("click", function (event) {
    var closer = event.target.closest("[data-close]");
    if (!closer) return;
    if (closer.getAttribute("data-close") === "dialog") closeCar(false);
  });
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("hashchange", syncFromLocation);
  window.addEventListener("popstate", syncFromLocation);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  loadInventory(false);
  loadEnhancements();

  function contactPhone() { return contact.phoneTel || "+10000000000"; }
  function contactDisplay() { return contact.phoneDisplay || "(000) 000-0000"; }
  function mapsHref() {
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(contact.mapsQuery || contact.address || "123 Example Street, Your City");
  }
  function smsHref(extra) {
    var body = contact.smsBody || "Hello Mark Cars, I'm asking about a car on your site.";
    if (extra) body += " " + extra;
    return "sms:" + contactPhone() + "?&body=" + encodeURIComponent(body);
  }

  function fillContact(container, car) {
    if (!container) return;
    clear(container);
    var shareUrl = location.href.split("#")[0] + (car ? "#" + encodeURIComponent(car.id) : "");
    addAction(container, "Call", "tel:" + contactPhone());
    addAction(container, "Text", smsHref(car ? car.id : ""));
    addAction(container, "Get directions", mapsHref(), true);
    var share = document.createElement("button");
    share.type = "button";
    share.className = "btn btn-line";
    share.textContent = "Share";
    share.addEventListener("click", function () { shareLink(shareUrl, car ? car.title : "Mark Cars"); });
    container.appendChild(share);
  }

  function addAction(container, label, href, external) {
    var link = document.createElement("a");
    link.className = "btn btn-line";
    link.href = href;
    link.textContent = label;
    if (external) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    container.appendChild(link);
  }

  function shareLink(url, title) {
    var data = { title: title, text: title + " — Mark Cars", url: url };
    if (navigator.share) {
      navigator.share(data).catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { announce("Link copied."); });
    }
  }

  function applyTheme(theme) {
    var next = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("markcars-theme", next); } catch (error) {}
    if (els.theme) {
      var light = next === "light";
      els.theme.textContent = light ? "Dark" : "Light";
      els.theme.setAttribute("aria-pressed", light ? "true" : "false");
      els.theme.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
    }
    var color = document.querySelector('meta[name="theme-color"]');
    if (color) color.setAttribute("content", next === "light" ? "#f4efe6" : "#090a0c");
  }

  function onScroll() {
    if (!els.header) return;
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    els.header.classList.toggle("is-stuck", y > 12);
  }

  function feedUrl() {
    return (typeof FEED_URL === "string" ? FEED_URL : "").trim();
  }

  function applyOwnerControls() {
    var enabled = ownerControlsEnabled();
    els.refresh.hidden = !enabled;
    els.addCar.hidden = !enabled;
  }

  function ownerControlsEnabled() {
    var params = new URLSearchParams(window.location.search);
    var flag = params.get("owner");
    if (flag === "off") {
      try { localStorage.removeItem("markcars-owner"); } catch (error) {}
      return false;
    }
    if (flag === "markcars") {
      try { localStorage.setItem("markcars-owner", "1"); } catch (error) {}
      return true;
    }
    try { return localStorage.getItem("markcars-owner") === "1"; }
    catch (error) { return false; }
  }

  function loadInventory(refresh) {
    if (state.loading) return;
    state.loading = true;
    setBusy(true, refresh);
    showSkeletons(true);
    var started = Date.now();
    announce(refresh ? "Refreshing inventory." : "Loading inventory.");
    els.inventory.setAttribute("aria-busy", "true");
    var url = feedUrl();
    var task = !url
      ? loadSample(refresh).then(function (data) { return { data: data, sample: true, kind: "sample" }; })
      : loadLive(url, refresh).then(function (data) { return { data: data, sample: false, kind: "" }; }).catch(function () {
          return loadSample(true).then(function (data) { return { data: data, sample: true, kind: "error" }; });
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
        setNotice("Sample listings. These cars are examples, not vehicles for sale.", "sample");
      } else {
        setNotice("", "");
      }
      announce((refresh ? "Inventory refreshed. " : "Inventory loaded. ") + countLabel(visibleCars().length, poolCount()) + ". Last updated " + formatWhen(state.updated) + ".");
      syncOpenCar();
    }).catch(function () {
      state.cars = [];
      state.sample = true;
      renderAll();
      setNotice("Inventory could not be loaded. Check the connection and try again in a moment.", "error");
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
    return fetchJson(url).then(assertFeed);
  }

  function loadLive(base, refresh) {
    var url = new URL(base, window.location.href);
    if (refresh) url.searchParams.set("refresh", "1");
    return fetchJson(url.toString()).then(assertFeed).catch(function () {
      return fetchJsonp(base, !!refresh).then(assertFeed);
    });
  }

  function fetchJson(url) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, FEED_TIMEOUT_MS);
    return fetch(url, {
      cache: "no-store",
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
      try { url = new URL(base, window.location.href); }
      catch (error) { reject(error); return; }
      if (refresh) url.searchParams.set("refresh", "1");
      url.searchParams.set("callback", cb);
      var timer = setTimeout(function () { cleanup(); reject(new Error("timeout")); }, FEED_TIMEOUT_MS);
      function cleanup() {
        clearTimeout(timer);
        try { delete window[cb]; } catch (error) { window[cb] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }
      window[cb] = function (data) { cleanup(); resolve(data); };
      script.onerror = function () { cleanup(); reject(new Error("jsonp")); };
      script.src = url.toString();
      document.head.appendChild(script);
    });
  }

  function assertFeed(data) {
    if (!data || data.ok !== true || !Array.isArray(data.cars)) throw new Error((data && data.error) || "bad feed");
    return data;
  }

  function ingest(data, useLocal) {
    var cars = data.cars.map(normalize).filter(function (car) { return car.id || car.title; });
    if (useLocal) cars = cars.map(withLocalPhotos);
    return { cars: cars, updated: data.updated || new Date().toISOString() };
  }

  function normalize(car) {
    var photos = Array.isArray(car.photos) ? car.photos.map(function (photo) {
      photo = photo || {};
      return { id: String(photo.id || ""), name: String(photo.name || ""), url: String(photo.url || ""), thumb: String(photo.thumb || ""), fallback: String(photo.fallback || "") };
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
      return { id: photo.id, name: photo.name, url: local, thumb: local, fallback: photo.fallback || photo.url || "" };
    });
    if (!photos.length && slug) {
      var only = "sample-photos/" + slug + "-01.jpg";
      photos.push({ id: "", name: slug + "-01.jpg", url: only, thumb: only, fallback: "" });
    }
    return Object.assign({}, car, { photos: photos });
  }

  function renderAll() {
    tuneSliders();
    renderChips();
    renderUpdated();
    renderStats();
    renderHero();
    renderGrid();
    writeSchema();
    if (window.Swiper) initCardSwipers();
  }

  function tuneSliders() {
    var prices = state.cars.map(function (car) { return car.price; }).filter(function (price) { return !isNaN(price); });
    var miles = state.cars.map(function (car) { return car.mileage; }).filter(function (mile) { return !isNaN(mile); });
    var priceMin = prices.length ? Math.floor(Math.min.apply(null, prices) / 500) * 500 : 0;
    var priceMax = prices.length ? Math.ceil(Math.max.apply(null, prices) / 500) * 500 : 100000;
    var milesMax = miles.length ? Math.ceil(Math.max.apply(null, miles) / 1000) * 1000 : 150000;
    if (priceMax <= priceMin) priceMax = priceMin + 500;
    state.bounds = { priceMin: priceMin, priceMax: priceMax, milesMax: milesMax };
    els.priceMin.min = String(priceMin);
    els.priceMin.max = String(priceMax);
    els.priceMax.min = String(priceMin);
    els.priceMax.max = String(priceMax);
    els.maxMiles.min = "0";
    els.maxMiles.max = String(milesMax);
    if (!state.priceTouched) {
      els.priceMin.value = String(priceMin);
      els.priceMax.value = String(priceMax);
    }
    if (!state.milesTouched) els.maxMiles.value = String(milesMax);
    updateReadouts();
  }

  function updateReadouts() {
    var min = Number(els.priceMin.value);
    var max = Number(els.priceMax.value);
    var atEnds = min <= state.bounds.priceMin && max >= state.bounds.priceMax;
    els.priceReadout.textContent = !state.priceTouched || atEnds ? "Any" : money(min) + " – " + money(max);
    var mile = Number(els.maxMiles.value);
    els.milesReadout.textContent = !state.milesTouched || mile >= state.bounds.milesMax ? "Any" : miles(mile);
  }

  function renderChips() {
    renderChipGroup(els.makeChips, uniques(state.cars, "make"), state.make, function (value) {
      state.make = value;
      renderChips();
      renderGrid();
    });
    renderChipGroup(els.typeChips, uniques(state.cars, "type"), state.type, function (value) {
      state.type = value;
      renderChips();
      renderGrid();
    });
  }

  function renderChipGroup(container, values, current, onPick) {
    clear(container);
    var all = chipButton("All", current === "", function () { onPick(""); });
    container.appendChild(all);
    values.forEach(function (value) {
      container.appendChild(chipButton(value, current === value, function () { onPick(value); }));
    });
  }

  function chipButton(label, pressed, onClick) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = label;
    button.setAttribute("aria-pressed", pressed ? "true" : "false");
    button.addEventListener("click", onClick);
    return button;
  }

  function renderUpdated() {
    els.updated.textContent = formatWhen(state.updated);
    els.updated.setAttribute("datetime", state.updated || "");
  }

  function renderStats() {
    var available = state.cars.filter(function (car) { return car.status !== "Sold"; });
    var prices = available.map(function (car) { return car.price; }).filter(function (price) { return !isNaN(price); });
    countUp(els.statCount, available.length, function (value) { return String(Math.round(value)); });
    if (prices.length) countUp(els.statPrice, Math.min.apply(null, prices), function (value) { return money(Math.round(value)); });
    else els.statPrice.textContent = "—";
    els.statTypes.textContent = typeSummary(available);
  }

  function renderHero() {
    var car = state.cars.filter(function (item) { return item.status !== "Sold" && item.photos.length; })[0] || state.cars[0];
    if (!car) return;
    attachFallback(els.heroImg, heroPhoto(car), "");
    var name = [yearText(car.year), car.make, car.model].filter(function (part) { return part && part !== "—"; }).join(" ");
    els.heroCaption.textContent = (state.sample || isSampleCar(car) ? "Sample photo · " : "Featured · ") + name;
  }

  function heroPhoto(car) {
    var photo = (car.photos && car.photos[0]) || {};
    if (/^MC-00[123]$/.test(car.id)) {
      var local = "sample-photos/" + car.id + "-01.jpg";
      return { url: local, thumb: local, fallback: photo.url || photo.fallback || "" };
    }
    return photo;
  }

  function renderGrid() {
    destroyCardSwipers();
    var list = visibleCars();
    clear(els.grid);
    list.forEach(function (car) { els.grid.appendChild(renderCard(car)); });
    els.grid.hidden = false;
    showSkeletons(false);
    els.count.textContent = state.cars.length ? countLabel(list.length, poolCount()) : "No cars yet";
    renderEmpty(list);
    if (window.Swiper) initCardSwipers();
    animateCards();
  }

  function renderEmpty(list) {
    clear(els.empty);
    if (list.length) { els.empty.hidden = true; return; }
    els.empty.hidden = false;
    var message = document.createElement("p");
    message.textContent = state.cars.length ? "No cars match those filters." : "No cars in the inventory yet.";
    els.empty.appendChild(message);
    if (state.cars.some(function (car) { return car.status === "Sold"; }) && !els.showSold.checked) {
      var soldNote = document.createElement("p");
      soldNote.textContent = "Sold cars are hidden. Turn on Show sold cars to see them.";
      els.empty.appendChild(soldNote);
    }
  }

  function renderCard(car) {
    var article = document.createElement("article");
    article.className = "card" + (car.status === "Sold" ? " is-sold" : "");
    var swiper = document.createElement("div");
    swiper.className = "swiper card-swiper" + (car.photos.length < 2 ? " is-single" : "");
    var wrapper = document.createElement("div");
    wrapper.className = "swiper-wrapper";
    var photos = car.photos.length ? car.photos : [null];
    photos.forEach(function (photo, index) {
      var slide = document.createElement("div");
      slide.className = "swiper-slide";
      var button = document.createElement("button");
      button.type = "button";
      button.className = "card-hit";
      button.setAttribute("aria-label", "View details for " + car.title);
      var img = document.createElement("img");
      img.alt = car.title + ", photo " + (index + 1);
      img.decoding = "async";
      if (index === 0) img.loading = "lazy";
      attachFallback(img, photo, img.alt);
      button.appendChild(img);
      button.addEventListener("click", function () { openCar(car.id, false); });
      slide.appendChild(button);
      wrapper.appendChild(slide);
    });
    swiper.appendChild(wrapper);
    if (car.photos.length > 1) {
      ["prev", "next"].forEach(function (dir) {
        var nav = document.createElement("button");
        nav.type = "button";
        nav.className = "swiper-nav " + dir;
        nav.setAttribute("aria-label", dir === "prev" ? "Previous photo" : "Next photo");
        nav.textContent = dir === "prev" ? "‹" : "›";
        swiper.appendChild(nav);
      });
      var dots = document.createElement("div");
      dots.className = "swiper-pagination";
      swiper.appendChild(dots);
    }
    var badges = document.createElement("div");
    badges.className = "card-badges";
    var left = document.createElement("div");
    left.className = "badge-row";
    left.appendChild(badge(car.status));
    if (car.id && car.id === justAddedId()) left.appendChild(chip("Just added", "badge badge-new"));
    badges.appendChild(left);
    if (isSampleCar(car) || state.sample) badges.appendChild(chip("Sample", "badge badge-sample"));
    swiper.appendChild(badges);

    var body = document.createElement("a");
    body.className = "card-body";
    body.href = "#" + encodeURIComponent(car.id);
    body.addEventListener("click", function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openCar(car.id, false);
    });
    var title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = car.title;
    var meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = [car.type, car.color, miles(car.mileage)].filter(function (part) { return part && part !== "—"; }).join(" · ");
    var price = document.createElement("p");
    price.className = "price";
    price.textContent = money(car.price);
    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(price);
    var monthly = monthlyFor(car.price, defaultDown(car.price), financeApr(), financeTerm());
    if (monthly != null) {
      var pay = document.createElement("p");
      pay.className = "payment";
      pay.textContent = "Est. " + money(monthly) + "/mo";
      body.appendChild(pay);
    }
    article.appendChild(swiper);
    article.appendChild(body);
    return article;
  }

  function visibleCars() {
    var query = els.q.value.trim().toLowerCase();
    var minPrice = state.priceTouched ? Number(els.priceMin.value) : null;
    var maxPrice = state.priceTouched ? Number(els.priceMax.value) : null;
    var maxMiles = state.milesTouched ? Number(els.maxMiles.value) : null;
    if (maxMiles != null && maxMiles >= state.bounds.milesMax) maxMiles = null;
    var list = state.cars.filter(function (car) {
      if (!els.showSold.checked && car.status === "Sold") return false;
      if (state.make && car.make !== state.make) return false;
      if (state.type && car.type !== state.type) return false;
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
    if (state.activeId && findCar(state.activeId)) { renderDialog(); return; }
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
    renderDialog();
    els.dialog.hidden = false;
    lockScroll(true);
    if (!same) els.dialogClose.focus();
    document.title = car.title + " · Mark Cars";
    if (!fromHistory) {
      var next = "#" + encodeURIComponent(id);
      if (location.hash !== next) history.pushState({ markCar: id }, "", next);
    }
  }

  function closeCar(fromHistory) {
    var wasOpen = !els.dialog.hidden;
    els.dialog.hidden = true;
    state.activeId = null;
    if (state.detailSwiper) { state.detailSwiper.destroy(true, true); state.detailSwiper = null; }
    if (wasOpen) lockScroll(false);
    document.title = "Mark Cars — Used cars, carefully chosen";
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
    var row = document.createElement("span");
    row.className = "badge-row";
    row.appendChild(badge(car.status));
    if (car.id === justAddedId()) row.appendChild(chip("Just added", "badge badge-new"));
    if (isSampleCar(car) || state.sample) row.appendChild(chip("Sample", "badge badge-sample"));
    els.dialogStatus.appendChild(row);
    var sample = isSampleCar(car) || state.sample;
    els.dialogSample.hidden = !sample;
    els.dialogSample.textContent = sample ? "Sample listing. This is not a vehicle for sale." : "";
    els.dialogDesc.textContent = car.description || "No description yet.";
    clear(els.dialogSpecs);
    [
      ["calendar", "Year", yearText(car.year)],
      ["factory", "Make", car.make || "—"],
      ["car", "Model", car.model || "—"],
      ["shapes", "Type", car.type || "—"],
      ["palette", "Color", car.color || "—"],
      ["gauge", "Mileage", miles(car.mileage)],
      ["badge-check", "Status", car.status],
      ["hash", "Stock ID", car.id || "—"]
    ].forEach(function (spec) {
      var wrap = document.createElement("div");
      var dt = document.createElement("dt");
      var icon = document.createElement("i");
      icon.setAttribute("data-lucide", spec[0]);
      icon.setAttribute("aria-hidden", "true");
      dt.appendChild(icon);
      dt.appendChild(document.createTextNode(spec[1]));
      var dd = document.createElement("dd");
      dd.textContent = spec[2];
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      els.dialogSpecs.appendChild(wrap);
    });
    if (window.lucide && lucide.createIcons) lucide.createIcons({ attrs: { "aria-hidden": "true" } });
    clear(els.dialogCredit);
    if (sample && car.id) {
      els.dialogCredit.hidden = false;
      els.dialogCredit.appendChild(document.createTextNode("Sample photos: "));
      var credit = document.createElement("a");
      credit.href = "credits.html#" + encodeURIComponent(car.id);
      credit.textContent = "Photo credits";
      els.dialogCredit.appendChild(credit);
    } else els.dialogCredit.hidden = true;
    els.estApr.value = String(financeApr());
    els.estTerm.value = String(financeTerm());
    els.estDown.value = String(Math.round(defaultDown(car.price)));
    renderEstimate();
    fillContact(els.dialogActions, car);
    renderDetailSlides(car);
  }

  function renderDetailSlides(car) {
    if (state.detailSwiper) { state.detailSwiper.destroy(true, true); state.detailSwiper = null; }
    clear(els.detailSlides);
    var photos = car.photos.length ? car.photos : [null];
    photos.forEach(function (photo, index) {
      var slide = document.createElement("div");
      slide.className = "swiper-slide";
      var img = document.createElement("img");
      var alt = photoAlt(car, index, photos.length);
      slide.appendChild(img);
      els.detailSlides.appendChild(slide);
      attachFallback(img, photo, alt);
    });
    var multi = photos.length > 1;
    els.detailPrev.hidden = !multi;
    els.detailNext.hidden = !multi;
    if (window.Swiper) {
      state.detailSwiper = new Swiper(els.detailSwiper, {
        speed: reducedMotion() ? 0 : 450,
        navigation: { prevEl: els.detailPrev, nextEl: els.detailNext }
      });
    }
  }

  function currentSlide() {
    return state.detailSwiper ? state.detailSwiper.activeIndex : 0;
  }

  function renderEstimate() {
    var car = findCar(state.activeId);
    if (!car) return;
    var down = num(els.estDown.value);
    var apr = num(els.estApr.value);
    var term = Number(els.estTerm.value) || financeTerm();
    var monthly = monthlyFor(car.price, isNaN(down) ? 0 : down, isNaN(apr) ? 0 : apr, term);
    els.estimateOut.textContent = monthly == null ? "—" : money(monthly) + " / month";
  }

  function openPhotoSwipe(index) {
    var car = findCar(state.activeId);
    if (!car || !window.PhotoSwipe) return;
    var items = (car.photos.length ? car.photos : [{ url: PLACEHOLDER }]).map(function (photo, i) {
      return { src: (photo && (photo.url || photo.thumb || photo.fallback)) || PLACEHOLDER, width: 1600, height: 1066, alt: photoAlt(car, i, car.photos.length || 1) };
    });
    var pswp = new PhotoSwipe({ dataSource: items, index: index || 0, bgOpacity: 0.94 });
    pswp.init();
  }

  function showSkeletons(show) {
    if (els.skeletons) els.skeletons.hidden = !show;
    if (show) els.grid.hidden = true;
  }

  function setBusy(busy, refresh) {
    els.refresh.classList.toggle("is-busy", busy);
    els.refresh.setAttribute("aria-busy", busy ? "true" : "false");
    els.refreshLabel.textContent = busy ? (refresh ? "Refreshing…" : "Loading…") : "Refresh inventory";
  }

  function setNotice(text, kind) {
    if (!text) { els.notice.hidden = true; els.noticeText.textContent = ""; els.notice.classList.remove("is-error"); return; }
    els.notice.hidden = false;
    els.notice.classList.toggle("is-error", kind === "error");
    els.noticeText.textContent = text;
  }

  function announce(text) {
    els.status.textContent = "";
    window.setTimeout(function () { els.status.textContent = text; }, 30);
  }

  function resetFilters() {
    els.q.value = "";
    els.sort.value = "price-asc";
    els.showSold.checked = false;
    state.make = "";
    state.type = "";
    state.priceTouched = false;
    state.milesTouched = false;
    tuneSliders();
    renderChips();
    renderGrid();
  }

  function writeSchema() {
    var node = document.getElementById("jsonld");
    if (!node) return;
    var origin = location.origin + location.pathname.replace(/[^/]*$/, "");
    var list = state.cars.filter(function (car) { return car.status !== "Sold"; }).map(function (car, index) {
      var image = car.photos[0] && (car.photos[0].url || car.photos[0].thumb);
      if (image && image.indexOf("http") !== 0) image = new URL(image, location.href).href;
      return {
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Vehicle",
          name: car.title,
          brand: car.make,
          model: car.model,
          vehicleModelDate: yearText(car.year),
          color: car.color,
          sku: car.id,
          image: image,
          mileageFromOdometer: isNaN(car.mileage) ? undefined : { "@type": "QuantitativeValue", value: car.mileage, unitCode: "SMI" },
          offers: isNaN(car.price) ? undefined : { "@type": "Offer", price: car.price, priceCurrency: "USD", availability: "https://schema.org/InStock" }
        }
      };
    });
    var address = String(contact.address || "123 Example Street, Your City");
    node.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "AutoDealer",
          name: "Mark Cars",
          url: "https://russian1987.github.io/mark-cars/",
          image: origin + "sample-photos/MC-001-01.jpg",
          telephone: contactPhone(),
          address: { "@type": "PostalAddress", streetAddress: address }
        },
        { "@type": "ItemList", name: "Mark Cars inventory", itemListElement: list }
      ]
    });
  }

  function loadEnhancements() {
    var jobs = [
      loadCss(CDN + "photoswipe@5.4.4/dist/photoswipe.css"),
      loadScript(CDN + "swiper@11/swiper-bundle.min.js"),
      loadScript(CDN + "photoswipe@5.4.4/dist/umd/photoswipe.umd.min.js"),
      loadScript(CDN + "photoswipe@5.4.4/dist/umd/photoswipe-lightbox.umd.min.js"),
      loadScript(CDN + "lucide@0.468.0/dist/umd/lucide.min.js")
    ];
    if (!reducedMotion()) {
      jobs.push(loadCss(CDN + "lenis@1.1.18/dist/lenis.css"));
      jobs.push(loadScript(CDN + "gsap@3.12.5/dist/gsap.min.js"));
      jobs.push(loadScript(CDN + "gsap@3.12.5/dist/ScrollTrigger.min.js"));
      jobs.push(loadScript(CDN + "lenis@1.1.18/dist/lenis.min.js"));
    }
    Promise.all(jobs).then(function () {
      if (window.lucide && lucide.createIcons) lucide.createIcons({ attrs: { "aria-hidden": "true" } });
      initCardSwipers();
      if (state.activeId) renderDetailSlides(findCar(state.activeId));
      setupMotion();
    }).catch(function () {});
  }

  function setupMotion() {
    if (reducedMotion() || !window.gsap) return;
    if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    if (window.Lenis && !window.matchMedia("(pointer: coarse)").matches) {
      lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
      lenis.on("scroll", function () {
        onScroll();
        if (window.ScrollTrigger) ScrollTrigger.update();
      });
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    }
    gsap.from(".why-card, .quote", {
      y: 16,
      duration: 0.7,
      stagger: 0.08,
      ease: "power2.out",
      immediateRender: false,
      scrollTrigger: window.ScrollTrigger ? { trigger: "#why", start: "top 82%" } : undefined
    });
    gsap.to(".hero-ken", {
      yPercent: 8,
      ease: "none",
      scrollTrigger: window.ScrollTrigger ? { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } : undefined
    });
    state.motionReady = true;
    animateCards();
  }

  function animateCards() {
    if (cardsAnimated || !state.motionReady || reducedMotion() || !window.gsap) return;
    if (!document.querySelector(".card")) return;
    cardsAnimated = true;
    gsap.from(".card", {
      y: 20,
      duration: 0.55,
      stagger: 0.07,
      ease: "power2.out",
      immediateRender: false,
      clearProps: "transform"
    });
  }

  function initCardSwipers() {
    if (!window.Swiper) return;
    document.querySelectorAll(".card-swiper").forEach(function (el) {
      if (el.swiper || el.classList.contains("is-single")) return;
      new Swiper(el, {
        speed: reducedMotion() ? 0 : 420,
        pagination: { el: el.querySelector(".swiper-pagination"), clickable: true },
        navigation: { nextEl: el.querySelector(".next"), prevEl: el.querySelector(".prev") }
      });
    });
  }

  function destroyCardSwipers() {
    document.querySelectorAll(".card-swiper").forEach(function (el) {
      if (el.swiper) el.swiper.destroy(true, true);
    });
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  function loadCss(href) {
    return new Promise(function (resolve) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = resolve;
      link.onerror = resolve;
      document.head.appendChild(link);
    });
  }

  function lockScroll(lock) {
    document.body.classList.toggle("no-scroll", lock);
    if (lenis) { if (lock) lenis.stop(); else lenis.start(); }
  }

  function onKeydown(event) {
    if (document.querySelector(".pswp--open")) return;
    var dialogOpen = !!state.activeId && !els.dialog.hidden;
    if (event.key === "Escape" && dialogOpen) { event.preventDefault(); closeCar(false); return; }
    if (!dialogOpen) return;
    if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && state.detailSwiper) {
      var tag = event.target && event.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      event.preventDefault();
      if (event.key === "ArrowRight") state.detailSwiper.slideNext();
      else state.detailSwiper.slidePrev();
      return;
    }
    if (event.key !== "Tab") return;
    var items = focusable(els.dialog.querySelector(".dialog-panel"));
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function focusable(container) {
    var selector = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])";
    return Array.prototype.filter.call(container.querySelectorAll(selector), function (node) {
      return !node.closest("[hidden]");
    });
  }

  function syncFromLocation() {
    var id = carIdFromHash();
    if (id && findCar(id)) {
      if (state.activeId !== id || els.dialog.hidden) openCar(id, true);
      return;
    }
    if (state.activeId || !els.dialog.hidden) closeCar(true);
  }

  function attachFallback(img, photo, alt) {
    img.alt = alt || "";
    if (img._onerr) img.removeEventListener("error", img._onerr);
    var sources = [];
    if (photo) [photo.url, photo.thumb, photo.fallback].forEach(function (src) { if (src && sources.indexOf(src) === -1) sources.push(src); });
    function fail() {
      var failed = img.getAttribute("src") || "";
      window.setTimeout(function () {
        if ((img.getAttribute("src") || "") !== failed) return;
        if (img.naturalWidth > 0) return;
        var next = sources[sources.indexOf(failed) + 1];
        if (next) {
          img.src = next;
          return;
        }
        if (!img.classList.contains("is-placeholder")) {
          img.classList.add("is-placeholder");
          img.src = PLACEHOLDER;
        }
      }, 60);
    }
    img._onerr = fail;
    img.addEventListener("error", fail);
    img.classList.remove("is-placeholder");
    if (!sources.length) { fail(); return; }
    img.src = sources[0];
  }

  function findCar(id) {
    for (var i = 0; i < state.cars.length; i++) if (state.cars[i].id === id) return state.cars[i];
    return null;
  }

  function carIdFromHash() {
    var raw = (location.hash || "").replace(/^#/, "");
    if (!raw) return "";
    try { raw = decodeURIComponent(raw); } catch (error) { return ""; }
    if (raw === "inventory" || raw === "why" || raw === "stories" || raw === "contact") return "";
    return raw;
  }

  function justAddedId() {
    for (var i = state.cars.length - 1; i >= 0; i--) if (state.cars[i].id) return state.cars[i].id;
    return "";
  }

  function poolCount() {
    return state.cars.filter(function (car) { return els.showSold.checked || car.status !== "Sold"; }).length;
  }

  function countUp(el, target, format) {
    if (!el || target == null || isNaN(target)) return;
    if (reducedMotion()) { el.textContent = format(target); return; }
    var start = performance.now();
    function frame(now) {
      var p = Math.min(1, (now - start) / 800);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = format(target * eased);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function financeApr() { return num(finance.apr); }
  function financeTerm() { var term = Number(finance.termMonths); return term || 60; }
  function defaultDown(price) {
    var pct = num(finance.downPercent);
    if (isNaN(price) || isNaN(pct)) return 0;
    return price * (pct / 100);
  }
  function monthlyFor(price, down, apr, months) {
    if (isNaN(price) || !months) return null;
    var principal = Math.max(0, price - (isNaN(down) ? 0 : down));
    var rate = (isNaN(apr) ? 0 : apr) / 100 / 12;
    if (rate === 0) return principal / months;
    var pow = Math.pow(1 + rate, months);
    return principal * rate * pow / (pow - 1);
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
  function isSampleCar(car) { return (car.title + " " + car.description).toLowerCase().indexOf("sample") !== -1; }
  function photoAlt(car, index, total) { return car.title + ", photo " + (index + 1) + " of " + total; }
  function countLabel(shown, total) {
    if (shown === total) return shown + (shown === 1 ? " car" : " cars");
    return "Showing " + shown + " of " + total;
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
    var parsed = Number(String(value).replace(/[$,%\s]/g, ""));
    return isNaN(parsed) ? NaN : parsed;
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
    var cents = Math.round(Math.abs(value) * 100) % 100 !== 0;
    return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
  }
  function miles(value) {
    if (value == null || isNaN(value)) return "—";
    return Math.round(value).toLocaleString("en-US") + " mi";
  }
  function yearText(value) { return value == null || isNaN(value) ? "—" : String(Math.round(value)); }
  function formatWhen(value) {
    if (!value) return "—";
    var date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }
  function typeSummary(cars) {
    var types = uniques(cars, "type");
    if (!types.length) return "—";
    if (types.length > 3) return types.length + " styles";
    return types.join(" · ");
  }
  function uniques(cars, key) {
    var seen = {};
    cars.forEach(function (car) { if (car[key]) seen[car[key]] = true; });
    return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b); });
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function debounce(fn, wait) { var timer; return function () { clearTimeout(timer); timer = setTimeout(fn, wait); }; }
  function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  function reducedMotion() { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
})();
