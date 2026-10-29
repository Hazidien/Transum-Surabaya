/*
 * Konfigurasi data WebGIS Transum Surabaya.
 * Nama berkas di sini harus sama persis dengan nama file yang diunggah ke repository.
 * Route_Id dipakai untuk menghubungkan layer rute dan halte; nama halte berasal dari Halte_name atau Halte_nama.
 */
window.TRANSUM_CONFIG = {
  routes: [
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
  ],

  stops: [
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
    }
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
    "sby-benowo": { count: 4, basis: "Acuan berita Nov 2025: 16 armada pada rute Benowo–Tunjungan.", sourceUrl: "https://www.detik.com/jatim/berita/d-8216825/suroboyo-bus-mulai-layani-rute-benowo-tunjungan-ada-16-armada" },
    "sby-kejawan": { count: 4, basis: "Statistik Sektoral Surabaya 2024: 6 unit Unesa–ITS; proksi, bukan hitungan langsung rute terbaru.", sourceUrl: "https://satudata.surabaya.go.id/files/sektoral/2024/8_Bab_VIII_Transportasi_dan_Pariwisata.pdf" },
    "sby-purabaya": { count: 4, basis: "Statistik Sektoral Surabaya 2024: 9 bus reguler + 1 bus tingkat Purabaya–Rajawali.", sourceUrl: "https://satudata.surabaya.go.id/files/sektoral/2024/8_Bab_VIII_Transportasi_dan_Pariwisata.pdf" },
    "ww-gunung-anyar": { count: 4, basis: "Acuan akademik 2025 untuk TIJ–Gunung Anyar; kesesuaian rute perlu diverifikasi.", sourceUrl: "https://journal.its.ac.id/index.php/jpr/article/download/5128/5467" },
    "ww-tow": { count: 4, basis: "Acuan akademik 2025 untuk UNESA–Terminal Osowilangun; kesesuaian rute perlu diverifikasi.", sourceUrl: "https://journal.its.ac.id/index.php/jpr/article/download/5128/5467" }
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
