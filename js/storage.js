// ============================================================================
// STORAGE - Data Persistence (Export/Import/Backup)
// ============================================================================

const Storage = {
    // Storage keys
    KEYS: {
        TRANSACTIONS: 'hartaGonoGini_transactions',
        NEXT_ID: 'hartaGonoGini_nextId',
        PEOPLE: 'hartaGonoGini_people',
        SETTINGS: 'hartaGonoGini_settings',
        BUDGETS: 'hartaGonoGini_budgets'
    },

    // Current data version
    VERSION: '2.0',
    VERSION_KEY: 'hartaGonoGini_version',

    // Migrate stored data from older versions to current schema
    migrate: function() {
        let stored = null;
        try {
            stored = localStorage.getItem(this.VERSION_KEY);
        } catch (e) {
            // localStorage unavailable — skip migration
            return;
        }

        const currentVersion = this.VERSION;
        if (stored === currentVersion) return;

        const fromVersion = stored || '1.0-legacy';

        // 1.0 → 2.0: ensure every transaction has splitStatus + lowercased payer/split keys
        if (fromVersion !== '2.0') {
            try {
                const txs = this.get(this.KEYS.TRANSACTIONS) || [];
                let mutated = false;

                for (const t of txs) {
                    if (!t.splitStatus || typeof t.splitStatus !== 'object') {
                        t.splitStatus = {};
                        mutated = true;
                    }
                    if (t.payer && typeof t.payer === 'string') {
                        const lower = t.payer.toLowerCase();
                        if (lower !== t.payer) {
                            t.payer = lower;
                            mutated = true;
                        }
                    }
                    if (t.split && typeof t.split === 'object') {
                        const normalized = {};
                        let splitMutated = false;
                        for (const k of Object.keys(t.split)) {
                            const lower = k.toLowerCase();
                            normalized[lower] = t.split[k];
                            if (lower !== k) splitMutated = true;
                        }
                        if (splitMutated) {
                            t.split = normalized;
                            mutated = true;
                        }
                    }
                }

                if (mutated) {
                    this.set(this.KEYS.TRANSACTIONS, txs);
                }
            } catch (e) {
                console.error('Migration error (1.0 → 2.0):', e);
            }
        }

        try {
            localStorage.setItem(this.VERSION_KEY, currentVersion);
        } catch (e) {
            console.error('Failed to persist version key:', e);
        }
    },

    // Get all data for export
    getExportData: function() {
        return {
            version: this.VERSION,
            exportDate: new Date().toISOString(),
            transactions: this.get(this.KEYS.TRANSACTIONS) || [],
            people: this.get(this.KEYS.PEOPLE) || null,
            budgets: this.get(this.KEYS.BUDGETS) || null,
            settings: this.get(this.KEYS.SETTINGS) || {}
        };
    },

    // Simple get
    get: function(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Storage get error:', e);
            return null;
        }
    },

    // Simple set
    set: function(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    },

    // Export to JSON file
    exportJSON: function() {
        const data = this.getExportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `harta-gonogini-backup-${this.formatDateForFilename(new Date())}.json`;
        link.click();
        URL.revokeObjectURL(url);

        if (typeof showToast === 'function') {
            showToast('Berhasil export data');
        }
    },

    // Import from JSON, CSV, or XLSX file
    importJSON: function(file) {
        console.log('importJSON called with file:', file ? file.name : 'null');
        if (!file || !file.name) {
            return Promise.reject(new Error('File tidak valid'));
        }
        const fileName = file.name.toLowerCase();
        const isXLSX = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
        const importMode = window.pendingImportMode || 'merge';

        return new Promise((resolve, reject) => {
            console.log('Promise created, isXLSX:', isXLSX);
            if (isXLSX) {
                // XLSX: read as binary
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const arrayData = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(arrayData, { type: 'array' });
                        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                        if (jsonData.length < 2) {
                            reject(new Error('File XLSX kosong atau tidak valid'));
                            return;
                        }

                        // Get current people for split matching
                        const currentPeople = this.get(this.KEYS.PEOPLE) || [];
                        const importData = this.parseXLSX(jsonData, currentPeople);

                        const newTransactions = JSON.parse(JSON.stringify(importData.transactions || []));
                        const newNextId = importData.nextId || 1;

                        // Extract and save people from imported transactions
                        const extractedPeople = this.extractPeopleFromTransactions(newTransactions);

                        if (importMode === 'replace') {
                            // Replace all data
                            this.set(this.KEYS.TRANSACTIONS, newTransactions);
                            this.set(this.KEYS.NEXT_ID, newNextId);
                            if (extractedPeople.length > 0) {
                                this.set(this.KEYS.PEOPLE, extractedPeople);
                            }
                            console.log('About to resolve XLSX replace');
                            resolve({ transactions: newTransactions.length, people: extractedPeople.length, mode: 'replace' });
                        } else {
                            // Merge: combine with existing data
                            const existingTransactions = this.get(this.KEYS.TRANSACTIONS) || [];
                            const existingPeople = this.get(this.KEYS.PEOPLE) || [];
                            const existingNextId = this.get(this.KEYS.NEXT_ID) || 1;

                            // Merge transactions (create new objects with new IDs to avoid modifying original)
                            let nextId = existingNextId;
                            const mergedTransactions = [
                                ...existingTransactions,
                                ...newTransactions.map(t => ({...t, id: nextId++}))
                            ];

                            // Merge people (avoid duplicates)
                            const peopleMap = {};
                            existingPeople.forEach(p => peopleMap[p.key] = p);
                            extractedPeople.forEach(p => {
                                if (!peopleMap[p.key]) {
                                    peopleMap[p.key] = p;
                                }
                            });
                            const mergedPeople = Object.values(peopleMap);

                            this.set(this.KEYS.TRANSACTIONS, mergedTransactions);
                            this.set(this.KEYS.NEXT_ID, existingNextId);
                            this.set(this.KEYS.PEOPLE, mergedPeople);

                            resolve({
                                transactions: newTransactions.length,
                                merged: mergedTransactions.length,
                                people: mergedPeople.length,
                                mode: 'merge'
                            });
                        }
                    } catch (err) {
                        reject(new Error('File tidak valid: ' + err.message));
                    }
                };
                reader.onerror = () => reject(new Error('Gagal membaca file'));
                reader.readAsArrayBuffer(file);
            } else {
                // JSON or CSV: read as text
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const content = e.target.result.trim();
                        let data;
                        // Get current people for split matching
                        const currentPeople = this.get(this.KEYS.PEOPLE) || [];

                        // Check if it's CSV (starts with ID followed by delimiter)
                        const isCSV = /^ID[\s,\t"]/.test(content) || content.startsWith('"ID"');
                        if (isCSV) {
                            // Parse CSV
                            data = this.parseCSV(content, currentPeople);
                        } else {
                            // Parse JSON
                            data = JSON.parse(content);
                        }

                        // Validate data
                        const validation = Validation.validateImportData(data);
                        if (!validation.valid) {
                            reject(new Error(validation.error));
                            return;
                        }

                        const newTransactions = JSON.parse(JSON.stringify(data.transactions || []));
                        const newPeople = JSON.parse(JSON.stringify(data.people || []));
                        const existingTransactions = this.get(this.KEYS.TRANSACTIONS) || [];
                        const existingPeople = this.get(this.KEYS.PEOPLE) || [];
                        const existingNextId = this.get(this.KEYS.NEXT_ID) || 1;

                        if (importMode === 'replace') {
                            // Replace all data
                            if (data.transactions) this.set(this.KEYS.TRANSACTIONS, data.transactions);
                            if (data.people) this.set(this.KEYS.PEOPLE, data.people);
                            if (data.budgets) this.set(this.KEYS.BUDGETS, data.budgets);
                            if (data.settings) this.set(this.KEYS.SETTINGS, data.settings);
                            console.log('About to resolve JSON replace');
                            resolve({ transactions: data.transactions?.length || 0, people: data.people?.length || 0, mode: 'replace' });
                        } else {
                            // Merge: combine with existing data
                            // Create new objects with new IDs to avoid modifying original
                            let nextId = existingNextId;
                            const mergedTransactions = [
                                ...existingTransactions,
                                ...newTransactions.map(t => ({...t, id: nextId++}))
                            ];

                            // Merge people (avoid duplicates)
                            const peopleMap = {};
                            existingPeople.forEach(p => peopleMap[p.key] = p);
                            newPeople.forEach(p => {
                                if (!peopleMap[p.key]) {
                                    peopleMap[p.key] = p;
                                }
                            });
                            const mergedPeople = Object.values(peopleMap);

                            this.set(this.KEYS.TRANSACTIONS, mergedTransactions);
                            this.set(this.KEYS.PEOPLE, mergedPeople);
                            this.set(this.KEYS.NEXT_ID, nextId);
                            if (data.budgets) this.set(this.KEYS.BUDGETS, data.budgets);
                            if (data.settings) this.set(this.KEYS.SETTINGS, data.settings);

                            resolve({
                                transactions: newTransactions.length,
                                merged: mergedTransactions.length,
                                people: mergedPeople.length,
                                mode: 'merge'
                            });
                        }
                    } catch (err) {
                        reject(new Error('File tidak valid: ' + err.message));
                    }
                };
                reader.onerror = () => reject(new Error('Gagal membaca file'));
                reader.readAsText(file);
            }
        });
    },

    // Parse CSV to transactions format
    parseCSV: function(csvContent, people) {
        const lines = csvContent.split('\n');
        const headerLine = lines[0];

        // Detect delimiter (comma, tab, or multiple spaces)
        let delimiter = ',';
        if (headerLine.includes('\t')) {
            delimiter = '\t';
        } else if (/ID\s{2,}|ID\s{2,}Tanggal/.test(headerLine)) {
            delimiter = /\s{2,}/;
        }

        // Split headers by detected delimiter
        const headers = headerLine.split(delimiter).map(h => h.replace(/"/g, '').trim());

        // Find column indices (case-insensitive)
        const findIdx = (name) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());

        const idIdx = findIdx('ID');
        const dateIdx = findIdx('Tanggal');
        const descIdx = findIdx('Deskripsi');
        const catIdx = findIdx('Kategori');
        const payerIdx = findIdx('Pembayar');
        const totalIdx = findIdx('Total');
        const splitIdx = findIdx('Split');
        const statusIdx = findIdx('Status');

        const transactions = [];
        let nextId = 1;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Parse line by detected delimiter
            let values;
            if (delimiter instanceof RegExp) {
                values = line.split(delimiter).map(v => v.trim());
            } else {
                values = this.parseCSVLine(line);
            }

            if (values.length < 3) continue;

            const id = (idIdx >= 0 && values[idIdx]) ? values[idIdx] : ('t' + (Date.now() + i));
            const dateRaw = (dateIdx >= 0 && values[dateIdx]) ? values[dateIdx].replace(/^"|"$/g, '').trim() : '';
            const date = this.parseDate(dateRaw) || new Date().toISOString().split('T')[0];
            const description = (descIdx >= 0 && values[descIdx]) ? values[descIdx].replace(/^"|"$/g, '').trim() : '';
            const category = (catIdx >= 0 && values[catIdx]) ? values[catIdx].replace(/^"|"$/g, '').trim() : 'lainnya';
            const payer = (payerIdx >= 0 && values[payerIdx]) ? values[payerIdx].replace(/^"|"$/g, '').trim() : '';
            const payerKey = payer.toLowerCase().replace(/\s+/g, '');
            const totalAmount = (totalIdx >= 0 && values[totalIdx]) ? parseFloat(values[totalIdx].replace(/[^0-9.-]/g, '')) || 0 : 0;
            const splitData = (splitIdx >= 0 && values[splitIdx]) ? values[splitIdx].replace(/^"|"$/g, '').trim() : '';
            const split = this.parseCSVSplit(splitData, totalAmount, payerKey, people);
            const status = (statusIdx >= 0 && values[statusIdx]) ? values[statusIdx].replace(/^"|"$/g, '').trim() : 'Pending';

            // Skip if no valid data
            if (!description && totalAmount === 0) continue;

            transactions.push({
                id,
                date,
                description: description || 'Imported',
                category,
                payer,
                payerKey,
                totalAmount,
                split,
                items: [],
                splitStatus: this.calculateSplitStatus(split, status),
                createdAt: new Date().toISOString()
            });

            const numId = parseInt(id.replace('t', '')) || 0;
            if (numId >= nextId) nextId = numId + 1;
        }

        return {
            version: '2.0',
            transactions: transactions,
            people: null,
            nextId: nextId
        };
    },

    // Parse date from various formats
    parseDate: function(dateStr) {
        if (!dateStr) return null;
        dateStr = dateStr.trim();

        // Already ISO format (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            return dateStr.split('T')[0];
        }

        // DD/MM/YYYY or DD-MM-YYYY
        const ddmmyyyy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (ddmmyyyy) {
            const [, d, m, y] = ddmmyyyy;
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }

        // MM/DD/YYYY (US format) — also handles ambiguous DD/MM
        const mmddyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (mmddyyyy) {
            const [, m, d, y] = mmddyyyy;
            // m > 12 means first number is clearly a day (DD/MM format)
            if (parseInt(m) > 12) {
                return `${y}-${d.padStart(2, '0')}-${m.padStart(2, '0')}`;
            }
            // Both ≤ 12: default to DD/MM for Indonesian locale
            // (swap — first number is day, second is month)
            return `${y}-${d.padStart(2, '0')}-${m.padStart(2, '0')}`;
        }

        // Try native Date parsing as fallback
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
        }

        return null;
    },

    // Parse a single CSV line handling quoted fields
    parseCSVLine: function(line) {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        return values;
    },

    // Parse split data from CSV
    parseCSVSplit: function(splitStr, totalAmount, payerKey, people) {
        const split = {};

        // Get available person keys (exclude payer since they already paid)
        const peopleKeys = people ? people.filter(p => p.key !== payerKey).map(p => p.key) : [];

        if (!splitStr) {
            // If no split data, assume others pay the payer equally
            if (peopleKeys.length > 0) {
                const perPerson = totalAmount / (peopleKeys.length + 1);
                peopleKeys.forEach(key => {
                    split[key] = perPerson;
                });
            }
            return split;
        }

        // Parse format: Person(amount); Person(amount) or Person(amount)(items)
        const parts = splitStr.split(';');
        parts.forEach(part => {
            const match = part.match(/([^(]+)\(([^)]+)\)/);
            if (match) {
                const name = match[1].trim();
                const key = name.toLowerCase().replace(/\s+/g, '');
                const amount = parseFloat(match[2]) || 0;

                // Skip if this is the payer (they already paid)
                if (key === payerKey) return;

                // Match with existing person key
                let matchedKey = key;
                if (peopleKeys.includes(key)) {
                    matchedKey = key;
                } else {
                    // Try partial match
                    const found = peopleKeys.find(pk => pk.includes(key) || key.includes(pk));
                    if (found) matchedKey = found;
                }

                if (matchedKey && matchedKey !== payerKey) {
                    split[matchedKey] = (split[matchedKey] || 0) + amount;
                }
            }
        });

        return split;
    },

    // Calculate split status based on status string
    parseXLSX: function(rows, people) {
        if (!rows || rows.length < 2) {
            return { transactions: [], nextId: 1 };
        }

        const headers = rows[0].map(h => String(h || '').trim());
        const transactions = [];
        let nextId = 1;

        // Find column indices (case-insensitive)
        const findIdx = (name) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());

        const idIdx = findIdx('ID');
        const dateIdx = findIdx('Tanggal');
        const descIdx = findIdx('Deskripsi');
        const catIdx = findIdx('Kategori');
        const payerIdx = findIdx('Pembayar');
        const totalIdx = findIdx('Total');
        const splitIdx = findIdx('Split');
        const statusIdx = findIdx('Status');

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const getVal = (idx) => {
                if (idx < 0 || idx >= row.length) return '';
                let val = row[idx];
                // Handle XLSX cell objects (some cells might be objects)
                if (val && typeof val === 'object') {
                    val = val.v || val.w || '';
                }
                return String(val || '').trim();
            };

            const id = getVal(idIdx) || ('t' + (Date.now() + i));
            const dateRaw = getVal(dateIdx);
            // Handle Excel date serial numbers for date column
            let parsedDate = dateRaw;
            if (dateIdx >= 0 && rows[i][dateIdx] && typeof rows[i][dateIdx] === 'number') {
                const val = rows[i][dateIdx];
                if (val > 25569 && val < 2958465) {
                    // Excel date serial to JS date
                    const date = new Date((val - 25569) * 86400 * 1000);
                    parsedDate = date.toISOString().split('T')[0];
                }
            }
            const date = this.parseDate(parsedDate) || new Date().toISOString().split('T')[0];
            const description = getVal(descIdx);
            const category = getVal(catIdx) || 'lainnya';
            const payer = getVal(payerIdx) || '';
            const payerKey = payer.toLowerCase().replace(/\s+/g, '');
            const totalAmount = parseFloat(getVal(totalIdx).replace(/[^0-9.-]/g, '')) || 0;
            const splitStr = getVal(splitIdx);
            const status = getVal(statusIdx);

            // Skip empty rows
            if (!description && totalAmount === 0) continue;

            // Parse split - pass people for key matching
            const split = this.parseCSVSplit(splitStr, totalAmount, payerKey, people);

            transactions.push({
                id,
                date,
                description: description || 'Imported',
                category,
                payer,
                payerKey,
                totalAmount,
                split,
                items: [],
                splitStatus: this.calculateSplitStatus(split, status),
                createdAt: new Date().toISOString()
            });

            const numId = parseInt(id.replace('t', '')) || 0;
            if (numId >= nextId) nextId = numId + 1;
        }

        return { transactions, nextId };
    },

    calculateSplitStatus: function(split, status) {
        const splitStatus = {};
        const isSettled = status.toLowerCase() === 'settled';
        Object.keys(split).forEach(key => {
            splitStatus[key] = isSettled ? 'paid' : 'pending';
        });
        return splitStatus;
    },

    // Export to CSV
    exportCSV: function() {
        const transactions = this.get(this.KEYS.TRANSACTIONS) || [];
        if (transactions.length === 0) {
            alert('Tidak ada data untuk export');
            return;
        }

        // CSV header
        const headers = ['ID', 'Tanggal', 'Deskripsi', 'Kategori', 'Pembayar', 'Total', 'Split', 'Status'];

        // CSV rows
        const rows = transactions.map(t => {
            const splitParts = [];
            Object.entries(t.split || {}).forEach(([person, data]) => {
                const amount = typeof data === 'number' ? data : data.amount;
                const items = typeof data === 'object' ? (data.items || []).map(i => i.name).join('; ') : '';
                splitParts.push(`${person}(${amount})${items ? '(' + items + ')' : ''}`);
            });

            const splitStatus = t.splitStatus || {};
            const allPaid = Object.keys(t.split || {}).every(p => splitStatus[p] === 'paid');

            return [
                t.id,
                t.date || '',
                `"${(t.description || '').replace(/"/g, '""')}"`,
                t.category || 'lainnya',
                t.payer || '',
                t.totalAmount || 0,
                `"${splitParts.join('; ')}"`,
                allPaid ? 'Settled' : 'Pending'
            ];
        });

        // Combine
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        // Download
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `harta-gonogini-transactions-${this.formatDateForFilename(new Date())}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        if (typeof showToast === 'function') {
            showToast('Berhasil export CSV');
        }
    },

    // Backup with timestamp
    backup: function() {
        this.exportJSON();
    },

    // Restore from backup file
    restore: function(file) {
        return this.importJSON(file);
    },

    // Clear all data
    clearAll: function() {
        if (!confirm('Hapus SEMUA data? Ini tidak bisa diundo!')) {
            return false;
        }

        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });

        if (typeof showToast === 'function') {
            showToast('Berhasil hapus semua data');
        }
        return true;
    },

    // Get settings
    getSettings: function() {
        return this.get(this.KEYS.SETTINGS) || {
            darkMode: false,
            currency: 'IDR',
            dateFormat: 'dd/mm/yyyy'
        };
    },

    // Update settings
    updateSettings: function(newSettings) {
        const current = this.getSettings();
        const updated = { ...current, ...newSettings };
        return this.set(this.KEYS.SETTINGS, updated);
    },

    // Get budgets
    getBudgets: function() {
        return this.get(this.KEYS.BUDGETS) || {};
    },

    // Set budget for person
    setBudget: function(personKey, amount) {
        const budgets = this.getBudgets();
        budgets[personKey] = amount;
        return this.set(this.KEYS.BUDGETS, budgets);
    },

    // Get spending for person in current month
    getPersonMonthSpending: function(personKey) {
        const transactions = this.get(this.KEYS.TRANSACTIONS) || [];
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let total = 0;
        transactions.forEach(t => {
            if (!t.date) return;
            const tDate = new Date(t.date);
            if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
                // Check if person is in split
                if (t.split && t.split[personKey]) {
                    const amount = typeof t.split[personKey] === 'number'
                        ? t.split[personKey]
                        : t.split[personKey].amount;
                    total += amount;
                }
            }
        });

        return total;
    },

    // Extract unique people from transactions
    extractPeopleFromTransactions: function(transactions) {
        const peopleMap = {};

        transactions.forEach(t => {
            // Add payer
            if (t.payer && t.payerKey) {
                peopleMap[t.payerKey] = { key: t.payerKey, name: t.payer };
            }
            // Add people from split
            if (t.split) {
                Object.keys(t.split).forEach(key => {
                    if (key && !peopleMap[key]) {
                        // Try to get name from payerKey if available
                        const personName = t.payerKey === key ? t.payer : key;
                        peopleMap[key] = { key: key, name: personName.charAt(0).toUpperCase() + personName.slice(1) };
                    }
                });
            }
        });

        return Object.values(peopleMap);
    },

    // Format date for filename
    formatDateForFilename: function(date) {
        return date.toISOString().split('T')[0].replace(/-/g, '');
    },

    // Initialize hidden file input for import
    initImportInput: function() {
        let input = document.getElementById('importFileInput');
        if (!input) {
            input = document.createElement('input');
            input.type = 'file';
            input.id = 'importFileInput';
            input.accept = '.json,.csv,.xlsx,.xls';
            input.style.display = 'none';
            document.body.appendChild(input);
        }
        return input;
    },

    // Process import file (called after modal confirmation)
    processImportFile: async function(file) {
        console.log('processImportFile called with file:', file ? file.name : 'null');
        if (!file) {
            alert('Tidak ada file yang dipilih');
            return;
        }
        try {
            const result = await Storage.importJSON(file);
            console.log('Import result:', result);

            // Use setTimeout to ensure code runs after promise settles
            setTimeout(() => {
                console.log('setTimeout callback running');

                if (typeof loadFromStorage === 'function') {
                    loadFromStorage();
                    console.log('After loadFromStorage, transactions:', transactions.length);
                }
                if (typeof refreshAll === 'function') {
                    refreshAll();
                    console.log('refreshAll called');
                }
                if (typeof renderPeopleManage === 'function') {
                    renderPeopleManage();
                    console.log('renderPeopleManage called');
                }

                if (typeof showToast === 'function') {
                    showToast(`Berhasil import ${result.transactions} transaksi`);
                    console.log('Toast shown');
                }

                window.pendingImportMode = null;
                console.log('Import process complete');
            }, 50);
        } catch (err) {
            console.error('Error in processImportFile:', err);
            alert('Import gagal: ' + err.message);
        }
    },

    // Trigger import dialog
    triggerImport: function() {
        const input = this.initImportInput();
        input.click();
    },

    // ============================================================================
    // SYNC FROM GOOGLE SHEETS
    // ============================================================================

    // User-configured sync URL (persisted in localStorage)
    SYNC_URL_KEY: 'hartaGonoGini_syncUrl',
    LAST_SYNC_KEY: 'hartaGonoGini_lastSync',
    AUTO_SYNC_KEY: 'hartaGonoGini_autoSync',

    // Get the user's sync URL (empty string if not set)
    getSyncUrl: function() {
        try { return localStorage.getItem(this.SYNC_URL_KEY) || ''; }
        catch (e) { return ''; }
    },

    // Save the user's sync URL
    setSyncUrl: function(url) {
        try { localStorage.setItem(this.SYNC_URL_KEY, url); }
        catch (e) { /* ignore quota */ }
    },

    // Convert any Google Sheets URL to its CSV export URL
    // Accepts /edit URLs and returns /export?format=csv&gid=...
    toCsvExportUrl: function(input) {
        if (!input) return '';
        let url = input.trim();

        // Already an export URL — pass through
        if (url.includes('/export?')) return url;

        // Must be a Google Sheets URL
        if (!/^https?:\/\/(docs\.google\.com\/spreadsheets\/|sheets\.google\.com\/)/.test(url)) {
            return null; // signal invalid
        }

        // Extract gid from query string or hash
        let gid = '0';
        const hashMatch = url.match(/[#&?]gid=(\d+)/);
        const queryMatch = url.match(/[?&]gid=(\d+)/);
        if (hashMatch) gid = hashMatch[1];
        else if (queryMatch) gid = queryMatch[1];

        // Strip everything after the path's document id
        const docMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (!docMatch) return null;

        return `https://docs.google.com/spreadsheets/d/${docMatch[1]}/export?format=csv&gid=${gid}`;
    },

    // Fetch sheet and parse into app's internal format
    syncFromUrl: async function(url) {
        const target = url || this.getSyncUrl();
        if (!target) throw new Error('URL Google Sheet belum diisi');
        const response = await fetch(target, { redirect: 'follow' });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const csv = await response.text();
        return this.parseSyncCSV(csv);
    },

    // Generate a spreadsheet template with the expected schema and a sample row.
    // Returns XLSX when SheetJS is available, falls back to CSV otherwise.
    // Uses the Split column format that matches the user's actual sheet.
    getTemplateRows: function() {
        return [
            ['ID', 'Tanggal', 'Deskripsi', 'Kategori', 'Pembayar', 'Total', 'Status', 'Split'],
            [1, '10 May 26', 'Coffee', 'Makan', 'Qulub', 50000, 'Selesai', '; Aldo(25000)(Coffee); Acha(25000)(Coffee)'],
            [2, '10 May 26', 'Lunch', 'Makan', 'Yohn', 80000, 'Pending', '; Yohn(20000)(Lunch); Haqqi(20000)(Lunch); Aldo(20000)(Lunch); Acha(20000)(Lunch)'],
            [3, '11 May 26', 'Carry Over', 'Lainnya', 'Qulub', 111644, 'Pending', '; Aldo(111644)(Carry Over ke Qulub (3))']
        ];
    },

    // CSV fallback (only used if SheetJS isn't loaded)
    getTemplateCSV: function() {
        const rows = this.getTemplateRows();
        return rows.map(row => row.map(cell => {
            const s = String(cell);
            return (s.includes(',') || s.includes('"') || s.includes('\n'))
                ? `"${s.replace(/"/g, '""')}"`
                : s;
        }).join(',')).join('\n');
    },

    downloadTemplate: function() {
        const rows = this.getTemplateRows();

        if (typeof XLSX !== 'undefined' && XLSX.utils && XLSX.writeFile) {
            // XLSX path — preferred
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, 'Template');
            XLSX.writeFile(wb, 'harta-gono-gini-template.xlsx');
        } else {
            // CSV fallback
            const csv = this.getTemplateCSV();
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'harta-gono-gini-template.csv';
            link.click();
            URL.revokeObjectURL(url);
        }

        if (typeof showToast === 'function') {
            showToast('Template downloaded');
        }
    },

    // Parse the Google Sheet CSV format
    // Supports two layouts (auto-detected):
    //   (A) Per-person columns: ID,Tanggal,...,Status,,<Person1>,<Person2>,...
    //   (B) Single Split column: ID,Tanggal,...,Status,Split
    //       Split cell = "; Name(amount)(item); Name2(amount)(item)"
    parseSyncCSV: function(csv) {
        const lines = csv.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
            return { transactions: [], people: [], nextId: 1 };
        }

        // Find header row (first line whose first cell is "ID")
        let headerIdx = -1;
        for (let i = 0; i < lines.length; i++) {
            const firstCell = (this.parseCSVLine(lines[i])[0] || '').trim();
            if (firstCell.toLowerCase() === 'id') {
                headerIdx = i;
                break;
            }
        }
        if (headerIdx < 0) throw new Error('Header "ID,Tanggal,..." tidak ditemukan');

        const headers = this.parseCSVLine(lines[headerIdx]).map(h => h.trim());

        const findIdx = (name) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
        const dateIdx = findIdx('Tanggal');
        const descIdx = findIdx('Deskripsi');
        const catIdx = findIdx('Kategori');
        const payerIdx = findIdx('Pembayar');
        const totalIdx = findIdx('Total');
        const statusIdx = findIdx('Status');
        const splitColIdx = findIdx('Split');

        // Detect format
        const useSplitColumn = splitColIdx >= 0;

        // Per-person columns: everything after Status, skipping empty header columns
        let personNames = [];
        let personKeys = [];
        let peopleStartIdx = -1;

        if (!useSplitColumn) {
            peopleStartIdx = statusIdx >= 0 ? statusIdx + 1 : headers.length;
            while (peopleStartIdx < headers.length && headers[peopleStartIdx] === '') {
                peopleStartIdx++;
            }
            personNames = headers.slice(peopleStartIdx).filter(h => h);
            personKeys = personNames.map(n => this.personKeyFromName(n));
        }

        // Collect people names from data + per-person headers
        const seen = new Set();
        const people = [];
        const addPerson = (rawName) => {
            const name = rawName.trim();
            if (!name) return null;
            const key = this.personKeyFromName(name);
            if (!seen.has(key)) {
                seen.add(key);
                people.push({ key, name });
            }
            return key;
        };
        personNames.forEach(addPerson);

        // Parse data rows
        const transactions = [];
        let nextId = 1;

        for (let i = headerIdx + 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length < 5) continue;

            const idRaw = (values[0] || '').trim();
            if (!/^\d+$/.test(idRaw)) continue; // skip summary / non-data rows

            const id = parseInt(idRaw, 10);
            const date = this.parseSyncDate((values[dateIdx] || '').trim()) || new Date().toISOString().split('T')[0];
            const description = ((values[descIdx] || '').trim()) || 'Imported';
            const category = ((values[catIdx] || '').trim()) || 'lainnya';
            const payerName = (values[payerIdx] || '').trim();
            const payerKey = this.personKeyFromName(payerName);
            if (payerKey) addPerson(payerName); // ensure payer is in people list
            const totalAmount = this.parseSyncAmount(values[totalIdx] || '');
            const status = ((values[statusIdx] || '').trim()).toLowerCase();
            const isPaid = status === 'selesai' || status === 'settled' || status === 'paid';

            // Build split map based on format
            const split = {};
            const splitStatus = {};

            if (useSplitColumn) {
                // Parse "; Name(amount)(desc); Name2(amount)(desc)"
                const splitStr = (values[splitColIdx] || '').trim();
                if (splitStr) {
                    const entries = splitStr.split(';');
                    for (const entry of entries) {
                        const trimmed = entry.trim();
                        if (!trimmed) continue;
                        // Match: Name(amount)(description)  — description can contain parens
                        const match = trimmed.match(/^([^()]+?)\((\d+)\)\s*(.*)$/);
                        if (!match) continue;
                        const [, name, amountStr, itemDesc] = match;
                        const amount = parseInt(amountStr, 10);
                        if (!amount || amount <= 0) continue;
                        const key = addPerson(name);
                        if (!key) continue;
                        const desc = itemDesc.replace(/^\(/, '').replace(/\)$/, '').trim();
                        const items = desc ? [{ name: desc, amount }] : [];
                        split[key] = { amount, items };
                        if (isPaid) splitStatus[key] = 'paid';
                    }
                }
            } else {
                for (let p = 0; p < personNames.length; p++) {
                    const colIdx = peopleStartIdx + p;
                    if (colIdx >= values.length) continue;
                    const amt = this.parseSyncAmount(values[colIdx]);
                    if (amt > 0) {
                        split[personKeys[p]] = { amount: amt, items: [] };
                        if (isPaid) splitStatus[personKeys[p]] = 'paid';
                    }
                }
            }

            transactions.push({
                id,
                date,
                description,
                category,
                payer: payerKey,
                totalAmount,
                split,
                extraCosts: null,
                discounts: null,
                splitStatus,
                createdAt: new Date().toISOString()
            });

            if (id >= nextId) nextId = id + 1;
        }

        return { transactions, people, nextId };
    },

    personKeyFromName: function(name) {
        if (!name) return '';
        return String(name).toLowerCase().replace(/\s+/g, '');
    },

    // Parse "10 May 26" or "21-Jul-2026" → "2026-05-10"
    parseSyncDate: function(str) {
        if (!str) return null;
        str = str.trim();
        // Already ISO
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.split('T')[0];
        // DD MMM YY(YY) or DD-MMM-YYYY — split on whitespace OR dash
        const parts = str.split(/[\s\-]+/);
        if (parts.length !== 3) return null;
        const day = parseInt(parts[0], 10);
        const monthLower = parts[1].toLowerCase().substring(0, 3);
        const yearRaw = parseInt(parts[2], 10);
        const monthMap = {
            jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5,
            jun: 6, jul: 7, agu: 8, aug: 8, sep: 9, okt: 10, oct: 10,
            nov: 11, des: 12, dec: 12
        };
        const month = monthMap[monthLower];
        if (!month || isNaN(day)) return null;
        const fullYear = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
        return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    },

    // Parse "Rp 240,700" → 240700 (returns 0 for empty/null)
    parseSyncAmount: function(str) {
        if (str === null || str === undefined) return 0;
        const cleaned = String(str).replace(/[^0-9]/g, '');
        if (!cleaned) return 0;
        return parseInt(cleaned, 10) || 0;
    },

    // Apply synced data to localStorage (merge or replace)
    applySync: function(syncData, mode) {
        const newTransactions = syncData.transactions || [];
        const newPeople = syncData.people || [];
        const newNextId = syncData.nextId || 1;

        const existingTransactions = this.get(this.KEYS.TRANSACTIONS) || [];
        const existingPeople = this.get(this.KEYS.PEOPLE) || [];
        const existingNextId = this.get(this.KEYS.NEXT_ID) || 1;

        // Merge people by key — existing wins on collision to preserve manual edits
        const peopleMap = {};
        existingPeople.forEach(p => { peopleMap[p.key] = p; });
        newPeople.forEach(p => {
            if (!peopleMap[p.key]) peopleMap[p.key] = p;
        });
        const mergedPeople = Object.values(peopleMap);

        let finalTransactions;
        let addedCount;
        if (mode === 'replace') {
            finalTransactions = newTransactions;
            addedCount = newTransactions.length;
        } else {
            // Merge by ID — skip rows that already exist
            const existingIds = new Set(existingTransactions.map(t => t.id));
            const toAdd = newTransactions.filter(t => !existingIds.has(t.id));
            finalTransactions = [...existingTransactions, ...toAdd];
            addedCount = toAdd.length;
        }

        const finalNextId = Math.max(existingNextId, newNextId);

        this.set(this.KEYS.TRANSACTIONS, finalTransactions);
        this.set(this.KEYS.PEOPLE, mergedPeople);
        this.set(this.KEYS.NEXT_ID, finalNextId);

        try {
            localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
        } catch (e) { /* ignore */ }

        return {
            added: addedCount,
            total: finalTransactions.length,
            people: mergedPeople.length,
            skipped: newTransactions.length - addedCount,
            mode
        };
    },

    getLastSync: function() {
        try {
            return localStorage.getItem(this.LAST_SYNC_KEY);
        } catch (e) {
            return null;
        }
    },

    // Auto-sync preference
    isAutoSyncEnabled: function() {
        try { return localStorage.getItem(this.AUTO_SYNC_KEY) === '1'; }
        catch (e) { return false; }
    },
    setAutoSync: function(enabled) {
        try { localStorage.setItem(this.AUTO_SYNC_KEY, enabled ? '1' : '0'); }
        catch (e) { /* ignore */ }
    }
};

// Expose globally
console.log('storage.js loaded');
window.Storage = Storage;
window.exportToJSON = Storage.exportJSON.bind(Storage);
window.importFromJSON = Storage.importJSON.bind(Storage);
window.exportToCSV = Storage.exportCSV.bind(Storage);
window.backupData = Storage.backup.bind(Storage);
window.triggerImport = Storage.triggerImport.bind(Storage);
console.log('Export/Import functions exposed:', typeof window.exportToJSON, typeof window.exportToCSV, typeof window.triggerImport);
