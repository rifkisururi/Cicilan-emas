const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const pool = require('../config/database');

// All user routes require authentication
router.use(isAuthenticated);

// User Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const userId = req.session.user.id;

        // Get user's installment statistics
        const stats = await Promise.all([
            pool.query('SELECT COUNT(*) as count FROM installment_header WHERE user_id = $1 AND status = $2', [userId, 'active']),
            pool.query('SELECT COUNT(*) as count FROM installment_header WHERE user_id = $1 AND status = $2', [userId, 'completed']),
            pool.query('SELECT COUNT(*) as count FROM installment_header WHERE user_id = $1 AND status = $2', [userId, 'pending']),
            pool.query(`
                SELECT SUM(id.total_amount - id.paid_amount) as total
                FROM installment_detail id
                JOIN installment_header ih ON id.installment_header_id = ih.id
                WHERE ih.user_id = $1 AND id.payment_status = 'unpaid'
            `, [userId])
        ]);

        const statistics = {
            activeInstallments: parseInt(stats[0].rows[0].count),
            completedInstallments: parseInt(stats[1].rows[0].count),
            pendingInstallments: parseInt(stats[2].rows[0].count),
            totalOutstanding: parseFloat(stats[3].rows[0].total || 0)
        };

        // Get user's active installments
        const installments = await pool.query(`
            SELECT * FROM installment_header
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 5
        `, [userId]);

        // Get upcoming payments
        const upcomingPayments = await pool.query(`
            SELECT
                id.*,
                ih.installment_number,
                ih.product_name,
                ih.product_weight
            FROM installment_detail id
            JOIN installment_header ih ON id.installment_header_id = ih.id
            WHERE ih.user_id = $1
            AND id.payment_status = 'unpaid'
            AND id.due_date >= CURRENT_DATE
            ORDER BY id.due_date ASC
            LIMIT 5
        `, [userId]);

        res.render('user/dashboard', {
            title: 'Dashboard',
            statistics,
            installments: installments.rows,
            upcomingPayments: upcomingPayments.rows
        });
    } catch (error) {
        console.error('User dashboard error:', error);
        res.status(500).send('Internal server error');
    }
});

// Browse Products
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
            WHERE p.is_active = true
            GROUP BY p.id
            ORDER BY p.product_name, p.weight_gram
        `);

        // Get current price
        const priceResult = await pool.query(`
            SELECT * FROM price_config
            WHERE price_date <= CURRENT_DATE
            ORDER BY price_date DESC
            LIMIT 1
        `);

        // Get system config
        const configResult = await pool.query('SELECT * FROM system_config');
        const systemConfig = {};
        configResult.rows.forEach(row => {
            systemConfig[row.config_key] = parseFloat(row.config_value);
        });

        res.render('user/products', {
            title: 'Produk Emas',
            products: result.rows,
            currentPrice: priceResult.rows[0] || null,
            systemConfig
        });
    } catch (error) {
        console.error('Products page error:', error);
        res.status(500).send('Internal server error');
    }
});

// Apply for Installment
router.get('/apply/:productId', async (req, res) => {
    try {
        const { productId } = req.params;

        // Get product
        const productResult = await pool.query(`
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
            WHERE p.id = $1 AND p.is_active = true
            GROUP BY p.id
        `, [productId]);

        if (productResult.rows.length === 0) {
            return res.status(404).send('Product not found or inactive');
        }

        // Get current price
        const priceResult = await pool.query(`
            SELECT * FROM price_config
            WHERE price_date <= CURRENT_DATE
            ORDER BY price_date DESC
            LIMIT 1
        `);

        // Get system config
        const configResult = await pool.query('SELECT * FROM system_config');
        const systemConfig = {};
        configResult.rows.forEach(row => {
            systemConfig[row.config_key] = parseFloat(row.config_value);
        });

        res.render('user/apply', {
            title: 'Pengajuan Cicilan',
            product: productResult.rows[0],
            currentPrice: priceResult.rows[0] || null,
            systemConfig
        });
    } catch (error) {
        console.error('Apply page error:', error);
        res.status(500).send('Internal server error');
    }
});

// My Installments
router.get('/installments', async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { status } = req.query;

        let query = 'SELECT * FROM installment_header WHERE user_id = $1';
        const params = [userId];

        if (status) {
            query += ' AND status = $2';
            params.push(status);
        }

        query += ' ORDER BY created_at DESC';

        const result = await pool.query(query, params);

        res.render('user/installments', {
            title: 'Cicilan Saya',
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
        const userId = req.session.user.id;

        const headerResult = await pool.query(
            'SELECT * FROM installment_header WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

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

        // Get system config for penalty calculation
        const configResult = await pool.query(
            'SELECT config_value FROM system_config WHERE config_key = $1',
            ['penalty_per_day']
        );

        res.render('user/installment-detail', {
            title: 'Detail Cicilan',
            header: headerResult.rows[0],
            details: detailResult.rows,
            payments: paymentsResult.rows,
            penaltyPerDay: parseFloat(configResult.rows[0].config_value)
        });
    } catch (error) {
        console.error('Installment detail page error:', error);
        res.status(500).send('Internal server error');
    }
});

// Payment History
router.get('/payments', async (req, res) => {
    try {
        const userId = req.session.user.id;

        const result = await pool.query(`
            SELECT
                ph.*,
                ih.installment_number,
                ih.product_name,
                id.month_number,
                id.due_date
            FROM payment_history ph
            JOIN installment_header ih ON ph.installment_header_id = ih.id
            JOIN installment_detail id ON ph.installment_detail_id = id.id
            WHERE ph.user_id = $1
            ORDER BY ph.payment_date DESC
        `, [userId]);

        res.render('user/payments', {
            title: 'Histori Pembayaran',
            payments: result.rows
        });
    } catch (error) {
        console.error('Payments page error:', error);
        res.status(500).send('Internal server error');
    }
});

module.exports = router;
