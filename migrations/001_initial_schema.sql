-- Migration: Initial Schema
-- Created: 2024-01-01

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'user', -- 'admin' or 'user'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: products (Master Produk Emas)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    product_code VARCHAR(50) UNIQUE NOT NULL,
    product_name VARCHAR(255) NOT NULL, -- Antam, UBS, dll
    description TEXT,
    weight_gram DECIMAL(10, 2) NOT NULL, -- Pecahan: 1, 2, 3, dst
    base_price DECIMAL(15, 2) NOT NULL,
    stock INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: product_images
CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    image_path VARCHAR(500) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Table: price_config (Harga Pasar Harian)
CREATE TABLE IF NOT EXISTS price_config (
    id SERIAL PRIMARY KEY,
    price_date DATE NOT NULL DEFAULT CURRENT_DATE,
    buy_price DECIMAL(15, 2) NOT NULL, -- Harga beli per gram
    sell_price DECIMAL(15, 2) NOT NULL, -- Harga jual per gram
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(price_date)
);

-- Table: system_config (Margin, DP, Admin Fee, Denda)
CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value DECIMAL(10, 2) NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default system configurations
INSERT INTO system_config (config_key, config_value, description) VALUES
('margin_percent', 10.00, 'Margin dalam persen dari harga jual'),
('min_dp_percent', 10.00, 'Minimum DP dalam persen'),
('max_dp_percent', 50.00, 'Maksimum DP dalam persen'),
('admin_fee_percent', 2.00, 'Biaya admin dalam persen dari harga jual'),
('penalty_per_day', 0.50, 'Denda per hari keterlambatan dalam persen')
ON CONFLICT (config_key) DO NOTHING;

-- Table: installment_header (Header Cicilan)
CREATE TABLE IF NOT EXISTS installment_header (
    id SERIAL PRIMARY KEY,
    installment_number VARCHAR(50) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_weight DECIMAL(10, 2) NOT NULL,
    product_image VARCHAR(500),
    sell_price DECIMAL(15, 2) NOT NULL, -- Harga jual per gram
    total_price DECIMAL(15, 2) NOT NULL, -- Harga jual * berat
    margin_percent DECIMAL(5, 2) NOT NULL,
    margin_amount DECIMAL(15, 2) NOT NULL,
    dp_amount DECIMAL(15, 2) NOT NULL,
    admin_fee DECIMAL(15, 2) NOT NULL,
    principal_amount DECIMAL(15, 2) NOT NULL, -- Total harga - DP
    tenor_months INTEGER NOT NULL,
    monthly_principal DECIMAL(15, 2) NOT NULL, -- Cicilan pokok per bulan
    monthly_margin DECIMAL(15, 2) NOT NULL, -- Cicilan margin per bulan
    monthly_payment DECIMAL(15, 2) NOT NULL, -- Total cicilan per bulan
    total_payment DECIMAL(15, 2) NOT NULL, -- Total keseluruhan pembayaran
    start_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, active, completed, cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

-- Table: installment_detail (Detail Angsuran per Bulan)
CREATE TABLE IF NOT EXISTS installment_detail (
    id SERIAL PRIMARY KEY,
    installment_header_id INTEGER NOT NULL,
    month_number INTEGER NOT NULL, -- Bulan ke-
    due_date DATE NOT NULL, -- Tanggal jatuh tempo
    principal_amount DECIMAL(15, 2) NOT NULL, -- Cicilan pokok
    margin_amount DECIMAL(15, 2) NOT NULL, -- Cicilan margin
    total_amount DECIMAL(15, 2) NOT NULL, -- Total cicilan bulan ini
    payment_status VARCHAR(20) DEFAULT 'unpaid', -- unpaid, paid, late
    payment_date TIMESTAMP,
    late_days INTEGER DEFAULT 0,
    penalty_amount DECIMAL(15, 2) DEFAULT 0,
    paid_amount DECIMAL(15, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (installment_header_id) REFERENCES installment_header(id) ON DELETE CASCADE,
    UNIQUE(installment_header_id, month_number)
);

-- Table: payment_history (Histori Pembayaran)
CREATE TABLE IF NOT EXISTS payment_history (
    id SERIAL PRIMARY KEY,
    installment_detail_id INTEGER NOT NULL,
    installment_header_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    payment_amount DECIMAL(15, 2) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(50),
    reference_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (installment_detail_id) REFERENCES installment_detail(id) ON DELETE CASCADE,
    FOREIGN KEY (installment_header_id) REFERENCES installment_header(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_products_code ON products(product_code);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_price_config_date ON price_config(price_date DESC);
CREATE INDEX idx_installment_header_user ON installment_header(user_id);
CREATE INDEX idx_installment_header_status ON installment_header(status);
CREATE INDEX idx_installment_header_number ON installment_header(installment_number);
CREATE INDEX idx_installment_detail_header ON installment_detail(installment_header_id);
CREATE INDEX idx_installment_detail_status ON installment_detail(payment_status);
CREATE INDEX idx_payment_history_user ON payment_history(user_id);
CREATE INDEX idx_payment_history_header ON payment_history(installment_header_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_price_config_updated_at BEFORE UPDATE ON price_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_installment_header_updated_at BEFORE UPDATE ON installment_header FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_installment_detail_updated_at BEFORE UPDATE ON installment_detail FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
