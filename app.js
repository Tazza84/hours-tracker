// Hours Tracker App - Full Working Version
class HoursTracker {
    constructor() {
        this.isRunning = false;
        this.isPaused = false;
        this.startTime = null;
        this.pausedTime = 0;
        this.isOnLunch = false;
        this.lunchStartTime = null;

        // Defaults (overridden by loadSettings / loadFromStorage)
        this.targetHours = 7.6;
        this.lunchDuration = 30; // minutes
        this.notificationsEnabled = true;

        this.init();
    }

    // ─── Helpers ────────────────────────────────────────────
    todayKey() {
        return new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
    }

    weekStartKey(date = new Date()) {
        const d = new Date(date);
        const day = d.getDay(); // 0=Sun
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Mon start
        const mon = new Date(d.setDate(diff));
        return mon.toISOString().split('T')[0];
    }

    weekDates(weekStart) {
        const dates = [];
        const d = new Date(weekStart + 'T00:00:00');
        for (let i = 0; i < 5; i++) {
            const day = new Date(d);
            day.setDate(d.getDate() + i);
            dates.push(day.toISOString().split('T')[0]);
        }
        return dates;
    }

    formatDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return `${days[d.getDay()]} ${d.getDate()}`;
    }

    formatWeekRange(weekStart) {
        const dates = this.weekDates(weekStart);
        const first = new Date(dates[0] + 'T00:00:00');
        const last = new Date(dates[4] + 'T00:00:00');
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        if (first.getMonth() === last.getMonth()) {
            return `${months[first.getMonth()]} ${first.getDate()}-${last.getDate()}, ${first.getFullYear()}`;
        }
        return `${months[first.getMonth()]} ${first.getDate()} - ${months[last.getMonth()]} ${last.getDate()}, ${first.getFullYear()}`;
    }

    // ─── Storage ────────────────────────────────────────────
    getSessions() {
        const raw = localStorage.getItem('hoursSessions');
        return raw ? JSON.parse(raw) : {};
    }

    saveSessions(sessions) {
        localStorage.setItem('hoursSessions', JSON.stringify(sessions));
    }

    getBankedData() {
        const raw = localStorage.getItem('hoursBanked');
        return raw ? JSON.parse(raw) : { balance: 0, log: [] };
    }

    saveBankedData(data) {
        localStorage.setItem('hoursBanked', JSON.stringify(data));
    }

    getSettings() {
        const raw = localStorage.getItem('hoursSettings');
        return raw ? JSON.parse(raw) : null;
    }

    saveSettings() {
        localStorage.setItem('hoursSettings', JSON.stringify({
            targetHours: this.targetHours,
            lunchDuration: this.lunchDuration,
            notificationsEnabled: this.notificationsEnabled
        }));
    }

    getTimerState() {
        const raw = localStorage.getItem('hoursTimerState');
        return raw ? JSON.parse(raw) : null;
    }

    saveTimerState() {
        localStorage.setItem('hoursTimerState', JSON.stringify({
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            startTime: this.startTime,
            pausedTime: this.pausedTime,
            isOnLunch: this.isOnLunch,
            lunchStartTime: this.lunchStartTime,
            savedAt: Date.now()
        }));
    }

    // ─── Day total helpers ──────────────────────────────────
    totalForDay(dateKey) {
        const sessions = this.getSessions();
        const daySessions = sessions[dateKey] || [];
        return daySessions.reduce((sum, s) => sum + s.duration, 0);
    }

    totalToday() {
        return this.totalForDay(this.todayKey());
    }

    currentSessionHours() {
        if (!this.isRunning) return 0;
        if (this.isPaused) return this.pausedTime / (1000 * 60 * 60);
        return (Date.now() - this.startTime) / (1000 * 60 * 60);
    }

    displayTotalToday() {
        return this.totalToday() + this.currentSessionHours();
    }

    // ─── Weekly balance ─────────────────────────────────────
    weeklyWorked(weekStart) {
        const dates = this.weekDates(weekStart);
        let total = 0;
        const today = this.todayKey();
        for (const d of dates) {
            total += this.totalForDay(d);
            if (d === today) {
                total += this.currentSessionHours();
            }
        }
        return total;
    }

    weeklyTarget(weekStart) {
        // Count how many of the 5 weekdays have passed or are today
        const dates = this.weekDates(weekStart);
        const today = this.todayKey();
        let count = 0;
        for (const d of dates) {
            if (d <= today) count++;
        }
        return count * this.targetHours;
    }

    weeklyBalance() {
        const ws = this.weekStartKey();
        return this.weeklyWorked(ws) - this.weeklyTarget(ws);
    }

    // ─── Init ───────────────────────────────────────────────
    init() {
        this.loadSettings();
        this.restoreTimerState();
        this.updateAllUI();
        this.bindEventListeners();

        // Update every second
        setInterval(() => {
            if (this.isRunning && !this.isPaused) {
                this.updateAllUI();
            }
            // Check lunch timer
            if (this.isOnLunch) {
                this.checkLunchDone();
            }
        }, 1000);
    }

    loadSettings() {
        const s = this.getSettings();
        if (s) {
            this.targetHours = s.targetHours ?? 7.6;
            this.lunchDuration = s.lunchDuration ?? 30;
            this.notificationsEnabled = s.notificationsEnabled ?? true;
        }
    }

    restoreTimerState() {
        const state = this.getTimerState();
        if (!state) return;

        // Only restore if it was saved today
        const savedDate = new Date(state.savedAt).toISOString().split('T')[0];
        if (savedDate !== this.todayKey()) {
            localStorage.removeItem('hoursTimerState');
            return;
        }

        this.isOnLunch = state.isOnLunch;
        this.lunchStartTime = state.lunchStartTime;

        if (state.isRunning && !state.isPaused) {
            // Timer was actively running when app closed — pause it at the
            // point it was last saved so we don't count closed-app time as work
            this.isRunning = true;
            this.isPaused = true;
            this.pausedTime = state.savedAt - state.startTime;
        } else {
            this.isRunning = state.isRunning;
            this.isPaused = state.isPaused;
            this.startTime = state.startTime;
            this.pausedTime = state.pausedTime;
        }
    }

    // ─── Event Listeners ────────────────────────────────────
    bindEventListeners() {
        document.getElementById('startTimer').addEventListener('click', () => this.startTimer());
        document.getElementById('pauseTimer').addEventListener('click', () => this.pauseTimer());
        document.getElementById('stopTimer').addEventListener('click', () => this.stopTimer());
        document.getElementById('lunchBtn').addEventListener('click', () => this.startLunch());
        document.getElementById('addBlockBtn').addEventListener('click', () => showAddBlock());
    }

    // ─── Timer ──────────────────────────────────────────────
    startTimer() {
        if (this.isOnLunch) {
            this.endLunch();
        }
        this.isRunning = true;
        this.isPaused = false;
        this.startTime = Date.now() - this.pausedTime;
        this.pausedTime = 0;
        this.updateTimerButtons();
        this.saveTimerState();
        this.showNotification('Timer started');
    }

    startTimerFrom(dateTimeMs) {
        if (this.isOnLunch) {
            this.endLunch();
        }
        this.isRunning = true;
        this.isPaused = false;
        this.startTime = dateTimeMs;
        this.pausedTime = 0;
        this.updateTimerButtons();
        this.saveTimerState();
        this.updateAllUI();
    }

    pauseTimer() {
        this.isPaused = true;
        this.pausedTime = Date.now() - this.startTime;
        this.updateTimerButtons();
        this.saveTimerState();
        this.showNotification('Timer paused');
    }

    stopTimer() {
        if (this.isRunning) {
            const sessionHours = this.currentSessionHours();
            if (sessionHours > 0.001) { // at least ~4 seconds
                this.addSession(sessionHours, 'timer');
            }
        }
        this.isRunning = false;
        this.isPaused = false;
        this.startTime = null;
        this.pausedTime = 0;
        this.updateTimerButtons();
        this.saveTimerState();
        this.updateAllUI();
        this.recalcBanked();
        this.showNotification('Timer stopped — session saved');
    }

    addSession(hours, type, note, dateKey, startTimeISO) {
        const sessions = this.getSessions();
        const key = dateKey || this.todayKey();
        if (!sessions[key]) sessions[key] = [];
        sessions[key].push({
            start: startTimeISO || new Date().toISOString(),
            duration: hours,
            type: type || 'timer',
            note: note || ''
        });
        this.saveSessions(sessions);
    }

    // ─── Lunch ──────────────────────────────────────────────
    startLunch() {
        if (this.isOnLunch) return;

        // Pause timer if running
        if (this.isRunning && !this.isPaused) {
            this.pauseTimer();
        }

        this.isOnLunch = true;
        this.lunchStartTime = Date.now();
        this.saveTimerState();
        this.updateLunchUI(true);
        this.showNotification(`Lunch break — ${this.lunchDuration} min`);
    }

    endLunch() {
        this.isOnLunch = false;
        this.lunchStartTime = null;
        this.saveTimerState();
        this.updateLunchUI(false);
    }

    checkLunchDone() {
        if (!this.isOnLunch || !this.lunchStartTime) return;
        const elapsed = (Date.now() - this.lunchStartTime) / 60000; // minutes
        const remaining = Math.max(0, this.lunchDuration - elapsed);
        const lunchBtn = document.getElementById('lunchBtn');

        if (remaining <= 0) {
            this.endLunch();
            // Auto-resume timer if it was running before lunch
            if (this.isRunning) {
                this.isPaused = false;
                this.startTime = Date.now() - this.pausedTime;
                this.pausedTime = 0;
                this.updateTimerButtons();
                this.saveTimerState();
            }
            this.showNotification('Lunch over — timer resumed');
        } else {
            const mins = Math.ceil(remaining);
            lunchBtn.textContent = `🍽️ LUNCH (${mins}m)`;
        }
    }

    updateLunchUI(onLunch) {
        const lunchBtn = document.getElementById('lunchBtn');
        if (onLunch) {
            lunchBtn.textContent = `🍽️ LUNCH (${this.lunchDuration}m)`;
            lunchBtn.style.background = 'var(--bg-gradient-coral)';
            lunchBtn.style.color = 'white';
            lunchBtn.style.border = 'none';
        } else {
            lunchBtn.textContent = '🍽️ LUNCH';
            lunchBtn.style.background = '';
            lunchBtn.style.color = '';
            lunchBtn.style.border = '';
        }
    }

    // ─── Banked Hours ───────────────────────────────────────
    recalcBanked() {
        // Recalculate banked hours from all historical data
        const sessions = this.getSessions();
        const banked = this.getBankedData();
        const today = this.todayKey();

        // Sum overtime across all completed days (not today — still in progress)
        let earned = 0;
        for (const [dateKey, daySessions] of Object.entries(sessions)) {
            if (dateKey === today) continue; // skip today
            const dayTotal = daySessions.reduce((s, sess) => s + sess.duration, 0);
            const overtime = dayTotal - this.targetHours;
            earned += overtime; // can be negative (undertime)
        }

        // Deductions from log
        const deducted = banked.log
            .filter(e => e.type === 'deduction')
            .reduce((s, e) => s + e.hours, 0);

        banked.balance = earned - deducted;
        this.saveBankedData(banked);
    }

    useBankedHours(hours, reason) {
        const banked = this.getBankedData();
        if (hours > banked.balance) {
            this.showNotification('Not enough banked hours');
            return false;
        }
        banked.log.push({
            date: this.todayKey(),
            type: 'deduction',
            hours: hours,
            reason: reason || '',
            timestamp: new Date().toISOString()
        });
        banked.balance -= hours;
        this.saveBankedData(banked);
        this.updateAllUI();
        return true;
    }

    logTimeAccrued(hours, date, note) {
        const banked = this.getBankedData();
        if (hours > banked.balance) {
            this.showNotification('Not enough banked hours');
            return false;
        }
        banked.log.push({
            date: date || this.todayKey(),
            type: 'deduction',
            hours: hours,
            reason: `Time accrued: ${note || ''}`.trim(),
            timestamp: new Date().toISOString()
        });
        banked.balance -= hours;
        this.saveBankedData(banked);
        this.updateAllUI();
        return true;
    }

    // ─── UI Updates ─────────────────────────────────────────
    updateAllUI() {
        this.updateTimerButtons();
        this.updateTodayDisplay();
        this.updateWeeklyDisplay();
        this.updateBankedDisplay();
        this.updateQuickActionSubtitles();
    }

    updateTimerButtons() {
        const startBtn = document.getElementById('startTimer');
        const pauseBtn = document.getElementById('pauseTimer');
        const stopBtn = document.getElementById('stopTimer');
        const earlierLink = document.getElementById('startedEarlierLink');

        if (!this.isRunning) {
            startBtn.classList.remove('hidden');
            pauseBtn.classList.add('hidden');
            stopBtn.classList.add('hidden');
            startBtn.textContent = 'START TIMER';
            if (earlierLink) earlierLink.style.display = 'block';
        } else if (this.isPaused) {
            startBtn.classList.remove('hidden');
            pauseBtn.classList.add('hidden');
            stopBtn.classList.remove('hidden');
            startBtn.textContent = 'RESUME';
            if (earlierLink) earlierLink.style.display = 'none';
        } else {
            startBtn.classList.add('hidden');
            pauseBtn.classList.remove('hidden');
            stopBtn.classList.remove('hidden');
            if (earlierLink) earlierLink.style.display = 'none';
        }
    }

    updateTodayDisplay() {
        const total = this.displayTotalToday();
        const pct = Math.min((total / this.targetHours) * 100, 100);
        const circumference = 283;
        const offset = circumference - (pct / 100) * circumference;

        const ring = document.querySelector('.today-card .progress-ring-fill');
        if (ring) ring.style.strokeDashoffset = offset;

        const text = document.querySelector('.today-progress .today-hours');
        if (text) text.textContent = `${total.toFixed(1)}/${this.targetHours}`;

        // Colour the ring based on completion
        if (ring) {
            ring.style.stroke = total >= this.targetHours ? '#22c55e' : '#3b82f6';
        }
    }

    updateWeeklyDisplay() {
        const balance = this.weeklyBalance();
        const sign = balance >= 0 ? '+' : '';

        const hoursAhead = document.querySelector('.hours-ahead');
        if (hoursAhead) hoursAhead.textContent = `${sign}${balance.toFixed(1)}`;

        const aheadLabel = document.querySelector('.ahead-label');
        if (aheadLabel) aheadLabel.textContent = balance >= 0 ? 'hours ahead' : 'hours behind';

        // Hero card gradient based on positive/negative
        const hero = document.querySelector('.hero-card');
        if (hero) {
            hero.style.background = balance >= 0
                ? 'var(--bg-gradient-green)'
                : 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)';
        }

        // Weekly progress ring
        const ws = this.weekStartKey();
        const worked = this.weeklyWorked(ws);
        const fullWeekTarget = 5 * this.targetHours;
        const pct = Math.min((worked / fullWeekTarget) * 100, 100);
        const circumference = 283;
        const offset = circumference - (pct / 100) * circumference;
        const ring = document.querySelector('.hero-card .progress-ring-fill');
        if (ring) ring.style.strokeDashoffset = offset;
    }

    updateBankedDisplay() {
        const banked = this.getBankedData();
        const el = document.querySelector('.banked-hours');
        if (el) el.textContent = `💰 ${banked.balance.toFixed(1)} hours banked`;
    }

    updateQuickActionSubtitles() {
        const banked = this.getBankedData();
        const bankedSub = document.getElementById('bankedSubtitle');
        if (bankedSub) bankedSub.textContent = `${banked.balance.toFixed(1)} hrs available`;

        const weekSub = document.getElementById('weekSubtitle');
        if (weekSub) weekSub.textContent = 'View breakdown';
    }

    // ─── Notifications ──────────────────────────────────────
    showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 14px;
            font-weight: 500;
            z-index: 2000;
            opacity: 0;
            transition: all 0.3s ease;
            pointer-events: none;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(-50%) translateY(10px)';
        }, 50);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(-50%) translateY(-10px)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// ─── Modal System ───────────────────────────────────────────
function createModal(title, content) {
    closeModal(); // close any existing modal first

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex; align-items: center; justify-content: center;
        z-index: 1000; opacity: 0; transition: opacity 0.3s ease;
        backdrop-filter: blur(4px);
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white; border-radius: 24px; padding: 32px;
        max-width: 400px; width: 90%; max-height: 90vh; overflow-y: auto;
        transform: scale(0.9) translateY(20px); transition: transform 0.3s ease;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    `;

    modal.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
            <h2 style="font-size: 1.5rem; font-weight: 700; margin: 0;">${title}</h2>
            <button onclick="closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b;">×</button>
        </div>
        ${content}
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    setTimeout(() => {
        overlay.style.opacity = '1';
        modal.style.transform = 'scale(1) translateY(0)';
    }, 10);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
    return modal;
}

function closeModal() {
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) {
        const modal = overlay.querySelector('div');
        overlay.style.opacity = '0';
        if (modal) modal.style.transform = 'scale(0.9) translateY(20px)';
        setTimeout(() => overlay.remove(), 300);
    }
}

// ─── Show Banked Time ───────────────────────────────────────
function showBankedTime() {
    const banked = app.getBankedData();
    createModal('Use Banked Time', `
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="font-size: 1.2rem; color: #64748b; margin-bottom: 8px;">Available</div>
            <div style="font-size: 2rem; font-weight: 700; color: ${banked.balance >= 0 ? '#22c55e' : '#ef4444'};">${banked.balance.toFixed(1)} hours</div>
        </div>
        <div style="display: grid; gap: 12px;">
            <button class="modal-btn modal-btn-primary" onclick="showLogTimeAccrued()">📋 Log as Time Accrued</button>
            <button class="modal-btn" onclick="quickUse(1)">Left 1 hour early</button>
            <button class="modal-btn" onclick="quickUse(0.5)">Extended lunch +30min</button>
            <button class="modal-btn" onclick="showCustomUse()">Custom amount...</button>
        </div>
        ${banked.log.length > 0 ? `
        <div style="margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            <h3 style="font-size: 0.95rem; color: #64748b; margin-bottom: 12px;">Recent Activity</h3>
            ${banked.log.slice(-5).reverse().map(e => `
                <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 0.85rem; color: #64748b;">
                    <span>${e.reason || e.type}</span>
                    <span style="color: ${e.type === 'deduction' ? '#ef4444' : '#22c55e'};">${e.type === 'deduction' ? '-' : '+'}${e.hours.toFixed(1)}h</span>
                </div>
            `).join('')}
        </div>` : ''}
    `);
}

function quickUse(hours) {
    const reasons = { 1: 'Left 1 hour early', 0.5: 'Extended lunch +30min' };
    if (app.useBankedHours(hours, reasons[hours] || `Used ${hours}h`)) {
        closeModal();
        app.showNotification(`Used ${hours} banked hour${hours !== 1 ? 's' : ''}`);
    }
}

function showCustomUse() {
    closeModal();
    createModal('Custom Banked Hours Use', `
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">Hours to use:</label>
            <input type="number" id="customUseHours" step="0.1" min="0.1" value="1.0"
                   style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 1rem;">
        </div>
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">Reason:</label>
            <input type="text" id="customUseReason" placeholder="e.g., Appointment"
                   style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 1rem;">
        </div>
        <div style="display: flex; gap: 12px;">
            <button class="modal-btn" onclick="closeModal()" style="flex: 1; background: #f1f5f9;">Cancel</button>
            <button class="modal-btn modal-btn-primary" onclick="submitCustomUse()" style="flex: 1;">Use Hours</button>
        </div>
    `);
}

function submitCustomUse() {
    const hours = parseFloat(document.getElementById('customUseHours').value);
    const reason = document.getElementById('customUseReason').value || 'Custom use';
    if (isNaN(hours) || hours <= 0) {
        app.showNotification('Enter a valid number of hours');
        return;
    }
    if (app.useBankedHours(hours, reason)) {
        closeModal();
        app.showNotification(`Used ${hours.toFixed(1)} banked hours`);
    }
}

// ─── Log Time Accrued ───────────────────────────────────────
function showLogTimeAccrued() {
    closeModal();
    const banked = app.getBankedData();
    createModal('Log Time Accrued', `
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">Date:</label>
            <input type="date" id="accrualDate" value="${new Date().toISOString().split('T')[0]}"
                   style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 1rem;">
        </div>
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">Hours:</label>
            <select id="accrualHours" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 1rem;">
                <option value="1.0">1.0 hour</option>
                <option value="1.9">1.9 hours (quarter day)</option>
                <option value="3.8">3.8 hours (half day)</option>
                <option value="7.6" selected>7.6 hours (full day)</option>
                <option value="custom">Custom amount...</option>
            </select>
            <input type="number" id="accrualCustomHours" step="0.1" min="0.1" placeholder="Enter hours"
                   style="display:none; width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; margin-top: 8px; font-size: 1rem;">
        </div>
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">Note:</label>
            <input type="text" id="accrualNote" placeholder="e.g., Overtime compensation"
                   style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 1rem;">
        </div>
        <div style="background: #fef3c7; padding: 16px; border-radius: 12px; margin-bottom: 20px;">
            <div style="color: #92400e; font-size: 0.9rem;">
                ⚠️ This will remove <span id="removeAmount">7.6</span> hours from your bank (${banked.balance.toFixed(1)}h available)
            </div>
        </div>
        <div style="display: flex; gap: 12px;">
            <button class="modal-btn" onclick="closeModal()" style="flex: 1; background: #f1f5f9;">Cancel</button>
            <button class="modal-btn modal-btn-primary" onclick="submitTimeAccrued()" style="flex: 1;">Submit</button>
        </div>
    `);

    document.getElementById('accrualHours').addEventListener('change', function() {
        const customInput = document.getElementById('accrualCustomHours');
        const amountEl = document.getElementById('removeAmount');
        if (this.value === 'custom') {
            customInput.style.display = 'block';
            amountEl.textContent = '—';
            customInput.addEventListener('input', () => {
                amountEl.textContent = customInput.value || '—';
            });
        } else {
            customInput.style.display = 'none';
            amountEl.textContent = this.value;
        }
    });
}

function submitTimeAccrued() {
    const select = document.getElementById('accrualHours');
    let hours;
    if (select.value === 'custom') {
        hours = parseFloat(document.getElementById('accrualCustomHours').value);
    } else {
        hours = parseFloat(select.value);
    }
    const date = document.getElementById('accrualDate').value;
    const note = document.getElementById('accrualNote').value;

    if (isNaN(hours) || hours <= 0) {
        app.showNotification('Enter a valid number of hours');
        return;
    }

    if (app.logTimeAccrued(hours, date, note)) {
        closeModal();
        app.showNotification(`${hours} hours logged as time accrued`);
    }
}

// ─── Started Earlier ─────────────────────────────────────────
function showStartedEarlier() {
    const now = new Date();
    const h = now.getHours();
    // Default to a sensible morning start
    const defaultStart = h < 12 ? '08:00' : `${String(Math.max(h - 2, 7)).padStart(2, '0')}:00`;

    createModal('When did you start?', `
        <p style="color: #64748b; margin-bottom: 20px; font-size: 0.95rem;">
            Set your actual start time and the timer will count from then.
        </p>
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">I started at:</label>
            <input type="time" id="earlierStartTime" value="${defaultStart}"
                   style="width: 100%; padding: 14px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 1.1rem;"
                   onchange="updateEarlierPreview()">
        </div>
        <div id="earlierPreview" style="background: #f0fdf4; padding: 16px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
            <div style="font-size: 0.9rem; color: #64748b; margin-bottom: 4px;">Time already worked</div>
            <div style="font-size: 1.6rem; font-weight: 700; color: #22c55e;" id="earlierPreviewHours">—</div>
        </div>
        <div style="display: flex; gap: 12px;">
            <button class="modal-btn" onclick="closeModal()" style="flex: 1; background: #f1f5f9;">Cancel</button>
            <button class="modal-btn modal-btn-primary" onclick="submitStartedEarlier()" style="flex: 1;">Start Timer</button>
        </div>
    `);
    updateEarlierPreview();
}

function updateEarlierPreview() {
    const timeInput = document.getElementById('earlierStartTime');
    const preview = document.getElementById('earlierPreviewHours');
    const previewBox = document.getElementById('earlierPreview');
    if (!timeInput || !preview) return;

    const [h, m] = timeInput.value.split(':').map(Number);
    const now = new Date();
    const startTime = new Date();
    startTime.setHours(h, m, 0, 0);

    const diffMs = now - startTime;
    if (diffMs <= 0) {
        preview.textContent = '—';
        preview.style.color = '#ef4444';
        previewBox.style.background = '#fef2f2';
        return;
    }

    const diffHours = diffMs / (1000 * 60 * 60);
    preview.textContent = `${diffHours.toFixed(1)}h so far`;
    preview.style.color = '#22c55e';
    previewBox.style.background = '#f0fdf4';
}

function submitStartedEarlier() {
    const timeInput = document.getElementById('earlierStartTime');
    if (!timeInput) return;

    const [h, m] = timeInput.value.split(':').map(Number);
    const startTime = new Date();
    startTime.setHours(h, m, 0, 0);

    const now = Date.now();
    if (startTime.getTime() >= now) {
        app.showNotification('Start time must be in the past');
        return;
    }

    app.startTimerFrom(startTime.getTime());
    closeModal();

    const diffHours = (now - startTime.getTime()) / (1000 * 60 * 60);
    const fmtH = h % 12 || 12;
    const period = h >= 12 ? 'PM' : 'AM';
    app.showNotification(`Timer running from ${fmtH}:${String(m).padStart(2, '0')} ${period} (${diffHours.toFixed(1)}h so far)`);
}

// ─── Add Time Block ─────────────────────────────────────────
function showAddBlock() {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const tabStyle = (active) => `
        flex: 1; padding: 10px; border: none; border-radius: 10px; font-weight: 600;
        font-size: 0.9rem; cursor: pointer; transition: all 0.2s ease;
        background: ${active ? 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' : '#f1f5f9'};
        color: ${active ? 'white' : '#64748b'};
    `;

    createModal('Add Time', `
        <!-- Tab switcher -->
        <div id="blockTabs" style="display: flex; gap: 8px; margin-bottom: 20px; background: #f8fafc; padding: 4px; border-radius: 12px;">
            <button id="tabRange" style="${tabStyle(true)}" onclick="switchBlockTab('range')">Start / End Time</button>
            <button id="tabHours" style="${tabStyle(false)}" onclick="switchBlockTab('hours')">Quick Hours</button>
        </div>

        <!-- Time Range tab (default) -->
        <div id="panelRange">
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Date:</label>
                <input type="date" id="blockDate" value="${todayStr}"
                       style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 1rem;">
            </div>
            <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                <div style="flex: 1;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Start:</label>
                    <input type="time" id="blockStart" value="08:00"
                           style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 1rem;"
                           onchange="updateBlockPreview()">
                </div>
                <div style="flex: 1;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">End:</label>
                    <input type="time" id="blockEnd" value="16:00"
                           style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 1rem;"
                           onchange="updateBlockPreview()">
                </div>
            </div>
            <div style="margin-bottom: 16px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" id="blockLunch" checked onchange="updateBlockPreview()">
                    <label for="blockLunch" style="font-weight: 500;">Deduct lunch (${app.lunchDuration} min)</label>
                </div>
            </div>
            <div id="blockPreview" style="background: #f0fdf4; padding: 16px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
                <div style="font-size: 0.9rem; color: #64748b; margin-bottom: 4px;">Total work time</div>
                <div style="font-size: 1.6rem; font-weight: 700; color: #22c55e;" id="blockPreviewHours">7.5h</div>
                <div style="font-size: 0.8rem; color: #94a3b8;" id="blockPreviewBreakdown">8:00 AM – 4:00 PM minus 30min lunch</div>
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Note (optional):</label>
                <input type="text" id="blockRangeNote" placeholder="e.g., Worked from home"
                       style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 1rem;">
            </div>
            <div style="display: flex; gap: 12px;">
                <button class="modal-btn" onclick="closeModal()" style="flex: 1; background: #f1f5f9;">Cancel</button>
                <button class="modal-btn modal-btn-primary" onclick="submitBlockRange()" style="flex: 1;">Add</button>
            </div>
        </div>

        <!-- Quick Hours tab -->
        <div id="panelHours" style="display: none;">
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Hours:</label>
                <input type="number" id="blockHours" step="0.1" min="0.1" value="1.0"
                       style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 1rem;">
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Note (optional):</label>
                <input type="text" id="blockNote" placeholder="e.g., Morning meeting before timer"
                       style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 1rem;">
            </div>
            <div style="display: flex; gap: 12px;">
                <button class="modal-btn" onclick="closeModal()" style="flex: 1; background: #f1f5f9;">Cancel</button>
                <button class="modal-btn modal-btn-primary" onclick="submitAddBlock()" style="flex: 1;">Add</button>
            </div>
        </div>
    `);

    updateBlockPreview();
}

function switchBlockTab(tab) {
    const rangePanel = document.getElementById('panelRange');
    const hoursPanel = document.getElementById('panelHours');
    const tabRange = document.getElementById('tabRange');
    const tabHours = document.getElementById('tabHours');

    const activeStyle = 'flex: 1; padding: 10px; border: none; border-radius: 10px; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s ease; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white;';
    const inactiveStyle = 'flex: 1; padding: 10px; border: none; border-radius: 10px; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s ease; background: #f1f5f9; color: #64748b;';

    if (tab === 'range') {
        rangePanel.style.display = 'block';
        hoursPanel.style.display = 'none';
        tabRange.style.cssText = activeStyle;
        tabHours.style.cssText = inactiveStyle;
    } else {
        rangePanel.style.display = 'none';
        hoursPanel.style.display = 'block';
        tabRange.style.cssText = inactiveStyle;
        tabHours.style.cssText = activeStyle;
    }
}

function updateBlockPreview() {
    const startEl = document.getElementById('blockStart');
    const endEl = document.getElementById('blockEnd');
    const lunchEl = document.getElementById('blockLunch');
    const previewHours = document.getElementById('blockPreviewHours');
    const previewBreakdown = document.getElementById('blockPreviewBreakdown');
    const previewBox = document.getElementById('blockPreview');

    if (!startEl || !endEl) return;

    const [sh, sm] = startEl.value.split(':').map(Number);
    const [eh, em] = endEl.value.split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    let totalMins = endMins - startMins;

    if (totalMins <= 0) {
        previewHours.textContent = '—';
        previewBreakdown.textContent = 'End time must be after start time';
        previewBox.style.background = '#fef2f2';
        return;
    }

    const deductLunch = lunchEl && lunchEl.checked;
    const lunchMins = deductLunch ? app.lunchDuration : 0;
    totalMins -= lunchMins;

    if (totalMins <= 0) {
        previewHours.textContent = '—';
        previewBreakdown.textContent = 'Work time is less than lunch break';
        previewBox.style.background = '#fef2f2';
        return;
    }

    const hours = totalMins / 60;
    previewHours.textContent = `${hours.toFixed(1)}h`;
    previewBox.style.background = '#f0fdf4';

    // Format times for display
    const fmtTime = (h, m) => {
        const period = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${String(m).padStart(2, '0')} ${period}`;
    };
    const lunchStr = deductLunch ? ` minus ${app.lunchDuration}min lunch` : '';
    previewBreakdown.textContent = `${fmtTime(sh, sm)} – ${fmtTime(eh, em)}${lunchStr}`;
}

function submitBlockRange() {
    const startVal = document.getElementById('blockStart').value;
    const endVal = document.getElementById('blockEnd').value;
    const dateVal = document.getElementById('blockDate').value;
    const deductLunch = document.getElementById('blockLunch').checked;
    const note = document.getElementById('blockRangeNote').value;

    const [sh, sm] = startVal.split(':').map(Number);
    const [eh, em] = endVal.split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    let totalMins = endMins - startMins;

    if (totalMins <= 0) {
        app.showNotification('End time must be after start time');
        return;
    }

    if (deductLunch) totalMins -= app.lunchDuration;

    if (totalMins <= 0) {
        app.showNotification('Work time is less than lunch break');
        return;
    }

    const hours = totalMins / 60;
    const startISO = `${dateVal}T${startVal}:00`;

    const fmtTime = (h, m) => {
        const period = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${String(m).padStart(2, '0')}${period}`;
    };
    const lunchNote = deductLunch ? ` (−${app.lunchDuration}m lunch)` : '';
    const autoNote = `${fmtTime(sh, sm)}–${fmtTime(eh, em)}${lunchNote}`;
    const fullNote = note ? `${note} | ${autoNote}` : autoNote;

    app.addSession(hours, 'manual', fullNote, dateVal, startISO);
    app.recalcBanked();
    app.updateAllUI();
    closeModal();
    app.showNotification(`Added ${hours.toFixed(1)}h for ${dateVal}`);
}

function submitAddBlock() {
    const hours = parseFloat(document.getElementById('blockHours').value);
    const note = document.getElementById('blockNote').value;
    if (isNaN(hours) || hours <= 0) {
        app.showNotification('Enter a valid number of hours');
        return;
    }
    app.addSession(hours, 'manual', note);
    app.updateAllUI();
    closeModal();
    app.showNotification(`Added ${hours.toFixed(1)}h block`);
}

// ─── History View ───────────────────────────────────────────
function showHistory() {
    const ws = app.weekStartKey();
    const dates = app.weekDates(ws);
    const today = app.todayKey();

    let weekTotal = 0;
    let rows = '';
    for (const d of dates) {
        const dayTotal = app.totalForDay(d);
        const isCurrent = d === today;
        const liveTotal = isCurrent ? dayTotal + app.currentSessionHours() : dayTotal;
        weekTotal += liveTotal;
        const diff = liveTotal - app.targetHours;
        const diffStr = diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);

        let icon, colour;
        if (d > today) {
            icon = '⬜'; colour = '#94a3b8';
        } else if (liveTotal === 0 && d < today) {
            icon = '⬜'; colour = '#94a3b8';
        } else if (liveTotal >= app.targetHours) {
            icon = '✅'; colour = '#22c55e';
        } else if (isCurrent) {
            icon = '🔄'; colour = '#3b82f6';
        } else {
            icon = '⚠️'; colour = '#f59e0b';
        }

        rows += `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                <span>${app.formatDate(d)}${isCurrent ? ' (today)' : ''}</span>
                <span style="color: ${colour};">${icon} ${liveTotal > 0 ? liveTotal.toFixed(1) + 'h' : '—'} ${liveTotal > 0 ? '(' + diffStr + ')' : ''}</span>
            </div>`;
    }

    const balance = app.weeklyBalance();
    const sign = balance >= 0 ? '+' : '';

    // Banked activity this week
    const banked = app.getBankedData();
    const weekLogs = banked.log.filter(e => e.date >= ws);
    const weekDeducted = weekLogs.filter(e => e.type === 'deduction').reduce((s, e) => s + e.hours, 0);

    createModal('This Week', `
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="font-size: 1.1rem; color: #64748b; margin-bottom: 8px;">${app.formatWeekRange(ws)}</div>
            <div style="font-size: 1.8rem; font-weight: 700; color: ${balance >= 0 ? '#22c55e' : '#ef4444'};">${sign}${balance.toFixed(1)} hours</div>
            <div style="color: #64748b;">${weekTotal.toFixed(1)} total this week</div>
        </div>
        <div style="margin-bottom: 24px;">
            <h3 style="margin-bottom: 16px; font-size: 1.1rem;">Daily Breakdown</h3>
            ${rows}
        </div>
        ${weekDeducted > 0 ? `
        <div>
            <h3 style="margin-bottom: 16px; font-size: 1.1rem;">Banked Hours Activity</h3>
            <div style="font-size: 0.9rem; color: #64748b; line-height: 1.8;">
                ${weekLogs.map(e => `<div style="display:flex;justify-content:space-between;">
                    <span>${e.reason}</span>
                    <span style="color:#ef4444;">-${e.hours.toFixed(1)}h</span>
                </div>`).join('')}
            </div>
        </div>` : ''}
    `);
}

// ─── Settings ───────────────────────────────────────────────
function showSettings() {
    createModal('Settings', `
        <div style="display: grid; gap: 20px;">
            <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Daily Target Hours:</label>
                <input type="number" id="settingTarget" step="0.1" value="${app.targetHours}"
                       style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 1rem;">
            </div>
            <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Default Lunch Duration:</label>
                <select id="settingLunch" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 1rem;">
                    <option value="30" ${app.lunchDuration === 30 ? 'selected' : ''}>30 minutes</option>
                    <option value="45" ${app.lunchDuration === 45 ? 'selected' : ''}>45 minutes</option>
                    <option value="60" ${app.lunchDuration === 60 ? 'selected' : ''}>60 minutes</option>
                </select>
            </div>
            <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Notifications:</label>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <input type="checkbox" id="settingNotif" ${app.notificationsEnabled ? 'checked' : ''}>
                    <label for="settingNotif">Timer alerts and break reminders</label>
                </div>
            </div>
            <hr style="border: none; border-top: 1px solid #e2e8f0;">
            <div>
                <button class="modal-btn" onclick="showResetConfirm()" style="color: #ef4444;">
                    🗑️ Reset All Data
                </button>
            </div>
            <button class="modal-btn modal-btn-primary" onclick="saveSettingsFromModal()">
                Save Settings
            </button>
        </div>
    `);
}

function saveSettingsFromModal() {
    app.targetHours = parseFloat(document.getElementById('settingTarget').value) || 7.6;
    app.lunchDuration = parseInt(document.getElementById('settingLunch').value) || 30;
    app.notificationsEnabled = document.getElementById('settingNotif').checked;
    app.saveSettings();
    app.updateAllUI();
    closeModal();
    app.showNotification('Settings saved');
}

function showResetConfirm() {
    closeModal();
    createModal('Reset All Data?', `
        <p style="color: #64748b; margin-bottom: 24px;">This will delete all tracked hours, banked time, and session history. This cannot be undone.</p>
        <div style="display: flex; gap: 12px;">
            <button class="modal-btn" onclick="closeModal()" style="flex: 1; background: #f1f5f9;">Cancel</button>
            <button class="modal-btn" onclick="resetAllData()" style="flex: 1; background: #ef4444; color: white;">Reset Everything</button>
        </div>
    `);
}

function resetAllData() {
    localStorage.removeItem('hoursSessions');
    localStorage.removeItem('hoursBanked');
    localStorage.removeItem('hoursTimerState');
    localStorage.removeItem('hoursSettings');
    app.isRunning = false;
    app.isPaused = false;
    app.startTime = null;
    app.pausedTime = 0;
    app.targetHours = 7.6;
    app.lunchDuration = 30;
    app.notificationsEnabled = true;
    app.updateAllUI();
    closeModal();
    app.showNotification('All data reset');
}

// ─── Today Menu ─────────────────────────────────────────────
function showTodayMenu() {
    const sessions = app.getSessions();
    const today = app.todayKey();
    const todaySessions = sessions[today] || [];

    let sessionList = '';
    if (todaySessions.length > 0) {
        sessionList = todaySessions.map((s, i) => {
            const time = new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const icon = s.type === 'manual' ? '✏️' : '⏱️';
            return `<div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 0.9rem;">
                <span>${icon} ${time}${s.note ? ' — ' + s.note : ''}</span>
                <span>${s.duration.toFixed(1)}h</span>
            </div>`;
        }).join('');
    } else {
        sessionList = '<div style="color: #94a3b8; font-size: 0.9rem;">No sessions yet today</div>';
    }

    createModal("Today's Sessions", `
        <div style="margin-bottom: 16px;">
            ${sessionList}
        </div>
        <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; font-weight: 600;">
            <span>Total</span>
            <span>${app.displayTotalToday().toFixed(1)}h / ${app.targetHours}h</span>
        </div>
    `);
}

// ─── Initialize ─────────────────────────────────────────────
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new HoursTracker();
});

// ─── PWA Service Worker ─────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered:', reg))
            .catch(err => console.log('SW registration failed:', err));
    });
}
