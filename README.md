# Portfolio

## Menambah project dari lokal

1. Jalankan `python manage.py` di folder portfolio (Python 3).
2. Buka http://127.0.0.1:8000/admin.html.
3. Isi form lalu klik **Simpan project**.
4. Lihat hasil di http://127.0.0.1:8000. Data tersimpan di `projects.json`.
5. Commit dan push perubahan ke GitHub seperti biasa; tunggu deployment selesai.

Pada push pertama, sertakan semua file fitur ini, terutama `index.html`, `project-data.js`, dan `projects.json`. Berikutnya cukup push perubahan data project. GitHub Pages membaca JSON tanpa menjalankan Python. Form penyimpanan hanya berjalan di server lokal, tanpa token GitHub.

Project lama tetap tersedia. Project tambahan muncul paling depan dan ikut pencarian, kategori, jumlah project, dan Quick View. Gunakan alamat server lokal, jangan membuka HTML dengan klik dua kali, agar JSON bisa dimuat. Tekan Ctrl+C untuk menghentikan server.
