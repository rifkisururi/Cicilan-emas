const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Get user from database
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const user = result.rows[0];

        // Verify password
        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Store user in session
        req.session.user = {
            id: user.id,
            username: user.username,
            fullName: user.full_name,
            email: user.email,
            role: user.role
        };

        res.json({
            success: true,
            user: req.session.user,
            redirectUrl: user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Register
router.post('/register', async (req, res) => {
    try {
        const { username, password, fullName, email, phone } = req.body;

        // Validate input
        if (!username || !password || !fullName || !email) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if username or email already exists
        const existingUser = await pool.query(
            'SELECT * FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        const result = await pool.query(
            `INSERT INTO users (username, password, full_name, email, phone, role)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, username, full_name, email, role`,
            [username, hashedPassword, fullName, email, phone || null, 'user']
        );

        const newUser = result.rows[0];

        // Store user in session
        req.session.user = {
            id: newUser.id,
            username: newUser.username,
            fullName: newUser.full_name,
            email: newUser.email,
            role: newUser.role
        };

        res.json({
            success: true,
            user: req.session.user,
            redirectUrl: '/user/dashboard'
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to logout' });
        }
        res.json({ success: true, redirectUrl: '/login' });
    });
});

// Check session
router.get('/check', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, user: req.session.user });
    } else {
        res.json({ authenticated: false });
    }
});

module.exports = router;
