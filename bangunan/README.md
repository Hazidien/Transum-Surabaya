# Data Bangunan Surabaya

Atribut tinggi untuk ekstrusi 3D: `LIDAR_MEAN`.

## Jangan unggah GeoJSON 573 MB langsung ke repository

Simpan GeoJSON asli di komputer. GitHub memblokir file reguler yang lebih besar dari 100 MiB dan data sebesar ini terlalu berat untuk langsung dimuat di browser.

## Alur yang disarankan

1. Buka **OSGeo4W Shell** yang terpasang bersama QGIS, atau terminal yang memiliki GDAL.
2. Reproject ke WGS 84 / EPSG:4326 (GeoJSON web harus longitude/latitude). Sesuaikan nama file input dengan file lokalmu:

   ```bash
   ogr2ogr -f GeoJSON -t_srs EPSG:4326 bangunan_wgs84.geojson bangunan_surabaya.geojson
   ```

3. Untuk menguji website terlebih dahulu, pilih sebagian bangunan di QGIS (misalnya buffer sekitar satu rute), lalu ekspor subset sebagai `bangunan_uji.geojson`. Unggah hanya jika ukuran filenya kecil.
4. Untuk seluruh kota, konversikan GeoJSON WGS84 menjadi PMTiles memakai Tippecanoe (misalnya di WSL/Linux):

   ```bash
   tippecanoe -o bangunan.pmtiles -zg --drop-densest-as-needed --extend-zooms-if-still-dropping -l buildings -y LIDAR_MEAN bangunan_wgs84.geojson
   ```

   Perintah tersebut membuat source-layer bernama `buildings` dan mempertahankan atribut `LIDAR_MEAN` yang digunakan untuk tinggi 3D. Jika kamu ingin popup memuat atribut lain, tambahkan nama atribut yang diperlukan melalui opsi `-y`.

5. Host `bangunan.pmtiles` di layanan yang mendukung file besar dan HTTP Range Requests. Jangan menganggap file PMTiles dapat ditaruh langsung di repository jika ukurannya melebihi batas GitHub. Sesudah URL hosting tersedia, sesuaikan `config.js` agar aplikasi membaca URL tersebut.

## Validasi tinggi

Pastikan `LIDAR_MEAN` benar-benar tinggi bangunan di atas tanah dalam meter, bukan elevasi absolut atap atau nilai NoData. Jika ada nilai kosong atau tidak masuk akal, bersihkan/validasi sebelum membuat tiles.
