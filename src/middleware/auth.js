// Authentication middleware
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }

    // Check if it's an API request
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Redirect to login for web requests
    res.redirect('/login');
};

// Admin role middleware
const isAdmin = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }

    // Check if it's an API request
    if (req.path.startsWith('/api/')) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    res.status(403).send('Forbidden: Admin access required');
};

// User role middleware
const isUser = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'user') {
        return next();
    }

    // Check if it's an API request
    if (req.path.startsWith('/api/')) {
        return res.status(403).json({ error: 'Forbidden: User access required' });
    }

    res.status(403).send('Forbidden: User access required');
};

module.exports = {
    isAuthenticated,
    isAdmin,
    isUser
};
