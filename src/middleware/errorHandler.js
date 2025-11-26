// Error handler middleware
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            details: err.errors
        });
    }

    // Database errors
    if (err.code && err.code.startsWith('23')) {
        return res.status(400).json({
            error: 'Database Error',
            message: 'Data constraint violation'
        });
    }

    // Default error
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error'
    });
};

module.exports = errorHandler;
