/**
 * Installment Calculator - Perhitungan Cicilan Sistem Flat
 */

/**
 * Validate installment parameters
 */
function validateInstallmentParams(params) {
    const { totalPrice, dpAmount, dpPercent, tenor, minDp, maxDp } = params;

    const errors = [];

    // Validate DP percentage
    if (dpPercent < minDp || dpPercent > maxDp) {
        errors.push(`DP harus antara ${minDp}% - ${maxDp}%`);
    }

    // Validate DP amount
    const calculatedDpPercent = (dpAmount / totalPrice) * 100;
    if (calculatedDpPercent < minDp || calculatedDpPercent > maxDp) {
        errors.push(`Jumlah DP tidak sesuai dengan range yang ditentukan`);
    }

    // Validate tenor (minimum 12 months, multiples of 6)
    if (tenor < 12) {
        errors.push('Tenor minimal 12 bulan');
    }

    if (tenor % 6 !== 0) {
        errors.push('Tenor harus kelipatan 6 bulan');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Calculate installment details using flat system
 *
 * @param {Object} params - Calculation parameters
 * @param {number} params.totalPrice - Total harga produk (harga jual * berat)
 * @param {number} params.dpAmount - Jumlah DP
 * @param {number} params.tenor - Tenor dalam bulan
 * @param {number} params.marginPercent - Margin dalam persen (per tahun)
 * @param {number} params.adminFeePercent - Biaya admin dalam persen
 * @returns {Object} Calculated installment details
 */
function calculateInstallment(params) {
    const {
        totalPrice,
        dpAmount,
        tenor,
        marginPercent,
        adminFeePercent
    } = params;

    // Hitung jumlah pinjaman (pokok)
    const principalAmount = totalPrice - dpAmount;

    // Hitung biaya admin
    const adminFee = totalPrice * (adminFeePercent / 100);

    // Hitung cicilan pokok per bulan (flat)
    const monthlyPrincipal = principalAmount / tenor;

    // Hitung margin per bulan (flat)
    // Margin dihitung dari pokok × (margin% / 12)
    const monthlyMargin = principalAmount * (marginPercent / 12 / 100);

    // Total cicilan per bulan
    const monthlyPayment = monthlyPrincipal + monthlyMargin;

    // Total margin selama tenor
    const totalMargin = monthlyMargin * tenor;

    // Total pembayaran keseluruhan (DP + pokok + margin + admin fee)
    const totalPayment = dpAmount + principalAmount + totalMargin + adminFee;

    return {
        principalAmount: parseFloat(principalAmount.toFixed(2)),
        adminFee: parseFloat(adminFee.toFixed(2)),
        monthlyPrincipal: parseFloat(monthlyPrincipal.toFixed(2)),
        monthlyMargin: parseFloat(monthlyMargin.toFixed(2)),
        monthlyPayment: parseFloat(monthlyPayment.toFixed(2)),
        totalMargin: parseFloat(totalMargin.toFixed(2)),
        totalPayment: parseFloat(totalPayment.toFixed(2))
    };
}

/**
 * Generate installment schedule (detail cicilan per bulan)
 *
 * @param {Object} params - Schedule parameters
 * @param {Date} params.startDate - Tanggal mulai cicilan
 * @param {number} params.tenor - Tenor dalam bulan
 * @param {number} params.monthlyPrincipal - Cicilan pokok per bulan
 * @param {number} params.monthlyMargin - Cicilan margin per bulan
 * @param {number} params.monthlyPayment - Total cicilan per bulan
 * @returns {Array} Array of installment details
 */
function generateInstallmentSchedule(params) {
    const {
        startDate,
        tenor,
        monthlyPrincipal,
        monthlyMargin,
        monthlyPayment
    } = params;

    const schedule = [];
    const start = new Date(startDate);

    for (let month = 1; month <= tenor; month++) {
        // Calculate due date (add months to start date)
        const dueDate = new Date(start);
        dueDate.setMonth(start.getMonth() + month);

        schedule.push({
            monthNumber: month,
            dueDate: dueDate.toISOString().split('T')[0], // Format: YYYY-MM-DD
            principalAmount: parseFloat(monthlyPrincipal.toFixed(2)),
            marginAmount: parseFloat(monthlyMargin.toFixed(2)),
            totalAmount: parseFloat(monthlyPayment.toFixed(2)),
            paymentStatus: 'unpaid',
            lateDays: 0,
            penaltyAmount: 0,
            paidAmount: 0
        });
    }

    return schedule;
}

/**
 * Calculate penalty for late payment
 *
 * @param {Object} params - Penalty parameters
 * @param {Date} params.dueDate - Tanggal jatuh tempo
 * @param {Date} params.paymentDate - Tanggal pembayaran (default: today)
 * @param {number} params.totalAmount - Jumlah cicilan
 * @param {number} params.penaltyPerDay - Denda per hari dalam persen
 * @returns {Object} Penalty calculation result
 */
function calculatePenalty(params) {
    const {
        dueDate,
        paymentDate = new Date(),
        totalAmount,
        penaltyPerDay
    } = params;

    const due = new Date(dueDate);
    const payment = new Date(paymentDate);

    // Calculate late days
    const diffTime = payment - due;
    const lateDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Calculate penalty amount
    const penaltyAmount = lateDays > 0
        ? totalAmount * (penaltyPerDay / 100) * lateDays
        : 0;

    return {
        lateDays,
        penaltyAmount: parseFloat(penaltyAmount.toFixed(2)),
        isLate: lateDays > 0
    };
}

/**
 * Generate installment number
 * Format: INS-YYYYMMDD-XXXXX
 */
function generateInstallmentNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 100000)).padStart(5, '0');

    return `INS-${year}${month}${day}-${random}`;
}

module.exports = {
    validateInstallmentParams,
    calculateInstallment,
    generateInstallmentSchedule,
    calculatePenalty,
    generateInstallmentNumber
};
