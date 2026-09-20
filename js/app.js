// ============================================================================
// HARTA GONO-GINI - Main Application
// ============================================================================

console.log('app.js loading...');

// Global error handler
window.onerror = function(msg, url, line) {
    console.error('Error:', msg, 'at line', line);
    return true;
};

// ============================================================================
// CONSTANTS
// ============================================================================

const CATEGORY_ICONS = {
    makan: '🍔',
    transport: '🚗',
    rumah: '🏠',
    hiburan: '🎮',
    belanja: '🛒',
    kesehatan: '💊',
    lainnya: '📦'
};

const CATEGORY_LABELS = {
    makan: 'Makan',
    transport: 'Transport',
    rumah: 'Rumah',
    hiburan: 'Hiburan',
    belanja: 'Belanja',
    kesehatan: 'Kesehatan',
    lainnya: 'Lainnya'
};

// ============================================================================
// UTILITIES
// ============================================================================

function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

function formatIndonesianDate(dateStr) {
    if (!dateStr) return '-';
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const dayName = days[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return dayName + ', ' + day + ' ' + month + ' ' + year;
}

function debugData() {
    console.log('=== DEBUG DATA ===');
    console.log('People count:', people.length);
    console.log('People array:', JSON.stringify(people, null, 2));
    console.log('Transactions:', transactions.length);
    const container = document.getElementById('peopleList');
    console.log('peopleList container:', container);
    console.log('peopleList innerHTML length:', container ? container.innerHTML.length : 0);
    if (container) {
        console.log('peopleList children count:', container.children.length);
    }
    console.log('==================');
}

// ============================================================================
// STORAGE (Override default with enhanced Storage module)
// ============================================================================

function loadFromStorage() {
    // Use Storage module if available, else fallback
    if (window.Storage) {
        // Migrate stored data to current schema before reading
        Storage.migrate();

        const savedTransactions = Storage.get(Storage.KEYS.TRANSACTIONS);
        const savedNextId = Storage.get(Storage.KEYS.NEXT_ID);
        const savedPeople = Storage.get(Storage.KEYS.PEOPLE);

        console.log('loadFromStorage - savedTransactions:', savedTransactions);
        console.log('loadFromStorage - savedNextId:', savedNextId);
        console.log('loadFromStorage - savedPeople:', savedPeople);

        if (savedTransactions) transactions = savedTransactions;
        if (savedNextId) nextId = savedNextId;
        if (savedPeople) people = savedPeople;
    } else {
        const savedTransactions = localStorage.getItem('hartaGonoGini_transactions');
        const savedNextId = localStorage.getItem('hartaGonoGini_nextId');
        if (savedTransactions) transactions = JSON.parse(savedTransactions);
        if (savedNextId) nextId = parseInt(savedNextId);
    }
}

function saveToStorage() {
    if (window.Storage) {
        const ok1 = Storage.set(Storage.KEYS.TRANSACTIONS, transactions);
        const ok2 = Storage.set(Storage.KEYS.NEXT_ID, nextId);
        const ok3 = Storage.set(Storage.KEYS.PEOPLE, people);
        if (!ok1 || !ok2 || !ok3) {
            handleQuotaExceeded();
        }
    } else {
        try {
            localStorage.setItem('hartaGonoGini_transactions', JSON.stringify(transactions));
            localStorage.setItem('hartaGonoGini_nextId', nextId.toString());
            localStorage.setItem('hartaGonoGini_people', JSON.stringify(people));
        } catch (e) {
            if (e.name === 'QuotaExceededError' || (e.code && e.code === 22)) {
                handleQuotaExceeded();
            } else {
                throw e;
            }
        }
    }
}

function handleQuotaExceeded() {
    if (typeof showToast === 'function') {
        showToast('⚠️ Penyimpanan penuh — data di-export ke file');
    }
    // Auto-export to JSON as fallback so user doesn't lose data
    if (window.Storage && typeof Storage.exportJSON === 'function') {
        try {
            Storage.exportJSON();
        } catch (e) {
            console.error('Auto-export failed:', e);
        }
    }
}

// ============================================================================
// STATE
// ============================================================================

let transactions = [];
let nextId = 1;
const itemsPerPage = 10;
let currentPage = 1;
let historyPage = 1;
let extraCostCounter = 0;
let discountCounter = 0;

let people = [];

// ============================================================================
// DARK MODE
// ============================================================================

function toggleDarkMode() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const darkStylesheet = document.getElementById('darkStylesheet');
    const darkBtn = document.getElementById('darkModeBtn');

    if (isDark) {
        document.body.removeAttribute('data-theme');
        if (darkStylesheet) darkStylesheet.disabled = true;
        if (darkBtn) darkBtn.textContent = '🌙';
        if (window.Storage) Storage.updateSettings({ darkMode: false });
    } else {
        document.body.setAttribute('data-theme', 'dark');
        if (darkStylesheet) darkStylesheet.disabled = false;
        if (darkBtn) darkBtn.textContent = '☀️';
        if (window.Storage) Storage.updateSettings({ darkMode: true });
    }
}

function initDarkMode() {
    const settings = window.Storage ? Storage.getSettings() : {};
    if (settings.darkMode) {
        document.body.setAttribute('data-theme', 'dark');
        const darkStylesheet = document.getElementById('darkStylesheet');
        if (darkStylesheet) darkStylesheet.disabled = false;
        const darkBtn = document.getElementById('darkModeBtn');
        if (darkBtn) darkBtn.textContent = '☀️';
    }
}

// ============================================================================
// EXPORT MENU
// ============================================================================

function toggleExportMenu() {
    const menu = document.getElementById('exportMenu');
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
}
window.toggleExportMenu = toggleExportMenu;

// Close export menu when clicking outside
document.addEventListener('click', function(e) {
    const menu = document.getElementById('exportMenu');
    const btn = e.target.closest('button');
    if (menu && !menu.contains(e.target) && (!btn || !btn.onclick?.toString().includes('toggleExportMenu'))) {
        menu.style.display = 'none';
    }
});

// ============================================================================
// PEOPLE MANAGEMENT
// ============================================================================

function getPersonName(key) {
    const person = people.find(p => p.key === key);
    return person ? person.name : key;
}

function renderPeopleManage() {
    const container = document.getElementById('peopleList');
    if (!container) {
        console.error('peopleList container not found!');
        return;
    }

    // Empty state
    if (people.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray-400); padding: 20px;">Belum ada orang. Klik "Tambah Orang" untuk mulai.</p>';
        renderFormPeople();
        return;
    }

    // Build HTML using string concatenation for better compatibility
    let html = '';
    for (let i = 0; i < people.length; i++) {
        const person = people[i];
        const removeBtn = people.length > 1
            ? '<button data-action="delete-person" data-key="' + escapeHtml(person.key) + '" style="padding: 8px 12px; background: var(--danger); color: white; border: none; border-radius: 6px; cursor: pointer;">Hapus</button>'
            : '';
        html += '<div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">' +
            '<input type="text" value="' + escapeHtml(person.name) + '" data-action="update-person" data-key="' + escapeHtml(person.key) + '"' +
            ' style="flex: 1; padding: 8px 12px; border: 1px solid var(--gray-300); border-radius: 6px;">' +
            removeBtn +
            '</div>';
    }

    container.innerHTML = html;

    // Wire up handlers via dataset (safe — values flow through JS, not attribute parsing)
    container.querySelectorAll('[data-action="delete-person"]').forEach(btn => {
        btn.addEventListener('click', () => showDeletePersonModal(btn.dataset.key));
    });
    container.querySelectorAll('[data-action="update-person"]').forEach(input => {
        input.addEventListener('change', () => updatePersonName(input.dataset.key, input.value));
    });

    renderFormPeople();
}

function updatePersonName(key, newName) {
    // Validate input
    if (window.Validation) {
        const result = Validation.validatePersonName(newName);
        if (!result.valid) {
            showAlert(result.error);
            renderPeopleManage(); // Reset to original
            return;
        }
        newName = result.value;
    }

    const person = people.find(p => p.key === key);
    if (person) {
        person.name = newName;
        saveToStorage();
        renderFormPeople();
        refreshAll();
    }
}

function removePerson(key) {
    if (people.length <= 1) {
        showAlert('Minimal harus ada 1 orang');
        return;
    }

    // Block deletion if person appears in any transaction
    const inPayer = transactions.some(t => t.payer && t.payer.toLowerCase() === key.toLowerCase());
    const inSplit = transactions.some(t => t.split && Object.keys(t.split).some(k => k.toLowerCase() === key.toLowerCase()));
    if (inPayer || inSplit) {
        showAlert('Tidak dapat menghapus orang yang masih terlibat dalam transaksi. Hapus atau edit transaksi tersebut terlebih dahulu.');
        return;
    }

    if (confirm('Hapus orang ini? Data transaksi terkait mungkin terpengaruh.')) {
        people = people.filter(p => p.key !== key);
        saveToStorage();
        renderPeopleManage();
        refreshAll();
    }
}

// ============================================================================
// ADD/DELETE PERSON MODALS
// ============================================================================

let personToDelete = null;

function showAddPersonModal() {
    const modal = document.getElementById('addPersonModal');
    const input = document.getElementById('newPersonName');
    const error = document.getElementById('addPersonError');

    if (!modal || !input) return;

    input.value = '';
    if (error) error.style.display = 'none';

    modal.classList.add('show');
    setTimeout(() => input.focus(), 100);
}

function closeAddPersonModal() {
    const modal = document.getElementById('addPersonModal');
    if (modal) modal.classList.remove('show');
}

function confirmAddPerson() {
    const input = document.getElementById('newPersonName');
    const error = document.getElementById('addPersonError');
    const name = input ? input.value.trim() : '';

    if (!name) {
        if (error) {
            error.textContent = 'Nama tidak boleh kosong!';
            error.style.display = 'block';
        }
        return;
    }

    // Validate
    if (window.Validation) {
        const result = Validation.validatePersonName(name);
        if (!result.valid) {
            if (error) {
                error.textContent = result.error;
                error.style.display = 'block';
            }
            return;
        }
    }

    const key = name.replace(/\s+/g, '').toLowerCase();

    if (people.find(p => p.key === key)) {
        if (error) {
            error.textContent = 'Nama sudah ada!';
            error.style.display = 'block';
        }
        return;
    }

    // Add person
    people.push({ key, name });
    saveToStorage();
    closeAddPersonModal();
    renderPeopleManage();
    renderFormPeople();
    refreshAll();
    showToast('Orang berhasil ditambahkan');
}

function showDeletePersonModal(key) {
    const modal = document.getElementById('deletePersonModal');
    const nameSpan = document.getElementById('deletePersonName');

    if (!modal) return;

    personToDelete = key;
    const person = people.find(p => p.key === key);
    if (nameSpan && person) {
        nameSpan.textContent = person.name;
    }

    modal.classList.add('show');
}

function closeDeletePersonModal() {
    const modal = document.getElementById('deletePersonModal');
    if (modal) modal.classList.remove('show');
    personToDelete = null;
}

function confirmDeletePerson() {
    if (!personToDelete) return;

    const key = personToDelete;

    // Block deletion if person appears in any transaction
    const inPayer = transactions.some(t => t.payer && t.payer.toLowerCase() === key.toLowerCase());
    const inSplit = transactions.some(t => t.split && Object.keys(t.split).some(k => k.toLowerCase() === key.toLowerCase()));
    if (inPayer || inSplit) {
        closeDeletePersonModal();
        showAlert('Tidak dapat menghapus orang yang masih terlibat dalam transaksi. Hapus atau edit transaksi tersebut terlebih dahulu.');
        return;
    }

    closeDeletePersonModal();

    people = people.filter(p => p.key !== key);
    saveToStorage();
    renderPeopleManage();
    renderFormPeople();
    refreshAll();
    showToast('Orang berhasil dihapus');
}

// Handle Enter key in add person input
const newPersonInput = document.getElementById('newPersonName');
if (newPersonInput) {
    newPersonInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmAddPerson();
        }
        if (e.key === 'Escape') {
            closeAddPersonModal();
        }
    });
}

function addPerson() {
    showAddPersonModal();
}

function renderFormPeople() {
    const payerSelect = document.getElementById('payer');
    if (!payerSelect) return;

    payerSelect.innerHTML = '<option value="">Pilih...</option>' +
        people.map(p => `<option value="${p.key}">${escapeHtml(p.name)}</option>`).join('');

    const checkboxContainer = document.getElementById('splitCheckboxes');
    if (!checkboxContainer) return;

    checkboxContainer.innerHTML = people.map(p => `
        <label class="checkbox-item" data-person="${p.key}">
            <input type="checkbox" name="split" value="${p.key}" disabled>
            <span class="checkmark"></span>
            <span>${escapeHtml(p.name)}</span>
        </label>
    `).join('');

    document.querySelectorAll('.checkbox-item input').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const parent = this.closest('.checkbox-item');
            if (this.checked) {
                parent.classList.add('checked');
            } else {
                parent.classList.remove('checked');
            }
            updateSplitAmountInputs();
        });
    });

    document.querySelectorAll('.checkbox-item').forEach(label => {
        label.addEventListener('click', function(e) {
            const checkbox = this.querySelector('input[type="checkbox"]');
            if (checkbox && checkbox.disabled) {
                e.preventDefault();
                const description = document.getElementById('description')?.value.trim();
                const payer = document.getElementById('payer')?.value;
                if (!description || !payer) {
                    showAlert('Silakan isi field "Deskripsi" dan "Yang Membayar (Payer)" terlebih dahulu!');
                }
            }
        });
    });
}

// ============================================================================
// BALANCE & SETTLEMENT CALCULATIONS
// ============================================================================

function calculateBalances() {
    const balances = {};
    people.forEach(p => balances[p.key] = 0);

    transactions.forEach(t => {
        const splitStatus = t.splitStatus || {};
        const payerLower = t.payer ? t.payer.toLowerCase() : '';
        Object.entries(t.split || {}).forEach(([person, data]) => {
            const amount = typeof data === 'number' ? data : data.amount;
            if (person.toLowerCase() === payerLower) return;
            if (splitStatus[person] !== 'paid') {
                balances[person] -= amount;
                balances[t.payer] += amount;
            }
        });
    });

    return balances;
}

function calculateSettlements() {
    const settlementMap = {};

    transactions.forEach(t => {
        const splitStatus = t.splitStatus || {};
        Object.entries(t.split || {}).forEach(([person, data]) => {
            if (person === t.payer) return;
            if (splitStatus[person] === 'paid') return;

            const amount = typeof data === 'number' ? data : data.amount;
            const items = typeof data === 'object' ? data.items : [];

            if (amount > 0) {
                // Normalize keys to lowercase for consistent matching
                const fromKey = person.toLowerCase();
                const toKey = t.payer ? t.payer.toLowerCase() : '';
                const key = `${fromKey}-${toKey}`;

                if (!settlementMap[key]) {
                    settlementMap[key] = { from: fromKey, to: toKey, originalFrom: person, originalTo: t.payer, amount: 0, items: [] };
                }
                settlementMap[key].amount += amount;
                items.forEach(item => {
                    settlementMap[key].items.push({ name: item.name || '-', amount: item.amount });
                });
            }
        });
    });

    console.log('Debug settlements - settlementMap:', JSON.stringify(settlementMap, null, 2));

    const finalSettlements = [];
    const processed = new Set();

    Object.values(settlementMap).forEach(s => {
        const reverseKey = `${s.to}-${s.from}`;
        const pairKey = [s.from, s.to].sort().join('-');
        console.log('Processing:', s.from, '->', s.to, '=', s.amount, '| reverseKey:', reverseKey, '| pairKey:', pairKey);
        if (processed.has(pairKey)) {
            console.log('Already processed, skipping');
            return;
        }
        processed.add(pairKey);

        if (settlementMap[reverseKey]) {
            const reverse = settlementMap[reverseKey];
            const netAmount = s.amount - reverse.amount;
            console.log('Found reverse:', reverse.from, '->', reverse.to, '=', reverse.amount, '| netAmount:', netAmount);

            if (netAmount > 0) {
                finalSettlements.push({
                    from: s.from, to: s.to, amount: netAmount,
                    items: [...s.items, ...reverse.items.map(i => ({...i, isReverse: true}))]
                });
            } else if (netAmount < 0) {
                finalSettlements.push({
                    from: reverse.from, to: reverse.to, amount: Math.abs(netAmount),
                    items: [...reverse.items, ...s.items.map(i => ({...i, isReverse: true}))]
                });
            }
        } else {
            console.log('No reverse found, adding as-is');
            finalSettlements.push(s);
        }
    });

    console.log('Debug settlements - finalSettlements:', JSON.stringify(finalSettlements, null, 2));
    return finalSettlements;
}

// ============================================================================
// DASHBOARD
// ============================================================================

let dashboardVisible = true;

// Memoized settlements — invalidated at start of each refreshAll()
let _settlementsCache = null;
function getSettlements() {
    if (_settlementsCache === null) {
        _settlementsCache = calculateSettlements();
    }
    return _settlementsCache;
}
function resetSettlementsCache() {
    _settlementsCache = null;
}

function toggleDashboard() {
    const content = document.getElementById('dashboardContent');
    const btn = document.getElementById('dashboardToggleBtn');

    dashboardVisible = !dashboardVisible;

    if (content) {
        content.style.display = dashboardVisible ? 'block' : 'none';
    }
    if (btn) {
        btn.textContent = dashboardVisible ? '👁️ Sembunyikan' : '👁️ Tampilkan';
    }
}

function renderDashboard() {
    // Calculate stats
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Total bulan ini
    let totalMonth = 0;
    transactions.forEach(t => {
        if (!t.date) return;
        const tDate = new Date(t.date);
        if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
            totalMonth += t.totalAmount || 0;
        }
    });

    // Pending amount
    const settlements = getSettlements();
    let pendingAmount = 0;
    settlements.forEach(s => pendingAmount += s.amount);

    // Settled count
    let settledCount = 0;
    transactions.forEach(t => {
        const splitStatus = t.splitStatus || {};
        if (Object.keys(t.split || {}).every(p => splitStatus[p] === 'paid')) {
            settledCount++;
        }
    });

    // Top payer
    const payerTotals = {};
    transactions.forEach(t => {
        if (!payerTotals[t.payer]) payerTotals[t.payer] = 0;
        payerTotals[t.payer] += t.totalAmount || 0;
    });
    let topPayer = '-';
    let topAmount = 0;
    Object.entries(payerTotals).forEach(([payer, total]) => {
        if (total > topAmount) {
            topAmount = total;
            topPayer = getPersonName(payer);
        }
    });

    // Update DOM
    const statTotal = document.getElementById('statTotalMonth');
    const statPending = document.getElementById('statPending');
    const statSettled = document.getElementById('statSettled');
    const statTopPayer = document.getElementById('statTopPayer');

    if (statTotal) statTotal.textContent = formatCurrency(totalMonth);
    if (statPending) statPending.textContent = formatCurrency(pendingAmount);
    if (statSettled) statSettled.textContent = settledCount;
    if (statTopPayer) statTopPayer.textContent = topPayer;

    // Render charts
    console.log('renderDashboard - people:', people.length, people);
    console.log('renderDashboard - transactions:', transactions.length);
    if (window.Charts) {
        const categoryData = Charts.getCategoryBreakdown(transactions);
        const personData = Charts.getPersonSpending(transactions, people);
        console.log('renderDashboard - personData:', personData);

        Charts.drawPieChart('categoryChart', categoryData, { donut: true });
        Charts.drawBarChart('personChart', personData);
        Charts.drawLegend('categoryLegend', categoryData);
        Charts.drawLegend('personLegend', personData);
    }
}

// ============================================================================
// PERSON HISTORY MODAL
// ============================================================================

function showPersonHistory(personKey) {
    const person = people.find(p => p.key === personKey);
    if (!person) return;

    const modal = document.getElementById('personHistoryModal');
    const title = document.getElementById('personHistoryTitle');
    const content = document.getElementById('personHistoryContent');

    if (!modal || !title || !content) return;

    title.textContent = `📋 Histori - ${person.name}`;

    // Get transactions involving this person
    const personTransactions = transactions.filter(t => {
        return t.payer === personKey || (t.split && t.split[personKey]);
    });

    if (personTransactions.length === 0) {
        content.innerHTML = '<p class="no-data">Belum ada transaksi</p>';
    } else {
        let totalPaid = 0;
        let totalOwes = 0;

        const rows = personTransactions.map(t => {
            const splitStatus = t.splitStatus || {};
            const amount = t.split && t.split[personKey] ? (typeof t.split[personKey] === 'number' ? t.split[personKey] : t.split[personKey].amount) : 0;
            const isPayer = t.payer === personKey;
            const isPaid = isPayer || splitStatus[personKey] === 'paid';

            if (isPayer) totalPaid += t.totalAmount || 0;
            if (!isPayer && !isPaid) totalOwes += amount;

            return `
                <tr>
                    <td style="white-space: nowrap; font-size: 0.85rem; color: #6b7280;">${formatIndonesianDate(t.date)}</td>
                    <td>${escapeHtml(t.description || '-')}</td>
                    <td>${isPayer ? '<span style="color: #10b981;">Bayar</span>' : '<span style="color: #f59e0b;">Ganti</span>'}</td>
                    <td class="amount">${formatCurrency(isPayer ? t.totalAmount : amount)}</td>
                    <td>
                        <span class="status-badge ${isPaid ? 'status-settled' : 'status-pending'}">
                            ${isPaid ? 'Settled' : 'Pending'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

        content.innerHTML = `
            <div style="margin-bottom: 16px; display: flex; gap: 16px;">
                <div style="flex: 1; padding: 12px; background: #d1fae5; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.2rem; font-weight: 700; color: #047857;">${formatCurrency(totalPaid)}</div>
                    <div style="font-size: 0.85rem; color: #059669;">Total Bayar</div>
                </div>
                <div style="flex: 1; padding: 12px; background: #fef3c7; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.2rem; font-weight: 700; color: #b45309;">${formatCurrency(totalOwes)}</div>
                    <div style="font-size: 0.85rem; color: #d97706;">Belum Settle</div>
                </div>
            </div>
            <table class="transactions-table">
                <thead>
                    <tr>
                        <th>Tanggal</th>
                        <th>Deskripsi</th>
                        <th>Role</th>
                        <th>Jumlah</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    modal.classList.add('show');
}

function closePersonHistoryModal() {
    const modal = document.getElementById('personHistoryModal');
    if (modal) modal.classList.remove('show');
}

// ============================================================================
// SETTLEMENT RENDERING
// ============================================================================

let settlementsExpanded = false;
const SETTLEMENTS_INITIAL_COUNT = 5;

function toggleSettlements() {
    settlementsExpanded = !settlementsExpanded;
    renderSettlements();
}

function renderSettlements() {
    const settlements = getSettlements();
    const container = document.getElementById('settlementList');
    if (!container) return;

    if (settlements.length === 0) {
        container.innerHTML = '<li class="no-data">Semua sudah settle! ✓</li>';
        return;
    }

    const visibleSettlements = settlementsExpanded
        ? settlements
        : settlements.slice(0, SETTLEMENTS_INITIAL_COUNT);

    container.innerHTML = visibleSettlements.map(s => `
        <li class="settlement-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                <span>
                    <span class="from">${escapeHtml(getPersonName(s.from))}</span>
                    <span class="arrow">bayar ke</span>
                    <span class="to">${escapeHtml(getPersonName(s.to))}</span>
                </span>
                <span>
                    <span class="amount">${formatCurrency(s.amount)}</span>
                    <button class="btn-settle" data-action="settle" data-from="${escapeHtml(s.from)}" data-to="${escapeHtml(s.to)}" data-amount="${s.amount}">Selesai</button>
                </span>
            </div>
            ${s.items.length > 0 ? `
                <div style="font-size: 0.85rem; color: #6b7280; padding-left: 8px; width: 100%;">
                    ${s.items.map(item => `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 2px; ${item.isReverse ? 'opacity: 0.7;' : ''}">
                            <span>• ${escapeHtml(item.name)}${item.isReverse ? ' (terkompensasi)' : ''}</span>
                            <span>${formatCurrency(item.amount)}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </li>
    `).join('');

    // Wire up settle handlers via dataset (safe — values flow through JS, not attribute parsing)
    container.querySelectorAll('[data-action="settle"]').forEach(btn => {
        btn.addEventListener('click', () => settleBySettlement(btn.dataset.from, btn.dataset.to, parseFloat(btn.dataset.amount)));
    });

    // Add "Show more/less" button if there are more settlements
    if (settlements.length > SETTLEMENTS_INITIAL_COUNT) {
        container.innerHTML += `
            <li style="text-align: center; padding: 12px; border-top: 1px solid #e5e7eb;">
                <button onclick="toggleSettlements()" style="
                    background: none;
                    border: none;
                    color: #4f46e5;
                    font-weight: 600;
                    cursor: pointer;
                    padding: 8px 16px;
                    border-radius: 6px;
                    transition: background 0.2s;
                " onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='none'">
                    ${settlementsExpanded
                        ? `▲ Sembunyikan (${settlements.length - SETTLEMENTS_INITIAL_COUNT} lainnya)`
                        : `▼ Lihat semua (${settlements.length} settlements)`
                    }
                </button>
            </li>
        `;
    }
}

// ============================================================================
// TRANSACTION RENDERING
// ============================================================================

// Debounce wrapper to avoid re-rendering on every keystroke
let _renderTransactionsTimer = null;
function debouncedRenderTransactions() {
    if (_renderTransactionsTimer) clearTimeout(_renderTransactionsTimer);
    _renderTransactionsTimer = setTimeout(() => {
        _renderTransactionsTimer = null;
        renderTransactions();
    }, 150);
}

function renderTransactions() {
    const tbody = document.getElementById('transactionsBody');
    if (!tbody) return;

    // Get filters
    const searchText = document.getElementById('searchText')?.value.toLowerCase() || '';
    const filterCategory = document.getElementById('filterCategory')?.value || '';
    const filterDateStart = document.getElementById('filterDateStart')?.value || '';
    const filterDateEnd = document.getElementById('filterDateEnd')?.value || '';
    const filterStatus = document.getElementById('filterStatus')?.value || '';

    // Filter transactions
    let filteredTransactions = transactions;

    if (searchText) {
        filteredTransactions = filteredTransactions.filter(t =>
            (t.description || '').toLowerCase().includes(searchText)
        );
    }

    if (filterCategory) {
        filteredTransactions = filteredTransactions.filter(t => t.category === filterCategory);
    }

    if (filterDateStart) {
        filteredTransactions = filteredTransactions.filter(t => !t.date || t.date >= filterDateStart);
    }

    if (filterDateEnd) {
        filteredTransactions = filteredTransactions.filter(t => !t.date || t.date <= filterDateEnd);
    }

    if (filterStatus) {
        filteredTransactions = filteredTransactions.filter(t => {
            const splitStatus = t.splitStatus || {};
            const allPaid = Object.keys(t.split || {}).every(p => splitStatus[p] === 'paid');
            return filterStatus === 'settled' ? allPaid : !allPaid;
        });
    }

    // Sort by date descending
    filteredTransactions.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date);
    });

    // Pagination
    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages || 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + itemsPerPage);

    if (paginatedTransactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #9ca3af;">Tidak ada transaksi yang cocok</td></tr>';
        document.getElementById('transactionsPagination').innerHTML = '';
        return;
    }

    tbody.innerHTML = paginatedTransactions.map((t, idx) => {
        const splitStatus = t.splitStatus || {};
        const allPaid = Object.keys(t.split || {}).every(p => splitStatus[p] === 'paid');
        const globalIdx = startIndex + idx + 1;

        return `
            <tr>
                <td>${globalIdx}</td>
                <td style="white-space: nowrap; font-size: 0.85rem; color: #6b7280;">${formatIndonesianDate(t.date)}</td>
                <td>
                    <div onclick="toggleDetails(${t.id})" style="cursor:pointer;font-weight:500;">
                        ${escapeHtml(t.description || '-')}
                        <span style="color:var(--gray-400);font-size:0.8rem;">(klik untuk lihat split)</span>
                    </div>
                    <div id="details-${t.id}" class="expanded-details">
                        ${renderTransactionDetails(t, splitStatus)}
                    </div>
                </td>
                <td>
                    <span style="font-size: 1.2rem;">${CATEGORY_ICONS[t.category] || '📦'}</span>
                    <span style="font-size: 0.8rem; color: #6b7280;">${CATEGORY_LABELS[t.category] || 'Lainnya'}</span>
                </td>
                <td><span class="person person-${t.payer}">${escapeHtml(getPersonName(t.payer))}</span></td>
                <td class="amount">${formatCurrency(t.totalAmount)}</td>
                <td>
                    <button onclick="downloadImage(${t.id})" title="Download Detail" style="background: var(--primary); color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 1rem;">📥</button>
                </td>
                <td>
                    <span class="status-badge ${allPaid ? 'status-settled' : 'status-pending'}">
                        ${allPaid ? 'Settled' : 'Pending'}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 4px;">
                        <button onclick="editTransaction(${t.id})" style="padding: 4px 8px; font-size: 0.75rem; background: var(--warning); color: white; border: none; border-radius: 4px; cursor: pointer;">Edit</button>
                        <button onclick="deleteTransaction(${t.id})" style="padding: 4px 8px; font-size: 0.75rem; background: var(--danger); color: white; border: none; border-radius: 4px; cursor: pointer;">Hapus</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Wire up settle-person buttons (safe — values flow through JS, not attribute parsing)
    tbody.querySelectorAll('[data-action="settle-person"]').forEach(btn => {
        btn.addEventListener('click', () => settlePerson(parseInt(btn.dataset.txId, 10), btn.dataset.person));
    });

    renderPagination('transactionsPagination', totalPages, currentPage, (page) => {
        currentPage = page;
        renderTransactions();
    });
}

function renderTransactionDetails(t, splitStatus) {
    console.log('renderTransactionDetails - transaction:', t);
    console.log('renderTransactionDetails - split:', t.split);
    console.log('renderTransactionDetails - totalAmount:', t.totalAmount);
    console.log('renderTransactionDetails - payer:', t.payer);
    return `
        <div class="split-details">
            <div class="split-details-header">
                <span class="icon">👥</span>
                <h4>Detail Split Bill</h4>
            </div>
            <div class="split-cards">
                ${Object.entries(t.split || {}).map(([person, data]) => {
                    const amount = typeof data === 'number' ? data : data.amount;
                    const items = typeof data === 'object' ? data.items : [];
                    const isPaid = splitStatus[person] === 'paid';
                    return `
                        <div class="split-card ${isPaid ? 'paid' : ''}">
                            <div class="split-card-header">
                                <span class="person-name person-${person}">${escapeHtml(getPersonName(person))}</span>
                                <span class="split-amount">${formatCurrency(amount)}</span>
                            </div>
                            ${items.length > 0 ? `
                                <div class="items-list">
                                    ${items.map(item => `
                                        <div class="item-row">
                                            <span class="item-name">${escapeHtml(item.name || '-')}</span>
                                            <span class="item-amount">${formatCurrency(item.amount)}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                            <div class="split-card-footer">
                                ${isPaid ?
                                    '<span class="status-badge status-paid">✓ Lunas</span>' :
                                    `<button class="btn-pay" data-action="settle-person" data-tx-id="${t.id}" data-person="${escapeHtml(person)}">💰 Bayar</button>`
                                }
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            ${t.extraCosts && t.extraCosts.length > 0 ? `
                <div class="extra-costs-section">
                    <div class="extra-costs-header">
                        <span>💡</span>
                        <span>Biaya Tambahan</span>
                    </div>
                    <div class="extra-costs-list">
                        ${t.extraCosts.map(ec => `
                            <div class="extra-cost-item">
                                <span class="extra-cost-name">${escapeHtml(ec.name || 'Biaya')} (${ec.type === 'percent' ? ec.value + '%' : formatCurrency(ec.value)})</span>
                                <span class="extra-cost-calc">${formatCurrency(ec.calculated)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            ${t.discounts && t.discounts.length > 0 ? `
                <div class="extra-costs-section" style="background: #ecfdf5;">
                    <div class="extra-costs-header">
                        <span>🏷️</span>
                        <span>Diskon</span>
                    </div>
                    <div class="extra-costs-list">
                        ${t.discounts.map(disc => `
                            <div class="extra-cost-item">
                                <span class="extra-cost-name">${escapeHtml(disc.name || 'Diskon')} (${disc.type === 'percent' ? disc.value + '%' : formatCurrency(disc.value)})</span>
                                <span class="extra-cost-calc" style="color: #10b981;">-${formatCurrency(disc.calculated)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            <div class="total-section">
                <span class="total-label">Total Bill</span>
                <div class="total-value">
                    <span class="amount">${formatCurrency(t.totalAmount)}</span>
                    <span class="payer">Dibayar oleh ${escapeHtml(getPersonName(t.payer))}</span>
                </div>
            </div>
            <div class="split-actions">
                <button class="btn-download-detail" onclick="downloadImage(${t.id})">
                    <span>📥</span>
                    <span>Download Detail</span>
                </button>
            </div>
        </div>
    `;
}

function renderPagination(containerId, totalPages, currentPage, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';

    if (currentPage > 1) {
        html += `<button class="page-btn" data-page="${currentPage - 1}" data-container="${containerId}" style="padding:4px 10px;border:1px solid #e5e7eb;background:white;border-radius:4px;cursor:pointer;">&#8249;</button>`;
    }

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            const active = i === currentPage ? 'background:#4f46e5;color:white;' : '';
            html += `<button class="page-btn" data-page="${i}" data-container="${containerId}" style="padding:4px 10px;border:1px solid #e5e7eb;background:white;border-radius:4px;cursor:pointer;${active}">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += `<span style="padding:4px;">...</span>`;
        }
    }

    if (currentPage < totalPages) {
        html += `<button class="page-btn" data-page="${currentPage + 1}" data-container="${containerId}" style="padding:4px 10px;border:1px solid #e5e7eb;background:white;border-radius:4px;cursor:pointer;">&#8250;</button>`;
    }

    container.innerHTML = html;
}

function goToPage(containerId, page) {
    if (containerId === 'transactionsPagination') {
        currentPage = page;
        renderTransactions();
    } else {
        historyPage = page;
        renderHistory();
    }
}

function showHistory() {
    document.getElementById('historyCard').style.display = 'block';
    historyPage = 1;
    renderHistory();
}

function hideHistory() {
    document.getElementById('historyCard').style.display = 'none';
}

function renderHistory() {
    const tbody = document.getElementById('historyBody');
    if (!tbody) return;

    let settledTransactions = transactions.filter(t => {
        const splitStatus = t.splitStatus || {};
        return Object.keys(t.split || {}).every(p => splitStatus[p] === 'paid');
    });

    // Sort by date descending
    settledTransactions.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date);
    });

    const totalPages = Math.ceil(settledTransactions.length / itemsPerPage);
    if (historyPage > totalPages) historyPage = totalPages || 1;

    const startIndex = (historyPage - 1) * itemsPerPage;
    const paginatedTransactions = settledTransactions.slice(startIndex, startIndex + itemsPerPage);

    if (paginatedTransactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #6b7280;">Belum ada transaksi yang settled</td></tr>';
        document.getElementById('historyPagination').innerHTML = '';
        return;
    }

    tbody.innerHTML = paginatedTransactions.map((t, idx) => {
        const globalIdx = startIndex + idx + 1;
        return `
            <tr>
                <td>${globalIdx}</td>
                <td style="white-space: nowrap; font-size: 0.85rem; color: #6b7280;">${formatIndonesianDate(t.date)}</td>
                <td>${escapeHtml(t.description || '-')}</td>
                <td>
                    <span style="font-size: 1.2rem;">${CATEGORY_ICONS[t.category] || '📦'}</span>
                </td>
                <td><span class="person person-${t.payer}">${escapeHtml(getPersonName(t.payer))}</span></td>
                <td class="amount">${formatCurrency(t.totalAmount)}</td>
                <td><span class="status-badge status-settled">Settled</span></td>
            </tr>
        `;
    }).join('');

    renderPagination('historyPagination', totalPages, historyPage, (page) => {
        historyPage = page;
        renderHistory();
    });
}

// ============================================================================
// TRANSACTION ACTIONS
// ============================================================================

function toggleDetails(id) {
    const details = document.getElementById(`details-${id}`);
    if (details) details.classList.toggle('show');
}

function settlePerson(transactionId, person) {
    const t = transactions.find(tr => tr.id === transactionId);
    if (t) {
        if (!t.splitStatus) t.splitStatus = {};
        t.splitStatus[person] = 'paid';
        saveToStorage();
        refreshAll();
    }
}

let settleData = { from: '', to: '', amount: 0 };

function settleBySettlement(from, to, amount) {
    settleData = { from, to, amount };
    const fromName = getPersonName(from);
    const toName = getPersonName(to);

    const msg = document.getElementById('confirmSettleMessage');
    msg.replaceChildren();
    const strongFrom = document.createElement('strong');
    strongFrom.textContent = fromName;
    msg.appendChild(strongFrom);
    msg.appendChild(document.createTextNode(' sudah bayar ke '));
    const strongTo = document.createElement('strong');
    strongTo.textContent = toName;
    msg.appendChild(strongTo);
    msg.appendChild(document.createElement('br'));
    const amountSpan = document.createElement('span');
    amountSpan.style.fontSize = '1.3rem';
    amountSpan.style.color = '#10b981';
    amountSpan.style.fontWeight = 'bold';
    amountSpan.textContent = `Rp ${formatCurrency(amount).replace('Rp ', '')}`;
    msg.appendChild(amountSpan);

    document.getElementById('confirmSettleModal').classList.add('show');
}

function closeConfirmSettleModal() {
    document.getElementById('confirmSettleModal').classList.remove('show');
    settleData = { from: '', to: '', amount: 0 };
}

function confirmSettle() {
    const { from, to, amount } = settleData;
    closeConfirmSettleModal();

    let remaining = amount;

    for (let t of transactions) {
        if (remaining <= 0) break;
        const splitStatus = t.splitStatus || {};

        // Normalize keys to lowercase for consistent matching
        const payerLower = t.payer ? t.payer.toLowerCase() : '';
        const fromLower = from ? from.toLowerCase() : '';
        const toLower = to ? to.toLowerCase() : '';

        // Check if this transaction matches the settlement direction
        if (payerLower === toLower && t.split) {
            // Find the person in split with case-insensitive match
            const splitPersonKey = Object.keys(t.split).find(key => key.toLowerCase() === fromLower);
            if (splitPersonKey && splitStatus[splitPersonKey] !== 'paid') {
                const splitAmount = typeof t.split[splitPersonKey] === 'number'
                    ? t.split[splitPersonKey]
                    : t.split[splitPersonKey].amount;

                // Only mark as paid if we have enough remaining to fully cover this split
                if (remaining >= splitAmount) {
                    if (!t.splitStatus) t.splitStatus = {};
                    t.splitStatus[splitPersonKey] = 'paid';
                    remaining -= splitAmount;
                } else {
                    // Not enough remaining to cover this split — stop, no partial marking
                    break;
                }
            }
        }
    }

    saveToStorage();
    refreshAll();
}

let deleteTargetId = null;

function deleteTransaction(id) {
    deleteTargetId = id;
    document.getElementById('confirmDeleteModal').classList.add('show');
}

function closeConfirmDeleteModal() {
    document.getElementById('confirmDeleteModal').classList.remove('show');
    deleteTargetId = null;
}

function confirmDeleteTransaction() {
    if (deleteTargetId !== null) {
        transactions = transactions.filter(t => t.id !== deleteTargetId);
        saveToStorage();
        refreshAll();
        closeConfirmDeleteModal();
    }
}

// ============================================================================
// FORM HANDLING
// ============================================================================

function setupSplitInputs() {
    const checkboxes = document.querySelectorAll('.checkbox-item input');
    const labels = document.querySelectorAll('.checkbox-item');

    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const parent = this.closest('.checkbox-item');
            if (this.checked) {
                parent.classList.add('checked');
            } else {
                parent.classList.remove('checked');
            }
            updateSplitAmountInputs();
        });
    });

    labels.forEach(label => {
        label.addEventListener('click', function(e) {
            const checkbox = this.querySelector('input[type="checkbox"]');
            if (checkbox && checkbox.disabled) {
                e.preventDefault();
            }
        });
    });

    updateSplitAmountInputs();
}

function updateSplitAmountInputs() {
    const checkedBoxes = document.querySelectorAll('.checkbox-item input:checked');
    const container = document.getElementById('splitAmounts');
    if (!container) return;

    container.innerHTML = Array.from(checkedBoxes).map(checkbox => {
        const person = checkbox.value;
        return `
            <div class="person-split-section">
                <div class="person-split-header">
                    <span class="person-name person-${person}">${escapeHtml(getPersonName(person))}</span>
                    <span class="person-total" id="total-${person}">Rp 0</span>
                </div>
                <div class="items-container" id="items-${person}">
                    <div class="item-row">
                        <input type="text" placeholder="Nama item (opsional)" class="item-name" data-person="${person}">
                        <input type="number" placeholder="Rp 0" class="item-amount" data-person="${escapeHtml(person)}" min="0" data-action="calculate-person-total">
                        <button type="button" class="btn-remove-item" onclick="removeItem(this)" style="display: none;">×</button>
                    </div>
                </div>
                <button type="button" class="btn-add-item" data-action="add-item" data-person="${escapeHtml(person)}">+ Tambah Item</button>
            </div>
        `;
    }).join('');

    // Wire up add-item buttons (safe — values flow through JS, not attribute parsing)
    container.querySelectorAll('[data-action="add-item"]').forEach(btn => {
        btn.addEventListener('click', () => addItem(btn.dataset.person));
    });

    // Wire up item-amount inputs (safe — values flow through JS, not attribute parsing)
    container.querySelectorAll('[data-action="calculate-person-total"]').forEach(input => {
        input.addEventListener('input', () => calculatePersonTotal(input.dataset.person));
    });

    calculateAutoTotal();
}

function addItem(person, name = '', amount = '') {
    const container = document.getElementById(`items-${person}`);
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
        <input type="text" placeholder="Nama item (opsional)" class="item-name" data-person="${escapeHtml(person)}" value="${escapeHtml(name)}">
        <input type="number" placeholder="Rp 0" class="item-amount" data-person="${escapeHtml(person)}" min="0" data-action="calculate-person-total" value="${amount}">
        <button type="button" class="btn-remove-item" onclick="removeItem(this)">×</button>
    `;
    container.appendChild(row);

    // Wire up amount input (safe — value flows through JS, not attribute parsing)
    const amountInput = row.querySelector('[data-action="calculate-person-total"]');
    if (amountInput) {
        amountInput.addEventListener('input', () => calculatePersonTotal(person));
    }

    // Show delete button on first row when there are 2+ rows
    const allRows = container.querySelectorAll('.item-row');
    if (allRows.length >= 2) {
        allRows[0].querySelector('.btn-remove-item').style.display = 'block';
    }

    calculatePersonTotal(person);
}

function removeItem(btn) {
    const row = btn.closest('.item-row');
    const container = row.parentElement;
    const person = container.id.replace('items-', '');

    row.remove();

    // Hide delete button on first row when there's only 1 row left
    const allRows = container.querySelectorAll('.item-row');
    if (allRows.length === 1) {
        allRows[0].querySelector('.btn-remove-item').style.display = 'none';
    }

    calculatePersonTotal(person);
}

function calculatePersonTotal(person) {
    const container = document.getElementById(`items-${person}`);
    const totalEl = document.getElementById(`total-${person}`);
    if (!container || !totalEl) return;

    const amounts = container.querySelectorAll('.item-amount');
    let total = 0;
    amounts.forEach(input => {
        total += parseInt(input.value) || 0;
    });
    totalEl.textContent = formatCurrency(total);
    calculateAutoTotal();
}

function calculateAutoTotal() {
    const checkedBoxes = document.querySelectorAll('.checkbox-item input:checked');
    let total = 0;

    checkedBoxes.forEach(checkbox => {
        const person = checkbox.value;
        const personTotal = document.getElementById(`total-${person}`);
        if (personTotal) {
            const text = personTotal.textContent.replace(/[Rp\s.]/g, '');
            total += parseInt(text) || 0;
        }
    });

    const extraCostRows = document.querySelectorAll('.extra-cost-row');
    let totalExtraCost = 0;

    extraCostRows.forEach(row => {
        const type = row.querySelector('.extra-cost-type').value;
        const value = parseInt(row.querySelector('.extra-cost-value').value) || 0;

        if (value > 0) {
            let calculated = 0;
            if (type === 'percent') {
                calculated = Math.round(total * value / 100);
            } else {
                calculated = value;
            }
            totalExtraCost += calculated;
        }
    });

    const discountRows = document.querySelectorAll('.discount-row');
    let totalDiscount = 0;

    discountRows.forEach(row => {
        const type = row.querySelector('.discount-type').value;
        const value = parseInt(row.querySelector('.discount-value').value) || 0;

        if (value > 0) {
            let calculated = 0;
            if (type === 'percent') {
                calculated = Math.round(total * value / 100);
            } else {
                calculated = value;
            }
            totalDiscount += calculated;
        }
    });

    const grandTotal = total + totalExtraCost - totalDiscount;
    const totalAmountInput = document.getElementById('totalAmount');
    const autoTotalSpan = document.getElementById('autoTotal');
    if (totalAmountInput) totalAmountInput.value = grandTotal;
    if (autoTotalSpan) autoTotalSpan.textContent = formatCurrency(grandTotal);
}

function updateCheckboxState() {
    const description = document.getElementById('description')?.value.trim() || '';
    const payer = document.getElementById('payer')?.value || '';
    const shouldEnable = description.length > 0 && payer.length > 0;

    document.querySelectorAll('#splitCheckboxes input[type="checkbox"]').forEach(cb => {
        cb.disabled = !shouldEnable;
    });

    if (!shouldEnable) {
        document.querySelectorAll('#splitCheckboxes .checkbox-item').forEach(item => {
            item.classList.remove('checked');
            item.querySelector('input').checked = false;
        });
    }
}

// ============================================================================
// FORM SUBMISSION
// ============================================================================

document.getElementById('addTransactionForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const descriptionEl = document.getElementById('description');
    const payerEl = document.getElementById('payer');
    const categoryEl = document.getElementById('category');
    const dateEl = document.getElementById('transactionDate');

    if (!descriptionEl || !payerEl || !categoryEl || !dateEl) return;

    let description = descriptionEl.value;
    const payer = payerEl.value;
    const category = categoryEl.value || 'lainnya';
    const transactionDate = dateEl.value;

    // Validate
    if (window.Validation) {
        const descResult = Validation.validateDescription(description);
        if (!descResult.valid) {
            showAlert(descResult.error);
            return;
        }
        description = descResult.value;
    }

    const checkedBoxes = document.querySelectorAll('.checkbox-item input:checked');
    const split = {};
    let totalAmount = 0;

    checkedBoxes.forEach(checkbox => {
        const person = checkbox.value;
        const container = document.getElementById(`items-${person}`);
        if (!container) return;

        const itemRows = container.querySelectorAll('.item-row');
        const items = [];
        let personTotal = 0;

        itemRows.forEach(row => {
            const itemName = row.querySelector('.item-name').value;
            const itemAmount = parseInt(row.querySelector('.item-amount').value) || 0;

            if (itemAmount > 0) {
                items.push({ name: itemName, amount: itemAmount });
                personTotal += itemAmount;
            }
        });

        if (personTotal > 0) {
            split[person] = { amount: personTotal, items: items };
            totalAmount += personTotal;
        }
    });

    if (Object.keys(split).length === 0) {
        showAlert('Pilih setidaknya satu orang untuk split');
        return;
    }

    if (totalAmount === 0) {
        showAlert('Masukkan jumlah untuk setiap orang');
        return;
    }

    const discountRows = document.querySelectorAll('.discount-row');
    const discounts = [];

    discountRows.forEach(row => {
        const type = row.querySelector('.discount-type').value;
        const name = row.querySelector('.discount-name').value;
        const value = parseInt(row.querySelector('.discount-value').value) || 0;

        if (value > 0) {
            let calculated = 0;
            if (type === 'percent') {
                calculated = Math.round(totalAmount * value / 100);
            } else {
                calculated = value;
            }

            discounts.push({
                type: type,
                name: name || 'Diskon',
                value: value,
                calculated: calculated
            });

            Object.keys(split).forEach(person => {
                const personSubtotal = split[person].amount;
                const ratio = totalAmount > 0 ? personSubtotal / totalAmount : 0;
                const personDiscount = Math.round(calculated * ratio);
                split[person].amount -= personDiscount;
                split[person].items.push({
                    name: name || 'Diskon',
                    amount: -personDiscount,
                    isDiscount: true
                });
            });

            totalAmount -= calculated;
        }
    });

    const extraCostRows = document.querySelectorAll('.extra-cost-row');
    const extraCosts = [];

    extraCostRows.forEach(row => {
        const type = row.querySelector('.extra-cost-type').value;
        const name = row.querySelector('.extra-cost-name').value;
        const value = parseInt(row.querySelector('.extra-cost-value').value) || 0;

        if (value > 0) {
            let calculated = 0;
            if (type === 'percent') {
                calculated = Math.round(totalAmount * value / 100);
            } else {
                calculated = value;
            }

            extraCosts.push({
                type: type,
                name: name || 'Biaya Tambahan',
                value: value,
                calculated: calculated
            });

            Object.keys(split).forEach(person => {
                const personSubtotal = split[person].amount;
                const ratio = totalAmount > 0 ? personSubtotal / totalAmount : 0;
                const personExtraCost = Math.round(calculated * ratio);
                split[person].amount += personExtraCost;
                split[person].items.push({
                    name: name || 'Biaya Tambahan',
                    amount: personExtraCost,
                    isExtraCost: true
                });
            });

            totalAmount += calculated;
        }
    });

    const editId = document.getElementById('editTransactionId').value;

    if (editId) {
        const index = transactions.findIndex(t => t.id === parseInt(editId));
        if (index !== -1) {
            transactions[index] = {
                ...transactions[index],
                description,
                payer,
                category,
                totalAmount,
                split,
                extraCosts: extraCosts.length > 0 ? extraCosts : null,
                discounts: discounts.length > 0 ? discounts : null
            };
        }
        cancelEdit();
        showToast('Berhasil update transaksi');
    } else {
        transactions.push({
            id: nextId++,
            description,
            payer,
            category,
            totalAmount,
            split,
            extraCosts: extraCosts.length > 0 ? extraCosts : null,
            discounts: discounts.length > 0 ? discounts : null,
            splitStatus: {},
            status: 'pending',
            date: transactionDate || new Date().toISOString().split('T')[0]
        });
    }

    saveToStorage();
    this.reset();

    document.querySelectorAll('.checkbox-item').forEach(item => {
        item.classList.remove('checked');
        item.querySelector('input').checked = false;
    });
    document.getElementById('splitAmounts').innerHTML = '';
    document.getElementById('autoTotal').textContent = 'Rp 0';
    document.getElementById('extraCostsContainer').innerHTML = '';
    document.getElementById('discountsContainer').innerHTML = '';
    document.getElementById('transactionDate').value = '';
    extraCostCounter = 0;
    discountCounter = 0;
    document.getElementById('editTransactionId').value = '';

    refreshAll();
});

// ============================================================================
// EXTRA COSTS
// ============================================================================

function addExtraCostField() {
    extraCostCounter++;
    const container = document.getElementById('extraCostsContainer');
    if (!container) return;

    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'extra-cost-row';
    fieldDiv.id = `extraCostRow-${extraCostCounter}`;
    fieldDiv.style.cssText = 'display: flex; gap: 8px; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap;';
    fieldDiv.innerHTML = `
        <div class="form-group" style="min-width: 120px; flex: 1;">
            <label>Jenis Biaya</label>
            <select class="extra-cost-type" onchange="handleExtraCostTypeChange(this)">
                <option value="percent">Persen (%)</option>
                <option value="nominal">Nominal (Rp)</option>
            </select>
        </div>
        <div class="form-group" style="min-width: 120px; flex: 1;">
            <label>Nama Biaya</label>
            <input type="text" class="extra-cost-name" placeholder="Contoh: Pajak">
        </div>
        <div class="form-group" style="min-width: 100px; flex: 1;">
            <label>Nilai</label>
            <input type="number" class="extra-cost-value" placeholder="0" min="0" disabled>
        </div>
        <button type="button" onclick="removeExtraCostField(${extraCostCounter})" style="background: var(--danger); color: white; border: none; width: 36px; height: 36px; border-radius: 6px; cursor: pointer; margin-top: 20px;">×</button>
    `;
    container.appendChild(fieldDiv);

    // Set initial state for the new field
    const newSelect = fieldDiv.querySelector('.extra-cost-type');
    if (newSelect) {
        handleExtraCostTypeChange(newSelect);
    }

    calculateAutoTotal();
}

function removeExtraCostField(id) {
    const row = document.getElementById(`extraCostRow-${id}`);
    if (row) {
        row.remove();
        calculateAutoTotal();
    }
}

function handleExtraCostTypeChange(select) {
    const input = select.closest('.extra-cost-row').querySelector('.extra-cost-value');
    if (input) {
        input.disabled = !select.value;
        if (!select.value) {
            input.value = '';
        } else {
            input.placeholder = select.value === 'percent' ? '10' : '5000';
        }
    }
    calculateAutoTotal();
}

document.getElementById('extraCostsContainer')?.addEventListener('input', function(e) {
    if (e.target.classList.contains('extra-cost-value') || e.target.classList.contains('extra-cost-name')) {
        calculateAutoTotal();
    }
});

// ============================================================================
// DISCOUNTS
// ============================================================================

function addDiscountField() {
    discountCounter++;
    const container = document.getElementById('discountsContainer');
    if (!container) return;

    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'discount-row';
    fieldDiv.id = `discountRow-${discountCounter}`;
    fieldDiv.style.cssText = 'display: flex; gap: 8px; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap;';
    fieldDiv.innerHTML = `
        <div class="form-group" style="min-width: 120px; flex: 1;">
            <label>Jenis Diskon</label>
            <select class="discount-type" onchange="handleDiscountTypeChange(this)">
                <option value="percent">Persen (%)</option>
                <option value="nominal">Nominal (Rp)</option>
            </select>
        </div>
        <div class="form-group" style="min-width: 120px; flex: 1;">
            <label>Nama Diskon</label>
            <input type="text" class="discount-name" placeholder="Contoh: Promo, Voucher">
        </div>
        <div class="form-group" style="min-width: 100px; flex: 1;">
            <label>Nilai</label>
            <input type="number" class="discount-value" placeholder="0" min="0" disabled>
        </div>
        <button type="button" onclick="removeDiscountField(${discountCounter})" style="background: #dc2626; color: white; border: none; width: 36px; height: 36px; border-radius: 6px; cursor: pointer; margin-top: 20px;">×</button>
    `;
    container.appendChild(fieldDiv);

    const newSelect = fieldDiv.querySelector('.discount-type');
    if (newSelect) {
        handleDiscountTypeChange(newSelect);
    }

    calculateAutoTotal();
}

function removeDiscountField(id) {
    const row = document.getElementById(`discountRow-${id}`);
    if (row) {
        row.remove();
        calculateAutoTotal();
    }
}

function handleDiscountTypeChange(select) {
    const input = select.closest('.discount-row').querySelector('.discount-value');
    if (input) {
        input.disabled = !select.value;
        if (!select.value) {
            input.value = '';
        } else {
            input.placeholder = select.value === 'percent' ? '10' : '5000';
        }
    }
    calculateAutoTotal();
}

document.getElementById('discountsContainer')?.addEventListener('input', function(e) {
    if (e.target.classList.contains('discount-value') || e.target.classList.contains('discount-name')) {
        calculateAutoTotal();
    }
});

document.getElementById('description')?.addEventListener('input', updateCheckboxState);
document.getElementById('payer')?.addEventListener('change', updateCheckboxState);

// ============================================================================
// MODALS & TOAST
// ============================================================================

function showAlert(message) {
    document.getElementById('alertMessage').textContent = message;
    document.getElementById('alertModal').classList.add('show');
}

function closeAlertModal() {
    document.getElementById('alertModal').classList.remove('show');
}

// ============================================================================
// IMPORT CONFIRMATION MODAL
// ============================================================================

let selectedImportMode = 'merge'; // default to merge
let pendingImportFile = null; // Store selected file

function selectFileForImport() {
    // Close export menu first
    const exportMenu = document.getElementById('exportMenu');
    if (exportMenu) exportMenu.style.display = 'none';

    // Remove existing input if any
    const existingInput = document.getElementById('importFileInput');
    if (existingInput) {
        existingInput.remove();
    }

    // Create fresh input element
    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'importFileInput';
    input.accept = '.json,.csv,.xlsx,.xls';
    input.style.display = 'none';

    // Set onchange handler before adding to DOM
    input.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            pendingImportFile = file;
            showImportConfirmModal();
        }
    });

    document.body.appendChild(input);
    input.click();
}

function showImportConfirmModal() {
    // Reset to default (merge)
    selectedImportMode = 'merge';
    selectImportMode('merge');
    document.getElementById('importConfirmModal').classList.add('show');
}

function closeImportConfirmModal() {
    document.getElementById('importConfirmModal').classList.remove('show');
    pendingImportFile = null; // Clear pending file
}

function selectImportMode(mode) {
    selectedImportMode = mode;

    // Update UI styling
    const replaceOption = document.getElementById('importReplaceOption');
    const mergeOption = document.getElementById('importMergeOption');
    const replaceRadio = document.getElementById('importModeReplace');
    const mergeRadio = document.getElementById('importModeMerge');

    if (mode === 'replace') {
        replaceOption.style.borderColor = '#4f46e5';
        replaceOption.style.background = '#eef2ff';
        mergeOption.style.borderColor = '#e5e7eb';
        mergeOption.style.background = 'transparent';
        replaceRadio.checked = true;
        mergeRadio.checked = false;
    } else {
        mergeOption.style.borderColor = '#4f46e5';
        mergeOption.style.background = '#eef2ff';
        replaceOption.style.borderColor = '#e5e7eb';
        replaceOption.style.background = 'transparent';
        mergeRadio.checked = true;
        replaceRadio.checked = false;
    }
}

function confirmImport() {
    console.log('confirmImport called');
    if (!pendingImportFile) {
        showToast('Tidak ada file yang dipilih');
        return;
    }

    const fileToImport = pendingImportFile;
    console.log('File to import:', fileToImport ? fileToImport.name : 'null');

    closeImportConfirmModal();
    showLoadingToast('Memproses ' + (fileToImport.name || 'file') + '...');

    window.pendingImportMode = selectedImportMode;
    console.log('Import mode:', selectedImportMode);

    console.log('Calling Storage.processImportFile');
    Storage.processImportFile(fileToImport).finally(() => {
        hideLoadingToast();
    });
    console.log('Storage.processImportFile dispatched');
}

// ============================================================================
// SYNC FROM GOOGLE SHEET
// ============================================================================

let _syncDebounceTimer = null;
let _syncInProgress = false;

function showSyncConfirmModal() {
    // Pre-fill URL from storage
    const input = document.getElementById('syncUrlInput');
    if (input && window.Storage && Storage.getSyncUrl) {
        const saved = Storage.getSyncUrl();
        // Show the saved *original* (edit URL) if possible, or the export URL
        input.value = saved || '';
    }

    // Last sync info
    const lastEl = document.getElementById('lastSyncDisplay');
    if (lastEl) {
        const last = window.Storage && Storage.getLastSync ? Storage.getLastSync() : null;
        if (last) {
            const d = new Date(last);
            lastEl.textContent = `Sinkron terakhir: ${d.toLocaleString('id-ID')}`;
        } else {
            lastEl.textContent = 'Belum pernah sinkron';
        }
    }

    // Reset status + button state
    updateSyncUrlStatus('', '');
    updateSyncButton();
    syncAutoSyncCheckbox();

    document.getElementById('syncUrlModal').classList.add('show');
    setTimeout(() => input && input.focus(), 0);
}

function closeSyncUrlModal() {
    document.getElementById('syncUrlModal').classList.remove('show');
    if (_syncDebounceTimer) {
        clearTimeout(_syncDebounceTimer);
        _syncDebounceTimer = null;
    }
}

// Called on every keystroke in the URL input
function onSyncUrlInput() {
    const input = document.getElementById('syncUrlInput');
    const raw = input ? input.value.trim() : '';

    updateSyncButton();

    // Validate
    if (!raw) {
        updateSyncUrlStatus('', '');
        if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
        return;
    }

    const exportUrl = Storage.toCsvExportUrl(raw);
    if (!exportUrl) {
        updateSyncUrlStatus('error', '❌ URL harus dari Google Sheets');
        if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
        return;
    }

    updateSyncUrlStatus('ok', '✓ URL valid');

    // Debounce auto-sync: trigger ~800ms after last keystroke
    if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
    _syncDebounceTimer = setTimeout(() => {
        _syncDebounceTimer = null;
        if (!_syncInProgress) {
            runSync(exportUrl);
        }
    }, 800);
}

// Enter key triggers sync immediately
function onSyncUrlKeyDown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
        const btn = document.getElementById('syncNowBtn');
        if (btn && !btn.disabled) confirmSync();
    }
}

function updateSyncUrlStatus(type, msg) {
    const el = document.getElementById('syncUrlStatus');
    if (!el) return;
    el.textContent = msg;
    el.style.color = type === 'error' ? '#dc2626' : (type === 'ok' ? '#059669' : '#9ca3af');
}

function updateSyncButton() {
    const input = document.getElementById('syncUrlInput');
    const btn = document.getElementById('syncNowBtn');
    if (!input || !btn) return;
    const exportUrl = Storage.toCsvExportUrl(input.value.trim());
    const valid = !!exportUrl;
    btn.disabled = !valid;
    btn.style.opacity = valid ? '1' : '0.5';
    btn.style.cursor = valid ? 'pointer' : 'not-allowed';
}

function downloadSyncTemplate() {
    if (window.Storage && typeof Storage.downloadTemplate === 'function') {
        Storage.downloadTemplate();
    } else {
        showAlert('Template tidak tersedia');
    }
}

// Manual sync (button click)
// Holds the URL selected for sync while the user picks a mode
let _pendingSyncUrl = '';

function confirmSync() {
    const input = document.getElementById('syncUrlInput');
    const raw = input ? input.value.trim() : '';
    const exportUrl = Storage.toCsvExportUrl(raw);
    if (!exportUrl) {
        updateSyncUrlStatus('error', '❌ URL tidak valid');
        return;
    }

    _pendingSyncUrl = exportUrl;

    // Close URL modal so confirmation modal sits on top
    closeSyncUrlModal();

    // Highlight the option that matches the current auto-sync state
    const autoOn = window.Storage && Storage.isAutoSyncEnabled && Storage.isAutoSyncEnabled();
    const oneShotBtn = document.getElementById('syncModeOneShot');
    const autoBtn = document.getElementById('syncModeAuto');
    if (oneShotBtn && autoBtn) {
        if (autoOn) {
            autoBtn.style.borderColor = '#4f46e5';
            autoBtn.style.background = '#eef2ff';
            oneShotBtn.style.borderColor = '#e5e7eb';
            oneShotBtn.style.background = 'transparent';
        } else {
            oneShotBtn.style.borderColor = '#4f46e5';
            oneShotBtn.style.background = '#eef2ff';
            autoBtn.style.borderColor = '#e5e7eb';
            autoBtn.style.background = 'transparent';
        }
    }

    document.getElementById('syncModeModal').classList.add('show');
}

function closeSyncModeModal() {
    document.getElementById('syncModeModal').classList.remove('show');
    _pendingSyncUrl = '';
}

// mode: 'once' = sync one time, 'auto' = sync + enable auto-sync for future
function confirmSyncMode(mode) {
    const url = _pendingSyncUrl;
    closeSyncModeModal();
    if (!url) return;

    if (mode === 'auto' && window.Storage && Storage.setAutoSync) {
        Storage.setAutoSync(true);
        // Update checkbox if URL modal is reopened later
        const cb = document.getElementById('autoSyncToggle');
        if (cb) cb.checked = true;
    }

    // deleteMissing is always true — sheet is the source of truth for what's present
    runSync(url, { deleteMissing: true });
}

// Track last successful sync time (for focus-sync debouncing)
let _lastSyncCompletedAt = 0;
const AUTO_SYNC_MIN_INTERVAL_MS = 30_000; // 30s — skip focus-sync if just synced

// Actual sync runner — used by auto-sync, button click, and Enter key
// options.silent = true hides toasts (used for background sync)
function runSync(exportUrl, options = {}) {
    const silent = options.silent === true;
    if (_syncInProgress) return;
    _syncInProgress = true;

    // Persist URL (skip when called from auto-sync where no input is being edited)
    if (!silent) {
        const rawInput = document.getElementById('syncUrlInput');
        if (rawInput && window.Storage && Storage.setSyncUrl) {
            Storage.setSyncUrl(rawInput.value.trim());
        }
    }

    if (!silent) showLoadingToast('Mengambil data dari Google Sheet...');

    fetch(exportUrl, { redirect: 'follow' })
        .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
            return r.text();
        })
        .then(csv => {
            const syncData = Storage.parseSyncCSV(csv);
            const result = Storage.applySync(syncData, 'merge', { deleteMissing });
            _lastSyncCompletedAt = Date.now();
            hideLoadingToast();
            _syncInProgress = false;

            // Refresh UI
            loadFromStorage();
            refreshAll();
            renderPeopleManage();
            renderFormPeople();

            // Update last sync display (only if modal is open)
            const lastEl = document.getElementById('lastSyncDisplay');
            if (lastEl) {
                const d = new Date();
                lastEl.textContent = `Sinkron terakhir: ${d.toLocaleString('id-ID')}`;
            }

            if (!silent) {
                const parts = [];
                if (result.added > 0) parts.push(`${result.added} baru`);
                if (result.skipped > 0) parts.push(`${result.skipped} dilewati`);
                if (result.removed > 0) parts.push(`${result.removed} dihapus`);
                const summary = parts.length > 0 ? parts.join(', ') : 'tidak ada perubahan';
                showToast(`Sinkron selesai: ${summary}, total ${result.total} transaksi`);
            }
        })
        .catch(err => {
            hideLoadingToast();
            _syncInProgress = false;
            if (silent) {
                // Background sync failure — log only, don't disturb user
                console.warn('Background sync gagal:', err.message);
            } else {
                updateSyncUrlStatus('error', '❌ ' + err.message);
                showAlert('Sinkron gagal: ' + err.message);
            }
        });
}

// Trigger a silent sync from the user's saved URL.
// Returns true if a sync was kicked off, false otherwise.
function tryAutoSync() {
    if (_syncInProgress) return false;
    if (!window.Storage || !Storage.getSyncUrl) return false;
    if (!Storage.isAutoSyncEnabled || !Storage.isAutoSyncEnabled()) return false;

    const rawUrl = Storage.getSyncUrl();
    if (!rawUrl) return false;

    const exportUrl = Storage.toCsvExportUrl(rawUrl);
    if (!exportUrl) return false;

    runSync(exportUrl, { silent: true });
    return true;
}

// After first successful sync, ask the user if they want auto-sync enabled.
// (Removed: replaced by the styled confirmation modal that fires on every
// manual sync, so first-time onboarding is unnecessary.)

// Sync the auto-sync checkbox state from storage to the UI
function syncAutoSyncCheckbox() {
    const cb = document.getElementById('autoSyncToggle');
    if (!cb || !window.Storage) return;
    if (Storage.isAutoSyncEnabled) {
        cb.checked = Storage.isAutoSyncEnabled();
    }
}

function onAutoSyncToggleChange() {
    const cb = document.getElementById('autoSyncToggle');
    if (!cb || !window.Storage || !Storage.setAutoSync) return;
    Storage.setAutoSync(cb.checked);
    if (cb.checked) {
        showToast('Auto-sync diaktifkan — sync otomatis saat buka / balik ke tab');
    } else {
        showToast('Auto-sync dimatikan');
    }
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = '✓ ' + message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Persistent loading toast — caller is responsible for hiding it
function showLoadingToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = '⏳ ' + message;
        toast.classList.add('show');
        toast.classList.add('loading');
    }
}

function hideLoadingToast() {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.classList.remove('show');
        toast.classList.remove('loading');
    }
}

window.showToast = showToast;

// ============================================================================
// EDIT TRANSACTION
// ============================================================================

function editTransaction(id) {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    document.getElementById('editTransactionId').value = id;
    document.getElementById('formTitle').textContent = '✏️ Edit Transaksi';
    document.getElementById('submitBtn').textContent = 'Update Transaksi';
    document.getElementById('cancelEditBtn').style.display = 'inline-block';
    document.getElementById('transactionFormCard').scrollIntoView({ behavior: 'smooth' });

    document.getElementById('description').value = transaction.description || '';
    document.getElementById('payer').value = transaction.payer || '';
    if (document.getElementById('category')) {
        document.getElementById('category').value = transaction.category || 'lainnya';
    }
    if (document.getElementById('transactionDate')) {
        document.getElementById('transactionDate').value = transaction.date || '';
    }

    updateCheckboxState();

    const checkedPeople = Object.keys(transaction.split || {});
    checkedPeople.forEach(person => {
        const checkbox = document.querySelector(`input[name="split"][value="${person}"]`);
        if (checkbox) {
            checkbox.checked = true;
            checkbox.closest('.checkbox-item').classList.add('checked');
        }
    });

    updateSplitAmountInputs();

    checkedPeople.forEach(person => {
        const data = transaction.split[person];
        const items = typeof data === 'object' ? data.items : [];
        const container = document.getElementById(`items-${person}`);
        if (!container) return;

        container.innerHTML = '';

        items.forEach(item => {
            if (!item.isExtraCost && !item.isDiscount) {
                addItem(person, item.name, item.amount);
            }
        });

        if (items.filter(i => !i.isExtraCost && !i.isDiscount).length === 0) {
            addItem(person, '', typeof data === 'number' ? data : (data.amount || 0));
        }
    });

    document.getElementById('extraCostsContainer').innerHTML = '';
    extraCostCounter = 0;

    if (transaction.extraCosts && transaction.extraCosts.length > 0) {
        transaction.extraCosts.forEach(ec => {
            addExtraCostField();
            const rows = document.querySelectorAll('.extra-cost-row');
            const lastRow = rows[rows.length - 1];
            if (lastRow) {
                lastRow.querySelector('.extra-cost-type').value = ec.type;
                lastRow.querySelector('.extra-cost-name').value = ec.name || '';
                lastRow.querySelector('.extra-cost-value').value = ec.value;
            }
        });
    }

    document.getElementById('discountsContainer').innerHTML = '';
    discountCounter = 0;

    if (transaction.discounts && transaction.discounts.length > 0) {
        transaction.discounts.forEach(disc => {
            addDiscountField();
            const rows = document.querySelectorAll('.discount-row');
            const lastRow = rows[rows.length - 1];
            if (lastRow) {
                lastRow.querySelector('.discount-type').value = disc.type;
                lastRow.querySelector('.discount-name').value = disc.name || '';
                lastRow.querySelector('.discount-value').value = disc.value;
            }
        });
    }

    calculateAutoTotal();
}

function cancelEdit() {
    document.getElementById('editTransactionId').value = '';
    document.getElementById('formTitle').textContent = '➕ Tambah Transaksi Baru';
    document.getElementById('submitBtn').textContent = 'Tambah Transaksi';
    document.getElementById('cancelEditBtn').style.display = 'none';
    document.getElementById('addTransactionForm').reset();

    document.querySelectorAll('.checkbox-item').forEach(item => {
        item.classList.remove('checked');
        item.querySelector('input').checked = false;
    });
    document.getElementById('splitAmounts').innerHTML = '';
    document.getElementById('autoTotal').textContent = 'Rp 0';
    document.getElementById('extraCostsContainer').innerHTML = '';
    document.getElementById('discountsContainer').innerHTML = '';
    document.getElementById('transactionDate').value = '';
    extraCostCounter = 0;
    discountCounter = 0;

    updateCheckboxState();
}

// ============================================================================
// RESET
// ============================================================================

function resetAllData() {
    document.getElementById('confirmModal').classList.add('show');
    // Reset input state when opening
    setTimeout(() => {
        const input = document.getElementById('resetConfirmInput');
        if (input) {
            input.value = '';
            toggleResetButton();
        }
    }, 0);
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('show');
}

function toggleResetButton() {
    const input = document.getElementById('resetConfirmInput');
    const btn = document.getElementById('resetConfirmBtn');
    if (!input || !btn) return;
    const matches = input.value === 'RESET';
    btn.disabled = !matches;
    btn.style.opacity = matches ? '1' : '0.5';
    btn.style.cursor = matches ? 'pointer' : 'not-allowed';
}

function resetBackupAndClose() {
    // Export data first, then close modal so user can complete reset if they want
    if (window.Storage && typeof Storage.exportJSON === 'function') {
        Storage.exportJSON();
        showToast('Backup tersimpan. Silakan lanjutkan reset jika perlu.');
    } else {
        showAlert('Fitur backup tidak tersedia');
    }
}

function confirmReset() {
    // Defense-in-depth: re-check the typed confirmation
    const input = document.getElementById('resetConfirmInput');
    if (!input || input.value !== 'RESET') {
        showAlert('Ketik RESET untuk konfirmasi');
        return;
    }

    transactions = [];
    nextId = 1;
    saveToStorage();
    closeConfirmModal();
    refreshAll();
    showToast('Berhasil reset data');
}

// ============================================================================
// IMAGE DOWNLOAD (Simplified - same as before)
// ============================================================================

function downloadImage(transactionId) {
    const t = transactions.find(tr => tr.id === transactionId);
    if (!t) return;

    const padding = 25;
    const width = 480;
    const headerHeight = 70;
    let contentHeight = 80 + 30;

    const numPeople = Object.keys(t.split || {}).length;
    contentHeight += numPeople * 35 + numPeople * 15;

    if (t.extraCosts && t.extraCosts.length > 0) {
        contentHeight += 30 + t.extraCosts.length * 25;
    }
    if (t.discounts && t.discounts.length > 0) {
        contentHeight += 30 + t.discounts.length * 25;
    }
    contentHeight += 90;

    const height = headerHeight + contentHeight + padding * 2 + 100;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#4f46e5');
    gradient.addColorStop(1, '#7c3aed');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, headerHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Detail Transaksi', width / 2, 32);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(t.description || 'Transaksi #' + t.id, width / 2, 50);

    ctx.textAlign = 'left';
    let y = headerHeight + padding + 5;

    const cardWidth = width - padding * 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(padding, y - 8, cardWidth, 60);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, y - 8, cardWidth, 60);
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(padding, y - 8, 4, 60);

    ctx.fillStyle = '#6b7280';
    ctx.font = '10px sans-serif';
    ctx.fillText('Bill:', padding + 15, y + 8);
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(getPersonName(t.payer), padding + 50, y + 8);
    ctx.fillText('Total:', padding + 15, y + 30);
    ctx.fillStyle = '#dc2626';
    ctx.fillText(formatCurrency(t.totalAmount), padding + 55, y + 30);

    y += 75;
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('Detail Split:', padding, y);
    y += 25;

    Object.entries(t.split || {}).forEach(([person, data]) => {
        const amount = typeof data === 'number' ? data : data.amount;
        const items = typeof data === 'object' ? data.items : [];

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(padding, y - 5, cardWidth, 25 + items.length * 20);
        ctx.strokeStyle = '#e5e7eb';
        ctx.strokeRect(padding, y - 5, cardWidth, 25 + items.length * 20);

        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(getPersonName(person), padding + 10, y + 8);
        ctx.fillStyle = '#dc2626';
        ctx.fillText(formatCurrency(amount), width - padding - 80, y + 8);
        y += 20;

        items.forEach(item => {
            ctx.fillStyle = '#6b7280';
            ctx.font = '9px sans-serif';
            ctx.fillText('• ' + (item.name || '-'), padding + 20, y);
            ctx.fillText(formatCurrency(item.amount), width - padding - 60, y);
            y += 18;
        });
        y += 12;
    });

    if (t.extraCosts && t.extraCosts.length > 0) {
        y += 10;
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('Biaya Tambahan:', padding, y);
        y += 18;

        t.extraCosts.forEach(ec => {
            ctx.fillStyle = '#92400e';
            ctx.font = '10px sans-serif';
            ctx.fillText(ec.name + ' (' + (ec.type === 'percent' ? ec.value + '%' : formatCurrency(ec.value)) + ')', padding + 10, y + 8);
            ctx.fillStyle = '#b45309';
            ctx.fillText(formatCurrency(ec.calculated), width - padding - 70, y + 8);
            y += 22;
        });
    }

    if (t.discounts && t.discounts.length > 0) {
        y += 10;
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('Diskon:', padding, y);
        y += 18;

        t.discounts.forEach(disc => {
            ctx.fillStyle = '#047857';
            ctx.font = '10px sans-serif';
            ctx.fillText(disc.name + ' (' + (disc.type === 'percent' ? disc.value + '%' : formatCurrency(disc.value)) + ')', padding + 10, y + 8);
            ctx.fillStyle = '#10b981';
            ctx.fillText('-' + formatCurrency(disc.calculated), width - padding - 70, y + 8);
            y += 22;
        });
    }

    const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    ctx.fillStyle = '#9ca3af';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Generated: ' + dateStr, width / 2, height - 12);

    const link = document.createElement('a');
    link.download = `detail-${t.description || 'transaksi'}-${t.id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function downloadSettlementImage() {
    const padding = 25;
    const headerHeight = 50;

    // Ensure people array is valid
    if (!people || people.length === 0) {
        showAlert('Tambahkan orang terlebih dahulu di Kelola Orang!');
        return;
    }

    // Use cached settlements for consistency with Section "Penyelesaian"
    const settlements = getSettlements();

    if (settlements.length === 0) {
        showAlert('Tidak ada yang perlu disettle!');
        return;
    }

    // Get person keys and names
    const personKeys = people.map(p => p.key);
    const personNamesMap = {};
    people.forEach(p => personNamesMap[p.key] = p.name);

    // Calculate total pending (from settlements)
    let totalPending = settlements.reduce((sum, s) => sum + s.amount, 0);

    // Get latest transaction date
    const latestDate = transactions.length > 0 ? transactions[0].date : new Date().toISOString().split('T')[0];
    const dateFormatted = new Date(latestDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    // Dynamic width based on number of people
    // Recap matrix: name column (80) + (num people * 80) + padding
    const minWidth = 400;
    const maxWidth = 800;
    const personColWidth = 85;
    const nameColWidth = 90;
    const recapWidth = nameColWidth + (personKeys.length * personColWidth) + padding * 2;

    // Detail table: description (120) + date (100) + (num people * colWidth) + padding
    const descColWidth = 120;
    const dateColWidth = 100;
    const detailColWidth = 80;
    const detailWidth = descColWidth + dateColWidth + (personKeys.length * detailColWidth) + padding * 2;

    // Use the wider of the two
    const width = Math.min(maxWidth, Math.max(minWidth, Math.max(recapWidth, detailWidth)));

    // Calculate content height dynamically
    let contentHeight = 0;

    // Section 1: Recap matrix
    contentHeight += 30; // header
    contentHeight += personKeys.length * 30 + 15; // matrix rows

    // Section 2: Detail transactions
    contentHeight += 35; // section header

    // Calculate height based on actual transactions
    const numTransactions = transactions.length;
    contentHeight += numTransactions * 25; // rows

    // Footer
    contentHeight += 50;

    const height = headerHeight + contentHeight + padding * 2;

    // Create canvas with dynamic dimensions (2x scale for HD)
    const scale = 2;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);

    // Background
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, width, height);

    // Header gradient
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#4f46e5');
    gradient.addColorStop(1, '#7c3aed');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, headerHeight);

    // Header text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Recap', width / 2, 22);
    ctx.font = '9px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('Harta Gono-Gini', width / 2, 38);

    ctx.textAlign = 'left';
    let y = headerHeight + padding + 5;
    const cardWidth = width - padding * 2;

    // ===== SECTION 1: RECAP MATRIX =====
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('Summary:', padding, y);
    y += 20;

    // Build netMatrix from settlements (using same calculation as Section "Penyelesaian")
    console.log('Debug: Building netMatrix from settlements:', JSON.stringify(settlements, null, 2));

    const netMatrix = {};
    personKeys.forEach(from => {
        netMatrix[from] = {};
        personKeys.forEach(to => {
            netMatrix[from][to] = '-';
        });
    });

    // Fill in settlements into the matrix
    settlements.forEach(s => {
        if (netMatrix[s.from] && netMatrix[s.from].hasOwnProperty(s.to)) {
            netMatrix[s.from][s.to] = s.amount;
        } else {
            console.log('Debug: Skipping settlement - from/to not in personKeys:', s.from, '->', s.to, '| personKeys:', personKeys);
        }
    });

    console.log('Debug: netMatrix:', JSON.stringify(netMatrix, null, 2));

    // Calculate dynamic column widths for recap matrix
    const recapNameColWidth = 90;
    const recapPersonColWidth = 85;
    const matrixNameColWidth = width - (personKeys.length * recapPersonColWidth) - padding * 2;

    // Table header row
    ctx.fillStyle = '#4f46e5';
    ctx.fillRect(padding, y, width - padding * 2, 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('', padding + 2, y + 18);

    personKeys.forEach((key, i) => {
        const name = personNamesMap[key] || key;
        const displayName = name.length > 8 ? name.substring(0, 7) + '..' : name;
        ctx.textAlign = 'center';
        ctx.fillText('Ke ' + displayName, padding + matrixNameColWidth + (i * recapPersonColWidth) + recapPersonColWidth / 2, y + 18);
    });
    ctx.textAlign = 'left';
    y += 28;

    // Table rows
    personKeys.forEach((fromKey, rowIdx) => {
        const rowHeight = 28;
        const bgColor = rowIdx % 2 === 0 ? '#ffffff' : '#f3f4f6';

        ctx.fillStyle = bgColor;
        ctx.fillRect(padding, y, width - padding * 2, rowHeight);
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(padding, y, width - padding * 2, rowHeight);

        // Row header (person name)
        const fromName = personNamesMap[fromKey] || fromKey;
        const displayFromName = fromName.length > 8 ? fromName.substring(0, 7) + '..' : fromName;
        ctx.fillStyle = '#374151';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(displayFromName, padding + 3, y + 18);

        // Payment cells
        personKeys.forEach((toKey, colIdx) => {
            const cellX = padding + matrixNameColWidth + (colIdx * recapPersonColWidth);
            const value = netMatrix[fromKey][toKey];

            if (value === '-') {
                ctx.fillStyle = '#9ca3af';
                ctx.font = '9px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('-', cellX + recapPersonColWidth / 2, y + 18);
            } else {
                ctx.fillStyle = '#dc2626';
                ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(formatCurrency(value), cellX + recapPersonColWidth / 2, y + 18);
            }
        });
        ctx.textAlign = 'left';

        y += rowHeight;
    });

    y += 35;

    // ===== SECTION 3: DETAIL TRANSAKSI TABLE =====
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('Detail Transaksi:', padding, y);
    y += 25;

    // Get all person names for table headers
    const personNames = people.map(p => p.name || p.key || 'Unknown');
    const numPersons = personNames.length || 1;

    // Dynamic column widths for detail table
    const detailDescColWidth = 110;
    const detailDateColWidth = 85;
    const detailPersonColWidth = Math.max(60, (cardWidth - detailDescColWidth - detailDateColWidth) / numPersons);
    const rowHeight = 25;

    // Table header
    ctx.fillStyle = '#7c3aed';
    ctx.fillRect(padding, y, cardWidth, 28);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('Description', padding + 5, y + 18);
    ctx.fillText('Date', padding + detailDescColWidth + 5, y + 18);

    personNames.forEach((name, i) => {
        const colX = padding + detailDescColWidth + detailDateColWidth + (i * detailPersonColWidth);
        // Truncate name if too long
        const displayName = (name || '?').length > 8 ? name.substring(0, 7) + '..' : name;
        ctx.textAlign = 'center';
        ctx.fillText(displayName, colX + detailPersonColWidth / 2, y + 18);
    });
    ctx.textAlign = 'left';
    y += 28;

    // Sort transactions by date descending
    const sortedTransactions = [...transactions].sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date);
    });

    // Table rows
    sortedTransactions.forEach((t, index) => {
        const bgColor = index % 2 === 0 ? '#ffffff' : '#f3f4f6';

        ctx.fillStyle = bgColor;
        ctx.fillRect(padding, y, cardWidth, rowHeight);
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(padding, y, cardWidth, rowHeight);

        // Description (truncate if too long, max 33 chars)
        const desc = t.description ? (t.description.length > 33 ? t.description.substring(0, 30) + '...' : t.description) : '-';
        ctx.fillStyle = '#374151';
        ctx.font = '9px sans-serif';
        ctx.fillText(desc, padding + 5, y + 16);

        // Date (with year)
        const dateObj = t.date ? new Date(t.date) : null;
        let dateStr = '-';
        if (dateObj && !isNaN(dateObj.getTime())) {
            const day = dateObj.getDate().toString().padStart(2, '0');
            const month = dateObj.toLocaleDateString('id-ID', { month: 'short' });
            const year = dateObj.getFullYear();
            dateStr = `${day} ${month} ${year}`;
        }
        ctx.fillStyle = '#6b7280';
        ctx.font = '8px sans-serif';
        ctx.fillText(dateStr, padding + detailDescColWidth + 5, y + 16);

        // Person amounts - check if payer
        personNames.forEach((name, i) => {
            const personKey = people[i]?.key || people[i]?.name?.toLowerCase().replace(/\s+/g, '');
            const colX = padding + detailDescColWidth + detailDateColWidth + (i * detailPersonColWidth);

            // Check if this person is the payer
            const isPayer = t.payer && personKey && personKey.toLowerCase() === t.payer.toLowerCase();

            // Try multiple key formats
            let amountValue = 0;
            if (t.split) {
                // Direct key match
                amountValue = t.split[personKey];
                if (amountValue === undefined) {
                    // Try case-insensitive match
                    const keys = Object.keys(t.split);
                    const foundKey = keys.find(k => k.toLowerCase() === personKey.toLowerCase());
                    if (foundKey) amountValue = t.split[foundKey];
                }
            }
            amountValue = typeof amountValue === 'number' ? amountValue : (amountValue?.amount || 0);

            if (isPayer) {
                // Show Paymaster for payer
                ctx.fillStyle = '#10b981';
                ctx.font = 'bold italic 8px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Paymaster', colX + detailPersonColWidth / 2, y + 16);
            } else if (amountValue > 0) {
                ctx.fillStyle = '#dc2626';
                ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(formatCurrency(amountValue), colX + detailPersonColWidth / 2, y + 16);
            } else {
                ctx.fillStyle = '#9ca3af';
                ctx.font = '9px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('-', colX + detailPersonColWidth / 2, y + 16);
            }
        });
        ctx.textAlign = 'left';

        y += rowHeight;
    });

    // Footer
    ctx.fillStyle = '#9ca3af';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Copyright © by KMB - Konferensi Meja Bundar', width / 2, height - 15);

    // Download
    const link = document.createElement('a');
    link.download = `recap-penyelesaian-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    showToast('Berhasil download');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function refreshAll() {
    resetSettlementsCache();
    renderDashboard();
    renderSettlements();
    renderTransactions();
}

// Expose functions globally
window.addPerson = addPerson;
window.removePerson = removePerson;
window.updatePersonName = updatePersonName;
window.renderPeopleManage = renderPeopleManage;
window.updateSplitAmountInputs = updateSplitAmountInputs;
window.calculateAutoTotal = calculateAutoTotal;
window.calculatePersonTotal = calculatePersonTotal;
window.addItem = addItem;
window.removeItem = removeItem;
window.toggleDetails = toggleDetails;
window.editTransaction = editTransaction;
window.settlePerson = settlePerson;
window.settleBySettlement = settleBySettlement;
window.downloadImage = downloadImage;
window.downloadSettlementImage = downloadSettlementImage;
window.resetAllData = resetAllData;
window.closeConfirmModal = closeConfirmModal;
window.confirmReset = confirmReset;
window.addExtraCostField = addExtraCostField;
window.removeExtraCostField = removeExtraCostField;
window.handleExtraCostTypeChange = handleExtraCostTypeChange;
window.addDiscountField = addDiscountField;
window.removeDiscountField = removeDiscountField;
window.handleDiscountTypeChange = handleDiscountTypeChange;
window.showHistory = showHistory;
window.hideHistory = hideHistory;
window.renderHistory = renderHistory;
window.updateCheckboxState = updateCheckboxState;
window.showAlert = showAlert;
window.closeAlertModal = closeAlertModal;
window.goToPage = goToPage;

// Modal functions
window.showAddPersonModal = showAddPersonModal;
window.closeAddPersonModal = closeAddPersonModal;
window.confirmAddPerson = confirmAddPerson;
window.showDeletePersonModal = showDeletePersonModal;
window.closeDeletePersonModal = closeDeletePersonModal;
window.confirmDeletePerson = confirmDeletePerson;
window.deleteTransaction = deleteTransaction;
window.closeConfirmDeleteModal = closeConfirmDeleteModal;
window.closeConfirmSettleModal = closeConfirmSettleModal;
window.confirmSettle = confirmSettle;
window.confirmDeleteTransaction = confirmDeleteTransaction;
window.debugData = debugData;
window.toggleDarkMode = toggleDarkMode;
window.toggleExportMenu = toggleExportMenu;
window.toggleDashboard = toggleDashboard;
window.toggleSettlements = toggleSettlements;
window.showPersonHistory = showPersonHistory;
window.closePersonHistoryModal = closePersonHistoryModal;
window.closeImportConfirmModal = closeImportConfirmModal;
window.confirmImport = confirmImport;
window.showSyncConfirmModal = showSyncConfirmModal;
window.closeSyncUrlModal = closeSyncUrlModal;
window.onSyncUrlInput = onSyncUrlInput;
window.onSyncUrlKeyDown = onSyncUrlKeyDown;
window.downloadSyncTemplate = downloadSyncTemplate;
window.confirmSync = confirmSync;
window.onAutoSyncToggleChange = onAutoSyncToggleChange;
window.confirmSyncMode = confirmSyncMode;
window.closeSyncModeModal = closeSyncModeModal;
window.showImportConfirmModal = showImportConfirmModal;
window.selectFileForImport = selectFileForImport;

// Pagination event delegation
document.addEventListener('click', function(e) {
    const btn = e.target.closest('.page-btn');
    if (btn) {
        const page = parseInt(btn.dataset.page);
        const containerId = btn.dataset.container;
        if (!isNaN(page) && containerId) {
            goToPage(containerId, page);
        }
    }
});

// Load data and initialize
loadFromStorage();
initDarkMode();
renderPeopleManage();
setupSplitInputs();
refreshAll();
updateCheckboxState();

// Set default date to today
const today = new Date().toISOString().split('T')[0];
const dateInput = document.getElementById('transactionDate');
if (dateInput) dateInput.value = today;

// ============================================================================
// AUTO-SYNC: on app load + when tab regains focus
// ============================================================================
// (A) Auto-sync on app load — fire after init so UI is responsive
setTimeout(() => {
    if (!tryAutoSync()) {
        console.log('Auto-sync dilewati: URL belum diset');
    } else {
        console.log('Auto-sync on load dimulai');
    }
}, 100);

// (C) Auto-sync on tab focus — skip if just synced (< 30s) to avoid spam
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (_syncInProgress) return;
    const sinceLast = Date.now() - _lastSyncCompletedAt;
    if (sinceLast < AUTO_SYNC_MIN_INTERVAL_MS) {
        console.log('Auto-sync dilewati: baru saja sync', Math.round(sinceLast/1000), 's lalu');
        return;
    }
    if (tryAutoSync()) {
        console.log('Auto-sync on focus dimulai');
    }
});

// (D) Periodic polling — sync every POLL_INTERVAL_MS while tab is active,
// so external changes (sheet updated by someone else) are picked up
const AUTO_SYNC_POLL_MS = 60_000; // 60 seconds
setInterval(() => {
    if (document.visibilityState !== 'visible') return; // only poll when tab is active
    if (_syncInProgress) return;
    const sinceLast = Date.now() - _lastSyncCompletedAt;
    if (sinceLast < AUTO_SYNC_MIN_INTERVAL_MS) {
        return; // recently synced (manual or focus), skip
    }
    if (tryAutoSync()) {
        console.log('Auto-sync (poll) dimulai');
    }
}, AUTO_SYNC_POLL_MS);

console.log('app.js fully loaded');
console.log('toggleExportMenu:', typeof window.toggleExportMenu);
