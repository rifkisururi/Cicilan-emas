/**
 * Utility functions for formatting
 */

/**
 * Format number to Indonesian Rupiah currency
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

/**
 * Format date to Indonesian format
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    }).format(new Date(date));
}

/**
 * Format date to ISO format (YYYY-MM-DD)
 * @param {Date|string} date - Date to format
 * @returns {string} ISO formatted date string
 */
function formatDateISO(date) {
    return new Date(date).toISOString().split('T')[0];
}

/**
 * Format datetime to Indonesian format
 * @param {Date|string} datetime - Datetime to format
 * @returns {string} Formatted datetime string
 */
function formatDateTime(datetime) {
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(datetime));
}

/**
 * Parse currency string to number
 * @param {string} currencyStr - Currency string
 * @returns {number} Parsed number
 */
function parseCurrency(currencyStr) {
    if (typeof currencyStr === 'number') return currencyStr;
    return parseFloat(currencyStr.replace(/[^0-9.-]+/g, ''));
}

module.exports = {
    formatCurrency,
    formatDate,
    formatDateISO,
    formatDateTime,
    parseCurrency
};
