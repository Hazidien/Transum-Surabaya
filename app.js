(function () {
  "use strict";

  const config = window.TRANSUM_CONFIG;
  const byId = (id) => document.getElementById(id);
  const routeList = byId("routeList");
  const routeSearch = byId("routeSearch");
  const stopSearch = byId("stopSearch");
  const loadStatus = byId("loadStatus");
  const mapError = byId("mapError");
  const nearestResult = byId("nearestResult");
  const nearestButton = byId("nearestButton");

  const state = {
    map: null,
    routes: new Map(),
    stops: [],
    stopFeatures: [],
    stopGroups: null,
    routeVisibility: new Map(),
    routeLayerIds: new Map(),
    stopsVisible: true,
    buildingLayerAdded: false,
    finderMode: false,
    clickMarker: null,
    walkingLayerAdded: false,
    activePopup: null,
    selectedRouteKey: null,
    selectedStop: null,
    bufferRadius: 400,
    labelsVisible: true,
    busesVisible: true,
    busAnimationOn: false,
    busFrame: null,
    busLastTime: 0,
    busMarkers: new Map(),
    busProgress: new Map(),
    busStopDistances: new Map(),
    routeAnimationCache: new Map(),
    busLastRender: 0,
    busStopWait: new Map(),
    busSpeedMultiplier: 1,
    busSpeedSetting: 30,
    activeBusPopup: null,
    activeBusId: null,
    hoverStopPopup: null,
    simulationMinutes: 6 * 60
  };

  if (!window.maplibregl || !config) {
    showError("Pustaka peta atau konfigurasi tidak ditemukan. Periksa koneksi internet dan file config.js.");
    return;
  }

  const normalize = (value) => String(value ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "");

  // Kanonisasi nama: abaikan awalan halte/shelter, samakan angka Romawi-Arab,
  // dan satukan variasi spasi/tanda baca seperti Tanjung Sari/Tanjungsari.
  function normalizeStopName(value) {
    let text = String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    text = text.replace(/\biii\b/g, "3").replace(/\bii\b/g, "2").replace(/\biv\b/g, "4").replace(/\bi\b/g, "1");
    text = text.replace(/\b(halte|shelter|bus stop|stop)\b/g, " ");
    return text.replace(/[^a-z0-9]+/g, "");
  }

  function formatStopName(value) {
    const name = String(value ?? "").trim();
    if (!name || /^halte\b/i.test(name)) return name || "Halte tanpa nama";
    // Nama terminal/term tidak diberi awalan "Halte".
    if (/^(terminal\b|term\.?\s)/i.test(name)) return name;
    return "Halte " + name;
  }

  function editDistance(a, b) {
    const row = Array.from({length:b.length+1}, (_,i)=>i);
    for(let i=1;i<=a.length;i++){
      let diagonal=row[0]; row[0]=i;
      for(let j=1;j<=b.length;j++){
        const above=row[j];
        row[j]=Math.min(row[j]+1,row[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));
        diagonal=above;
      }
    }
    return row[b.length];
  }

  function preferredStopName(names) {
    return [...names].filter(Boolean).sort((a,b)=>{
      const score = value => {
        const n=String(value).trim();
        return (normalizeStopName(n).length*2) + (/^(halte|shelter)\b/i.test(n)?2:0) - (/tanpa nama/i.test(n)?100:0);
      };
      return score(b)-score(a);
    })[0] || "Halte";
  }

  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  function showError(message) {
    mapError.textContent = message;
    mapError.hidden = false;
  }

  function hideError() {
    mapError.hidden = true;
  }

  function hideLoadingOverlay() {
    const overlay = byId("mapLoadingOverlay");
    if (overlay) overlay.hidden = true;
  }

  function setStatus(message) {
    loadStatus.textContent = message;
  }

  async function loadGeoJSON(path) {
    const encodedPath = path.split("/").map(segment => encodeURIComponent(segment)).join("/");
    const response = await fetch(encodedPath, { cache: "no-cache" });
    if (!response.ok) throw new Error("HTTP " + response.status + " — " + path);
    const data = await response.json();
    if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
      throw new Error("Format GeoJSON harus FeatureCollection: " + path);
    }
    return data;
  }

  function matchRoute(routeId, fallbackKey) {
    const value = normalize(routeId);
    if (value) {
      const exact = config.routes.find((route) =>
        [route.label, route.key, ...(route.routeValues || [])].some((candidate) => normalize(candidate) === value)
      );
      if (exact) return exact.key;

      const partial = config.routes.find((route) =>
        (route.routeValues || []).some((candidate) => {
          const alias = normalize(candidate);
          return alias.length >= 6 && (value.includes(alias) || alias.includes(value));
        })
      );
      if (partial) return partial.key;
    }
    return fallbackKey || null;
  }

  function addRoutePanel(route, index) {
    const groupKey = route.key.startsWith("sby-") ? "suroboyo" : "wirawiri";
    const groupTitle = groupKey === "suroboyo" ? "SUROBOYO BUS" : "WIRA WIRI";
    let group = routeList.querySelector('.route-group[data-group="' + groupKey + '"]');
    if (!group) {
      group = document.createElement("section");
      group.className = "route-group";
      group.dataset.group = groupKey;
      const heading = document.createElement("h3");
      heading.className = "route-group-heading";
      heading.textContent = groupTitle;
      group.appendChild(heading);
      routeList.appendChild(group);
    }
    const item = document.createElement("div");
    item.className = "route-item";
    item.setAttribute("role", "group");
    item.dataset.search = normalize(route.label);
    item.innerHTML = `
      <span class="route-line-swatch" style="background:${route.color}"></span>
      <span class="route-copy">
        <strong>${escapeHtml(route.label)}</strong>
        <small>Rute ${String(index + 1).padStart(2, "0")} · <span id="route-count-${route.key}">memuat…</span> fitur garis</small>
      </span>
      <input type="checkbox" checked aria-label="Tampilkan ${escapeHtml(route.label)}" data-route-toggle="${route.key}">
      <span class="route-check">✓</span>`;
    group.appendChild(item);

    const checkbox = item.querySelector("input");
    item.addEventListener("click", (event) => {
      // Area checkbox (termasuk kotak centang visual) hanya untuk on/off,
      // jangan sekaligus menjalankan pemilihan koridor dan zoom peta.
      if (event.target.closest('input[type="checkbox"]') || event.target.closest(".route-check")) return;
      selectRouteDetails(route.key);
      zoomToRoute(route.key);
    });
    checkbox.addEventListener("change", () => {
      state.routeVisibility.set(route.key, checkbox.checked);
      updateRouteVisibility(route.key);
      updateRouteCounter();
      updateRouteGroupHeadings();
    });
    item.querySelector(".route-check").addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    });
    item.addEventListener("dblclick", () => zoomToRoute(route.key));
  }

  function updateRouteGroupHeadings() {
    routeList.querySelectorAll(".route-group").forEach(group => {
      const hasVisible = [...group.querySelectorAll(".route-item")].some(item => !item.hidden);
      group.hidden = !hasVisible;
    });
  }

  function updateRouteCounter() {
    const shown = config.routes.filter(route => state.routeVisibility.get(route.key) !== false).length;
    byId("routeCount").textContent = shown + "/" + config.routes.length;
  }

  function updateRouteVisibility(routeKey) {
    const visible = state.routeVisibility.get(routeKey) !== false;
    if (!state.map || !state.map.isStyleLoaded()) return;
    const ids = state.routeLayerIds.get(routeKey) || [];
    ids.forEach(id => {
      if (!state.map.getLayer(id)) return;
      const isCoverage = id.startsWith("coverage-");
      const coverageEnabled = byId("coverageToggle")?.checked === true;
      state.map.setLayoutProperty(id, "visibility", visible && (!isCoverage || coverageEnabled) ? "visible" : "none");
    });
    // Visibilitas halte diatur per-koridor melalui layer filter, bukan setData GeoJSON
    // setiap checkbox berubah. Ini mencegah rebuild source besar dan mempertahankan titik
    // halte bersama selama minimal satu koridor yang melayaninya masih aktif.
    const visibleKeys = config.routes.filter(route => state.routeVisibility.get(route.key) !== false).map(route => route.key);
    const activeStopFilter = visibleKeys.length
      ? ["any", ...visibleKeys.map(key => ["in", key, ["get", "__routeKeys"]])]
      : ["==", ["get", "__showStop"], -1];
    if (state.map.getLayer("stops-all")) {
      state.map.setFilter("stops-all", activeStopFilter);
    }
    if (state.map.getLayer("stop-labels")) {
      state.map.setFilter("stop-labels", activeStopFilter);
    }
    setStopLayerVisibility(state.stopsVisible);
    refreshSelectedBuffer();
    state.busMarkers.forEach((marker, busId) => {
      if (busId.startsWith(routeKey + "::")) {
        marker.getElement().style.visibility = visible && state.busesVisible ? "visible" : "hidden";
        marker.getElement().style.pointerEvents = visible && state.busesVisible ? "auto" : "none";
      }
    });
    if (state.activeBusPopup && !visible && state.activeBusId?.startsWith(routeKey + "::")) state.activeBusPopup.remove();
  }

  function distancePointToRouteMeters(point, routeData) {
    const lat0 = point[1] * Math.PI / 180;
    const sx = 111320 * Math.cos(lat0);
    const sy = 110574;
    const px = point[0] * sx, py = point[1] * sy;
    let best = Infinity;
    const isPosition = value => Array.isArray(value) && value.length >= 2 &&
      typeof value[0] === "number" && typeof value[1] === "number";
    const segmentsFrom = coords => {
      const positions = [];
      const collect = value => {
        if (!Array.isArray(value)) return;
        if (isPosition(value)) positions.push(value);
        else value.forEach(collect);
      };
      collect(coords);
      return positions;
    };
    (routeData?.features || []).forEach(feature => {
      const coords = feature.geometry?.coordinates;
      if (!coords) return;
      const positions = segmentsFrom(coords);
      for (let i = 1; i < positions.length; i++) {
        const a = positions[i - 1], b = positions[i];
        // Avoid connecting the end of one separate line to the start of another.
        // Tiny adjacent segments still give a reliable local proximity test.
        const ax = a[0] * sx, ay = a[1] * sy;
        const bx = b[0] * sx, by = b[1] * sy;
        const dx = bx - ax, dy = by - ay;
        const denom = dx * dx + dy * dy;
        const t = denom ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / denom)) : 0;
        best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
      }
    });
    return best;
  }

  function canonicalStopGroupName(value) {
    const key = normalizeStopName(value);
    // Satukan variasi ejaan Family/Familly, tetapi pertahankan identitas halte A dan B.
    // Dengan demikian A hanya bergabung dengan A lintas koridor, begitu juga B.
    const graha = key.match(/^grahafamil(?:y|ly)([ab])$/);
    if (graha) return "grahafamily" + graha[1];
    // Variasi penulisan Jono/Yono Soewojo/Suwoyo merujuk halte Yono Suwoyo.
    // Nomor 1 dan 2 tetap menjadi halte terpisah, tetapi masing-masing
    // menggabungkan seluruh catatan lintas rute dalam radius pengelompokan.
    const yono = key.match(/^(?:jono|yono)(?:soewojo|suwoyo)([12])$/);
    if (yono) return "yonosuwoyo" + yono[1];
    // "Basra" and "Basra 2" are duplicate records at the same physical stop.
    if (key === "basra2") return "basra";
    return key;
  }

  function buildStopGroups() {
    if (state.stopGroups) return state.stopGroups;
    // Same canonical name can be merged across route datasets within 150 m.
    // Distinct names (e.g. Samsat Tandes A/B or Tanjungsari A/B) stay separate.
    const groups = [];
    const groupsByName = new Map();

    state.stops.forEach(feature => {
      const coord = feature.geometry.coordinates;
      if (!Array.isArray(coord) || !Number.isFinite(coord[0]) || !Number.isFinite(coord[1])) return;
      const rawName = String(feature.properties.__stopName || "").trim();
      const keyName = /^(halte|shelter)?\s*(tanpa nama|unnamed|unknown)$/i.test(rawName)
        ? "" : canonicalStopGroupName(rawName);

      let match = null;
      if (keyName) {
        const candidates = groupsByName.get(keyName) || [];
        let nearestDistance = Infinity;
        candidates.forEach(group => {
          const distance = haversineMeters(group.center, coord);
          if (distance <= 150 && distance < nearestDistance) {
            match = group;
            nearestDistance = distance;
          }
        });
      }

      // Satukan titik dari dataset/rute berbeda jika benar-benar berimpit.
      // Ambang 3 m menghindari penggabungan halte A/B yang berada di sisi jalan berbeda.
      if (!match) {
        let nearestDistance = Infinity;
        groups.forEach(group => {
          const distance = haversineMeters(group.center, coord);
          if (distance <= 3 && distance < nearestDistance) {
            match = group;
            nearestDistance = distance;
          }
        });
      }

      // Keep unnamed records independent so they cannot absorb named stops.
      if (!match) {
        match = { members: [], coords: [], center: coord, canonicalName: keyName };
        groups.push(match);
        if (keyName) {
          if (!groupsByName.has(keyName)) groupsByName.set(keyName, []);
          groupsByName.get(keyName).push(match);
        }
      }

      match.members.push(feature);
      match.coords.push(coord);
    });

    groups.forEach(group => {
      // Use a real source coordinate closest to all members, not an invented centroid.
      let best = group.coords[0], bestTotal = Infinity;
      group.coords.forEach(candidate => {
        const total = group.coords.reduce((sum, other) => sum + haversineMeters(candidate, other), 0);
        if (total < bestTotal) { bestTotal = total; best = candidate; }
      });
      group.center = best;
      group.routeKeys = [...new Set(group.members.map(f => f.properties.__routeKey).filter(Boolean))];
      group.routeIds = [...new Set(group.members.map(f => f.properties.__rawRouteId).filter(Boolean))];
      group.names = [...new Set(group.members.map(f => f.properties.__stopName).filter(Boolean))];
      const canonicalDisplay = /^grahafamily[ab]$/.test(group.canonicalName)
        ? "Graha Family " + group.canonicalName.slice(-1).toUpperCase()
        : /^yonosuwoyo[12]$/.test(group.canonicalName)
          ? "Yono Suwoyo " + group.canonicalName.slice(-1)
          : group.canonicalName === "basra" && group.names.some(name => normalizeStopName(name) === "basra") ? "Basra"
          : preferredStopName(group.names);
      group.displayName = formatStopName(canonicalDisplay);
    });

    state.stopGroups = groups;
    return groups;
  }
  function refreshStopsSource() {
    if (!state.map || !state.map.getSource("all-stops")) return;
    const groups = buildStopGroups();
    const features = groups.map((group, index) => {
      const members = group.members;
      const routeKeys = group.routeKeys;
      const visibleRouteKeys = routeKeys.filter(key => state.routeVisibility.get(key) !== false);
      return {
        type: "Feature", id: "stop-cluster-" + index,
        geometry: { type: "Point", coordinates: group.center },
        properties: {
          __stopName: group.displayName || formatStopName(group.names[0] || "Halte"), __stopNames: group.names,
          __routeKey: routeKeys[0] || "", __routeKeys: routeKeys, __visibleRouteKeys: visibleRouteKeys,
          __memberCount: members.length,
          __memberStops: members.map(f => ({
            name: formatStopName(f.properties.__stopName || "tanpa nama"), routeKey: f.properties.__routeKey || "", routeId: f.properties.__rawRouteId || "",
            id: f.properties.stop_id ?? f.properties.Stop_Id ?? f.properties.Id ?? f.properties.id ?? "—",
            coordinates: f.geometry.coordinates
          })),
          __showStop: state.stopsVisible && visibleRouteKeys.length ? 1 : 0
        }
      };
    });
    state.map.getSource("all-stops").setData({ type: "FeatureCollection", features });
  }

  function fitAllRoutes() {
    const allBounds = new maplibregl.LngLatBounds();
    let hasBounds = false;
    state.routes.forEach(route => {
      if (!route.bounds || route.bounds.isEmpty()) return;
      const sw = route.bounds.getSouthWest();
      const ne = route.bounds.getNorthEast();
      const center = route.bounds.getCenter();
      // All configured corridors are in Surabaya; ignore malformed coordinates outside this area.
      if (center.lng < 111 || center.lng > 114 || center.lat < -8.5 || center.lat > -6.5) return;
      allBounds.extend(sw);
      allBounds.extend(ne);
      hasBounds = true;
    });
    if (hasBounds) state.map.fitBounds(allBounds, {
      padding: { top: 100, bottom: 90, left: 370, right: 70 },
      maxZoom: 12.8, duration: 850
    });
    else state.map.flyTo({ center: config.map.center, zoom: config.map.zoom, pitch: config.map.pitch, bearing: config.map.bearing, duration: 850 });
  }

  function zoomToRoute(routeKey) {
    const entry = state.routes.get(routeKey);
    if (!entry || !entry.bounds || !state.map || !state.map.isStyleLoaded()) return;
    const sw = entry.bounds.getSouthWest(), ne = entry.bounds.getNorthEast();
    const center = entry.bounds.getCenter();
    const valid = [sw.lng, sw.lat, ne.lng, ne.lat, center.lng, center.lat].every(Number.isFinite)
      && center.lng >= 112 && center.lng <= 113.5 && center.lat >= -8 && center.lat <= -6.5
      && (ne.lng - sw.lng) < 0.5 && (ne.lat - sw.lat) < 0.5;
    // Jangan pernah fitBounds ke koordinat salah/di luar Surabaya; pertahankan view peta bila data rute tidak valid.
    if (!valid) {
      console.warn("Zoom rute dibatalkan karena bounds tidak valid:", routeKey, center);
      return;
    }
    state.map.fitBounds(entry.bounds, { padding: { top: 90, bottom: 90, left: 380, right: 70 }, maxZoom: 15, duration: 900 });
  }

  function boundsForFeatureCollection(collection) {
    const bounds = new maplibregl.LngLatBounds();
    (collection.features || []).forEach(feature => {
      const walk = (coords) => {
        if (!Array.isArray(coords)) return;
        if (typeof coords[0] === "number" && typeof coords[1] === "number") {
          if (Number.isFinite(coords[0]) && Number.isFinite(coords[1])) bounds.extend([coords[0], coords[1]]);
        } else coords.forEach(walk);
      };
      if (feature.geometry) walk(feature.geometry.coordinates);
    });
    return bounds.isEmpty() ? null : bounds;
  }

  function popupHtml(kicker, title, rows) {
    return `<div class="map-popup"><div class="popup-kicker">${escapeHtml(kicker)}</div><h3>${escapeHtml(title)}</h3>${rows.map(row =>
      `<p><strong>${escapeHtml(row[0])}:</strong> ${escapeHtml(row[1])}</p>`
    ).join("")}</div>`;
  }

  function routeNameByKey(key) {
    return config.routes.find(route => route.key === key)?.label || "Koridor belum teridentifikasi";
  }

  function openCreditModal(autoOpen = false) {
    const modal = byId("creditModal");
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    if (autoOpen) modal.dataset.openedAtStartup = "true";
  }

  function closeCreditModal() {
    const modal = byId("creditModal");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  function createMap() {
    if (window.pmtiles && window.maplibregl.addProtocol) {
      const protocol = new pmtiles.Protocol();
      maplibregl.addProtocol("pmtiles", protocol.tile);
    }

    state.map = new maplibregl.Map({
      container: "map",
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: config.map.center,
      zoom: config.map.zoom,
      pitch: config.map.pitch,
      bearing: config.map.bearing,
      maxPitch: 75,
      attributionControl: false,
      canvasContextAttributes: { antialias: false }
    });

    state.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    state.map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: "metric" }), "bottom-left");

    byId("openCreditButton")?.addEventListener("click", () => openCreditModal());
    byId("closeCreditButton")?.addEventListener("click", closeCreditModal);
    byId("creditModal")?.addEventListener("click", event => { if (event.target.id === "creditModal") closeCreditModal(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape") closeCreditModal(); });

    state.map.on("load", () => {
      setStatus("Peta dasar siap");
      addLoadedData();
      setupMapEvents();
      setupControls();
    });
    const mapCanvas = state.map.getCanvas();
    mapCanvas.addEventListener("webglcontextlost", event => {
      event.preventDefault();
      console.warn("WebGL context lost; simulasi dijeda untuk melindungi peta.");
      state.busAnimationOn = false;
      if (state.busFrame) cancelAnimationFrame(state.busFrame);
      state.busFrame = null;
    }, false);
    mapCanvas.addEventListener("webglcontextrestored", () => {
      console.info("WebGL context restored; peta dirender ulang.");
      state.map.resize();
      state.map.triggerRepaint();
    }, false);
    state.map.on("error", (event) => {
      if (event?.error?.message) console.warn("MapLibre:", event.error.message);
    });
    state.map.on("mousemove", (event) => {
      byId("coordinates").textContent = event.lngLat.lng.toFixed(5) + ", " + event.lngLat.lat.toFixed(5);
    });
  }

  async function addLoadedData() {
    setStatus("Memuat rute dan halte…");
    const failures = [];

    for (const [index, route] of config.routes.entries()) {
      addRoutePanel(route, index);
      state.routeVisibility.set(route.key, true);
      try {
        const data = await loadGeoJSON(route.file);
        const sourceId = "route-source-" + route.key;
        const bounds = boundsForFeatureCollection(data);
        state.map.addSource(sourceId, { type: "geojson", data });
        const haloId = "route-halo-" + route.key;
        const lineId = "route-line-" + route.key;
        state.map.addLayer({
          id: haloId, type: "line", source: sourceId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#07101e", "line-width": 7, "line-opacity": 0.95 }
        });
        state.map.addLayer({
          id: lineId, type: "line", source: sourceId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": route.color, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2, 15, 5], "line-opacity": 0.98 }
        });
        state.map.on("click", lineId, (event) => {
          selectRouteDetails(route.key);
          state.map.flyTo({ center: event.lngLat, zoom: Math.max(13, state.map.getZoom()), duration: 450 });
        });
        state.map.on("mouseenter", lineId, () => state.map.getCanvas().style.cursor = "pointer");
        state.map.on("mouseleave", lineId, () => state.map.getCanvas().style.cursor = state.finderMode ? "crosshair" : "");
        state.routes.set(route.key, { data, bounds, sourceId });
        state.routeLayerIds.set(route.key, [haloId, lineId]);
        const countEl = byId("route-count-" + route.key);
        if (countEl) countEl.textContent = data.features.length;
      } catch (error) {
        failures.push(error.message);
        const countEl = byId("route-count-" + route.key);
        if (countEl) countEl.textContent = "belum diunggah";
      }
    }

    await loadAllStops(failures);
    addStopLayers();
    setupCircleBuffers();
    setupBusSimulation();
    await setupCoverage(failures);
    setupBuildings(failures);
    updateRouteCounter();
    wireRouteSearch();

    const allBounds = new maplibregl.LngLatBounds();
    let hasBounds = false;
    state.routes.forEach(route => {
      if (route.bounds && !route.bounds.isEmpty()) {
        allBounds.extend(route.bounds.getSouthWest());
        allBounds.extend(route.bounds.getNorthEast());
        hasBounds = true;
      }
    });
    // Keep the configured opening view. Do not auto-fit all corridors, which can zoom out unexpectedly.

    if (failures.length) {
      setStatus(state.routes.size + "/" + config.routes.length + " rute · data belum lengkap");
      showError("Peta dasar sudah tampil, tetapi beberapa GeoJSON belum ditemukan atau tidak terbaca. Unggah berkas menggunakan nama yang tercantum di folder README, lalu muat ulang website. Detail teknis ada di console browser.");
      console.warn("Berkas data belum tersedia:", failures);
      hideLoadingOverlay();
      openCreditModal(true);
    } else {
      hideError();
      setStatus(state.routes.size + " rute · data siap");
      hideLoadingOverlay();
      openCreditModal(true);
    }
  }

  async function loadAllStops(failures) {
    const features = [];
    for (const stopDataset of config.stops) {
      try {
        const collection = await loadGeoJSON(stopDataset.file);
        collection.features.forEach((feature, index) => {
          if (!feature.geometry || feature.geometry.type !== "Point") {
            console.warn("Fitur halte bukan Point:", stopDataset.file, index);
            return;
          }
          const properties = { ...(feature.properties || {}) };
          const rawRouteId = properties.Route_Id ?? properties.Route_Id_1 ?? properties.route_id ?? properties.routeId ?? "";
          const routeKey = matchRoute(rawRouteId, stopDataset.fallbackRouteKey);
          const name = properties.Halte_name ?? properties.Halte_nama ?? properties.halte_name ?? properties.halte_nama ?? properties.stop_name ?? properties.name ?? "tanpa nama";
          properties.__routeKey = routeKey || "";
          properties.__stopName = String(name);
          properties.__rawRouteId = String(rawRouteId || "");
          properties.__dataset = stopDataset.key;
          features.push({ ...feature, properties });
        });
      } catch (error) {
        failures.push(error.message);
      }
    }
    state.stops = features;
    state.stopFeatures = features;
    byId("stopsStatus").textContent = features.length ? features.length + " titik halte terbaca" : "Belum ada GeoJSON halte";
  }

  function addStopLayers() {
    state.map.addSource("all-stops", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    refreshStopsSource();
    const visibleKeys = config.routes.filter(route => state.routeVisibility.get(route.key) !== false).map(route => route.key);
    const activeStopFilter = visibleKeys.length
      ? ["any", ...visibleKeys.map(key => ["in", key, ["get", "__routeKeys"]])]
      : ["==", ["get", "__showStop"], -1];
    // Satu layer untuk semua titik halte bersama. Layer per-rute sebelumnya
    // menggambar fitur yang sama berulang kali ketika satu halte dilayani banyak koridor.
    state.map.addLayer({
      id: "stops-all", type: "circle", source: "all-stops",
      filter: activeStopFilter,
      layout: { visibility: state.stopsVisible ? "visible" : "none" },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2.5, 14, 5.5],
        "circle-color": "#FFFFFF",
        "circle-stroke-color": "#173B63",
        "circle-stroke-width": 2.2,
        "circle-opacity": 0.98
      }
    });
    state.map.on("click", "stops-all", event => {
      const feature=event.features?.[0];
      if(feature) showStopDetails(feature);
    });
    state.map.on("mouseenter", "stops-all", event => {
      state.map.getCanvas().style.cursor="pointer";
      const feature=event.features?.[0];
      if(!feature) return;
      if(state.hoverStopPopup) state.hoverStopPopup.remove();
      state.hoverStopPopup=new maplibregl.Popup({
        closeButton:false,closeOnClick:false,offset:10,className:"stop-hover-popup"
      }).setLngLat(feature.geometry.coordinates)
        .setHTML('<div class="stop-hover-label">'+escapeHtml(feature.properties.__stopName || "Halte")+'</div>')
        .addTo(state.map);
    });
    state.map.on("mouseleave", "stops-all", () => {
      state.map.getCanvas().style.cursor=state.finderMode ? "crosshair" : "";
      if(state.hoverStopPopup){state.hoverStopPopup.remove();state.hoverStopPopup=null;}
    });

    state.map.addLayer({
      id: "stop-labels", type: "symbol", source: "all-stops",
      filter: activeStopFilter,
      minzoom: 10.5,
      layout: {
        "text-field": ["get", "__stopName"],
        "visibility": "visible",
        "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 10, 9, 14, 11, 17, 12],
        "text-offset": [0, 1.15],
        "text-anchor": "top",
        "text-allow-overlap": false,
        "text-ignore-placement": false
      },
      paint: { "text-color": "#f8fafc", "text-opacity": 0, "text-halo-color": "rgba(16,24,39,0)", "text-halo-width": 1.4, "text-halo-blur": 0.2 }
    });
    byId("stopsToggle").addEventListener("change", event => {
      state.stopsVisible = event.target.checked;
      setStopLayerVisibility(state.stopsVisible);
      setBufferLayerVisibility(state.stopsVisible && byId("coverageToggle").checked && !!state.selectedStop);
    });
  }

  function stopBufferPolygon(feature, radiusMeters, steps = 48) {
    const [lon, lat] = feature.geometry.coordinates;
    const coords = [];
    const earth = 6371008.8;
    const angular = radiusMeters / earth;
    const lat1 = lat * Math.PI / 180;
    const lon1 = lon * Math.PI / 180;
    for (let i = 0; i <= steps; i++) {
      const bearing = (i / steps) * Math.PI * 2;
      const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing));
      const lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2));
      coords.push([lon2 * 180 / Math.PI, lat2 * 180 / Math.PI]);
    }
    return { type: "Feature", properties: { __routeKey: feature.properties.__routeKey, __stopName: feature.properties.__stopName }, geometry: { type: "Polygon", coordinates: [coords] } };
  }

  function setupCircleBuffers() {
    const toggle = byId("coverageToggle");
    const slider = byId("bufferSlider");
    if (!state.map.getSource("stop-circle-buffers")) {
      state.map.addSource("stop-circle-buffers", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      state.map.addLayer({
        id: "stop-circle-buffer-fill", type: "fill", source: "stop-circle-buffers",
        paint: { "fill-color": ["match", ["get", "__routeKey"],
          "sby-benowo", "#00D9FF", "sby-kejawan", "#00D9FF", "sby-purabaya", "#00D9FF",
          "ww-gunung-anyar", "#00D9FF", "ww-tow", "#00D9FF", "#00D9FF"], "fill-opacity": 0 },
        layout: { visibility: "visible" }
      });
      state.map.addLayer({
        id: "stop-circle-buffer-outline", type: "line", source: "stop-circle-buffers",
        paint: { "line-color": ["match", ["get", "__routeKey"],
          "sby-benowo", "#F59E0B", "sby-kejawan", "#38BDF8", "sby-purabaya", "#A78BFA",
          "ww-gunung-anyar", "#FB7185", "ww-tow", "#34D399", "#38BDF8"], "line-width": 2.4, "line-opacity": 0 },
        layout: { visibility: "visible" }
      });
    }
    const refresh = () => {
      state.bufferRadius = Number(slider.value) || 400;
      byId("bufferValue").textContent = state.bufferRadius >= 1000 ? "1.000 m" : state.bufferRadius + " m";
      byId("bufferTime").textContent = "≈ " + Math.max(1, Math.round((state.bufferRadius / 1000 / 4.5) * 60)) + " menit jalan kaki (garis lurus)";
      refreshSelectedBuffer();
    };
    slider.addEventListener("input", refresh);
    toggle.addEventListener("change", () => {
      if (toggle.checked) refreshSelectedBuffer();
      else setBufferLayerVisibility(false);
    });
    refresh();
    refreshSelectedBuffer();
  }

  function haversineKm(a, b) { return haversineMeters(a, b) / 1000; }

  function routeCoordinates(routeData) {
    const coords = [];
    const walk = c => {
      if (!Array.isArray(c)) return;
      if (typeof c[0] === "number" && typeof c[1] === "number") coords.push(c);
      else c.forEach(walk);
    };
    (routeData.features || []).forEach(f => { if (f.geometry) walk(f.geometry.coordinates); });
    return coords;
  }

  function routeLengthKm(coords) {
    let total = 0;
    for (let i = 1; i < coords.length; i++) total += haversineKm(coords[i - 1], coords[i]);
    return total;
  }

  function selectRouteDetails(routeKey) {
    const route = config.routes.find(r => r.key === routeKey);
    const entry = state.routes.get(routeKey);
    if (!route || !entry) return;
    state.selectedRouteKey = routeKey;
    const coords = routeCoordinates(entry.data);
    const lengthKm = routeLengthKm(coords);
    const stops = buildStopGroups().filter(group => group.routeKeys.includes(routeKey)).map(group => ({
      type: "Feature", geometry: { type: "Point", coordinates: group.center },
      properties: { __stopName: group.displayName, __routeKey: routeKey, __routeKeys: group.routeKeys, __rawRouteId: group.routeIds.join(" · ") }
    }));
    const indexedStops = stops.map(feature => {
      let nearestIndex = 0, nearestDistance = Infinity;
      const point = feature.geometry.coordinates;
      coords.forEach((coord, i) => {
        const d = haversineMeters(point, coord);
        if (d < nearestDistance) { nearestDistance = d; nearestIndex = i; }
      });
      return { feature, nearestIndex, nearestDistance };
    }).sort((a, b) => a.nearestIndex - b.nearestIndex);
    byId("mapDetailKicker").textContent = "DETAIL KORIDOR";
    byId("mapDetailTitle").textContent = route.label;
    byId("mapDetailContent").innerHTML = `
      <div class="route-metrics">
        <div class="route-metric"><strong>${stops.length}</strong><small>halte</small></div>
        <div class="route-metric"><strong>${lengthKm.toFixed(1)} km</strong><small>panjang rute*</small></div>
        <div class="route-metric"><strong>${indexedStops.filter(s => s.nearestDistance <= 100).length}</strong><small>titik dekat garis</small></div>
      </div>
      <p class="result-note">*Panjang dihitung dari geometri garis pada GeoJSON, bukan jadwal atau jarak operasional resmi.</p>
      <div class="route-stop-heading">Halte sepanjang rute</div>
      <div class="route-stop-list">${indexedStops.length ? indexedStops.map((item, i) => `
        <button class="route-stop-item" data-stop-index="${i}">
          <span class="route-stop-number">${i + 1}</span>
          <span class="route-stop-name">${escapeHtml(formatStopName(item.feature.properties.__stopName || "tanpa nama"))}</span>
          <small>${Math.round(item.nearestDistance)} m dari garis</small>
        </button>`).join("") : '<p class="result-note">Belum ada data halte untuk koridor ini. Tambahkan GeoJSON halte yang sesuai.</p>'}
      </div>`;
    byId("mapDetailPanel").hidden = false;
    if (byId("mapHelpPanel")) byId("mapHelpPanel").hidden = true;
    byId("mapDetailContent").querySelectorAll("[data-stop-index]").forEach(button => {
      button.addEventListener("click", () => {
        const item = indexedStops[Number(button.dataset.stopIndex)];
        if (!item) return;
        showStopDetails(item.feature);
        state.map.flyTo({ center: item.feature.geometry.coordinates, zoom: 16, duration: 650 });
      });
    });
  }


  function setBufferLayerVisibility(visible) {
    // Toggle melalui paint opacity, bukan perubahan layout MapLibre.
    if (state.map?.getLayer("stop-circle-buffer-fill")) state.map.setPaintProperty("stop-circle-buffer-fill", "fill-opacity", visible ? 0.34 : 0);
    if (state.map?.getLayer("stop-circle-buffer-outline")) state.map.setPaintProperty("stop-circle-buffer-outline", "line-opacity", visible ? 0.98 : 0);
  }

  function setStopLayerVisibility(visible) {
    if (state.map?.getLayer("stops-all")) {
      state.map.setPaintProperty("stops-all", "circle-opacity", visible ? 0.98 : 0);
      state.map.setPaintProperty("stops-all", "circle-stroke-opacity", visible ? 1 : 0);
    }
    if (state.map?.getLayer("stop-labels")) {
      state.map.setPaintProperty("stop-labels", "text-opacity", visible ? 1 : 0);
      state.map.setPaintProperty("stop-labels", "text-halo-color", visible ? "#101827" : "rgba(16,24,39,0)");
    }
  }

  function refreshSelectedBuffer() {
    const source = state.map?.getSource("stop-circle-buffers");
    if (!source) return;
    const stop = state.selectedStop;
    const selectedRouteKeys = Array.isArray(stop?.properties?.__routeKeys)
      ? stop.properties.__routeKeys
      : [stop?.properties?.__routeKey].filter(Boolean);
    const hasVisibleService = selectedRouteKeys.some(key => state.routeVisibility.get(key) !== false);
    const enabled = byId("coverageToggle").checked && !!stop && state.stopsVisible && hasVisibleService;
    if (!enabled) {
      setBufferLayerVisibility(false);
      return;
    }
    source.setData({ type: "FeatureCollection", features: [stopBufferPolygon(stop, state.bufferRadius)] });
    setBufferLayerVisibility(true);
  }

  function showStopDetails(feature) {
    if (!feature || !feature.geometry || feature.geometry.type !== "Point") return;
    state.selectedStop = feature;
    const p = feature.properties || {};
    // MapLibre may expose GeoJSON array-valued properties as JSON strings on queried features.
    // Parse them explicitly; otherwise the popup falls back to a single route and hides the shared corridors.
    const parseArrayProperty = value => {
      if (Array.isArray(value)) return value;
      if (typeof value === "string") {
        try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; }
        catch (_) { return []; }
      }
      return [];
    };
    const parsedMembers = parseArrayProperty(p.__memberStops);
    const members = parsedMembers.length ? parsedMembers : [{
      name: p.__stopName || "Halte tanpa nama", routeKey: p.__routeKey || "",
      id: p.stop_id ?? p.Stop_Id ?? p.Id ?? p.id ?? "—", coordinates: feature.geometry.coordinates
    }];
    const storedRouteKeys = parseArrayProperty(p.__routeKeys);
    const routeKeys = [...new Set((storedRouteKeys.length ? storedRouteKeys : members.map(m => m.routeKey)).filter(Boolean))];
    const routeLabels = routeKeys.map(key => ({ key, label: routeNameByKey(key), color: config.routes.find(route => route.key === key)?.color || "#38BDF8" }));
    const routeKey = routeKeys[0] || p.__routeKey || "";
    const routeLabel = routeNameByKey(routeKey);
    const rawRouteIds = [...new Set(members.map(member => member.routeId).filter(Boolean))];
    byId("mapDetailKicker").textContent = "INFORMASI HALTE";
    byId("mapDetailTitle").textContent = p.__stopName || "Halte tanpa nama";
    const bufferToggle = byId("coverageToggle");
    if (bufferToggle && !bufferToggle.checked) bufferToggle.checked = true;
    byId("mapDetailContent").innerHTML = `
      <div class="route-metrics stop-metrics">
        <div class="route-metric"><strong>${escapeHtml(routeLabels.length ? [...new Set(routeLabels.map(r => r.label.split(" · ")[0]))].join(" / ") : "—")}</strong><small>operator/layanan</small></div>
        <div class="route-metric"><strong>${routeLabels.length}</strong><small>rute yang melayani</small></div>
        <div class="route-metric"><strong>${state.bufferRadius} m</strong><small>radius indikatif</small></div>
      </div>
      <div class="route-stop-heading">Dilayani koridor (${routeLabels.length})</div>
      <div class="served-route-list">${routeLabels.map(route => '<div class="served-route-chip" style="--route-color:' + route.color + '">' + escapeHtml(route.label) + '</div>').join("")}</div>
      ${rawRouteIds.length ? '<p class="result-note">Route_Id: ' + rawRouteIds.map(escapeHtml).join(" · ") + '</p>' : ""}
      ${p.__memberCount > 1 ? '<p class="result-note">Titik halte dari beberapa dataset digabung menjadi satu lokasi. Seluruh koridor yang melayani lokasi ini ditampilkan di atas.</p>' : ""}
      <p class="result-note">Buffer lingkaran hanya ditampilkan untuk halte yang dipilih. Radius dapat diubah dari panel kiri. Jarak merupakan radius geometris, bukan jaminan akses trotoar.</p>
      <button class="toolbar-button detail-nearest-button" id="detailFindNearby">Cari akses ke halte ini</button>`;
    byId("mapDetailPanel").hidden = false;
    if (byId("mapHelpPanel")) byId("mapHelpPanel").hidden = true;
    refreshSelectedBuffer();
    const coord = feature.geometry.coordinates;
    state.map.flyTo({ center: coord, zoom: Math.max(14, state.map.getZoom()), duration: 550 });
    byId("detailFindNearby").addEventListener("click", () => findNearestStop(coord));
  }

  function setupBusSimulation() {
    const button = byId("busPlayButton");
    const speed = byId("busSpeed");
    const dockButton = byId("busDockPlay");
    const dockSpeed = byId("busDockSpeed");
    const dockToggle = byId("busDockVisible");
    // Selector expresses the displayed acceleration. Each setting unit maps to 3x
    // the previous movement rate: 10x is the previous 30x baseline; 30x is 3x faster.
    const applyBusSpeed = value => {
      state.busSpeedSetting = Math.max(1, Number(value) || 1);
      state.busSpeedMultiplier = state.busSpeedSetting * 3;
      byId("busSpeedValue").textContent = state.busSpeedSetting + "×";
      if (dockSpeed) dockSpeed.value = String(state.busSpeedSetting);
      if (byId("busDockSpeedValue")) byId("busDockSpeedValue").textContent = state.busSpeedSetting + "×";
    };
    applyBusSpeed(30);
    // Pra-hitung geometri dan halte per koridor sekali saja. Hindari menghitung ulang
    // seluruh garis (ribuan vertex) pada setiap frame animasi.
    state.routeAnimationCache.clear();
    config.routes.forEach(route => {
      const entry=state.routes.get(route.key);
      if(!entry) return;
      const coords=routeCoordinates(entry.data);
      if(coords.length<2) return;
      const cumulative=[0];
      for(let i=1;i<coords.length;i++) cumulative[i]=cumulative[i-1]+haversineKm(coords[i-1],coords[i]);
      const length=cumulative[cumulative.length-1];
      const stopDistances=getRouteStopDistances(route.key,coords,length);
      state.routeAnimationCache.set(route.key,{coords,cumulative,length,stopDistances});
    });
    speed.value = "30";
    if (dockSpeed) dockSpeed.value = "30";
    speed.addEventListener("input", () => applyBusSpeed(speed.value));
    if (dockSpeed) dockSpeed.addEventListener("change", () => {
      speed.value = String(dockSpeed.value);
      applyBusSpeed(dockSpeed.value);
    });
    const setBusesVisible = visible => {
      state.busesVisible = !!visible;
      byId("busesToggle").checked = state.busesVisible;
      if (dockToggle) dockToggle.checked = state.busesVisible;
      state.busMarkers.forEach(marker => { marker.getElement().style.visibility = state.busesVisible ? "visible" : "hidden";
        marker.getElement().style.pointerEvents = state.busesVisible ? "auto" : "none"; });
      if (!state.busesVisible) {
        if (state.busFrame) cancelAnimationFrame(state.busFrame);
        state.busFrame = null;
        state.busLastTime = 0;
      } else if (state.busAnimationOn && !state.busFrame) {
        state.busLastTime = 0;
        state.busFrame = requestAnimationFrame(animateBusMarkers);
      }
    };
    if (dockToggle) dockToggle.addEventListener("change", () => setBusesVisible(dockToggle.checked));
    byId("busesToggle").addEventListener("change", event => setBusesVisible(event.target.checked));
    byId("closeMapDetail").addEventListener("click", () => {
      if (state.clickMarker) state.clickMarker.remove();
      state.clickMarker = null;
      clearWalkingRoute();
      byId("mapDetailPanel").hidden = true;
      if (byId("mapHelpPanel")) byId("mapHelpPanel").hidden = false;
      nearestResult.innerHTML = '<div class="result-placeholder"><span class="pin-outline">◎</span><span>Klik peta untuk mencari halte terdekat.</span></div>';
      state.selectedStop = null;
      refreshSelectedBuffer();
    });
    const toggleSimulation = () => {
      state.busAnimationOn = !state.busAnimationOn;
      button.innerHTML = state.busAnimationOn ? "<span>Ⅱ</span> Jeda simulasi bus" : "<span>▶</span> Mulai simulasi bus";
      if (dockButton) dockButton.textContent = state.busAnimationOn ? "Ⅱ" : "▶";
      if (state.busAnimationOn) {
        state.busLastTime = 0;
        state.busFrame = requestAnimationFrame(animateBusMarkers);
      } else if (state.busFrame) {
        cancelAnimationFrame(state.busFrame);
        state.busFrame = null;
      }
    };
    button.addEventListener("click", toggleSimulation);
    if (dockButton) dockButton.addEventListener("click", toggleSimulation);
    if (byId("simBusCount")) byId("simBusCount").textContent = getTotalSimulatedFleet() + " bus";
    // Start a clearly labelled simulation on load, matching the reference's running timeline.
    toggleSimulation();
  }

  function interpolateRoute(coords, progressKm) {
    if (coords.length < 2) return coords[0] || [112.75, -7.27];
    let left = Math.max(0, progressKm);
    for (let i = 1; i < coords.length; i++) {
      const segment = haversineKm(coords[i - 1], coords[i]);
      if (left <= segment || i === coords.length - 1) {
        const t = segment ? Math.min(1, left / segment) : 0;
        return [coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t,
                coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t];
      }
      left -= segment;
    }
    return coords[coords.length - 1];
  }

  function interpolateRouteCached(cache, progressKm) {
    const {coords,cumulative,length}=cache;
    if(coords.length<2) return coords[0] || [112.75,-7.27];
    let target=((progressKm%length)+length)%length;
    let low=1, high=cumulative.length-1;
    while(low<high){
      const mid=(low+high)>>1;
      if(cumulative[mid]<target) low=mid+1; else high=mid;
    }
    const i=low, segment=cumulative[i]-cumulative[i-1];
    const t=segment ? Math.max(0,Math.min(1,(target-cumulative[i-1])/segment)) : 0;
    return [coords[i-1][0]+(coords[i][0]-coords[i-1][0])*t,
            coords[i-1][1]+(coords[i][1]-coords[i-1][1])*t];
  }

  function getFleetConfig(routeKey) {
    const fleet = config.simulationFleet?.[routeKey];
    return fleet || { count: 4, basis: "Asumsi simulasi; jumlah resmi per rute belum terverifikasi" };
  }

  function getTotalSimulatedFleet() {
    return config.routes.reduce((sum, route) => sum + Math.max(1, Number(getFleetConfig(route.key).count) || 1), 0);
  }

  function createBusPopup(route, busId, fleet, speedKmh, marker) {
    if (state.activeBusPopup) state.activeBusPopup.remove();
    state.activeBusId = busId;
    const routeCache = state.routeAnimationCache.get(route.key);
    const routeEntry = state.routes.get(route.key);
    const routeKm = routeCache?.length ?? (routeEntry ? routeLengthKm(routeCoordinates(routeEntry.data)) : 0);
    const spacingKm = fleet.count > 0 ? routeKm / fleet.count : 0;
    const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: false, offset: 18, maxWidth: "290px" })
      .setLngLat(marker.getLngLat())
      .setHTML(`
        <div class="bus-popup-content">
          <div class="popup-kicker">SIMULASI ARMADA</div>
          <h3>${escapeHtml(busId.split("::").pop())}</h3>
          <p><strong>${escapeHtml(route.label)}</strong></p>
          <p>Kecepatan nominal: <strong>${speedKmh} km/jam</strong></p>
          <p>Armada simulasi koridor: <strong>${fleet.count} unit</strong></p>
          <p>Jarak rata-rata antar bus di sepanjang rute: <strong>${spacingKm.toFixed(1)} km</strong></p>
          <p class="bus-popup-destination">Posisi bergerak mengikuti geometri rute; bukan jadwal kedatangan.</p>
          <p class="simulation-warning">SIMULASI — bukan posisi bus sebenarnya atau data GPS real-time.</p>
          <p class="bus-popup-basis">${escapeHtml(fleet.basis || "Asumsi simulasi")}</p>
          ${fleet.sourceUrl ? '<p><a class="bus-source-link" href="' + escapeHtml(fleet.sourceUrl) + '" target="_blank" rel="noopener noreferrer">Lihat sumber armada ↗</a></p>' : ""}
        </div>`)
      .addTo(state.map);
    state.activeBusPopup = popup;
    popup.on("close", () => {
      if (state.activeBusPopup === popup) {
        state.activeBusPopup = null;
        state.activeBusId = null;
      }
    });
  }

  function getRouteStopDistances(routeKey, coords, routeLength) {
    if (state.busStopDistances.has(routeKey)) return state.busStopDistances.get(routeKey);
    const cumulative = [0];
    for (let i = 1; i < coords.length; i++) cumulative[i] = cumulative[i - 1] + haversineKm(coords[i - 1], coords[i]);
    const points = state.stops.filter(stop => stop.properties.__routeKey === routeKey);
    const distances = [];
    points.forEach(stop => {
      const point = stop.geometry.coordinates;
      let bestDistanceMeters = Infinity;
      let bestAlongKm = null;
      for (let i = 1; i < coords.length; i++) {
        const a = coords[i - 1], b = coords[i];
        const meanLat = (a[1] + b[1] + point[1]) / 3 * Math.PI / 180;
        const sx = 111.32 * Math.cos(meanLat);
        const sy = 110.57;
        const ax = a[0] * sx, ay = a[1] * sy;
        const bx = b[0] * sx, by = b[1] * sy;
        const px = point[0] * sx, py = point[1] * sy;
        const dx = bx - ax, dy = by - ay;
        const denom = dx * dx + dy * dy;
        const t = denom ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / denom)) : 0;
        const q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        const distanceMeters = haversineKm(point, q) * 1000;
        if (distanceMeters < bestDistanceMeters) {
          bestDistanceMeters = distanceMeters;
          bestAlongKm = cumulative[i - 1] + haversineKm(a, b) * t;
        }
      }
      // Stop points can sit slightly away from the digitized route centerline.
      if (bestAlongKm !== null && bestDistanceMeters <= 250) distances.push(bestAlongKm);
    });
    distances.sort((x, y) => x - y);
    const unique = distances.filter((value, index) => index === 0 || value - distances[index - 1] > 0.08);
    state.busStopDistances.set(routeKey, unique);
    return unique;
  }

  function animateBusMarkers(now) {
    if (!state.busAnimationOn || !state.busesVisible) { state.busFrame = null; return; }
    if (now - state.busLastRender < 33) {
      state.busFrame = requestAnimationFrame(animateBusMarkers);
      return;
    }
    state.busLastRender = now;
    if (!state.busLastTime) state.busLastTime = now;
    const elapsedMs = Math.min(250, now - state.busLastTime);
    const deltaHours = elapsedMs / 3600000 * state.busSpeedMultiplier;
    state.busLastTime = now;
    state.simulationMinutes = (state.simulationMinutes + elapsedMs / 1000 * state.busSpeedMultiplier * 0.5) % (24 * 60);
    const hh = String(Math.floor(state.simulationMinutes / 60)).padStart(2, "0");
    const mm = String(Math.floor(state.simulationMinutes % 60)).padStart(2, "0");
    if (byId("simulationClock")) byId("simulationClock").textContent = hh + ":" + mm;

    config.routes.forEach(route => {
      const entry = state.routes.get(route.key);
      const routeVisible = state.routeVisibility.get(route.key) !== false;
      if (!entry || !routeVisible || !state.busesVisible) {
        state.busMarkers.forEach((marker, busId) => {
          if (busId.startsWith(route.key + "::")) marker.getElement().style.visibility = "hidden";
          marker.getElement().style.pointerEvents = "none";
        });
        return;
      }
      const cache = state.routeAnimationCache.get(route.key);
      if (!cache || cache.coords.length < 2) return;
      const {coords,length,stopDistances} = cache;
      const fleet = getFleetConfig(route.key);
      const count = Math.max(1, Math.min(40, Number(fleet.count) || 1));
      const simulationMovementSpeed = route.key.startsWith("ww-") ? 15 : 20;
      const popupNominalSpeed = route.key.startsWith("ww-") ? 25 : 20;
      for (let i = 0; i < count; i++) {
        const busId = route.key + "::" + String(i + 1).padStart(2, "0");
        let marker = state.busMarkers.get(busId);
        if (!marker) {
          const el = document.createElement("button");
          el.type = "button";
          el.className = "bus-marker";
          el.textContent = "";
          el.style.background = route.color;
          el.setAttribute("aria-label", "Buka informasi bus simulasi " + (i + 1));
          el.title = "SIMULASI — klik untuk informasi bus";
          marker = new maplibregl.Marker({ element: el, anchor: "center" })
            .setLngLat(interpolateRouteCached(cache, length * i / count)).addTo(state.map);
          el.addEventListener("click", event => {
            event.stopPropagation();
            createBusPopup(route, busId, fleet, popupNominalSpeed, marker);
          });
          state.busMarkers.set(busId, marker);
          state.busProgress.set(busId, length * i / count);
        }
        marker.getElement().style.visibility = "visible";
        marker.getElement().style.pointerEvents = "auto";
        const previousProgress = state.busProgress.get(busId) || 0;
        const stopsAlongRoute = stopDistances;
        const waitState = state.busStopWait.get(busId);
        let progress = previousProgress;
        if (waitState && waitState.remainingMs > 0) {
          waitState.remainingMs -= elapsedMs;
          progress = waitState.stopProgress;
          if (waitState.remainingMs <= 0) state.busStopWait.delete(busId);
        } else {
          const proposed = previousProgress + simulationMovementSpeed * deltaHours;
          let nextStop = null;
          if (length > 0) {
            for (const stopDistance of stopsAlongRoute) {
              const ahead = stopDistance > previousProgress + 0.001 && stopDistance <= proposed + 0.001;
              const wrapped = proposed >= length && stopDistance <= (proposed % length);
              if (ahead || wrapped) { nextStop = stopDistance; break; }
            }
          }
          if (nextStop !== null) {
            progress = nextStop;
            state.busStopWait.set(busId, { stopProgress: nextStop, remainingMs: 2200 });
          } else {
            progress = length > 0 ? proposed % length : proposed;
          }
        }
        state.busProgress.set(busId, progress);
        marker.setLngLat(interpolateRouteCached(cache, progress));
        if (state.activeBusPopup && state.activeBusId === busId) state.activeBusPopup.setLngLat(marker.getLngLat());
      }
    });
    if (byId("simBusCount")) byId("simBusCount").textContent = getTotalSimulatedFleet() + " bus";
    state.busFrame = requestAnimationFrame(animateBusMarkers);
  }

  async function setupCoverage(failures) {
    // Radius buffers are generated dynamically from the loaded stop points.
    // Do not require an external coverage GeoJSON for this layer.
    return;
    const toggle = byId("coverageToggle");
    if (!config.coverage?.enabled) {
      toggle.disabled = true;
      return;
    }
    try {
      const data = await loadGeoJSON(config.coverage.file);
      data.features = data.features.map(feature => {
        const properties = { ...(feature.properties || {}) };
        const routeId = properties.Route_Id ?? properties.route_id ?? properties.Route_Id_1 ?? "";
        properties.__routeKey = matchRoute(routeId, null) || "";
        return { ...feature, properties };
      });
      state.map.addSource("stop-coverage", { type: "geojson", data });
      config.routes.forEach(route => {
        const fillId = "coverage-fill-" + route.key;
        const outlineId = "coverage-outline-" + route.key;
        const firstRouteLayer = state.routeLayerIds.get(config.routes[0]?.key)?.[0];
        state.map.addLayer({
          id: fillId,
          type: "fill",
          source: "stop-coverage",
          filter: ["==", ["get", "__routeKey"], route.key],
          paint: { "fill-color": route.color, "fill-opacity": 0.13 },
          layout: { visibility: "none" }
        }, firstRouteLayer);
        state.map.addLayer({
          id: outlineId,
          type: "line",
          source: "stop-coverage",
          filter: ["==", ["get", "__routeKey"], route.key],
          paint: { "line-color": route.color, "line-width": 1.2, "line-opacity": 0.72 },
          layout: { visibility: "none" }
        }, firstRouteLayer);
        const ids = state.routeLayerIds.get(route.key) || [];
        ids.push(fillId, outlineId);
        state.routeLayerIds.set(route.key, ids);
      });
      toggle.disabled = false;
      toggle.checked = false;
      byId("coverageToggle").addEventListener("change", event => {
        config.routes.forEach(route => {
          const isRouteVisible = state.routeVisibility.get(route.key) !== false;
          ["coverage-fill-" + route.key, "coverage-outline-" + route.key].forEach(id => {
            if (state.map.getLayer(id)) {
              state.map.setLayoutProperty(id, "visibility", event.target.checked && isRouteVisible ? "visible" : "none");
            }
          });
        });
      });
    } catch (error) {
      failures.push(error.message);
      toggle.disabled = true;
      console.warn("Data jangkauan halte belum tersedia:", error);
    }
  }

  function setupBuildings(failures) {
    const toggle = byId("buildingsToggle");
    if (!config.buildings.enabled) {
      byId("buildingStatus").textContent = "Belum diaktifkan · butuh PMTiles";
      toggle.disabled = true;
      return;
    }
    if (config.buildings.mode === "pmtiles") {
      if (!window.pmtiles) {
        failures.push("Pustaka PMTiles tidak tersedia");
        byId("buildingStatus").textContent = "Pustaka PMTiles gagal dimuat";
        return;
      }
      const absoluteUrl = new URL(config.buildings.file, document.baseURI).href;
      const sourceUrl = "pmtiles://" + absoluteUrl;
      state.map.addSource("buildings", { type: "vector", url: sourceUrl });
      addBuildingLayer(config.buildings.sourceLayer || "buildings");
    } else {
      loadGeoJSON(config.buildings.file).then(data => {
        state.map.addSource("buildings", { type: "geojson", data, maxzoom: 14 });
        addBuildingLayer(null);
        byId("buildingStatus").textContent = data.features.length.toLocaleString("id-ID") + " footprint";
        toggle.disabled = false;
      }).catch(error => {
        failures.push(error.message);
        byId("buildingStatus").textContent = "File bangunan tidak ditemukan";
      });
    }

    if (config.buildings.mode === "pmtiles") {
      // Aktifkan checkbox hanya bila pengguna sudah mengubah config dan tile berhasil dimuat.
      byId("buildingStatus").textContent = "Menunggu berkas bangunan.pmtiles";
      toggle.disabled = false;
    }

    function addBuildingLayer(sourceLayer) {
      const height = ["to-number", ["get", config.buildings.heightProperty || "LIDAR_MEAN"], 0];
      const layer = {
        id: "buildings-3d",
        type: "fill-extrusion",
        source: "buildings",
        minzoom: 12,
        paint: {
          "fill-extrusion-color": [
            "interpolate", ["linear"], height,
            0, "#354457", 5, "#50657e", 20, "#68829a", 60, "#9babc1"
          ],
          "fill-extrusion-height": ["max", 0.1, height],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.85,
          "fill-extrusion-vertical-gradient": true
        },
        layout: { visibility: "none" }
      };
      if (sourceLayer) layer["source-layer"] = sourceLayer;
      const firstRouteLayer = state.routeLayerIds.get(config.routes[0]?.key)?.[0];
      state.map.addLayer(layer, firstRouteLayer);
      state.buildingLayerAdded = true;
      state.map.on("click", "buildings-3d", (event) => {
        if (!event.features?.length) return;
        const properties = event.features[0].properties || {};
        const heightValue = properties[config.buildings.heightProperty || "LIDAR_MEAN"];
        const rows = [["Tinggi (LIDAR_MEAN)", heightValue == null ? "Tidak tersedia" : String(heightValue) + " m"]];
        ["building_id", "name", "area_m2", "floors"].forEach(key => {
          if (properties[key] != null) rows.push([key, properties[key]]);
        });
        new maplibregl.Popup({ offset: 8 }).setLngLat(event.lngLat)
          .setHTML(popupHtml("Footprint bangunan", properties.name || properties.building_id || "Bangunan Surabaya", rows))
          .addTo(state.map);
      });
      state.map.on("mouseenter", "buildings-3d", () => state.map.getCanvas().style.cursor = "pointer");
      state.map.on("mouseleave", "buildings-3d", () => state.map.getCanvas().style.cursor = state.finderMode ? "crosshair" : "");
      toggle.addEventListener("change", (event) => {
        if (state.map.getLayer("buildings-3d")) {
          state.map.setLayoutProperty("buildings-3d", "visibility", event.target.checked ? "visible" : "none");
        }
      });
      byId("buildingStatus").textContent = "Siap · aktifkan untuk tampilkan";
    }
  }

  function wireRouteSearch() {
    routeSearch.addEventListener("input", () => {
      const query = normalize(routeSearch.value);
      routeList.querySelectorAll(".route-item").forEach(item => {
        item.hidden = !!query && !item.dataset.search.includes(query);
      });
      updateRouteGroupHeadings();
    });
  }

  function setupMapEvents() {
    // Handler umum dipasang saat peta siap. Handler layer bangunan dipasang
    // setelah layer tersebut benar-benar tersedia di style MapLibre.
    state.map.on("click", (event) => {
      const rendered = state.map.queryRenderedFeatures(event.point);
      const routeLayerIds = new Set([...state.routeLayerIds.values()].flat());
      const clickedTransitFeature = rendered.some(feature => {
        const id = feature.layer?.id || "";
        return id.startsWith("stops-") || id === "stop-labels" || routeLayerIds.has(id);
      });
      if (clickedTransitFeature) return;
      findNearestStop([event.lngLat.lng, event.lngLat.lat]);
    });
  }

  function setupControls() {
    byId("closeMapDetail").addEventListener("click", () => {
      byId("mapDetailPanel").hidden = true;
      state.selectedStop = null;
      refreshSelectedBuffer();
    });
    byId("fitAllRoutesButton").addEventListener("click", fitAllRoutes);
    nearestButton.addEventListener("click", () => {
      state.finderMode = !state.finderMode;
      nearestButton.classList.toggle("active", state.finderMode);
      nearestButton.innerHTML = state.finderMode ? "<span>×</span> Batal memilih lokasi" : "<span>⌖</span> Pilih lokasi di peta";
      state.map.getCanvas().style.cursor = state.finderMode ? "crosshair" : "";
      if (state.finderMode) {
        nearestResult.innerHTML = '<div class="result-placeholder"><span class="pin-outline">⌖</span><span>Klik titik mana pun pada peta untuk mencari halte terdekat.</span></div>';
      }
    });

    byId("tiltButton").addEventListener("click", () => {
      const is3D = state.map.getPitch() > 20;
      state.map.easeTo({ pitch: is3D ? 0 : config.map.pitch, bearing: is3D ? 0 : config.map.bearing, duration: 700 });
      byId("tiltButton").innerHTML = is3D ? "2D <span>⌄</span>" : "3D <span>⌄</span>";
    });

    byId("resetView").addEventListener("click", () => fitAllRoutes());

    byId("clearSearch").addEventListener("click", () => {
      stopSearch.value = "";
      if (state.map.getLayer("stop-search-highlight")) {
        state.map.setFilter("stop-search-highlight", ["==", ["get", "__routeKey"], "__none__"]);
      }
    });

    stopSearch.addEventListener("keydown", event => {
      if (event.key === "Enter") searchStop(stopSearch.value);
    });

    byId("locateButton").addEventListener("click", () => {
      if (!navigator.geolocation) {
        nearestResult.innerHTML = '<div class="result-placeholder">Browser tidak mendukung lokasi perangkat.</div>';
        return;
      }
      navigator.geolocation.getCurrentPosition(
        position => findNearestStop([position.coords.longitude, position.coords.latitude]),
        () => { nearestResult.innerHTML = '<div class="result-placeholder">Lokasi tidak tersedia. Izinkan akses lokasi atau klik lokasi pada peta.</div>'; },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });

    byId("openSidebar").addEventListener("click", () => byId("sidebar").classList.add("open"));
    byId("closeSidebar").addEventListener("click", () => byId("sidebar").classList.remove("open"));

    document.addEventListener("keydown", event => {
      if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
        event.preventDefault(); routeSearch.focus();
      }
      if (event.key === "Escape") {
        state.finderMode = false;
        nearestButton.classList.remove("active");
        nearestButton.innerHTML = "<span>⌖</span> Pilih lokasi di peta";
        state.map.getCanvas().style.cursor = "";
      }
    });
  }

  function searchStop(queryText) {
    const query = normalize(queryText);
    if (!query) return;
    const candidates = buildStopGroups().map(group => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: group.center },
      properties: {
        __stopName: group.displayName,
        __routeKey: group.routeKeys[0] || "",
        __routeKeys: group.routeKeys,
        __memberCount: group.members.length,
        __memberStops: group.members.map(member => ({
          name: formatStopName(member.properties.__stopName || "tanpa nama"),
          routeKey: member.properties.__routeKey || "",
          routeId: member.properties.__rawRouteId || "",
          id: member.properties.Id ?? member.properties.id ?? "—",
          coordinates: member.geometry.coordinates
        }))
      }
    })).filter(feature => normalize(feature.properties.__stopName).includes(query));
    if (!candidates.length) {
      nearestResult.innerHTML = '<div class="result-placeholder">Nama halte tidak ditemukan. Pastikan data halte sudah dimuat.</div>';
      return;
    }
    const feature = candidates[0];
    const coord = feature.geometry.coordinates;
    state.map.flyTo({ center: coord, zoom: 16, pitch: config.map.pitch, duration: 900 });
    showStopDetails(feature);
    state.finderMode = false;
    nearestButton.classList.remove("active");
    nearestButton.innerHTML = "<span>⌖</span> Pilih lokasi di peta";
    state.map.getCanvas().style.cursor = "";
  }

  function haversineMeters(a, b) {
    const rad = value => value * Math.PI / 180;
    const [lon1, lat1] = a; const [lon2, lat2] = b;
    const dLat = rad(lat2 - lat1); const dLon = rad(lon2 - lon1);
    const value = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }

  function decodePolyline6(encoded) {
    let index = 0, lat = 0, lon = 0;
    const coordinates = [];
    while (index < encoded.length) {
      let result = 0, shift = 0, byte;
      do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
      const deltaLat = result & 1 ? ~(result >> 1) : (result >> 1);
      lat += deltaLat;
      result = 0; shift = 0;
      do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
      const deltaLon = result & 1 ? ~(result >> 1) : (result >> 1);
      lon += deltaLon;
      coordinates.push([lon / 1e6, lat / 1e6]);
    }
    return coordinates;
  }

  async function getWalkingRoute(from, to) {
    const response = await fetch(config.walking.serviceUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Client-Id": "transum-surabaya-webgis" },
      body: JSON.stringify({
        locations: [
          { lat: from[1], lon: from[0] },
          { lat: to[1], lon: to[0] }
        ],
        costing: "pedestrian",
        units: "kilometers",
        directions_options: { units: "kilometers" }
      })
    });
    if (!response.ok) throw new Error("Layanan routing mengembalikan HTTP " + response.status);
    const data = await response.json();
    const leg = data.trip?.legs?.[0];
    if (!leg || !leg.shape) throw new Error("Rute berjalan kaki tidak tersedia");
    const summary = leg.summary || {};
    return {
      coordinates: decodePolyline6(leg.shape),
      distanceKm: Number(summary.length),
      durationMinutes: Number(summary.time) / 60
    };
  }

  async function findNearestStop(origin) {
    if (!state.stops.length) {
      nearestResult.innerHTML = '<div class="result-placeholder">Data halte belum dimuat. Unggah GeoJSON halte terlebih dahulu.</div>';
      return;
    }
    state.finderMode = false;
    nearestButton.classList.remove("active");
    nearestButton.innerHTML = "<span>⌖</span> Pilih lokasi di peta";
    state.map.getCanvas().style.cursor = "";
    nearestResult.innerHTML = '<div class="loading-row"><span class="mini-spinner"></span> Menghitung halte dan rute berjalan kaki…</div>';

    if (state.clickMarker) state.clickMarker.remove();
    state.clickMarker = new maplibregl.Marker({ color: "#f8fafc" }).setLngLat(origin).addTo(state.map);

    const groupedStops = buildStopGroups().map(group => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: group.center },
      properties: {
        __stopName: group.displayName,
        __routeKey: group.routeKeys[0] || "",
        __routeKeys: group.routeKeys,
        __rawRouteId: group.routeIds.join(" · "),
        __memberCount: group.members.length
      }
    }));
    const nearby = groupedStops.map(feature => ({
      feature,
      straightMeters: haversineMeters(origin, feature.geometry.coordinates)
    })).sort((a, b) => a.straightMeters - b.straightMeters)
      .slice(0, Math.max(1, Number(config.walking.candidateStops) || 3));

    let best = null;
    let routingFailed = false;
    try {
      const results = await Promise.all(nearby.map(async (candidate) => {
        const route = await getWalkingRoute(origin, candidate.feature.geometry.coordinates);
        return { ...candidate, route };
      }));
      best = results.filter(item => Number.isFinite(item.route.distanceKm))
        .sort((a, b) => a.route.distanceKm - b.route.distanceKm)[0] || null;
    } catch (error) {
      routingFailed = true;
      console.warn("Routing berjalan kaki tidak tersedia:", error);
    }

    if (!best) {
      best = nearby[0];
      const km = best.straightMeters / 1000;
      best.route = {
        distanceKm: km,
        durationMinutes: (km / (Number(config.walking.fallbackWalkingSpeedKmh) || 4.5)) * 60,
        coordinates: [origin, best.feature.geometry.coordinates]
      };
    }

    state.selectedStop = best.feature;
    const bufferToggle = byId("coverageToggle");
    if (bufferToggle && !bufferToggle.checked) {
      bufferToggle.checked = true;
      ["stop-circle-buffer-fill", "stop-circle-buffer-outline"].forEach(id => {
        if (state.map.getLayer(id)) state.map.setLayoutProperty(id, "visibility", "visible");
      });
    }
    refreshSelectedBuffer();
    drawWalkingRoute(best.route.coordinates);
    const stopCoord = best.feature.geometry.coordinates;
    const coordsAreValid = Array.isArray(origin) && Array.isArray(stopCoord) &&
      Number.isFinite(origin[0]) && Number.isFinite(origin[1]) &&
      Number.isFinite(stopCoord[0]) && Number.isFinite(stopCoord[1]) &&
      origin[0] >= 112.0 && origin[0] <= 113.5 && origin[1] >= -8.0 && origin[1] <= -6.5 &&
      stopCoord[0] >= 112.0 && stopCoord[0] <= 113.5 && stopCoord[1] >= -8.0 && stopCoord[1] <= -6.5;
    const currentZoom = state.map.getZoom();
    // Clicking "nearby" from a stop can produce identical origin/destination coordinates.
    // Never fit a degenerate/small bounds; fly to the stop at a stable, readable city zoom.
    if (!coordsAreValid) {
      state.map.flyTo({ center: config.map.center, zoom: config.map.zoom, pitch: config.map.pitch, bearing: config.map.bearing, duration: 700 });
    } else if (best.straightMeters < 120) {
      state.map.flyTo({
        center: stopCoord,
        zoom: Math.max(14, Math.min(16, currentZoom)),
        pitch: config.map.pitch,
        bearing: config.map.bearing,
        duration: 700
      });
    } else if (best.straightMeters <= 1500) {
      const safeBounds = new maplibregl.LngLatBounds(origin, stopCoord);
      const sw = safeBounds.getSouthWest();
      const ne = safeBounds.getNorthEast();
      const lngSpan = ne.lng - sw.lng;
      const latSpan = ne.lat - sw.lat;
      if (lngSpan > 0.0002 && latSpan > 0.0002 && lngSpan < 0.04 && latSpan < 0.04) {
        state.map.fitBounds(safeBounds, {
          padding: { top: 110, bottom: 110, left: 370, right: 90 }, maxZoom: 15, duration: 700
        });
      } else {
        state.map.flyTo({ center: stopCoord, zoom: 14, pitch: config.map.pitch, bearing: config.map.bearing, duration: 700 });
      }
    } else {
      state.map.flyTo({ center: stopCoord, zoom: 14, pitch: config.map.pitch, bearing: config.map.bearing, duration: 700 });
    }

    const props = best.feature.properties || {};
    const nearestRouteKeys = Array.isArray(props.__routeKeys) ? props.__routeKeys : [props.__routeKey].filter(Boolean);
    const nearestRoutes = [...new Set(nearestRouteKeys)].map(key => ({
      key, label: routeNameByKey(key), color: config.routes.find(route => route.key === key)?.color || "#38BDF8"
    }));
    const distance = best.route.distanceKm * 1000;
    const distanceText = distance >= 1000 ? (distance / 1000).toFixed(2) + " km" : Math.round(distance) + " m";
    const timeText = Math.max(1, Math.round(best.route.durationMinutes)) + " menit";
    const note = routingFailed
      ? "Routing jaringan tidak dapat dijangkau. Jarak yang ditampilkan adalah garis lurus; waktu hanya perkiraan kasar."
      : "Jarak dan durasi dihitung menggunakan rute pejalan kaki OpenStreetMap/Valhalla; kondisi trotoar dan hambatan lapangan mungkin berbeda.";
    nearestResult.innerHTML = `
      <div class="result-card">
        <h3>${escapeHtml(props.__stopName || "Halte terdekat")}</h3>
        <p class="result-route">${escapeHtml(routeNameByKey(props.__routeKey))}</p>
        <div class="result-metrics">
          <div class="metric"><strong>${escapeHtml(distanceText)}</strong><small>Jarak berjalan kaki</small></div>
          <div class="metric"><strong>${escapeHtml(timeText)}</strong><small>Perkiraan waktu</small></div>
        </div>
        <p class="result-note">${escapeHtml(note)}</p>
        <button id="clearNearest" class="toolbar-button" style="margin-top:9px;width:100%;justify-content:center">Hapus hasil</button>
      </div>`;
    byId("mapDetailKicker").textContent = "HALTE TERDEKAT";
    byId("mapDetailTitle").textContent = props.__stopName || "Halte terdekat";
    byId("mapDetailContent").innerHTML = `
      <div class="route-metrics">
        <div class="route-metric"><strong>${escapeHtml(distanceText)}</strong><small>jarak ${routingFailed ? "garis lurus" : "berjalan kaki"}</small></div>
        <div class="route-metric"><strong>${escapeHtml(timeText)}</strong><small>estimasi jalan kaki</small></div>
      </div>
      <div class="route-stop-heading">Dilayani koridor (${nearestRoutes.length})</div>
      <div class="served-route-list">${nearestRoutes.map(route => '<div class="served-route-chip" style="--route-color:' + route.color + '">' + escapeHtml(route.label) + '</div>').join("")}</div>
      <p class="result-note">${escapeHtml(note)}</p>
      <button id="clearNearestFromPanel" class="toolbar-button" style="width:100%;justify-content:center">× Hapus hasil pencarian</button>`;
    byId("mapDetailPanel").hidden = false;
    const clearNearestResult = () => {
      if (state.clickMarker) state.clickMarker.remove();
      state.clickMarker = null;
      clearWalkingRoute();
      byId("mapDetailPanel").hidden = true;
      if (byId("mapHelpPanel")) byId("mapHelpPanel").hidden = false;
      nearestResult.innerHTML = '<div class="result-placeholder"><span class="pin-outline">◎</span><span>Klik peta untuk mencari halte terdekat.</span></div>';
    };
    byId("clearNearest").addEventListener("click", clearNearestResult);
    byId("clearNearestFromPanel").addEventListener("click", clearNearestResult);
  }

  function drawWalkingRoute(coordinates) {
    if (state.map.getLayer("walking-route-line")) state.map.removeLayer("walking-route-line");
    if (state.map.getLayer("walking-route-casing")) state.map.removeLayer("walking-route-casing");
    if (state.map.getSource("walking-route")) state.map.removeSource("walking-route");
    state.map.addSource("walking-route", {
      type: "geojson",
      data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } }
    });
    state.map.addLayer({
      id: "walking-route-casing", type: "line", source: "walking-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#FFFFFF", "line-width": 6, "line-opacity": .88 }
    });
    state.map.addLayer({
      id: "walking-route-line", type: "line", source: "walking-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#F43F5E", "line-width": 3.5, "line-dasharray": [1.2, 1.2] }
    });
    state.walkingLayerAdded = true;
  }

  function clearWalkingRoute() {
    ["walking-route-line", "walking-route-casing"].forEach(id => {
      if (state.map.getLayer(id)) state.map.removeLayer(id);
    });
    if (state.map.getSource("walking-route")) state.map.removeSource("walking-route");
    state.walkingLayerAdded = false;
  }

  createMap();
})();
