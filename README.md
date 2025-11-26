# 🏆 Cicilan Emas - Platform Penyedia Cicilan Emas

Platform fullstack berbasis Node.js untuk mengelola cicilan pembelian emas dengan sistem pembayaran flat.

## 📋 Fitur Utama

### Admin Panel
- ✅ Manajemen Produk Emas (Antam, UBS, dll)
- ✅ Upload Gambar Produk
- ✅ Konfigurasi Harga Emas Harian
- ✅ Pengaturan Margin, DP, Admin Fee, dan Denda
- ✅ Manajemen Pengajuan Cicilan
- ✅ Monitoring Pembayaran User
- ✅ Dashboard Analytics

### User Panel
- ✅ Browse Produk Emas
- ✅ Pengajuan Cicilan dengan Simulasi
- ✅ Dashboard Cicilan Aktif
- ✅ Pembayaran Angsuran
- ✅ Histori Pembayaran
- ✅ Notifikasi Pembayaran Mendatang

### Sistem Cicilan
- ✅ Perhitungan Flat (Cicilan Tetap)
- ✅ DP Fleksibel (Min-Max Configurable)
- ✅ Tenor Kelipatan 6 Bulan (Min. 12 Bulan)
- ✅ Auto-Generate Jadwal Angsuran
- ✅ Perhitungan Denda Otomatis
- ✅ Status Tracking (Pending, Active, Completed)

## 🛠 Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **View Engine**: EJS
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Containerization**: Docker & Docker Compose

## 📦 Struktur Database

### Master Tables
- `users` - Data pengguna (admin & user)
- `products` - Produk emas
- `product_images` - Gambar produk
- `price_config` - Harga emas harian
- `system_config` - Konfigurasi sistem (margin, DP, dll)

### Transaction Tables
- `installment_header` - Header cicilan
- `installment_detail` - Detail angsuran per bulan
- `payment_history` - Histori pembayaran

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- PostgreSQL 15+ (Server Terpisah/External)
- Node.js 18+ (untuk development tanpa Docker)

### Menggunakan Docker dengan PostgreSQL Server Terpisah (Production)

**PENTING**: Aplikasi ini menggunakan PostgreSQL server terpisah (external database).

1. **Clone repository**
```bash
git clone <repository-url>
cd Cicilan-emas
```

2. **Setup Environment**
```bash
cp .env.example .env
# Edit .env dan sesuaikan dengan konfigurasi PostgreSQL server Anda
```

Contoh konfigurasi `.env`:
```env
DB_HOST=your-postgres-server-ip
DB_PORT=5432
DB_NAME=cicilan_emas_db
DB_USER=your_db_user
DB_PASSWORD=your_db_password
```

3. **Setup Database di PostgreSQL Server**
```sql
-- Login ke PostgreSQL server Anda
-- Buat database baru
CREATE DATABASE cicilan_emas_db;
```

4. **Jalankan Database Migration**
```bash
# Install dependencies terlebih dahulu
npm install

# Jalankan migration ke PostgreSQL server
npm run migrate
```

5. **Build & Jalankan dengan Docker**
```bash
docker-compose up -d
```

6. **Akses aplikasi**
```
http://localhost:3000
```

### Menggunakan Docker dengan PostgreSQL Container (Development)

Jika Anda ingin menjalankan PostgreSQL di container untuk development:

```bash
# Gunakan docker-compose.local.yml
docker-compose -f docker-compose.local.yml up -d

# Tunggu beberapa detik hingga database siap, lalu jalankan migration
docker exec -it cicilan-emas-app npm run migrate
```

### Development Mode (Tanpa Docker)

1. **Install Dependencies**
```bash
npm install
```

2. **Setup Environment**
```bash
cp .env.example .env
# Edit .env sesuai konfigurasi PostgreSQL server Anda
```

3. **Setup Database**
```bash
# Pastikan PostgreSQL server sudah running dan dapat diakses
# Buat database: cicilan_emas_db

# Jalankan migration
npm run migrate
```

4. **Jalankan Aplikasi**
```bash
# Development mode dengan auto-reload
npm run dev

# atau Production mode
npm start
```

## 🔑 Default Credentials

### Admin
- Username: `admin`
- Password: `admin123`

### User Demo
- Username: `user1`
- Password: `admin123`

## 📊 Rumus Perhitungan Cicilan

### Sistem Flat

```javascript
// Pokok Pinjaman
Pokok = Harga Jual - DP

// Cicilan Pokok per Bulan
Cicilan Pokok = Pokok / Tenor (bulan)

// Cicilan Margin per Bulan
Cicilan Margin = Pokok × (Margin% / 12)

// Total Cicilan per Bulan
Cicilan Bulanan = Cicilan Pokok + Cicilan Margin

// Biaya Admin (sekali di awal)
Admin Fee = Harga Jual × Admin Fee%

// Total Pembayaran
Total = DP + (Cicilan Bulanan × Tenor) + Admin Fee
```

### Contoh Perhitungan

**Produk**: Emas Antam 5 gram
**Harga**: Rp 5.250.000
**DP**: Rp 1.050.000 (20%)
**Tenor**: 12 bulan
**Margin**: 10% per tahun
**Admin Fee**: 2%

```
Pokok = 5.250.000 - 1.050.000 = 4.200.000
Cicilan Pokok = 4.200.000 / 12 = 350.000/bulan
Cicilan Margin = 4.200.000 × (10% / 12) = 35.000/bulan
Cicilan Bulanan = 350.000 + 35.000 = 385.000/bulan
Admin Fee = 5.250.000 × 2% = 105.000

Total Pembayaran = 1.050.000 + (385.000 × 12) + 105.000
                 = 1.050.000 + 4.620.000 + 105.000
                 = 5.775.000
```

## 📁 Struktur Project

```
Cicilan-emas/
├── src/
│   ├── config/          # Database config
│   ├── middleware/      # Auth & error handling
│   ├── routes/          # Express routes
│   │   ├── api/        # API endpoints
│   │   ├── admin.js    # Admin pages
│   │   └── user.js     # User pages
│   ├── utils/          # Helper functions
│   ├── public/         # Static files
│   │   ├── css/       # Stylesheets
│   │   ├── js/        # Client-side JS
│   │   └── uploads/   # Uploaded images
│   └── index.js        # Main app file
├── views/              # EJS templates
│   ├── admin/         # Admin views
│   ├── user/          # User views
│   └── partials/      # Reusable components
├── migrations/         # Database migrations
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

## 🔧 Konfigurasi Sistem

Konfigurasi default dapat diubah melalui Admin Panel:

- **Margin**: 10% per tahun
- **Min DP**: 10%
- **Max DP**: 50%
- **Admin Fee**: 2%
- **Penalty per Day**: 0.5%

## 🌐 API Endpoints

### Authentication
- `POST /auth/login` - Login
- `POST /auth/register` - Register
- `POST /auth/logout` - Logout
- `GET /auth/check` - Check session

### Products (Admin)
- `GET /api/products` - List products
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `POST /api/products/:id/images` - Upload image

### Price Config (Admin)
- `GET /api/price-config` - List prices
- `POST /api/price-config` - Create/Update price
- `GET /api/price-config/current` - Get current price

### System Config (Admin)
- `GET /api/system-config` - Get all configs
- `PUT /api/system-config/:key` - Update config
- `POST /api/system-config/batch` - Batch update

### Installments
- `GET /api/installments` - List installments
- `POST /api/installments` - Create installment
- `GET /api/installments/:id` - Get detail
- `POST /api/installments/calculate` - Calculate preview
- `PUT /api/installments/:id/status` - Update status (Admin)
- `POST /api/installments/:id/pay/:detailId` - Pay installment
- `GET /api/installments/:id/payments` - Payment history

## 🎨 UI Features

- ✅ Responsive Design (Mobile-Friendly)
- ✅ Modern & Interactive Interface
- ✅ Real-time Calculation Preview
- ✅ Color-coded Status Badges
- ✅ Alert Notifications
- ✅ Modal Dialogs
- ✅ Loading States

## 🔒 Security Features

- ✅ Session-based Authentication
- ✅ Role-based Access Control (Admin/User)
- ✅ Password Hashing (bcrypt)
- ✅ SQL Injection Prevention
- ✅ File Upload Validation
- ✅ Input Sanitization

## 📝 Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cicilan_emas_db
DB_USER=postgres
DB_PASSWORD=postgres

# Session
SESSION_SECRET=your-secret-key

# Upload
UPLOAD_DIR=src/public/uploads
MAX_FILE_SIZE=5242880
```

## 🐛 Troubleshooting

### Database Connection Error
```bash
# Check if PostgreSQL is running
docker ps

# Check logs
docker logs cicilan-emas-db
```

### Migration Error
```bash
# Reset database
docker-compose down -v
docker-compose up -d
docker exec -it cicilan-emas-app npm run migrate
```

### Port Already in Use
```bash
# Change PORT in .env or docker-compose.yml
# Or stop the process using port 3000
```

## 📚 Development

### Add New Migration
```sql
-- Create new file in migrations/ folder
-- migrations/003_new_feature.sql

-- Add your SQL here
```

### Run Specific Migration
```bash
docker exec -it cicilan-emas-app npm run migrate
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 👨‍💻 Author

Developed with ❤️ for gold installment management

## 🙏 Acknowledgments

- Node.js & Express.js community
- PostgreSQL team
- All contributors

---

**Happy Coding! 🚀**
