/*
 * Konfigurasi data WebGIS Transum Surabaya.
 * Nama berkas di sini harus sama persis dengan nama file yang diunggah ke repository.
 * Route_Id dipakai untuk menghubungkan layer rute dan halte; nama halte berasal dari Halte_name atau Halte_nama.
 */
window.TRANSUM_CONFIG = {
  routes: [
    {
      key: "sby-purabaya-unair",
      label: "Suroboyo Bus · Terminal Purabaya–UNAIR Kampus C",
      file: "rute/Bus_Suroboyo_Terminal Purabaya - UNAIR Kampus C.geojson",
      color: "#F97316",
      routeValues: ["Terminal Purabaya - UNAIR Kampus C", "Purabaya-UNAIR Kampus C", "Purabaya-Unair"]
    },
    {
      key: "ww-pnr-balai-kota",
      label: "Wira Wiri · PNR–Balai Kota",
      file: "rute/WiraWiri_PNR-Balai Kota.geojson",
      color: "#E879F9",
      routeValues: ["PNR-Balai Kota", "PNR - Balai Kota", "PNR Balai Kota"]
    },
    {
      key: "ww-bratang-pasarturi",
      label: "Wira Wiri · Terminal Bratang–Stasiun Pasar Turi",
      file: "rute/WiraWiri_Terminal Bratang- St Pasar Turi.geojson",
      color: "#FACC15",
      routeValues: ["Terminal Bratang- St Pasar Turi", "Terminal Bratang - St Pasar Turi", "Bratang-Pasar Turi"]
    },
    {
      key: "sby-benowo",
      label: "Suroboyo Bus · Benowo–Tunjungan",
      file: "rute/Bus_Suroboyo_Benowo-Tunjungan.geojson",
      color: "#F59E0B",
      routeValues: ["Benowo-Tunjungan", "Terminal Benowo-Tunjungan"]
    },
    {
      key: "sby-kejawan",
      label: "Suroboyo Bus · Kejawan Putih–ITS–UNESA",
      file: "rute/Bus_Suroboyo_Kejawan Putih- ITS-Unesa.geojson",
      color: "#38BDF8",
      routeValues: ["Kejawan Putih-Unesa", "Kejawan Putih-ITS-Unesa", "Kejawan Putih- ITS-Unesa"]
    },
    {
      key: "sby-purabaya",
      label: "Suroboyo Bus · Purabaya–Rajawali",
      file: "rute/Bus_Suroboyo_Purabaya-Rajawali.geojson",
      color: "#A78BFA",
      routeValues: ["Purabaya-Rajawali"]
    },
    {
      key: "ww-gunung-anyar",
      label: "Wira Wiri · Gunung Anyar–ITS–Kenpark",
      file: "rute/WiraWiri_Gunung Anyar-ITS-Kenpark.geojson",
      color: "#FB7185",
      routeValues: ["Gunung Anyar-ITS-Kenpark", "Gnanyar-ITS-Kenpark"]
    },
    {
      key: "ww-tow",
      label: "Wira Wiri · TOW–UNESA",
      file: "rute/WiraWiri_TOW-UNESA.geojson",
      color: "#34D399",
      routeValues: ["TOW-UNESA"]
    }
    ,
    { key: "ww-bratang-bulak", label: "Wira Wiri · Terminal Bratang–Shelter Bulak", file: "rute/WiraWiri_Bratang-Shelter_Bulak.geojson", color: "#FBBF24", routeValues: ["Terminal_Bratang-Shelter_Bulak","Bratang-Shelter_Bulak"] },
    { key: "ww-mayjend-sungkono", label: "Wira Wiri · Mayjend Sungkono–RSUD BDH", file: "rute/WiraWiri_Mayjend_Sungkono-RSUD_BDH.geojson", color: "#FB7185", routeValues: ["Mayjend_Sungkono-RSUD_BDH","Mayjend_Sungkono-RSUD_BDH_1"] },
    { key: "ww-sier-kotalama", label: "Wira Wiri · SIER–Kota Lama", file: "rute/WiraWiri_SIER-Kota_Lama.geojson", color: "#A78BFA", routeValues: ["SIER-Kota_Lama"] },
    { key: "ww-tij-gununganyar", label: "Wira Wiri · TIJ–Gunung Anyar", file: "rute/WiraWiri_TIJ-Gunung_Anyar.geojson", color: "#22D3EE", routeValues: ["TIJ-Gunung-Anyar","TIJ-Gunung_Anyar"] },
    { key: "ww-tij-lakarsantri", label: "Wira Wiri · TIJ–Lakarsantri", file: "rute/WiraWiri_TIJ-Lakarsantri.geojson", color: "#84CC16", routeValues: ["TIJ-Lakarsantri"] },
    { key: "ww-keputih-bunguran", label: "Wira Wiri · Terminal Keputih–Bunguran", file: "rute/WiraWiri_Terminal_Keputih-Bunguran.geojson", color: "#F472B6", routeValues: ["Terminal_Keputih-Bunguran"] }
  ],

  stops: [
    {
      key: "stops-bus-purabaya-unair",
      file: "halte/halte_bus_Terminal Purabaya - UNAIR Kampus C.geojson",
      fallbackRouteKey: "sby-purabaya-unair"
    },
    {
      key: "stops-wira-pnr-balai-kota",
      file: "halte/halte_wirawiri_PNR-Balai Kota.geojson",
      fallbackRouteKey: "ww-pnr-balai-kota"
    },
    {
      key: "stops-wira-bratang-pasarturi",
      file: "halte/halte_wirawiri_Terminal Bratang- St Pasar Turi.geojson",
      fallbackRouteKey: "ww-bratang-pasarturi"
    },
    {
      key: "stops-bus-kejawan",
      file: "halte/halte_bus_Kejawan Putih-Unesa.geojson",
      fallbackRouteKey: "sby-kejawan"
    },
    {
      key: "stops-bus-benowo",
      file: "halte/halte_bus_Terminal Benowo-Tunjungan.geojson",
      fallbackRouteKey: "sby-benowo"
    },
    {
      key: "stops-bus-purabaya",
      file: "halte/halte_bus_Purabaya-Rajawali.geojson",
      fallbackRouteKey: "sby-purabaya"
    },
    {
      key: "stops-wira-gunung",
      file: "halte/halte_wirawiri_Gnanyar-ITS-Kenpark.geojson",
      fallbackRouteKey: "ww-gunung-anyar"
    },
    {
      key: "stops-wira-tow",
      file: "halte/halte_wirawiri_TOW-Unesa.geojson",
      fallbackRouteKey: "ww-tow"
    },
    { key: "stops-wira-mayjend-sungkono", file: "halte/halte_wirawiri_Mayjend_Sungkono-RSUD_BDH.geojson", fallbackRouteKey: "ww-mayjend-sungkono" },
    { key: "stops-wira-sier-kotalama", file: "halte/halte_wirawiri_SIER-Kota_Lama.geojson", fallbackRouteKey: "ww-sier-kotalama" },
    { key: "stops-wira-tij-gununganyar", file: "halte/halte_wirawiri_TIJ-Gunung_Anyar.geojson", fallbackRouteKey: "ww-tij-gununganyar" },
    { key: "stops-wira-tij-lakarsantri", file: "halte/halte_wirawiri_TIJ-Lakarsantri.geojson", fallbackRouteKey: "ww-tij-lakarsantri" },
    { key: "stops-wira-bratang-bulak", file: "halte/halte_wirawiri_Terminal_Bratang-Shelter_Bulak.geojson", fallbackRouteKey: "ww-bratang-bulak" },
    { key: "stops-wira-keputih-bunguran", file: "halte/halte_wirawiri_Terminal_Keputih-Bunguran.geojson", fallbackRouteKey: "ww-keputih-bunguran" }
  ],

  /*
   * Opsional: area jangkauan halte (buffer/area jaringan pejalan kaki).
   * Simpan hasil GeoJSON di folder halte dan sertakan Route_Id jika area dibedakan per koridor.
   */
  coverage: {
    enabled: false,
    file: "halte/jangkauan_halte.geojson"
  },

  /*
   * Untuk uji awal, jangan memuat GeoJSON bangunan 573 MB secara langsung.
   * Bangunan seluruh kota sebaiknya dikonversi menjadi PMTiles/vector tiles.
   *
   * Setelah bangunan.pmtiles di-host dan sudah dibuat dengan source-layer "buildings",
   * ubah enabled menjadi true. Gunakan property LIDAR_MEAN sebagai tinggi (meter)
   * hanya setelah memastikan nilainya memang tinggi bangunan di atas tanah.
   */
  /*
   * Armada simulasi per rute. Angka bertanda "acuan/proxy" bukan feed GPS.
   * Benowo-Tunjungan: 16 armada diberitakan mulai operasi Nov 2025.
   * Gunung Anyar and UNESA-Osowilangun counts are based on academic route table (2025)
   * for analogous routes; verify equivalence with current corridor names before formal use.
   * Other route counts are placeholders pending route-level official data.
   */
  simulationFleet: {
    "sby-purabaya-unair": { count: 4, basis: "Simulasi demo: 4 titik bergerak pada koridor baru; bukan jumlah armada resmi.", sourceUrl: "" },
    "ww-pnr-balai-kota": { count: 4, basis: "Simulasi demo: 4 titik bergerak pada koridor baru; bukan jumlah armada resmi.", sourceUrl: "" },
    "ww-bratang-pasarturi": { count: 4, basis: "Simulasi demo: 4 titik bergerak pada koridor baru; bukan jumlah armada resmi.", sourceUrl: "" },
    "sby-benowo": { count: 4, basis: "Acuan berita Nov 2025: 16 armada pada rute Benowo–Tunjungan.", sourceUrl: "https://www.detik.com/jatim/berita/d-8216825/suroboyo-bus-mulai-layani-rute-benowo-tunjungan-ada-16-armada" },
    "sby-kejawan": { count: 4, basis: "Statistik Sektoral Surabaya 2024: 6 unit Unesa–ITS; proksi, bukan hitungan langsung rute terbaru.", sourceUrl: "https://satudata.surabaya.go.id/files/sektoral/2024/8_Bab_VIII_Transportasi_dan_Pariwisata.pdf" },
    "sby-purabaya": { count: 4, basis: "Statistik Sektoral Surabaya 2024: 9 bus reguler + 1 bus tingkat Purabaya–Rajawali.", sourceUrl: "https://satudata.surabaya.go.id/files/sektoral/2024/8_Bab_VIII_Transportasi_dan_Pariwisata.pdf" },
    "ww-gunung-anyar": { count: 4, basis: "Acuan akademik 2025 untuk TIJ–Gunung Anyar; kesesuaian rute perlu diverifikasi.", sourceUrl: "https://journal.its.ac.id/index.php/jpr/article/download/5128/5467" },
    "ww-tow": { count: 4, basis: "Acuan akademik 2025 untuk UNESA–Terminal Osowilangun; kesesuaian rute perlu diverifikasi.", sourceUrl: "https://journal.its.ac.id/index.php/jpr/article/download/5128/5467" },
    "ww-bratang-bulak": { count: 4, basis: "Simulasi demo: 4 bus per koridor; bukan jumlah armada resmi.", sourceUrl: "" },
    "ww-mayjend-sungkono": { count: 4, basis: "Simulasi demo: 4 bus per koridor; bukan jumlah armada resmi.", sourceUrl: "" },
    "ww-sier-kotalama": { count: 4, basis: "Simulasi demo: 4 bus per koridor; bukan jumlah armada resmi.", sourceUrl: "" },
    "ww-tij-gununganyar": { count: 4, basis: "Simulasi demo: 4 bus per koridor; bukan jumlah armada resmi.", sourceUrl: "" },
    "ww-tij-lakarsantri": { count: 4, basis: "Simulasi demo: 4 bus per koridor; bukan jumlah armada resmi.", sourceUrl: "" },
    "ww-keputih-bunguran": { count: 4, basis: "Simulasi demo: 4 bus per koridor; bukan jumlah armada resmi.", sourceUrl: "" }
  },

  buildings: {
    enabled: false,
    mode: "pmtiles",
    file: "bangunan/bangunan.pmtiles",
    sourceLayer: "buildings",
    heightProperty: "LIDAR_MEAN"
  },

  map: {
    center: [112.75, -7.27],
    zoom: 11,
    pitch: 48,
    bearing: -18
  },

  walking: {
    enabled: true,
    serviceUrl: "https://valhalla1.openstreetmap.de/route",
    candidateStops: 3,
    fallbackWalkingSpeedKmh: 4.5
  }
};
