const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const { isAuthenticated, isAdmin } = require('../../middleware/auth');

// Get all price configurations
router.get('/', async (req, res) => {
    try {
        const { limit = 30 } = req.query;

        const result = await pool.query(`
            SELECT * FROM price_config
            ORDER BY price_date DESC
            LIMIT $1
        `, [limit]);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get price config error:', error);
        res.status(500).json({ error: 'Failed to fetch price configuration' });
    }
});

// Get current/latest price
router.get('/current', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM price_config
            WHERE price_date <= CURRENT_DATE
            ORDER BY price_date DESC
            LIMIT 1
        `);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No price configuration found' });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Get current price error:', error);
        res.status(500).json({ error: 'Failed to fetch current price' });
    }
});

// Get price by date
router.get('/:date', async (req, res) => {
    try {
        const { date } = req.params;

        const result = await pool.query(
            'SELECT * FROM price_config WHERE price_date = $1',
            [date]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Price configuration not found for this date' });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Get price by date error:', error);
        res.status(500).json({ error: 'Failed to fetch price configuration' });
    }
});

// Create or update price configuration (Admin only)
router.post('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { price_date, buy_price, sell_price, notes } = req.body;

        // Validate required fields
        if (!price_date || !buy_price || !sell_price) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate prices
        if (buy_price <= 0 || sell_price <= 0) {
            return res.status(400).json({ error: 'Prices must be greater than 0' });
        }

        if (buy_price > sell_price) {
            return res.status(400).json({ error: 'Buy price cannot be greater than sell price' });
        }

        // Insert or update
        const result = await pool.query(`
            INSERT INTO price_config (price_date, buy_price, sell_price, notes)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (price_date)
            DO UPDATE SET
                buy_price = EXCLUDED.buy_price,
                sell_price = EXCLUDED.sell_price,
                notes = EXCLUDED.notes,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [price_date, buy_price, sell_price, notes || null]);

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Price configuration saved successfully'
        });
    } catch (error) {
        console.error('Save price config error:', error);
        res.status(500).json({ error: 'Failed to save price configuration' });
    }
});

// Update price configuration (Admin only)
router.put('/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { buy_price, sell_price, notes } = req.body;

        // Validate prices if provided
        if (buy_price && buy_price <= 0) {
            return res.status(400).json({ error: 'Buy price must be greater than 0' });
        }

        if (sell_price && sell_price <= 0) {
            return res.status(400).json({ error: 'Sell price must be greater than 0' });
        }

        const result = await pool.query(`
            UPDATE price_config
            SET
                buy_price = COALESCE($1, buy_price),
                sell_price = COALESCE($2, sell_price),
                notes = COALESCE($3, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *
        `, [buy_price, sell_price, notes, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Price configuration not found' });
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Price configuration updated successfully'
        });
    } catch (error) {
        console.error('Update price config error:', error);
        res.status(500).json({ error: 'Failed to update price configuration' });
    }
});

// Delete price configuration (Admin only)
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM price_config WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Price configuration not found' });
        }

        res.json({
            success: true,
            message: 'Price configuration deleted successfully'
        });
    } catch (error) {
        console.error('Delete price config error:', error);
        res.status(500).json({ error: 'Failed to delete price configuration' });
    }
});

module.exports = router;
