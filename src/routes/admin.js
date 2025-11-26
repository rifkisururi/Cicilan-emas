const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const pool = require('../config/database');

// All admin routes require authentication and admin role
router.use(isAuthenticated, isAdmin);

// Admin Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        // Get statistics
        const stats = await Promise.all([
            pool.query('SELECT COUNT(*) as count FROM users WHERE role = $1', ['user']),
            pool.query('SELECT COUNT(*) as count FROM products WHERE is_active = true'),
            pool.query('SELECT COUNT(*) as count FROM installment_header WHERE status = $1', ['pending']),
            pool.query('SELECT COUNT(*) as count FROM installment_header WHERE status = $1', ['active']),
            pool.query('SELECT SUM(total_payment) as total FROM installment_header WHERE status IN ($1, $2)', ['active', 'completed'])
        ]);

        const statistics = {
            totalUsers: parseInt(stats[0].rows[0].count),
            totalProducts: parseInt(stats[1].rows[0].count),
            pendingInstallments: parseInt(stats[2].rows[0].count),
            activeInstallments: parseInt(stats[3].rows[0].count),
            totalRevenue: parseFloat(stats[4].rows[0].total || 0)
        };

        // Get recent installments
        const recentInstallments = await pool.query(`
            SELECT ih.*, u.full_name as user_name
            FROM installment_header ih
            JOIN users u ON ih.user_id = u.id
            ORDER BY ih.created_at DESC
            LIMIT 10
        `);

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            statistics,
            recentInstallments: recentInstallments.rows
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).send('Internal server error');
    }
});

// Products Management
router.get('/products', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                p.*,
                COALESCE(json_agg(
                    json_build_object(
                        'id', pi.id,
                        'image_path', pi.image_path,
                        'is_primary', pi.is_primary
                    )
                ) FILTER (WHERE pi.id IS NOT NULL), '[]') as images
            FROM products p
            LEFT JOIN product_images pi ON p.id = pi.product_id
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `);

        res.render('admin/products', {
            title: 'Manajemen Produk',
            products: result.rows
        });
    } catch (error) {
        console.error('Products page error:', error);
        res.status(500).send('Internal server error');
    }
});

// Price Configuration
router.get('/price-config', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM price_config ORDER BY price_date DESC LIMIT 30'
        );

        res.render('admin/price-config', {
            title: 'Konfigurasi Harga',
            priceConfigs: result.rows
        });
    } catch (error) {
        console.error('Price config page error:', error);
        res.status(500).send('Internal server error');
    }
});

// System Configuration
router.get('/system-config', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM system_config ORDER BY config_key');

        const config = {};
        result.rows.forEach(row => {
            config[row.config_key] = {
                value: parseFloat(row.config_value),
                description: row.description
            };
        });

        res.render('admin/system-config', {
            title: 'Konfigurasi Sistem',
            config
        });
    } catch (error) {
        console.error('System config page error:', error);
        res.status(500).send('Internal server error');
    }
});

// Installments Management
router.get('/installments', async (req, res) => {
    try {
        const { status } = req.query;

        let query = `
            SELECT ih.*, u.full_name as user_name, u.email as user_email
            FROM installment_header ih
            JOIN users u ON ih.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ' AND ih.status = $1';
            params.push(status);
        }

        query += ' ORDER BY ih.created_at DESC';

        const result = await pool.query(query, params);

        res.render('admin/installments', {
            title: 'Manajemen Cicilan',
            installments: result.rows,
            currentStatus: status || 'all'
        });
    } catch (error) {
        console.error('Installments page error:', error);
        res.status(500).send('Internal server error');
    }
});

// Installment Detail
router.get('/installments/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const headerResult = await pool.query(`
            SELECT ih.*, u.full_name as user_name, u.email as user_email, u.phone as user_phone
            FROM installment_header ih
            JOIN users u ON ih.user_id = u.id
            WHERE ih.id = $1
        `, [id]);

        if (headerResult.rows.length === 0) {
            return res.status(404).send('Installment not found');
        }

        const detailResult = await pool.query(
            'SELECT * FROM installment_detail WHERE installment_header_id = $1 ORDER BY month_number',
            [id]
        );

        const paymentsResult = await pool.query(
            'SELECT * FROM payment_history WHERE installment_header_id = $1 ORDER BY payment_date DESC',
            [id]
        );

        res.render('admin/installment-detail', {
            title: 'Detail Cicilan',
            header: headerResult.rows[0],
            details: detailResult.rows,
            payments: paymentsResult.rows
        });
    } catch (error) {
        console.error('Installment detail page error:', error);
        res.status(500).send('Internal server error');
    }
});

// Users Management
router.get('/users', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                u.*,
                COUNT(DISTINCT ih.id) as total_installments,
                SUM(CASE WHEN ih.status = 'active' THEN 1 ELSE 0 END) as active_installments
            FROM users u
            LEFT JOIN installment_header ih ON u.id = ih.user_id
            WHERE u.role = 'user'
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);

        res.render('admin/users', {
            title: 'Manajemen User',
            users: result.rows
        });
    } catch (error) {
        console.error('Users page error:', error);
        res.status(500).send('Internal server error');
    }
});

module.exports = router;
