// ============================================================================
// HARTA GONO-GINI - Main Application
// ============================================================================

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
    var days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
    var months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    var date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    var dayName = days[date.getDay()];
    var day = date.getDate().toString().padStart(2, '0');
    var month = months[date.getMonth()];
    var year = date.getFullYear();
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
        const savedTransactions = Storage.get(Storage.KEYS.TRANSACTIONS);
        const savedNextId = Storage.get(Storage.KEYS.NEXT_ID);
        const savedPeople = Storage.get(Storage.KEYS.PEOPLE);

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
        Storage.set(Storage.KEYS.TRANSACTIONS, transactions);
        Storage.set(Storage.KEYS.NEXT_ID, nextId);
        Storage.set(Storage.KEYS.PEOPLE, people);
    } else {
        localStorage.setItem('hartaGonoGini_transactions', JSON.stringify(transactions));
        localStorage.setItem('hartaGonoGini_nextId', nextId.toString());
        localStorage.setItem('hartaGonoGini_people', JSON.stringify(people));
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

let people = [
    { key: 'qulub', name: 'Qulub' },
    { key: 'haqqi', name: 'Haqqi' },
    { key: 'yohn', name: 'Mas Yohn' },
    { key: 'lintang', name: 'Mas Lintang' }
];

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

    // Build HTML using string concatenation for better compatibility
    let html = '';
    for (let i = 0; i < people.length; i++) {
        const person = people[i];
        const removeBtn = people.length > 1
            ? '<button onclick="showDeletePersonModal(\'' + person.key + '\')" style="padding: 8px 12px; background: var(--danger); color: white; border: none; border-radius: 6px; cursor: pointer;">Hapus</button>'
            : '';
        html += '<div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">' +
            '<input type="text" value="' + escapeHtml(person.name) + '" onchange="updatePersonName(\'' + person.key + '\', this.value)"' +
            ' style="flex: 1; padding: 8px 12px; border: 1px solid var(--gray-300); border-radius: 6px;">' +
            removeBtn +
            '</div>';
    }

    container.innerHTML = html;
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
        Object.entries(t.split || {}).forEach(([person, data]) => {
            const amount = typeof data === 'number' ? data : data.amount;
            if (person === t.payer) return;
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
                const key = `${person}-${t.payer}`;
                if (!settlementMap[key]) {
                    settlementMap[key] = { from: person, to: t.payer, amount: 0, items: [] };
                }
                settlementMap[key].amount += amount;
                items.forEach(item => {
                    settlementMap[key].items.push({ name: item.name || '-', amount: item.amount });
                });
            }
        });
    });

    const finalSettlements = [];
    const processed = new Set();

    Object.values(settlementMap).forEach(s => {
        const reverseKey = `${s.to}-${s.from}`;
        const pairKey = [s.from, s.to].sort().join('-');
        if (processed.has(pairKey)) return;
        processed.add(pairKey);

        if (settlementMap[reverseKey]) {
            const reverse = settlementMap[reverseKey];
            const netAmount = s.amount - reverse.amount;

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
            finalSettlements.push(s);
        }
    });

    return finalSettlements;
}

// ============================================================================
// DASHBOARD
// ============================================================================

let dashboardVisible = true;

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
    const settlements = calculateSettlements();
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
    if (window.Charts) {
        const categoryData = Charts.getCategoryBreakdown(transactions);
        const personData = Charts.getPersonSpending(transactions, people);

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

function renderSettlements() {
    const settlements = calculateSettlements();
    const container = document.getElementById('settlementList');
    if (!container) return;

    if (settlements.length === 0) {
        container.innerHTML = '<li class="no-data">Semua sudah settle! ✓</li>';
        return;
    }

    container.innerHTML = settlements.map(s => `
        <li class="settlement-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                <span>
                    <span class="from">${escapeHtml(getPersonName(s.from))}</span>
                    <span class="arrow">bayar ke</span>
                    <span class="to">${escapeHtml(getPersonName(s.to))}</span>
                </span>
                <span>
                    <span class="amount">${formatCurrency(s.amount)}</span>
                    <button class="btn-settle" onclick="settleBySettlement('${s.from}', '${s.to}', ${s.amount})">Selesai</button>
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
}

// ============================================================================
// TRANSACTION RENDERING
// ============================================================================

function renderTransactions() {
    const tbody = document.getElementById('transactionsBody');
    if (!tbody) return;

    currentPage = 1;

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

    renderPagination('transactionsPagination', totalPages, currentPage, (page) => {
        currentPage = page;
        renderTransactions();
    });
}

function renderTransactionDetails(t, splitStatus) {
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
                                    `<button class="btn-pay" onclick="settlePerson(${t.id}, '${person}')">💰 Bayar</button>`
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
        html += `<button onclick="goToPage('${containerId}', ${currentPage - 1})" style="padding:4px 10px;border:1px solid #e5e7eb;background:white;border-radius:4px;cursor:pointer;">&#8249;</button>`;
    }

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            const active = i === currentPage ? 'background:#4f46e5;color:white;' : '';
            html += `<button onclick="goToPage('${containerId}', ${i})" style="padding:4px 10px;border:1px solid #e5e7eb;background:white;border-radius:4px;cursor:pointer;${active}">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += `<span style="padding:4px;">...</span>`;
        }
    }

    if (currentPage < totalPages) {
        html += `<button onclick="goToPage('${containerId}', ${currentPage + 1})" style="padding:4px 10px;border:1px solid #e5e7eb;background:white;border-radius:4px;cursor:pointer;">&#8250;</button>`;
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

function settleBySettlement(from, to, amount) {
    let remaining = amount;

    for (let t of transactions) {
        if (remaining <= 0) break;
        const splitStatus = t.splitStatus || {};

        if (t.payer === to && t.split && t.split[from] && splitStatus[from] !== 'paid') {
            if (!t.splitStatus) t.splitStatus = {};
            t.splitStatus[from] = 'paid';
            remaining -= (typeof t.split[from] === 'number' ? t.split[from] : t.split[from].amount);
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
                        <input type="number" placeholder="Rp 0" class="item-amount" data-person="${person}" min="0" oninput="calculatePersonTotal('${person}')">
                        <button type="button" class="btn-remove-item" onclick="removeItem(this)" style="visibility: hidden;">×</button>
                    </div>
                </div>
                <button type="button" class="btn-add-item" onclick="addItem('${person}')">+ Tambah Item</button>
            </div>
        `;
    }).join('');

    calculateAutoTotal();
}

function addItem(person, name = '', amount = '') {
    const container = document.getElementById(`items-${person}`);
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
        <input type="text" placeholder="Nama item (opsional)" class="item-name" data-person="${person}" value="${escapeHtml(name)}">
        <input type="number" placeholder="Rp 0" class="item-amount" data-person="${person}" min="0" oninput="calculatePersonTotal('${person}')" value="${amount}">
        <button type="button" class="btn-remove-item" onclick="removeItem(this)">×</button>
    `;
    container.appendChild(row);
    calculatePersonTotal(person);
}

function removeItem(btn) {
    const row = btn.closest('.item-row');
    const container = row.parentElement;
    const person = container.id.replace('items-', '');

    row.remove();
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

    const grandTotal = total + totalExtraCost;
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
                extraCosts: extraCosts.length > 0 ? extraCosts : null
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
    document.getElementById('transactionDate').value = '';
    extraCostCounter = 0;
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
            if (!item.isExtraCost) {
                addItem(person, item.name, item.amount);
            }
        });

        if (items.filter(i => !i.isExtraCost).length === 0) {
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
    document.getElementById('transactionDate').value = '';
    extraCostCounter = 0;

    updateCheckboxState();
}

// ============================================================================
// RESET
// ============================================================================

function resetAllData() {
    document.getElementById('confirmModal').classList.add('show');
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('show');
}

function confirmReset() {
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
    const settlements = calculateSettlements();
    if (settlements.length === 0) {
        showAlert('Semua sudah settle!');
        return;
    }

    // Simple implementation - download as text
    let content = 'PENYELESAIAN HUTANG\n';
    content += '====================\n\n';

    settlements.forEach(s => {
        content += `${getPersonName(s.from)} bayar ke ${getPersonName(s.to)}: ${formatCurrency(s.amount)}\n`;
    });

    content += '\nGenerated: ' + new Date().toLocaleDateString('id-ID');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'penyelesaian-hutang.txt';
    link.click();
    URL.revokeObjectURL(url);

    showToast('Berhasil download');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function refreshAll() {
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
window.confirmDeleteTransaction = confirmDeleteTransaction;
window.debugData = debugData;
window.toggleDarkMode = toggleDarkMode;
window.toggleExportMenu = toggleExportMenu;
window.toggleDashboard = toggleDashboard;
window.showPersonHistory = showPersonHistory;
window.closePersonHistoryModal = closePersonHistoryModal;

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
