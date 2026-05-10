// ============================================================================
// CHARTS - Canvas-based Chart Rendering (No external library)
// ============================================================================

const Charts = {
    // Color palette
    COLORS: [
        '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
        '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
    ],

    // Category colors
    CATEGORY_COLORS: {
        makan: '#ef4444',
        transport: '#3b82f6',
        rumah: '#8b5cf6',
        hiburan: '#ec4899',
        belanja: '#f59e0b',
        kesehatan: '#10b981',
        lainnya: '#6b7280'
    },

    // Category labels (Indonesian)
    CATEGORY_LABELS: {
        makan: 'Makan',
        transport: 'Transport',
        rumah: 'Rumah',
        hiburan: 'Hiburan',
        belanja: 'Belanja',
        kesehatan: 'Kesehatan',
        lainnya: 'Lainnya'
    },

    // Format currency for chart labels
    formatChartCurrency: function(amount) {
        if (amount >= 1000000) {
            return 'Rp ' + (amount / 1000000).toFixed(1) + 'jt';
        } else if (amount >= 1000) {
            return 'Rp ' + (amount / 1000).toFixed(0) + 'rb';
        }
        return 'Rp ' + amount;
    },

    // Draw pie chart
    drawPieChart: function(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        const size = Math.min(container.clientWidth, 300);

        // Set canvas size
        const dpr = window.devicePixelRatio || 1;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        ctx.scale(dpr, dpr);

        const centerX = size / 2;
        const centerY = size / 2;
        const radius = Math.min(centerX, centerY) - 10;
        const innerRadius = options.donut ? radius * 0.6 : 0;

        const total = data.reduce((sum, item) => sum + Math.abs(item.value), 0);
        if (total === 0) {
            // Draw empty state
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = '#e5e7eb';
            ctx.lineWidth = radius - innerRadius;
            ctx.stroke();

            ctx.fillStyle = '#9ca3af';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Tidak ada data', centerX, centerY + 4);
            return;
        }

        let startAngle = -Math.PI / 2; // Start from top

        data.forEach((item, index) => {
            const sliceAngle = (Math.abs(item.value) / total) * 2 * Math.PI;
            const endAngle = startAngle + sliceAngle;

            // Draw slice
            ctx.beginPath();
            ctx.moveTo(centerX + Math.cos(startAngle) * innerRadius, centerY + Math.sin(startAngle) * innerRadius);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
            ctx.closePath();

            ctx.fillStyle = item.color || this.COLORS[index % this.COLORS.length];
            ctx.fill();

            // Draw border
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            startAngle = endAngle;
        });

        // Draw center text (for donut)
        if (options.donut && options.centerText) {
            ctx.fillStyle = '#1f2937';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(options.centerText, centerX, centerY - 5);

            ctx.font = '12px sans-serif';
            ctx.fillStyle = '#6b7280';
            ctx.fillText('Total', centerX, centerY + 12);
        }
    },

    // Draw bar chart
    drawBarChart: function(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        const width = Math.min(container.clientWidth, 400);
        const height = 200;

        // Set canvas size
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);

        const padding = { top: 20, right: 10, bottom: 40, left: 50 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Clear canvas
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);

        const maxValue = Math.max(...data.map(d => Math.abs(d.value)), 1);
        const barWidth = (chartWidth / data.length) * 0.7;
        const barGap = (chartWidth / data.length) * 0.3;

        data.forEach((item, index) => {
            const barHeight = (Math.abs(item.value) / maxValue) * chartHeight;
            const x = padding.left + (index * (barWidth + barGap)) + barGap / 2;
            const y = padding.top + (chartHeight - barHeight);

            // Draw bar
            ctx.fillStyle = item.color || this.COLORS[index % this.COLORS.length];
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
            ctx.fill();

            // Draw value on top
            if (item.value > 0) {
                ctx.fillStyle = '#374151';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(this.formatChartCurrency(item.value), x + barWidth / 2, y - 5);
            }

            // Draw label below
            ctx.fillStyle = '#6b7280';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            const label = item.label.length > 8 ? item.label.substring(0, 8) + '..' : item.label;
            ctx.fillText(label, x + barWidth / 2, height - padding.bottom + 15);
        });

        // Draw Y-axis line
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, height - padding.bottom);
        ctx.stroke();
    },

    // Draw horizontal bar chart (for budget progress)
    drawProgressBar: function(canvasId, current, max, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        const width = Math.min(container.clientWidth, 300);
        const height = 24;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);

        // Background bar
        ctx.fillStyle = '#e5e7eb';
        ctx.beginPath();
        ctx.roundRect(0, 0, width, height, height / 2);
        ctx.fill();

        // Progress bar
        const progress = Math.min(current / max, 1);
        const progressWidth = width * progress;
        let progressColor = '#10b981'; // Green

        if (progress > 0.9) {
            progressColor = '#ef4444'; // Red - exceeded
        } else if (progress > 0.7) {
            progressColor = '#f59e0b'; // Yellow - warning
        }

        ctx.fillStyle = progressColor;
        ctx.beginPath();
        ctx.roundRect(0, 0, progressWidth, height, height / 2);
        ctx.fill();

        // Percentage text
        ctx.fillStyle = progress > 0.5 ? '#fff' : '#374151';
        ctx.font = `bold ${height / 2 + 2}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(progress * 100) + '%', width / 2, height / 2);
    },

    // Generate category breakdown data
    getCategoryBreakdown: function(transactions) {
        const breakdown = {};
        const categories = ['makan', 'transport', 'rumah', 'hiburan', 'belanja', 'kesehatan', 'lainnya'];

        categories.forEach(cat => {
            breakdown[cat] = 0;
        });

        transactions.forEach(t => {
            const category = t.category || 'lainnya';
            if (!breakdown.hasOwnProperty(category)) {
                breakdown[category] = 0;
            }
            breakdown[category] += t.totalAmount || 0;
        });

        // Convert to chart format
        return Object.entries(breakdown)
            .filter(([_, value]) => value > 0)
            .map(([key, value]) => ({
                label: this.CATEGORY_LABELS[key] || key,
                value: value,
                color: this.CATEGORY_COLORS[key] || this.COLORS[0]
            }))
            .sort((a, b) => b.value - a.value);
    },

    // Generate person spending data
    getPersonSpending: function(transactions, people) {
        const spending = {};

        people.forEach(p => {
            spending[p.key] = 0;
        });

        transactions.forEach(t => {
            // Add to payer's total (they paid this amount)
            if (t.payer && spending.hasOwnProperty(t.payer)) {
                spending[t.payer] += t.totalAmount || 0;
            }
        });

        return people.map((p, index) => ({
            label: p.name,
            value: spending[p.key] || 0,
            color: this.COLORS[index % this.COLORS.length]
        })).sort((a, b) => b.value - a.value);
    },

    // Get monthly spending trend
    getMonthlyTrend: function(transactions, months = 6) {
        const trend = [];
        const now = new Date();

        for (let i = months - 1; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthName = date.toLocaleDateString('id-ID', { month: 'short' });

            let total = 0;
            transactions.forEach(t => {
                if (!t.date) return;
                const tDate = new Date(t.date);
                if (tDate.getMonth() === date.getMonth() && tDate.getFullYear() === date.getFullYear()) {
                    total += t.totalAmount || 0;
                }
            });

            trend.push({
                label: monthName,
                value: total,
                color: this.COLORS[months - 1 - i]
            });
        }

        return trend;
    },

    // Draw legend
    drawLegend: function(containerId, items, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const maxItemsPerRow = options.perRow || 3;
        let html = '<div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;">';

        items.forEach(item => {
            html += `
                <div style="display: flex; align-items: center; gap: 6px; min-width: 100px;">
                    <div style="width: 12px; height: 12px; border-radius: 3px; background: ${item.color};"></div>
                    <span style="font-size: 0.85rem; color: #6b7280;">${item.label}</span>
                    <span style="font-size: 0.8rem; color: #374151; font-weight: 600;">${this.formatChartCurrency(item.value)}</span>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }
};

// Expose globally
window.Charts = Charts;
window.drawPieChart = Charts.drawPieChart.bind(Charts);
window.drawBarChart = Charts.drawBarChart.bind(Charts);
window.drawProgressBar = Charts.drawProgressBar.bind(Charts);
