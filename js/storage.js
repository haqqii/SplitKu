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

        // MM/DD/YYYY (US format)
        const mmddyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (mmddyyyy) {
            const [, m, d, y] = mmddyyyy;
            // Check if month > 12 (would indicate DD/MM format)
            if (parseInt(m) > 12) {
                return `${y}-${d.padStart(2, '0')}-${m.padStart(2, '0')}`;
            }
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
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
