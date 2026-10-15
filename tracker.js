/**
 * User Behavior & Visitor Logging System
 * Dashboard Monitoring Kinerja PPPK — BGTK Sumatera Barat
 * 
 * Fitur:
 * 1. Mendeteksi Perangkat, OS, Browser, Resolusi Layar, dan Referrer (misal WhatsApp).
 * 2. Mengambil Perkiraan IP & Lokasi Kota secara asinkron tanpa memperlambat loading web.
 * 3. Menghasilkan ID Pengunjung Unik per perangkat (Visitor ID).
 * 4. Mencatat jejak perilaku: Pegawai yang dilihat, pencarian, pembukaan foto detail, dan cetak laporan.
 * 5. Menyimpan riwayat log di localStorage & mengirimkan data ke Google Sheets (via Apps Script Web App).
 */

const TRACKER_CONFIG = {
  // Ganti URL ini dengan URL Google Apps Script Web App jika ingin dicatat otomatis ke Google Sheet Anda
  GOOGLE_SHEET_WEBAPP_URL: '',
  APP_NAME: 'Monitoring-PPPK-BGTK-Sumbar'
};

class AccessTracker {
  constructor() {
    this.sessionId = 'ses_' + Math.random().toString(36).substring(2, 9);
    this.visitorId = this.getOrCreateVisitorId();
    this.sessionStartTime = Date.now();
    this.geoInfo = { ip: 'Memuat...', city: '-', region: '-', isp: '-' };
    this.deviceInfo = this.detectDevice();
    this.eventQueue = [];

    this.init();
  }

  getOrCreateVisitorId() {
    let vid = localStorage.getItem('bgtk_visitor_id');
    if (!vid) {
      vid = 'usr_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('bgtk_visitor_id', vid);
    }
    return vid;
  }

  detectDevice() {
    const ua = navigator.userAgent;
    let deviceType = 'Desktop / PC';
    if (/tablet|ipad/i.test(ua)) deviceType = 'Tablet';
    else if (/mobile|android|iphone/i.test(ua)) deviceType = 'Smartphone (HP)';

    let os = 'Unknown OS';
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS (Apple)';
    else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
    else if (/linux/i.test(ua)) os = 'Linux';

    let browser = 'Unknown Browser';
    if (/whatsapp/i.test(ua)) browser = 'WhatsApp Webview';
    else if (/edg/i.test(ua)) browser = 'Microsoft Edge';
    else if (/chrome/i.test(ua)) browser = 'Google Chrome';
    else if (/safari/i.test(ua)) browser = 'Apple Safari';
    else if (/firefox/i.test(ua)) browser = 'Mozilla Firefox';

    return {
      deviceType,
      os,
      browser,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      referrer: document.referrer || (window.location.search.includes('ref=') ? 'WhatsApp Link' : 'Direct Link')
    };
  }

  async init() {
    // 1. Catat Kunjungan Awal
    this.logEvent('PAGE_VIEW', 'Membuka Dashboard Monitoring PPPK');

    // 2. Ambil Info Geo IP secara Asinkron di latar belakang
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        this.geoInfo = {
          ip: data.ip || 'Unknown',
          city: data.city || '-',
          region: data.region || '-',
          isp: data.org || '-'
        };
        // Update log kunjungan pertama dengan info geo lengkap
        this.logEvent('GEO_RESOLVED', `Lokasi: ${this.geoInfo.city}, ${this.geoInfo.region} (${this.geoInfo.isp})`);
      }
    } catch (e) {
      // Fallback ipify jika ipapi diblokir
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        this.geoInfo.ip = ipData.ip || '-';
      } catch (err) {
        this.geoInfo.ip = 'Lokal / Tersembunyi';
      }
    }

    // 3. Pasang Listener Penutupan Tab (Catat Durasi Kunjungan)
    window.addEventListener('beforeunload', () => {
      const durationSec = Math.round((Date.now() - this.sessionStartTime) / 1000);
      this.logEvent('PAGE_EXIT', `Durasi kunjungan: ${durationSec} detik`, false);
    });
  }

  /**
   * Catat Event Aktivitas Pengguna
   */
  logEvent(actionType, actionDetail = '', sendToCloud = true) {
    const now = new Date();
    const timestampStr = now.toLocaleDateString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const entry = {
      timestamp: timestampStr,
      timeUnix: Date.now(),
      sessionId: this.sessionId,
      visitorId: this.visitorId,
      device: this.deviceInfo.deviceType,
      os: this.deviceInfo.os,
      browser: this.deviceInfo.browser,
      screen: this.deviceInfo.screenResolution,
      referrer: this.deviceInfo.referrer,
      ip: this.geoInfo.ip,
      location: `${this.geoInfo.city}, ${this.geoInfo.region}`,
      isp: this.geoInfo.isp,
      actionType,
      actionDetail
    };

    // 1. Simpan ke Local Storage (Maks 150 log terakhir)
    this.saveToLocalStorage(entry);

    // 2. Kirim ke Endpoint Cloud jika tersedia
    if (sendToCloud && TRACKER_CONFIG.GOOGLE_SHEET_WEBAPP_URL) {
      this.sendToRemoteSheet(entry);
    }

    console.log(`[BGTK Tracker] ${actionType}: ${actionDetail}`);
  }

  saveToLocalStorage(entry) {
    try {
      let logs = JSON.parse(localStorage.getItem('bgtk_access_logs') || '[]');
      logs.unshift(entry);
      if (logs.length > 150) logs = logs.slice(0, 150);
      localStorage.setItem('bgtk_access_logs', JSON.stringify(logs));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }

  sendToRemoteSheet(entry) {
    try {
      // Menggunakan no-cors fetch agar berjalan aman tanpa isu CORS di GitHub Pages
      fetch(TRACKER_CONFIG.GOOGLE_SHEET_WEBAPP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      }).catch(err => console.debug('Tracker webhook pinged'));
    } catch (e) {}
  }

  /**
   * Mengambil Seluruh Log Akses Tersimpan
   */
  getStoredLogs() {
    try {
      return JSON.parse(localStorage.getItem('bgtk_access_logs') || '[]');
    } catch (e) {
      return [];
    }
  }

  clearStoredLogs() {
    localStorage.removeItem('bgtk_access_logs');
  }
}

// Inisialisasi Global Tracker
window.BGTKTracker = new AccessTracker();

/**
 * Event Tracking Helper untuk UI Dashboard
 */
function trackEmployeeFilter(employeeName) {
  window.BGTKTracker.logEvent('SELECT_EMPLOYEE', `Melihat riwayat pegawai: ${employeeName}`);
}

function trackPeriodFilter(mode, val) {
  window.BGTKTracker.logEvent('SELECT_PERIOD', `Mengubah filter periode ke: ${mode} (${val})`);
}

function trackSearchQuery(query) {
  if (query && query.trim().length >= 3) {
    window.BGTKTracker.logEvent('SEARCH_QUERY', `Mencari kata kunci: "${query}"`);
  }
}

function trackDetailPhotoView(reportId, author) {
  window.BGTKTracker.logEvent('VIEW_DETAIL_PHOTO', `Membuka foto rincian tugas #${reportId} milik ${author}`);
}

function trackPrintAction(employee, month) {
  window.BGTKTracker.logEvent('PRINT_REPORT', `Mencetak dokumen rekap A4 untuk: ${employee} (${month})`);
}

/**
 * Modal Admin Log & User Behavior Inspector
 */
function openAccessLogModal() {
  const modal = document.getElementById('accessLogModal');
  const tableBody = document.getElementById('accessLogTableBody');
  const summaryBox = document.getElementById('accessLogSummary');
  if (!modal) return;

  const logs = window.BGTKTracker.getStoredLogs();

  // Summary Metrics
  const uniqueVisitors = new Set(logs.map(l => l.visitorId)).size;
  const uniqueSessions = new Set(logs.map(l => l.sessionId)).size;
  const totalEvents = logs.length;

  if (summaryBox) {
    summaryBox.innerHTML = `
      <div class="grid grid-cols-3 gap-3 text-center">
        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span class="text-[10px] text-slate-400 font-bold uppercase block">Total Interaksi</span>
          <span class="text-xl font-bold text-slate-800">${totalEvents}</span>
        </div>
        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span class="text-[10px] text-slate-400 font-bold uppercase block">Sesi Terbuka</span>
          <span class="text-xl font-bold text-sky-600">${uniqueSessions}</span>
        </div>
        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span class="text-[10px] text-slate-400 font-bold uppercase block">Perangkat Unik</span>
          <span class="text-xl font-bold text-emerald-600">${uniqueVisitors}</span>
        </div>
      </div>
    `;
  }

  if (tableBody) {
    if (logs.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-6 text-slate-400 text-xs">Belum ada riwayat aktivitas tercatat.</td></tr>';
    } else {
      let rows = '';
      logs.slice(0, 50).forEach((l, idx) => {
        let badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
        if (l.actionType === 'PAGE_VIEW') badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (l.actionType === 'PRINT_REPORT') badgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
        if (l.actionType === 'SELECT_EMPLOYEE') badgeColor = 'bg-sky-50 text-sky-700 border-sky-200';

        rows += `
          <tr class="hover:bg-slate-50 text-xs border-b border-slate-100">
            <td class="p-2.5 font-mono text-slate-500 whitespace-nowrap">${l.timestamp}</td>
            <td class="p-2.5 whitespace-nowrap">
              <span class="font-bold text-slate-800 block">${l.device}</span>
              <span class="text-[10px] text-slate-400">${l.browser} • ${l.os}</span>
            </td>
            <td class="p-2.5 whitespace-nowrap">
              <span class="font-medium text-slate-700 block">${l.location || '-'}</span>
              <span class="text-[10px] text-slate-400 font-mono">${l.ip || '-'}</span>
            </td>
            <td class="p-2.5 whitespace-nowrap">
              <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold border ${badgeColor}">${l.actionType}</span>
            </td>
            <td class="p-2.5 text-slate-700">${l.actionDetail}</td>
          </tr>
        `;
      });
      tableBody.innerHTML = rows;
    }
  }

  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  if (window.lucide) window.lucide.createIcons();
}

function closeAccessLogModal() {
  const modal = document.getElementById('accessLogModal');
  if (modal) modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

function exportLogsToCSV() {
  const logs = window.BGTKTracker.getStoredLogs();
  if (logs.length === 0) {
    alert('Belum ada log yang dapat diekspor.');
    return;
  }

  const headers = ['Timestamp', 'VisitorID', 'Device', 'OS', 'Browser', 'Screen', 'IP', 'Location', 'ISP', 'Action', 'Detail'];
  const csvRows = [headers.join(',')];

  logs.forEach(l => {
    const row = [
      `"${l.timestamp}"`,
      `"${l.visitorId}"`,
      `"${l.device}"`,
      `"${l.os}"`,
      `"${l.browser}"`,
      `"${l.screen}"`,
      `"${l.ip}"`,
      `"${l.location}"`,
      `"${l.isp}"`,
      `"${l.actionType}"`,
      `"${(l.actionDetail || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `log-pemantau-bgtk-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
