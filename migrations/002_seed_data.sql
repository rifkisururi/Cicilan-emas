-- Seed Data: Initial data for development and testing
-- Created: 2024-01-01

-- Insert default admin user (password: admin123)
-- Password hash for 'admin123' using bcryptjs
INSERT INTO users (username, password, full_name, email, phone, role) VALUES
('admin', '$2a$10$Xn0VKvKqE5qL5y4z1JZLEuZkWqmXGvYI0xZYQ8qTQJ7vK9XQ3rXrq', 'Administrator', 'admin@cicilanemas.com', '081234567890', 'admin'),
('user1', '$2a$10$Xn0VKvKqE5qL5y4z1JZLEuZkWqmXGvYI0xZYQ8qTQJ7vK9XQ3rXrq', 'User Demo', 'user@cicilanemas.com', '081234567891', 'user')
ON CONFLICT (username) DO NOTHING;

-- Insert sample products (Emas Antam dan UBS)
INSERT INTO products (product_code, product_name, description, weight_gram, base_price, stock, is_active) VALUES
('ANTM-001', 'Emas Antam 1 Gram', 'Emas batangan Antam 1 gram 99.99%', 1.00, 1050000, 100, true),
('ANTM-002', 'Emas Antam 2 Gram', 'Emas batangan Antam 2 gram 99.99%', 2.00, 2100000, 50, true),
('ANTM-003', 'Emas Antam 3 Gram', 'Emas batangan Antam 3 gram 99.99%', 3.00, 3150000, 50, true),
('ANTM-005', 'Emas Antam 5 Gram', 'Emas batangan Antam 5 gram 99.99%', 5.00, 5250000, 30, true),
('ANTM-010', 'Emas Antam 10 Gram', 'Emas batangan Antam 10 gram 99.99%', 10.00, 10500000, 20, true),
('UBS-001', 'Emas UBS 1 Gram', 'Emas batangan UBS 1 gram 99.99%', 1.00, 1045000, 80, true),
('UBS-002', 'Emas UBS 2 Gram', 'Emas batangan UBS 2 gram 99.99%', 2.00, 2090000, 40, true),
('UBS-005', 'Emas UBS 5 Gram', 'Emas batangan UBS 5 gram 99.99%', 5.00, 5225000, 25, true),
('UBS-010', 'Emas UBS 10 Gram', 'Emas batangan UBS 10 gram 99.99%', 10.00, 10450000, 15, true)
ON CONFLICT (product_code) DO NOTHING;

-- Insert current gold price (harga pasar harian)
INSERT INTO price_config (price_date, buy_price, sell_price, notes) VALUES
(CURRENT_DATE, 1040000, 1050000, 'Harga emas pasar per gram hari ini'),
(CURRENT_DATE - INTERVAL '1 day', 1038000, 1048000, 'Harga emas pasar per gram kemarin')
ON CONFLICT (price_date) DO NOTHING;

-- System config already inserted in schema migration
