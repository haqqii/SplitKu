// ============================================================================
// VALIDATION & SANITIZATION - Security Foundation
// ============================================================================

const Validation = {
    // XSS Prevention - escape HTML characters
    sanitize: function(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    },

    // Sanitize for innerHTML usage
    escapeHtml: function(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    // Validate amount - must be positive number
    validateAmount: function(value) {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0;
    },

    // Validate description - max length, no scripts
    validateDescription: function(str) {
        if (!str || typeof str !== 'string') return { valid: false, error: 'Deskripsi harus diisi' };
        str = str.trim();
        if (str.length === 0) return { valid: false, error: 'Deskripsi tidak boleh kosong' };
        if (str.length > 200) return { valid: false, error: 'Deskripsi maksimal 200 karakter' };

        // Check for script injection attempts
        const scriptPattern = /<script|javascript:|on\w+=/i;
        if (scriptPattern.test(str)) {
            return { valid: false, error: 'Karakter tidak diizinkan' };
        }

        return { valid: true, value: str };
    },

    // Validate person name
    validatePersonName: function(str) {
        if (!str || typeof str !== 'string') return { valid: false, error: 'Nama harus diisi' };
        str = str.trim();
        if (str.length === 0) return { valid: false, error: 'Nama tidak boleh kosong' };
        if (str.length > 50) return { valid: false, error: 'Nama maksimal 50 karakter' };

        // Allow letters (including Indonesian), numbers, spaces, and common chars
        const namePattern = /^[a-zA-Z0-9\s'.,-]+$/;
        if (!namePattern.test(str)) {
            return { valid: false, error: 'Nama hanya boleh huruf, angka, spasi, koma, titik, kutip, dan strip' };
        }

        return { valid: true, value: str };
    },

    // Validate category
    validateCategory: function(str) {
        const validCategories = ['makan', 'transport', 'rumah', 'hiburan', 'belanja', 'kesehatan', 'lainnya'];
        if (!str || !validCategories.includes(str)) {
            return { valid: false, error: 'Kategori tidak valid' };
        }
        return { valid: true, value: str };
    },

    // Validate budget amount
    validateBudget: function(value) {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0) {
            return { valid: false, error: 'Budget harus angka positif' };
        }
        if (num > 1000000000) { // Max 1 miliar
            return { valid: false, error: 'Budget terlalu besar' };
        }
        return { valid: true, value: num };
    },

    // Validate date format (YYYY-MM-DD)
    validateDate: function(str) {
        if (!str) return { valid: true, value: null }; // Optional
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (!datePattern.test(str)) {
            return { valid: false, error: 'Format tanggal tidak valid' };
        }
        const date = new Date(str);
        if (isNaN(date.getTime())) {
            return { valid: false, error: 'Tanggal tidak valid' };
        }
        return { valid: true, value: str };
    },

    // Validate import JSON schema
    validateImportData: function(data) {
        if (!data || typeof data !== 'object') {
            return { valid: false, error: 'Format data tidak valid' };
        }

        // Check version
        if (!data.version) {
            // Try to handle old format
            if (Array.isArray(data)) {
                // Old format: just transactions array
                return {
                    valid: true,
                    value: {
                        version: '1.0-legacy',
                        transactions: data,
                        people: null,
                        settings: null
                    }
                };
            }
            return { valid: false, error: 'Data tidak memiliki versi yang valid' };
        }

        // Validate transactions
        if (data.transactions && !Array.isArray(data.transactions)) {
            return { valid: false, error: 'Transaksi harus array' };
        }

        if (data.people && !Array.isArray(data.people)) {
            return { valid: false, error: 'People harus array' };
        }

        return { valid: true, value: data };
    },

    // Validate transaction object
    validateTransaction: function(t) {
        const errors = [];

        if (!t.description) errors.push('Deskripsi diperlukan');
        if (!t.payer) errors.push('Pembayar diperlukan');
        if (t.totalAmount === undefined || t.totalAmount < 0) errors.push('Total amount tidak valid');
        if (!t.split || typeof t.split !== 'object') errors.push('Split data tidak valid');

        return errors.length === 0
            ? { valid: true }
            : { valid: false, error: errors.join(', ') };
    }
};

// Expose globally
window.Validation = Validation;
window.sanitize = Validation.sanitize.bind(Validation);
window.escapeHtml = Validation.escapeHtml.bind(Validation);
