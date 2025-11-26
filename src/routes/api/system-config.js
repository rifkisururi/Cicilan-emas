const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const { isAuthenticated, isAdmin } = require('../../middleware/auth');

// Get all system configurations
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM system_config ORDER BY config_key');

        // Convert to object format
        const config = {};
        result.rows.forEach(row => {
            config[row.config_key] = {
                value: parseFloat(row.config_value),
                description: row.description
            };
        });

        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error('Get system config error:', error);
        res.status(500).json({ error: 'Failed to fetch system configuration' });
    }
});

// Get specific configuration by key
router.get('/:key', async (req, res) => {
    try {
        const { key } = req.params;

        const result = await pool.query(
            'SELECT * FROM system_config WHERE config_key = $1',
            [key]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Configuration not found' });
        }

        res.json({
            success: true,
            data: {
                key: result.rows[0].config_key,
                value: parseFloat(result.rows[0].config_value),
                description: result.rows[0].description
            }
        });
    } catch (error) {
        console.error('Get config by key error:', error);
        res.status(500).json({ error: 'Failed to fetch configuration' });
    }
});

// Update system configuration (Admin only)
router.put('/:key', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;

        if (value === undefined || value === null) {
            return res.status(400).json({ error: 'Value is required' });
        }

        // Validate value
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) {
            return res.status(400).json({ error: 'Value must be a non-negative number' });
        }

        // Additional validation for specific keys
        if (key === 'min_dp_percent' || key === 'max_dp_percent') {
            if (numValue > 100) {
                return res.status(400).json({ error: 'Percentage cannot exceed 100' });
            }
        }

        // Check if min_dp > max_dp
        if (key === 'min_dp_percent') {
            const maxDp = await pool.query(
                'SELECT config_value FROM system_config WHERE config_key = $1',
                ['max_dp_percent']
            );
            if (maxDp.rows.length > 0 && numValue > parseFloat(maxDp.rows[0].config_value)) {
                return res.status(400).json({ error: 'Min DP cannot be greater than Max DP' });
            }
        }

        if (key === 'max_dp_percent') {
            const minDp = await pool.query(
                'SELECT config_value FROM system_config WHERE config_key = $1',
                ['min_dp_percent']
            );
            if (minDp.rows.length > 0 && numValue < parseFloat(minDp.rows[0].config_value)) {
                return res.status(400).json({ error: 'Max DP cannot be less than Min DP' });
            }
        }

        const result = await pool.query(`
            UPDATE system_config
            SET config_value = $1, updated_at = CURRENT_TIMESTAMP
            WHERE config_key = $2
            RETURNING *
        `, [numValue, key]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Configuration not found' });
        }

        res.json({
            success: true,
            data: {
                key: result.rows[0].config_key,
                value: parseFloat(result.rows[0].config_value),
                description: result.rows[0].description
            },
            message: 'Configuration updated successfully'
        });
    } catch (error) {
        console.error('Update system config error:', error);
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

// Batch update system configurations (Admin only)
router.post('/batch', isAuthenticated, isAdmin, async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { configs } = req.body;

        if (!configs || typeof configs !== 'object') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Invalid configs format' });
        }

        const results = [];

        for (const [key, value] of Object.entries(configs)) {
            const numValue = parseFloat(value);

            if (isNaN(numValue) || numValue < 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    error: `Invalid value for ${key}: must be a non-negative number`
                });
            }

            const result = await client.query(`
                UPDATE system_config
                SET config_value = $1, updated_at = CURRENT_TIMESTAMP
                WHERE config_key = $2
                RETURNING *
            `, [numValue, key]);

            if (result.rows.length > 0) {
                results.push({
                    key: result.rows[0].config_key,
                    value: parseFloat(result.rows[0].config_value),
                    description: result.rows[0].description
                });
            }
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            data: results,
            message: 'Configurations updated successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Batch update system config error:', error);
        res.status(500).json({ error: 'Failed to update configurations' });
    } finally {
        client.release();
    }
});

module.exports = router;
