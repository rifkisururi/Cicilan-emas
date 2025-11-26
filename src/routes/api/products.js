const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const { isAuthenticated, isAdmin } = require('../../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../public/uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// Get all products
router.get('/', async (req, res) => {
    try {
        const { active_only } = req.query;

        let query = `
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
        `;

        if (active_only === 'true') {
            query += ' WHERE p.is_active = true';
        }

        query += ' GROUP BY p.id ORDER BY p.created_at DESC';

        const result = await pool.query(query);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Get product by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

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
            WHERE p.id = $1
            GROUP BY p.id
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// Create product (Admin only)
router.post('/', isAuthenticated, isAdmin, upload.single('image'), async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const {
            product_code,
            product_name,
            description,
            weight_gram,
            base_price,
            stock
        } = req.body;

        // Validate required fields
        if (!product_code || !product_name || !weight_gram || !base_price) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Insert product
        const productResult = await client.query(`
            INSERT INTO products
            (product_code, product_name, description, weight_gram, base_price, stock, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, true)
            RETURNING *
        `, [product_code, product_name, description || null, weight_gram, base_price, stock || 0]);

        const product = productResult.rows[0];

        // If image uploaded, save it
        if (req.file) {
            await client.query(`
                INSERT INTO product_images (product_id, image_path, is_primary)
                VALUES ($1, $2, true)
            `, [product.id, '/uploads/' + req.file.filename]);
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            data: product,
            message: 'Product created successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create product error:', error);

        if (error.code === '23505') {
            return res.status(400).json({ error: 'Product code already exists' });
        }

        res.status(500).json({ error: 'Failed to create product' });
    } finally {
        client.release();
    }
});

// Update product (Admin only)
router.put('/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            product_code,
            product_name,
            description,
            weight_gram,
            base_price,
            stock,
            is_active
        } = req.body;

        const result = await pool.query(`
            UPDATE products
            SET
                product_code = COALESCE($1, product_code),
                product_name = COALESCE($2, product_name),
                description = COALESCE($3, description),
                weight_gram = COALESCE($4, weight_gram),
                base_price = COALESCE($5, base_price),
                stock = COALESCE($6, stock),
                is_active = COALESCE($7, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $8
            RETURNING *
        `, [product_code, product_name, description, weight_gram, base_price, stock, is_active, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Product updated successfully'
        });
    } catch (error) {
        console.error('Update product error:', error);

        if (error.code === '23505') {
            return res.status(400).json({ error: 'Product code already exists' });
        }

        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Delete product (Admin only)
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if product is used in any installment
        const installmentCheck = await pool.query(
            'SELECT COUNT(*) as count FROM installment_header WHERE product_id = $1',
            [id]
        );

        if (parseInt(installmentCheck.rows[0].count) > 0) {
            return res.status(400).json({
                error: 'Cannot delete product that is used in installments'
            });
        }

        const result = await pool.query(
            'DELETE FROM products WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// Upload product image (Admin only)
router.post('/:id/images', isAuthenticated, isAdmin, upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { is_primary } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }

        // If this is primary image, unset other primary images
        if (is_primary === 'true') {
            await pool.query(
                'UPDATE product_images SET is_primary = false WHERE product_id = $1',
                [id]
            );
        }

        const result = await pool.query(`
            INSERT INTO product_images (product_id, image_path, is_primary)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [id, '/uploads/' + req.file.filename, is_primary === 'true']);

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Image uploaded successfully'
        });
    } catch (error) {
        console.error('Upload image error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// Delete product image (Admin only)
router.delete('/:id/images/:imageId', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { imageId } = req.params;

        const result = await pool.query(
            'DELETE FROM product_images WHERE id = $1 RETURNING image_path',
            [imageId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Image not found' });
        }

        // Delete file from filesystem
        const imagePath = path.join(__dirname, '../../public', result.rows[0].image_path);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }

        res.json({
            success: true,
            message: 'Image deleted successfully'
        });
    } catch (error) {
        console.error('Delete image error:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

module.exports = router;
