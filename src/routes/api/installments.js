const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const { isAuthenticated, isAdmin } = require('../../middleware/auth');
const {
    validateInstallmentParams,
    calculateInstallment,
    generateInstallmentSchedule,
    calculatePenalty,
    generateInstallmentNumber
} = require('../../utils/installment-calculator');

// Get all installments (Admin: all, User: only their own)
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const { status, user_id } = req.query;
        const isAdminUser = req.session.user.role === 'admin';

        let query = 'SELECT * FROM installment_header WHERE 1=1';
        const params = [];
        let paramCount = 0;

        // Filter by user if not admin
        if (!isAdminUser) {
            paramCount++;
            query += ` AND user_id = $${paramCount}`;
            params.push(req.session.user.id);
        } else if (user_id) {
            paramCount++;
            query += ` AND user_id = $${paramCount}`;
            params.push(user_id);
        }

        // Filter by status
        if (status) {
            paramCount++;
            query += ` AND status = $${paramCount}`;
            params.push(status);
        }

        query += ' ORDER BY created_at DESC';

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get installments error:', error);
        res.status(500).json({ error: 'Failed to fetch installments' });
    }
});

// Get installment by ID with details
router.get('/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const isAdminUser = req.session.user.role === 'admin';

        let query = 'SELECT * FROM installment_header WHERE id = $1';
        const params = [id];

        // Non-admin can only view their own installments
        if (!isAdminUser) {
            query += ' AND user_id = $2';
            params.push(req.session.user.id);
        }

        const headerResult = await pool.query(query, params);

        if (headerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Installment not found' });
        }

        const header = headerResult.rows[0];

        // Get installment details
        const detailResult = await pool.query(
            'SELECT * FROM installment_detail WHERE installment_header_id = $1 ORDER BY month_number',
            [id]
        );

        res.json({
            success: true,
            data: {
                header: header,
                details: detailResult.rows
            }
        });
    } catch (error) {
        console.error('Get installment error:', error);
        res.status(500).json({ error: 'Failed to fetch installment' });
    }
});

// Create installment (User submits application)
router.post('/', isAuthenticated, async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const {
            product_id,
            dp_amount,
            tenor
        } = req.body;

        // Validate required fields
        if (!product_id || !dp_amount || !tenor) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Get product details
        const productResult = await client.query(`
            SELECT p.*, pi.image_path
            FROM products p
            LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = true
            WHERE p.id = $1 AND p.is_active = true
        `, [product_id]);

        if (productResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Product not found or inactive' });
        }

        const product = productResult.rows[0];

        // Get current price
        const priceResult = await client.query(`
            SELECT * FROM price_config
            WHERE price_date <= CURRENT_DATE
            ORDER BY price_date DESC
            LIMIT 1
        `);

        if (priceResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No price configuration found' });
        }

        const currentPrice = priceResult.rows[0];

        // Get system config
        const configResult = await client.query('SELECT * FROM system_config');
        const systemConfig = {};
        configResult.rows.forEach(row => {
            systemConfig[row.config_key] = parseFloat(row.config_value);
        });

        // Calculate total price (sell_price per gram * weight)
        const totalPrice = currentPrice.sell_price * product.weight_gram;

        // Calculate DP percentage
        const dpPercent = (dp_amount / totalPrice) * 100;

        // Validate installment parameters
        const validation = validateInstallmentParams({
            totalPrice,
            dpAmount: dp_amount,
            dpPercent,
            tenor,
            minDp: systemConfig.min_dp_percent,
            maxDp: systemConfig.max_dp_percent
        });

        if (!validation.valid) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: validation.errors.join(', ') });
        }

        // Calculate installment
        const calculation = calculateInstallment({
            totalPrice,
            dpAmount: dp_amount,
            tenor,
            marginPercent: systemConfig.margin_percent,
            adminFeePercent: systemConfig.admin_fee_percent
        });

        // Generate installment number
        const installmentNumber = generateInstallmentNumber();

        // Insert installment header
        const headerResult = await client.query(`
            INSERT INTO installment_header (
                installment_number,
                user_id,
                product_id,
                product_name,
                product_weight,
                product_image,
                sell_price,
                total_price,
                margin_percent,
                margin_amount,
                dp_amount,
                admin_fee,
                principal_amount,
                tenor_months,
                monthly_principal,
                monthly_margin,
                monthly_payment,
                total_payment,
                start_date,
                status
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
            ) RETURNING *
        `, [
            installmentNumber,
            req.session.user.id,
            product_id,
            product.product_name,
            product.weight_gram,
            product.image_path || null,
            currentPrice.sell_price,
            totalPrice,
            systemConfig.margin_percent,
            calculation.totalMargin,
            dp_amount,
            calculation.adminFee,
            calculation.principalAmount,
            tenor,
            calculation.monthlyPrincipal,
            calculation.monthlyMargin,
            calculation.monthlyPayment,
            calculation.totalPayment,
            new Date(),
            'pending'
        ]);

        const header = headerResult.rows[0];

        // Generate and insert installment schedule
        const schedule = generateInstallmentSchedule({
            startDate: header.start_date,
            tenor,
            monthlyPrincipal: calculation.monthlyPrincipal,
            monthlyMargin: calculation.monthlyMargin,
            monthlyPayment: calculation.monthlyPayment
        });

        for (const detail of schedule) {
            await client.query(`
                INSERT INTO installment_detail (
                    installment_header_id,
                    month_number,
                    due_date,
                    principal_amount,
                    margin_amount,
                    total_amount,
                    payment_status,
                    late_days,
                    penalty_amount,
                    paid_amount
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                header.id,
                detail.monthNumber,
                detail.dueDate,
                detail.principalAmount,
                detail.marginAmount,
                detail.totalAmount,
                detail.paymentStatus,
                detail.lateDays,
                detail.penaltyAmount,
                detail.paidAmount
            ]);
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            data: {
                header,
                details: schedule
            },
            message: 'Installment application submitted successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create installment error:', error);
        res.status(500).json({ error: 'Failed to create installment' });
    } finally {
        client.release();
    }
});

// Update installment status (Admin only)
router.put('/:id/status', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending', 'approved', 'active', 'completed', 'cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const result = await pool.query(`
            UPDATE installment_header
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `, [status, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Installment not found' });
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Installment status updated successfully'
        });
    } catch (error) {
        console.error('Update installment status error:', error);
        res.status(500).json({ error: 'Failed to update installment status' });
    }
});

// Pay installment
router.post('/:id/pay/:detailId', isAuthenticated, async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { id, detailId } = req.params;
        const { payment_amount, payment_method, reference_number } = req.body;

        // Get installment header
        const headerResult = await client.query(
            'SELECT * FROM installment_header WHERE id = $1',
            [id]
        );

        if (headerResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Installment not found' });
        }

        const header = headerResult.rows[0];

        // Check if user owns this installment or is admin
        if (header.user_id !== req.session.user.id && req.session.user.role !== 'admin') {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Get installment detail
        const detailResult = await client.query(
            'SELECT * FROM installment_detail WHERE id = $1 AND installment_header_id = $2',
            [detailId, id]
        );

        if (detailResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Installment detail not found' });
        }

        const detail = detailResult.rows[0];

        // Check if already paid
        if (detail.payment_status === 'paid') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'This installment has already been paid' });
        }

        // Calculate penalty if late
        const configResult = await client.query(
            'SELECT config_value FROM system_config WHERE config_key = $1',
            ['penalty_per_day']
        );

        const penaltyPerDay = parseFloat(configResult.rows[0].config_value);

        const penalty = calculatePenalty({
            dueDate: detail.due_date,
            paymentDate: new Date(),
            totalAmount: detail.total_amount,
            penaltyPerDay
        });

        // Calculate total amount to pay (including penalty)
        const totalAmountDue = detail.total_amount + penalty.penaltyAmount;

        // Validate payment amount
        if (payment_amount < totalAmountDue) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: 'Payment amount is insufficient',
                required: totalAmountDue,
                penalty: penalty.penaltyAmount
            });
        }

        // Update installment detail
        await client.query(`
            UPDATE installment_detail
            SET
                payment_status = $1,
                payment_date = CURRENT_TIMESTAMP,
                late_days = $2,
                penalty_amount = $3,
                paid_amount = $4,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
        `, [penalty.isLate ? 'late' : 'paid', penalty.lateDays, penalty.penaltyAmount, payment_amount, detailId]);

        // Insert payment history
        await client.query(`
            INSERT INTO payment_history (
                installment_detail_id,
                installment_header_id,
                user_id,
                payment_amount,
                payment_method,
                reference_number
            ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [detailId, id, req.session.user.id, payment_amount, payment_method || null, reference_number || null]);

        // Check if all installments are paid
        const remainingResult = await client.query(
            `SELECT COUNT(*) as count FROM installment_detail
             WHERE installment_header_id = $1 AND payment_status = 'unpaid'`,
            [id]
        );

        if (parseInt(remainingResult.rows[0].count) === 0) {
            await client.query(
                'UPDATE installment_header SET status = $1 WHERE id = $2',
                ['completed', id]
            );
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Payment recorded successfully',
            penalty: penalty.penaltyAmount,
            total_paid: payment_amount
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Pay installment error:', error);
        res.status(500).json({ error: 'Failed to record payment' });
    } finally {
        client.release();
    }
});

// Get payment history
router.get('/:id/payments', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user owns this installment or is admin
        const headerResult = await pool.query(
            'SELECT user_id FROM installment_header WHERE id = $1',
            [id]
        );

        if (headerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Installment not found' });
        }

        if (headerResult.rows[0].user_id !== req.session.user.id && req.session.user.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const result = await pool.query(
            'SELECT * FROM payment_history WHERE installment_header_id = $1 ORDER BY payment_date DESC',
            [id]
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get payment history error:', error);
        res.status(500).json({ error: 'Failed to fetch payment history' });
    }
});

// Calculate installment preview (before submission)
router.post('/calculate', async (req, res) => {
    try {
        const { product_id, dp_amount, tenor } = req.body;

        // Validate required fields
        if (!product_id || !dp_amount || !tenor) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Get product
        const productResult = await pool.query(
            'SELECT * FROM products WHERE id = $1 AND is_active = true',
            [product_id]
        );

        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found or inactive' });
        }

        const product = productResult.rows[0];

        // Get current price
        const priceResult = await pool.query(`
            SELECT * FROM price_config
            WHERE price_date <= CURRENT_DATE
            ORDER BY price_date DESC
            LIMIT 1
        `);

        if (priceResult.rows.length === 0) {
            return res.status(400).json({ error: 'No price configuration found' });
        }

        const currentPrice = priceResult.rows[0];

        // Get system config
        const configResult = await pool.query('SELECT * FROM system_config');
        const systemConfig = {};
        configResult.rows.forEach(row => {
            systemConfig[row.config_key] = parseFloat(row.config_value);
        });

        // Calculate total price
        const totalPrice = currentPrice.sell_price * product.weight_gram;

        // Calculate DP percentage
        const dpPercent = (dp_amount / totalPrice) * 100;

        // Validate
        const validation = validateInstallmentParams({
            totalPrice,
            dpAmount: dp_amount,
            dpPercent,
            tenor,
            minDp: systemConfig.min_dp_percent,
            maxDp: systemConfig.max_dp_percent
        });

        if (!validation.valid) {
            return res.status(400).json({ error: validation.errors.join(', '), errors: validation.errors });
        }

        // Calculate installment
        const calculation = calculateInstallment({
            totalPrice,
            dpAmount: dp_amount,
            tenor,
            marginPercent: systemConfig.margin_percent,
            adminFeePercent: systemConfig.admin_fee_percent
        });

        res.json({
            success: true,
            data: {
                product: {
                    name: product.product_name,
                    weight: product.weight_gram,
                    sell_price: currentPrice.sell_price
                },
                total_price: totalPrice,
                dp_amount: dp_amount,
                dp_percent: dpPercent,
                tenor: tenor,
                system_config: systemConfig,
                calculation: calculation
            }
        });
    } catch (error) {
        console.error('Calculate installment error:', error);
        res.status(500).json({ error: 'Failed to calculate installment' });
    }
});

module.exports = router;
