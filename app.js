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
    routeVisibility: new Map(),
    routeLayerIds: new Map(),
    stopsVisible: true,
    buildingLayerAdded: false,
    finderMode: false,
    clickMarker: null,
    walkingLayerAdded: false,
    activePopup: null
  };

  if (!window.maplibregl || !config) {
    showError("Pustaka peta atau konfigurasi tidak ditemukan. Periksa koneksi internet dan file config.js.");
    return;
  }

  const normalize = (value) => String(value ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "");

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

  function setStatus(message) {
    loadStatus.textContent = message;
  }

  async function loadGeoJSON(path) {
    const response = await fetch(path, { cache: "no-cache" });
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
    const item = document.createElement("label");
    item.className = "route-item";
    item.dataset.search = normalize(route.label);
    item.innerHTML = `
      <span class="route-line-swatch" style="background:${route.color}"></span>
      <span class="route-copy">
        <strong>${escapeHtml(route.label)}</strong>
        <small>Rute ${String(index + 1).padStart(2, "0")} · <span id="route-count-${route.key}">memuat…</span> fitur garis</small>
      </span>
      <input type="checkbox" checked aria-label="Tampilkan ${escapeHtml(route.label)}" data-route-toggle="${route.key}">
      <span class="route-check">✓</span>`;
    routeList.appendChild(item);

    const checkbox = item.querySelector("input");
    checkbox.addEventListener("change", () => {
      state.routeVisibility.set(route.key, checkbox.checked);
      updateRouteVisibility(route.key);
      updateRouteCounter();
    });
    item.addEventListener("dblclick", () => zoomToRoute(route.key));
  }

  function updateRouteCounter() {
    const shown = config.routes.filter(route => state.routeVisibility.get(route.key) !== false).length;
    byId("routeCount").textContent = shown + "/" + config.routes.length;
  }

  function updateRouteVisibility(routeKey) {
    const visible = state.routeVisibility.get(routeKey) !== false;
    const ids = state.routeLayerIds.get(routeKey) || [];
    if (!state.map) return;
    ids.forEach((id) => {
      if (state.map.getLayer(id)) state.map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    });
    state.stops.forEach((feature) => {
      if (feature.properties.__routeKey === routeKey) feature.properties.__routeVisible = visible;
    });
    refreshStopsSource();
  }

  function refreshStopsSource() {
    if (!state.map || !state.map.getSource("all-stops")) return;
    const features = state.stops.map(feature => {
      const copy = structuredClone(feature);
      const routeVisible = copy.properties.__routeKey
        ? state.routeVisibility.get(copy.properties.__routeKey) !== false
        : true;
      copy.properties.__showStop = state.stopsVisible && routeVisible ? 1 : 0;
      return copy;
    });
    state.map.getSource("all-stops").setData({ type: "FeatureCollection", features });
  }

  function zoomToRoute(routeKey) {
    const entry = state.routes.get(routeKey);
    if (!entry || !entry.bounds || !state.map) return;
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

  function createMap() {
    if (window.pmtiles && window.maplibregl.addProtocol) {
      const protocol = new pmtiles.Protocol();
      maplibregl.addProtocol("pmtiles", protocol.tile);
    }

    state.map = new maplibregl.Map({
      container: "map",
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: config.map.center,
      zoom: config.map.zoom,
      pitch: config.map.pitch,
      bearing: config.map.bearing,
      maxPitch: 75,
      attributionControl: false,
      canvasContextAttributes: { antialias: true }
    });

    state.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    state.map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: "metric" }), "bottom-left");

    state.map.on("load", () => {
      setStatus("Peta dasar siap");
      addLoadedData();
      setupMapEvents();
      setupControls();
    });
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
          const feature = event.features?.[0];
          const routeId = feature?.properties?.Route_Id ?? feature?.properties?.route_id ?? route.label;
          const popup = new maplibregl.Popup({ offset: 10, closeButton: true })
            .setLngLat(event.lngLat)
            .setHTML(popupHtml("Rute bus", route.label, [["Route_Id", routeId]]))
            .addTo(state.map);
          state.activePopup = popup;
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
    if (hasBounds) state.map.fitBounds(allBounds, { padding: { top: 95, bottom: 85, left: 370, right: 60 }, maxZoom: 12.8, duration: 900 });

    if (failures.length) {
      setStatus("Peta siap · data belum lengkap");
      showError("Peta dasar sudah tampil, tetapi beberapa GeoJSON belum ditemukan atau tidak terbaca. Unggah berkas menggunakan nama yang tercantum di folder README, lalu muat ulang website. Detail teknis ada di console browser.");
      console.warn("Berkas data belum tersedia:", failures);
    } else {
      hideError();
      setStatus("5 rute · data siap");
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
          const name = properties.Halte_nama ?? properties.halte_nama ?? properties.stop_name ?? properties.name ?? "Halte tanpa nama";
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

    config.routes.forEach(route => {
      const layerId = "stops-" + route.key;
      state.map.addLayer({
        id: layerId, type: "circle", source: "all-stops",
        filter: ["all", ["==", ["get", "__routeKey"], route.key], ["==", ["get", "__showStop"], 1]],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2.5, 14, 5.5],
          "circle-color": route.color,
          "circle-stroke-color": "#08101d",
          "circle-stroke-width": 1.4,
          "circle-opacity": 0.98
        }
      });
      state.map.on("click", layerId, (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const p = feature.properties || {};
        const routeLabel = routeNameByKey(p.__routeKey);
        const rows = [];
        if (p.__rawRouteId) rows.push(["Route_Id", p.__rawRouteId]);
        rows.push(["Stop ID", p.stop_id ?? p.Stop_Id ?? p.Id ?? p.id ?? "Tidak tersedia"]);
        const popup = new maplibregl.Popup({ offset: 9, closeButton: true })
          .setLngLat(event.lngLat)
          .setHTML(popupHtml("Informasi halte", p.__stopName || "Halte tanpa nama", rows.concat([["Koridor", routeLabel]])))
          .addTo(state.map);
        state.activePopup = popup;
      });
      state.map.on("mouseenter", layerId, () => state.map.getCanvas().style.cursor = "pointer");
      state.map.on("mouseleave", layerId, () => state.map.getCanvas().style.cursor = state.finderMode ? "crosshair" : "");
    });

    byId("stopsToggle").addEventListener("change", (event) => {
      state.stopsVisible = event.target.checked;
      refreshStopsSource();
    });
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
      state.map.addLayer(layer);
      state.buildingLayerAdded = true;
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
    });
  }

  function setupMapEvents() {
    state.map.on("click", (event) => {
      if (state.finderMode) findNearestStop([event.lngLat.lng, event.lngLat.lat]);
    });

    state.map.on("click", "buildings-3d", (event) => {
      if (!state.buildingLayerAdded || !event.features?.length) return;
      const properties = event.features[0].properties || {};
      const height = properties[config.buildings.heightProperty || "LIDAR_MEAN"];
      const rows = [["Tinggi (LIDAR_MEAN)", height == null ? "Tidak tersedia" : String(height) + " m"]];
      ["building_id", "name", "area_m2", "floors"].forEach(key => {
        if (properties[key] != null) rows.push([key, properties[key]]);
      });
      new maplibregl.Popup({ offset: 8 }).setLngLat(event.lngLat)
        .setHTML(popupHtml("Footprint bangunan", properties.name || properties.building_id || "Bangunan Surabaya", rows))
        .addTo(state.map);
    });

    state.map.on("mouseenter", "buildings-3d", () => state.map.getCanvas().style.cursor = "pointer");
    state.map.on("mouseleave", "buildings-3d", () => state.map.getCanvas().style.cursor = state.finderMode ? "crosshair" : "");
  }

  function setupControls() {
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

    byId("resetView").addEventListener("click", () => {
      state.map.flyTo({ center: config.map.center, zoom: config.map.zoom, pitch: config.map.pitch, bearing: config.map.bearing, duration: 900 });
    });

    byId("clearSearch").addEventListener("click", () => {
      stopSearch.value = "";
      state.map.setFilter("stop-search-highlight", ["==", ["get", "__searchHighlight"], ""]);
      // Hapus tanda hasil pencarian dengan mengembalikan style lingkaran.
      if (state.map.getLayer("stop-search-highlight")) state.map.setFilter("stop-search-highlight", ["==", ["get", "__routeKey"], "__none__"]);
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
    const candidates = state.stops.filter(feature => normalize(feature.properties.__stopName).includes(query));
    if (!candidates.length) {
      nearestResult.innerHTML = '<div class="result-placeholder">Nama halte tidak ditemukan. Pastikan data halte sudah dimuat.</div>';
      return;
    }
    const feature = candidates[0];
    const coord = feature.geometry.coordinates;
    state.map.flyTo({ center: coord, zoom: 16, pitch: config.map.pitch, duration: 900 });
    new maplibregl.Popup({ offset: 10 })
      .setLngLat(coord)
      .setHTML(popupHtml("Hasil pencarian", feature.properties.__stopName, [["Koridor", routeNameByKey(feature.properties.__routeKey)], ["Route_Id", feature.properties.__rawRouteId || "—"]]))
      .addTo(state.map);
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
      headers: { "Content-Type": "application/json" },
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

    const nearby = state.stops.map(feature => ({
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

    drawWalkingRoute(best.route.coordinates);
    state.map.fitBounds(new maplibregl.LngLatBounds(origin, best.feature.geometry.coordinates), {
      padding: { top: 110, bottom: 110, left: 370, right: 90 }, maxZoom: 16, duration: 700
    });

    const props = best.feature.properties || {};
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
    byId("clearNearest").addEventListener("click", () => {
      if (state.clickMarker) state.clickMarker.remove();
      state.clickMarker = null;
      clearWalkingRoute();
      nearestResult.innerHTML = '<div class="result-placeholder"><span class="pin-outline">◎</span><span>Klik peta untuk memulai pencarian halte.</span></div>';
    });
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
      paint: { "line-color": "#07101e", "line-width": 8, "line-opacity": .9 }
    });
    state.map.addLayer({
      id: "walking-route-line", type: "line", source: "walking-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#50e3c2", "line-width": 4, "line-dasharray": [1.3, 1.1] }
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
