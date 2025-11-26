require('dotenv').config();

const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const morgan = require('morgan');
const pool = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Middleware
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'user_sessions',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
}));

// Make user available in all views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.formatCurrency = require('./utils/formatters').formatCurrency;
    res.locals.formatDate = require('./utils/formatters').formatDate;
    res.locals.formatDateTime = require('./utils/formatters').formatDateTime;
    next();
});

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/api/products'));
app.use('/api/price-config', require('./routes/api/price-config'));
app.use('/api/system-config', require('./routes/api/system-config'));
app.use('/api/installments', require('./routes/api/installments'));
app.use('/admin', require('./routes/admin'));
app.use('/user', require('./routes/user'));

// Home route
app.get('/', (req, res) => {
    if (req.session.user) {
        if (req.session.user.role === 'admin') {
            return res.redirect('/admin/dashboard');
        } else {
            return res.redirect('/user/dashboard');
        }
    }
    res.redirect('/login');
});

// Login page
app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('login', { error: null });
});

// Error handler
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    res.status(404).render('404', { title: 'Page Not Found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server is running on port ${PORT}`);
    console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 URL: http://localhost:${PORT}\n`);
});

module.exports = app;
