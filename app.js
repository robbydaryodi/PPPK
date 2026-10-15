/**
 * Dashboard Monitoring Kinerja Pegawai PPPK
 * Balai Guru dan Tenaga Kependidikan (BGTK) Provinsi Sumatera Barat
 * Subbagian Umum - Urusan Rumah Tangga, Kebersihan, Keamanan, & Sarpras
 * 
 * Arsitektur: Standalone Single-Page Application (GitHub Pages Ready)
 * Data Source: Google Spreadsheet (Live JSONP + Offline Fallback)
 */

// Konfigurasi Sumber Data Spreadsheet
const CONFIG = {
  SPREADSHEET_ID: '1Ey8Qm4rsP73fJhkMdljRAJ253HmglsTNkxY4rV7u-TA',
  GID: '2124328095',
  OFFICE_NAME: 'BALAI GURU DAN TENAGA KEPENDIDIKAN PROVINSI SUMATERA BARAT',
  ADDRESS: 'Jl. Dewi Sartika, Rawang, Kota Pariaman, Sumatera Barat 25511 | Telp: (0751) 91178'
};

// State Aplikasi
const state = {
  rawReports: [],
  parsedReports: [],
  employees: [],
  availableMonths: [],
  
  // Filter Aktif
  selectedEmployee: 'ALL',
  selectedPeriodMode: 'MONTHLY', // 'MONTHLY', 'WEEKLY', 'ALL'
  selectedMonth: '', // '2026-04'
  selectedWeek: 'ALL', // 'ALL', '1', '2', '3', '4', '5'
  searchQuery: '',
  activeTab: 'ALL', // 'ALL', 'WITH_PHOTO', 'WITH_OBSTACLE'
  sortOrder: 'DESC', // 'DESC', 'ASC'
  
  // Status koneksi
  isLive: false,
  lastUpdated: null,
  activeDetailReport: null
};

// Normalisasi Nama Pegawai Resmi BGTK Sumbar
const EMPLOYEE_MAP = {
  'fitriandi': 'Fitriandi',
  'musrizaldi': 'Musrizaldi',
  'rio mailando agustiano': 'Rio Mailando Agustiano',
  'buyung syafrianto': 'Buyung Syafrianto',
  'neli aftariani': 'Neli Aftariani',
  'mardianto': 'Mardianto',
  'salaudin': 'Salaudin',
  'usrialdi': 'Usrialdi',
  'ade inputra': 'Ade Inputra',
  'karmawar': 'Karmawar',
  'roby': 'Robby Daryodi (Test)',
  'robby': 'Robby Daryodi (Test)'
};

// Palet Avatar Pegawai
const AVATAR_COLORS = [
  'from-blue-600 to-indigo-600',
  'from-emerald-600 to-teal-600',
  'from-violet-600 to-purple-600',
  'from-amber-600 to-orange-600',
  'from-cyan-600 to-sky-600',
  'from-rose-600 to-pink-600',
  'from-fuchsia-600 to-rose-600',
  'from-teal-600 to-emerald-600',
  'from-slate-700 to-slate-900',
  'from-sky-700 to-blue-800'
];

/**
 * Ekstraktor Direct Thumbnail Google Drive (Trik LH3 Google User Content)
 * Mengubah tautan preview Google Drive menjadi image direct feed tanpa kendala CORS
 */
function getDriveDirectThumbnail(url, size = 's800') {
  if (!url) return '';
  let fileId = '';
  const matchId = url.match(/id=([a-zA-Z0-9_-]+)/);
  if (matchId && matchId[1]) {
    fileId = matchId[1];
  } else {
    const matchSlash = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (matchSlash && matchSlash[1]) {
      fileId = matchSlash[1];
    }
  }
  if (!fileId) return url;
  return `https://lh3.googleusercontent.com/d/${fileId}=${size}`;
}

/**
 * Normalisasi dan Deteksi Cerdas Kategori Lokasi & Tugas
 */
function detectLocationAndCategory(text) {
  const lower = (text || '').toLowerCase();
  
  if (/aula mini|hol mini|aula utama|aula besar|hol utama|ruang wi|ruang belajar wi|ruang rapat/.test(lower)) {
    return {
      category: 'Aula & Pertemuan',
      icon: 'presentation',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200'
    };
  }
  if (/ult|pengaduan|perpustakaan|pustaka|arsip|bmn|numerasi|lumerasi|kantor utama|resepsionis|repsionis/.test(lower)) {
    return {
      category: 'Layanan & Pustaka',
      icon: 'building-2',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200'
    };
  }
  if (/asrama|asrama baru|asrama putra|rumah dinas|ruang kepala|kamar mandi kepala/.test(lower)) {
    return {
      category: 'Asrama & Rumdin',
      icon: 'home',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    };
  }
  if (/halaman|perkarangan|pekarangan|teras|parkir|taman|pos satpam|pos dua|pos 2|kolam|bunga/.test(lower)) {
    return {
      category: 'Halaman & Selasar',
      icon: 'trees',
      badgeClass: 'bg-teal-50 text-teal-700 border-teal-200'
    };
  }
  if (/sanyo|sanio|pompa|mesin air|temon|tandon|pipa|kran|air|listrik|pln|toilet|wc|kamar mandi|instalasi/.test(lower)) {
    return {
      category: 'MEP & Utilitas',
      icon: 'wrench',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
    };
  }
  if (/kunci kantor|piket|jaga kantor|keamanan|portal/.test(lower)) {
    return {
      category: 'Keamanan & Pos',
      icon: 'shield-check',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200'
    };
  }

  return {
    category: 'Fasilitas Kantor',
    icon: 'check-circle-2',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
  };
}

/**
 * Filter & Evaluasi Hambatan Nyata
 */
function evaluateObstacle(hambatanText) {
  if (!hambatanText) return { hasObstacle: false, text: '' };
  const raw = hambatanText.trim();
  const lower = raw.toLowerCase();
  
  // Kata-kata yang berarti TIDAK ADA hambatan
  const trivialPatterns = [
    /^[-_.,+]+$/,
    /^tidak ada$/i,
    /^tak ada$/i,
    /^tidak$/i,
    /^tiada$/i,
    /^aman$/i,
    /^lancar$/i,
    /^selesai$/i,
    /^beres$/i,
    /^tuntas$/i,
    /^bersih$/i,
    /^bersih²$/i,
    /^1$/,
    /^\+--?$/
  ];
  
  for (const pat of trivialPatterns) {
    if (pat.test(lower)) {
      return { hasObstacle: false, text: '' };
    }
  }

  // Cek apakah ada catatan kendala nyata
  return {
    hasObstacle: true,
    text: raw
  };
}

/**
 * Parsing Tanggal dan Waktu
 */
function parseTimestamp(tsString) {
  if (!tsString) {
    return {
      dateObj: new Date(),
      dateKey: '',
      monthKey: '',
      monthLabel: '',
      formattedDate: '-',
      formattedTime: '-',
      weekOfMonth: 1,
      timeSlot: 'Pagi'
    };
  }

  // Format umum GSheet: "3/2/2026 10:21:44" atau "4/16/2026 8:25:43"
  const parts = tsString.split(' ');
  const dateParts = parts[0].split('/');
  let m = parseInt(dateParts[0], 10);
  let d = parseInt(dateParts[1], 10);
  let y = parseInt(dateParts[2], 10);
  
  let hours = 8;
  let minutes = 0;
  if (parts[1]) {
    const timeParts = parts[1].split(':');
    hours = parseInt(timeParts[0], 10);
    minutes = parseInt(timeParts[1] || '0', 10);
    if (parts[2] && parts[2].toUpperCase() === 'PM' && hours < 12) hours += 12;
    if (parts[2] && parts[2].toUpperCase() === 'AM' && hours === 12) hours = 0;
  }

  const dateObj = new Date(y, m - 1, d, hours, minutes);
  const monthKey = `${y}-${String(m).padStart(2, '0')}`;
  const dateKey = `${monthKey}-${String(d).padStart(2, '0')}`;

  const monthsIndo = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const daysIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  const dayName = daysIndo[dateObj.getDay()];
  const monthName = monthsIndo[m - 1];
  const formattedDate = `${dayName}, ${d} ${monthName} ${y}`;
  const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} WIB`;

  // Hitung Minggu dalam Bulan (1: 1-7, 2: 8-14, 3: 15-21, 4: 22-28, 5: 29+)
  let weekOfMonth = 1;
  if (d <= 7) weekOfMonth = 1;
  else if (d <= 14) weekOfMonth = 2;
  else if (d <= 21) weekOfMonth = 3;
  else if (d <= 28) weekOfMonth = 4;
  else weekOfMonth = 5;

  // Waktu
  let timeSlot = 'Pagi';
  if (hours < 11) timeSlot = 'Pagi';
  else if (hours < 15) timeSlot = 'Siang';
  else if (hours < 18) timeSlot = 'Sore';
  else timeSlot = 'Malam';

  return {
    dateObj,
    dateKey,
    monthKey,
    monthLabel: `${monthName} ${y}`,
    day: d,
    month: m,
    year: y,
    formattedDate,
    formattedTime,
    weekOfMonth,
    timeSlot
  };
}

/**
 * Normalisasi Seluruh Baris Laporan
 */
function processRawReports(rawItems) {
  const employeesSet = new Map();
  const monthsSet = new Map();

  const processed = rawItems.map((item, idx) => {
    // Normalisasi Nama
    let rawAuthor = (item.author || '').trim();
    let normalizedAuthor = 'Petugas Tanpa Nama';
    if (rawAuthor) {
      const lower = rawAuthor.toLowerCase();
      normalizedAuthor = EMPLOYEE_MAP[lower] || rawAuthor;
    }

    // Skip atau filter testing Robby jika diinginkan, namun tetap simpan
    if (normalizedAuthor !== 'Petugas Tanpa Nama' && !normalizedAuthor.includes('Test')) {
      employeesSet.set(normalizedAuthor, (employeesSet.get(normalizedAuthor) || 0) + 1);
    }

    // Timestamp
    const timeMeta = parseTimestamp(item.timestamp);
    if (timeMeta.monthKey) {
      monthsSet.set(timeMeta.monthKey, timeMeta.monthLabel);
    }

    // Klasifikasi Lokasi & Pekerjaan
    const locMeta = detectLocationAndCategory(`${item.content || ''} ${item.output || ''}`);

    // Hambatan
    const obsMeta = evaluateObstacle(item.hambatan);

    // Foto Google Drive
    const driveThumbnail = getDriveDirectThumbnail(item.photoUrl);

    return {
      id: item.id || idx + 1,
      rawTimestamp: item.timestamp,
      author: normalizedAuthor,
      content: item.content || '(Tidak ada uraian tugas)',
      output: item.output || 'Selesai',
      hambatan: item.hambatan || '',
      hasRealObstacle: obsMeta.hasObstacle,
      obstacleDetail: obsMeta.text,
      photoUrl: item.photoUrl || '',
      driveThumbnail: driveThumbnail,
      hasPhoto: Boolean(item.photoUrl && item.photoUrl.trim().length > 10),
      time: timeMeta,
      location: locMeta
    };
  });

  // Urutkan pegawai berdasarkan jumlah laporan terbanyak
  const sortedEmployees = Array.from(employeesSet.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count], index) => ({
      name,
      count,
      avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
      initials: getInitials(name)
    }));

  // Urutkan bulan dari yang terbaru
  const sortedMonths = Array.from(monthsSet.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, label]) => ({ key, label }));

  return {
    reports: processed,
    employees: sortedEmployees,
    months: sortedMonths
  };
}

function getInitials(name) {
  if (!name) return 'PG';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Pemuat Data dari Google Sheets via JSONP
 */
function fetchGoogleSheetData() {
  updateConnectionStatus('loading', 'Memuat data terbaru dari Google Sheets...');

  // Fallback timer: jika lebih dari 4 detik, gunakan data offline
  const fallbackTimer = setTimeout(() => {
    if (!state.isLive && window.OFFLINE_REPORTS_DATA) {
      console.warn('Google Sheets loading took >4s, applying offline cache first.');
      loadOfflineData('Data Offline (Koneksi lambat, memuat cadangan lokal)');
    }
  }, 4000);

  // Buat script tag untuk JSONP
  const scriptId = 'gsheet-jsonp-script';
  const oldScript = document.getElementById(scriptId);
  if (oldScript) oldScript.remove();

  window.handleGoogleSheetResponse = function(response) {
    clearTimeout(fallbackTimer);
    try {
      if (!response || !response.table || !response.table.rows) {
        throw new Error('Format data Google Sheets tidak valid.');
      }

      const rows = response.table.rows;
      const parsedItems = rows.map((r, i) => {
        const c = r.c || [];
        return {
          id: i + 1,
          timestamp: c[0] ? (c[0].f || String(c[0].v || '')) : '',
          author: c[1] ? String(c[1].v || '') : '',
          content: c[2] ? String(c[2].v || '') : '',
          output: c[3] ? String(c[3].v || '') : '',
          hambatan: c[4] ? String(c[4].v || '') : '',
          photoUrl: c[5] ? String(c[5].v || '') : ''
        };
      });

      state.isLive = true;
      state.lastUpdated = new Date();
      applyDataset(parsedItems);
      updateConnectionStatus('live', `Live Terhubung (${parsedItems.length} Laporan)`);
    } catch (err) {
      console.error('Error parsing GSheet response:', err);
      loadOfflineData('Menggunakan Cadangan Data Lokal');
    }
  };

  const script = document.createElement('script');
  script.id = scriptId;
  script.src = `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=responseHandler:handleGoogleSheetResponse&gid=${CONFIG.GID}&_nocache=${Date.now()}`;
  script.onerror = function() {
    clearTimeout(fallbackTimer);
    console.warn('JSONP fetch failed. Using offline cache.');
    loadOfflineData('Mode Offline (Gagal memuat live spreadsheet)');
  };
  document.body.appendChild(script);
}

function loadOfflineData(statusMsg = 'Mode Cadangan Lokal') {
  if (window.OFFLINE_REPORTS_DATA && window.OFFLINE_REPORTS_DATA.length > 0) {
    state.isLive = false;
    state.lastUpdated = new Date();
    applyDataset(window.OFFLINE_REPORTS_DATA);
    updateConnectionStatus('offline', statusMsg);
  } else {
    updateConnectionStatus('error', 'Gagal memuat data laporan.');
  }
}

function applyDataset(rawItems) {
  state.rawReports = rawItems;
  const processed = processRawReports(rawItems);
  state.parsedReports = processed.reports;
  state.employees = processed.employees;
  state.availableMonths = processed.months;

  // Set default bulan ke bulan terbaru jika belum diset
  if (!state.selectedMonth && state.availableMonths.length > 0) {
    state.selectedMonth = state.availableMonths[0].key;
  }

  renderEmployeeSelector();
  renderPeriodSelectors();
  renderDashboard();
}

/**
 * Filter Data Berdasarkan Kondisi Aktif
 */
function getFilteredReports() {
  return state.parsedReports.filter(report => {
    // 1. Filter Pegawai
    if (state.selectedEmployee !== 'ALL') {
      if (report.author !== state.selectedEmployee) return false;
    }

    // 2. Filter Periode
    if (state.selectedPeriodMode === 'MONTHLY' || state.selectedPeriodMode === 'WEEKLY') {
      if (state.selectedMonth && report.time.monthKey !== state.selectedMonth) {
        return false;
      }
      if (state.selectedPeriodMode === 'WEEKLY' && state.selectedWeek !== 'ALL') {
        if (String(report.time.weekOfMonth) !== String(state.selectedWeek)) {
          return false;
        }
      }
    }

    // 3. Filter Tab Khusus
    if (state.activeTab === 'WITH_PHOTO' && !report.hasPhoto) return false;
    if (state.activeTab === 'WITH_OBSTACLE' && !report.hasRealObstacle) return false;

    // 4. Filter Pencarian Teks
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase();
      const matchContent = report.content.toLowerCase().includes(q);
      const matchOutput = report.output.toLowerCase().includes(q);
      const matchHambatan = (report.hambatan || '').toLowerCase().includes(q);
      const matchLocation = report.location.category.toLowerCase().includes(q);
      const matchAuthor = report.author.toLowerCase().includes(q);
      if (!matchContent && !matchOutput && !matchHambatan && !matchLocation && !matchAuthor) {
        return false;
      }
    }

    return true;
  }).sort((a, b) => {
    const timeA = a.time.dateObj.getTime();
    const timeB = b.time.dateObj.getTime();
    return state.sortOrder === 'DESC' ? timeB - timeA : timeA - timeB;
  });
}

/**
 * RENDER: Selector Pegawai
 */
function renderEmployeeSelector() {
  const container = document.getElementById('employeePillsContainer');
  if (!container) return;

  const totalAll = state.parsedReports.length;

  let html = `
    <button 
      onclick="setEmployee('ALL')" 
      class="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm ${
        state.selectedEmployee === 'ALL'
          ? 'bg-bgtk-navy text-white shadow-md ring-2 ring-sky-500/50'
          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
      }">
      <span class="w-5 h-5 rounded-lg bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-[10px]">ALL</span>
      <span>Semua Pegawai</span>
      <span class="px-1.5 py-0.5 rounded-full text-[10px] ${state.selectedEmployee === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}">${totalAll}</span>
    </button>
  `;

  state.employees.forEach(emp => {
    const isSelected = state.selectedEmployee === emp.name;
    html += `
      <button 
        onclick="setEmployee('${emp.name}')" 
        class="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm ${
          isSelected
            ? 'bg-bgtk-navy text-white shadow-md ring-2 ring-sky-500/50 scale-[1.02]'
            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
        }">
        <span class="w-5 h-5 rounded-lg bg-gradient-to-tr ${emp.avatarColor} text-white font-bold flex items-center justify-center text-[9px]">
          ${emp.initials}
        </span>
        <span>${emp.name}</span>
        <span class="px-1.5 py-0.5 rounded-full text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}">
          ${emp.count}
        </span>
      </button>
    `;
  });

  container.innerHTML = html;
}

/**
 * RENDER: Selector Periode (Bulan & Minggu)
 */
function renderPeriodSelectors() {
  const monthSelect = document.getElementById('monthSelect');
  if (monthSelect) {
    let opts = '';
    state.availableMonths.forEach(m => {
      opts += `<option value="${m.key}" ${state.selectedMonth === m.key ? 'selected' : ''}>${m.label}</option>`;
    });
    monthSelect.innerHTML = opts;
  }

  // Update button tabs for Period Mode
  updatePeriodModeUI();
}

function updatePeriodModeUI() {
  const btnMonthly = document.getElementById('btnModeMonthly');
  const btnWeekly = document.getElementById('btnModeWeekly');
  const btnAllTime = document.getElementById('btnModeAll');
  const weekSelectorWrapper = document.getElementById('weekSelectorWrapper');

  const activeClass = 'bg-sky-600 text-white font-bold shadow-sm';
  const inactiveClass = 'text-slate-600 hover:text-slate-900 font-medium';

  if (btnMonthly) btnMonthly.className = `px-3 py-1.5 rounded-lg text-xs transition-all ${state.selectedPeriodMode === 'MONTHLY' ? activeClass : inactiveClass}`;
  if (btnWeekly) btnWeekly.className = `px-3 py-1.5 rounded-lg text-xs transition-all ${state.selectedPeriodMode === 'WEEKLY' ? activeClass : inactiveClass}`;
  if (btnAllTime) btnAllTime.className = `px-3 py-1.5 rounded-lg text-xs transition-all ${state.selectedPeriodMode === 'ALL' ? activeClass : inactiveClass}`;

  if (weekSelectorWrapper) {
    if (state.selectedPeriodMode === 'WEEKLY') {
      weekSelectorWrapper.classList.remove('hidden');
    } else {
      weekSelectorWrapper.classList.add('hidden');
    }
  }
}

/**
 * RENDER: Utama Dashboard
 */
function renderDashboard() {
  const filtered = getFilteredReports();

  renderSummaryCards(filtered);
  renderCalendarStrip(filtered);
  renderActivityCards(filtered);
  updateActiveFilterLabel();
  
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * RENDER: Metric Summary Cards (Hanya Total Tugas & Hari Kerja Aktif)
 */
function renderSummaryCards(filtered) {
  // 1. Total Laporan
  const elTotal = document.getElementById('statTotalTasks');
  if (elTotal) elTotal.textContent = filtered.length;

  // 2. Hari Aktif
  const elDays = document.getElementById('statActiveDays');
  if (elDays) {
    const activeDays = new Set(filtered.map(r => r.time.dateKey)).size;
    elDays.textContent = activeDays;
  }
}

/**
 * RENDER: Kalender Aktivitas / Heatmap Strip (Memperlihatkan Hari Kerja)
 */
function renderCalendarStrip(filtered) {
  const container = document.getElementById('calendarHeatmapStrip');
  if (!container) return;

  if (state.selectedPeriodMode === 'ALL') {
    container.parentElement.classList.add('hidden');
    return;
  }
  container.parentElement.classList.remove('hidden');

  // Hitung jumlah hari dalam bulan terpilih
  const [yearStr, monthStr] = (state.selectedMonth || '2026-04').split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  const totalDays = new Date(y, m, 0).getDate();

  // Hitung sebaran aktivitas per hari
  const dayCounts = {};
  filtered.forEach(r => {
    if (r.time.month === m && r.time.year === y) {
      dayCounts[r.time.day] = (dayCounts[r.time.day] || 0) + 1;
    }
  });

  let html = '';
  for (let d = 1; d <= totalDays; d++) {
    const count = dayCounts[d] || 0;
    const dateObj = new Date(y, m - 1, d);
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

    let bgClass = 'bg-slate-100 text-slate-500 border-slate-200';
    if (count > 0) {
      if (count >= 5) bgClass = 'bg-emerald-600 text-white font-bold ring-2 ring-emerald-300 shadow-sm';
      else if (count >= 3) bgClass = 'bg-emerald-500 text-white font-bold shadow-sm';
      else bgClass = 'bg-emerald-400 text-white font-medium';
    } else if (isWeekend) {
      bgClass = 'bg-slate-50 text-slate-300 border-dashed border-slate-200';
    }

    const titleTooltip = `Tanggal ${d}: ${count} laporan kerja`;

    html += `
      <div 
        title="${titleTooltip}" 
        class="flex-1 min-w-[28px] max-w-[36px] h-10 rounded-lg flex flex-col items-center justify-center text-[10px] border transition-all cursor-pointer hover:scale-110 ${bgClass}">
        <span class="text-[9px] leading-tight">${d}</span>
        ${count > 0 ? `<span class="text-[8px] opacity-90 font-mono">${count}</span>` : '<span class="text-[8px] opacity-30">•</span>'}
      </div>
    `;
  }

  container.innerHTML = html;
}

/**
 * RENDER: Activity Cards (Detail per Kegiatan)
 */
function renderActivityCards(filtered) {
  const container = document.getElementById('activityCardsContainer');
  const emptyState = document.getElementById('emptyStateMessage');
  const countBadge = document.getElementById('feedCountBadge');

  if (countBadge) countBadge.textContent = `${filtered.length} Aktivitas Ditampilkan`;

  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  if (emptyState) emptyState.classList.add('hidden');

  let html = '';

  filtered.forEach(report => {
    const hasPhoto = report.hasPhoto && report.driveThumbnail;
    const hasObstacle = report.hasRealObstacle;

    html += `
      <div class="activity-card bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
        <!-- Header Kartu -->
        <div>
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="flex items-center gap-2.5">
              <span class="w-8 h-8 rounded-xl bg-slate-100 text-bgtk-navy font-bold flex items-center justify-center text-xs border border-slate-200">
                ${getInitials(report.author)}
              </span>
              <div>
                <h4 class="text-xs font-bold text-slate-800 leading-tight">${report.author}</h4>
                <div class="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                  <i data-lucide="clock" class="w-3 h-3 text-slate-400"></i>
                  <span>${report.time.formattedDate} • ${report.time.formattedTime}</span>
                </div>
              </div>
            </div>

            <!-- Badge Lokasi/Kategori -->
            <span class="px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${report.location.badgeClass} flex items-center gap-1">
              <i data-lucide="${report.location.icon}" class="w-3 h-3"></i>
              <span>${report.location.category}</span>
            </span>
          </div>

          <!-- Deskripsi Uraian Pekerjaan -->
          <div class="my-3">
            <p class="text-sm font-semibold text-slate-900 leading-relaxed">${escapeHtml(report.content)}</p>
            
            <!-- Output Capaian -->
            <div class="mt-2 text-xs flex items-center gap-1.5 text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
              <i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-600 shrink-0"></i>
              <span><strong class="text-slate-700">Hasil:</strong> ${escapeHtml(report.output)}</span>
            </div>

            <!-- Hambatan (Jika ada) -->
            ${hasObstacle ? `
              <div class="mt-2 text-xs flex items-start gap-1.5 text-amber-800 bg-amber-50/80 px-2.5 py-1.5 rounded-lg border border-amber-200">
                <i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5"></i>
                <span><strong class="text-amber-900">Kendala:</strong> ${escapeHtml(report.obstacleDetail)}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Bagian Foto & Aksi -->
        <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <div class="flex items-center gap-2">
            ${hasPhoto ? `
              <div 
                onclick="openDetailModal(${report.id})"
                class="group relative w-12 h-12 rounded-xl overflow-hidden cursor-pointer border border-slate-200 shadow-sm shrink-0">
                <img 
                  src="${report.driveThumbnail}" 
                  alt="Bukti Tugas" 
                  loading="lazy"
                  class="w-full h-full object-cover transition-transform group-hover:scale-110" 
                  onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-400\\'><i data-lucide=\\'image-off\\'></i></div>'"
                />
                <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <i data-lucide="zoom-in" class="w-4 h-4"></i>
                </div>
              </div>
              <span class="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <i data-lucide="camera" class="w-3.5 h-3.5"></i>
                Bukti Foto Ada
              </span>
            ` : `
              <span class="text-[11px] text-slate-400 flex items-center gap-1">
                <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
                Tanpa Lampiran Foto
              </span>
            `}
          </div>

          <button 
            onclick="openDetailModal(${report.id})" 
            class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-bgtk-navy hover:text-white text-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5">
            <span>Detail</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * MODAL: Detail Kegiatan (Foto Resolusi Penuh & Keterangan)
 */
function openDetailModal(reportId) {
  const report = state.parsedReports.find(r => r.id === reportId);
  if (!report) return;

  state.activeDetailReport = report;
  const modal = document.getElementById('detailModal');
  const modalContent = document.getElementById('modalContentArea');

  if (!modal || !modalContent) return;

  const hasPhoto = report.hasPhoto && report.driveThumbnail;

  modalContent.innerHTML = `
    <div class="flex items-start justify-between pb-4 border-b border-slate-100">
      <div class="flex items-center gap-3">
        <span class="w-10 h-10 rounded-2xl bg-bgtk-navy text-white font-bold flex items-center justify-center text-sm shadow-sm">
          ${getInitials(report.author)}
        </span>
        <div>
          <h3 class="text-base font-bold text-slate-900">${report.author}</h3>
          <p class="text-xs text-slate-500">${report.time.formattedDate} • ${report.time.formattedTime}</p>
        </div>
      </div>
      <button onclick="closeDetailModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    </div>

    <div class="mt-4 space-y-4">
      <!-- Foto Bukti Fisik -->
      ${hasPhoto ? `
        <div class="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 max-h-[380px] flex items-center justify-center relative group">
          <img 
            src="${report.driveThumbnail}" 
            alt="Foto Bukti Tugas" 
            class="max-h-[380px] w-auto object-contain mx-auto"
            onerror="this.parentElement.innerHTML='<div class=\\'p-8 text-center text-slate-400\\'>Foto gagal dimuat langsung. Buka tautan Google Drive di bawah.</div>'"
          />
          <a 
            href="${report.photoUrl}" 
            target="_blank" 
            class="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-black/75 hover:bg-black text-white text-xs font-semibold backdrop-blur-md flex items-center gap-1.5 transition-all">
            <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
            Buka di Google Drive
          </a>
        </div>
      ` : `
        <div class="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-slate-400 text-xs">
          <i data-lucide="image-off" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
          Tidak ada dokumentasi foto pada laporan ini.
        </div>
      `}

      <!-- Rincian Tugas -->
      <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
        <div>
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Uraian Tugas / Pekerjaan</span>
          <p class="text-sm font-semibold text-slate-900 leading-relaxed">${escapeHtml(report.content)}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Capaian / Output</span>
            <div class="flex items-center gap-1.5 text-xs text-slate-800 font-medium">
              <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600"></i>
              <span>${escapeHtml(report.output)}</span>
            </div>
          </div>
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Lokasi Fasilitas</span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${report.location.badgeClass}">
              <i data-lucide="${report.location.icon}" class="w-3.5 h-3.5"></i>
              ${report.location.category}
            </span>
          </div>
        </div>

        ${report.hasRealObstacle ? `
          <div class="pt-2 border-t border-slate-200/60">
            <span class="text-[10px] font-bold uppercase tracking-wider text-amber-600 block mb-1">Kendala / Hambatan Lapangan</span>
            <p class="text-xs font-semibold text-amber-900 bg-amber-100/70 p-2.5 rounded-xl border border-amber-200">${escapeHtml(report.obstacleDetail)}</p>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  if (window.lucide) window.lucide.createIcons();
}

function closeDetailModal() {
  const modal = document.getElementById('detailModal');
  if (modal) modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  state.activeDetailReport = null;
}

/**
 * GENERATOR CETAK REKAP LAPORAN BULANAN RESMI KEMENDIKDASMEN
 */
function generatePrintReport() {
  const filtered = getFilteredReports();
  const printArea = document.getElementById('printReportArea');
  if (!printArea) return;

  const currentMonthObj = state.availableMonths.find(m => m.key === state.selectedMonth);
  const monthTitle = currentMonthObj ? currentMonthObj.label : 'Semua Periode';
  const employeeTitle = state.selectedEmployee === 'ALL' ? 'Seluruh Pegawai Urusan Rumah Tangga & Keamanan' : state.selectedEmployee;

  let tableRows = '';
  filtered.forEach((r, idx) => {
    tableRows += `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>${r.time.formattedDate}</td>
        <td style="text-align: center;">${r.time.formattedTime}</td>
        <td>${escapeHtml(r.author)}</td>
        <td><strong>${escapeHtml(r.content)}</strong></td>
        <td>${escapeHtml(r.output)}</td>
        <td>${r.hasRealObstacle ? `<span style="color: #b45309;">${escapeHtml(r.obstacleDetail)}</span>` : '-'}</td>
        <td style="text-align: center;">${r.hasPhoto ? 'Ada Foto' : 'Tidak'}</td>
      </tr>
    `;
  });

  const printHtml = `
    <div class="kop-surat">
      <h2>${CONFIG.OFFICE_NAME}</h2>
      <p>${CONFIG.ADDRESS}</p>
    </div>

    <div style="text-align: center; margin-bottom: 20px;">
      <h3 style="margin: 0; font-size: 11pt; text-transform: uppercase; font-weight: 800; text-decoration: underline;">
        LEMBAR REKAPITULASI CATATAN KINERJA HARIAN PEGAWAI PPPK
      </h3>
      <p style="margin: 3px 0 0 0; font-size: 9pt;">
        Subbagian Umum — Urusan Rumah Tangga, Kebersihan, Keamanan, dan Pemeliharaan Sarana Prasarana
      </p>
    </div>

    <!-- Identitas Laporan -->
    <table style="width: 100%; margin-bottom: 15px; font-size: 9pt; border: none;">
      <tr>
        <td style="width: 18%; font-weight: bold; border: none; padding: 2px 0;">Nama Pegawai</td>
        <td style="width: 2%; border: none; padding: 2px 0;">:</td>
        <td style="width: 40%; border: none; padding: 2px 0;">${employeeTitle}</td>
        <td style="width: 18%; font-weight: bold; border: none; padding: 2px 0;">Bulan / Periode</td>
        <td style="width: 2%; border: none; padding: 2px 0;">:</td>
        <td style="width: 20%; border: none; padding: 2px 0;">${monthTitle}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; border: none; padding: 2px 0;">Unit Kerja</td>
        <td style="border: none; padding: 2px 0;">:</td>
        <td style="border: none; padding: 2px 0;">BGTK Provinsi Sumatera Barat</td>
        <td style="font-weight: bold; border: none; padding: 2px 0;">Total Penugasan</td>
        <td style="border: none; padding: 2px 0;">:</td>
        <td style="border: none; padding: 2px 0;">${filtered.length} Aktivitas Terselesaikan</td>
      </tr>
    </table>

    <!-- Tabel Rekap -->
    <table class="print-table">
      <thead>
        <tr>
          <th style="width: 4%;">No</th>
          <th style="width: 14%;">Hari / Tanggal</th>
          <th style="width: 9%;">Waktu</th>
          <th style="width: 13%;">Nama Pegawai</th>
          <th style="width: 28%;">Uraian Pekerjaan / Tugas</th>
          <th style="width: 14%;">Output / Capaian</th>
          <th style="width: 12%;">Kendala / Hambatan</th>
          <th style="width: 6%;">Bukti</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows || '<tr><td colspan="8" style="text-align: center; padding: 15px;">Tidak ada data laporan pada periode ini.</td></tr>'}
      </tbody>
    </table>

    <!-- Tanda Tangan Pengesahan -->
    <div class="print-signature-block">
      <div class="sign-column">
        <p>Mengetahui,</p>
        <p style="font-weight: bold;">Kepala Subbagian Umum</p>
        <div class="sign-space"></div>
        <p style="font-weight: bold; text-decoration: underline; margin-bottom: 2px;">(......................................................)</p>
        <p>NIP. ...............................................</p>
      </div>

      <div class="sign-column">
        <p>Pariaman, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <p style="font-weight: bold;">Pegawai yang Melaporkan</p>
        <div class="sign-space"></div>
        <p style="font-weight: bold; text-decoration: underline; margin-bottom: 2px;">${employeeTitle === 'Seluruh Pegawai Urusan Rumah Tangga & Keamanan' ? '( Koordinator Tim )' : employeeTitle}</p>
        <p>${employeeTitle === 'Seluruh Pegawai Urusan Rumah Tangga & Keamanan' ? 'NIP/NIPPPK. ...................................' : 'NIPPPK. ...............................................'}</p>
      </div>
    </div>
  `;

  printArea.innerHTML = printHtml;
  window.print();
}

/**
 * Helper dan Event Handler
 */
function setEmployee(name) {
  state.selectedEmployee = name;
  renderEmployeeSelector();
  renderDashboard();
}

function setPeriodMode(mode) {
  state.selectedPeriodMode = mode;
  updatePeriodModeUI();
  renderDashboard();
}

function setMonth(monthKey) {
  state.selectedMonth = monthKey;
  renderDashboard();
}

function setWeek(weekVal) {
  state.selectedWeek = weekVal;
  
  // Update week button styles
  const weekButtons = document.querySelectorAll('.week-btn');
  weekButtons.forEach(btn => {
    if (btn.dataset.week === weekVal) {
      btn.className = 'week-btn px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-600 text-white shadow-sm';
    } else {
      btn.className = 'week-btn px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100';
    }
  });

  renderDashboard();
}

function setActiveTab(tab) {
  state.activeTab = tab;
  
  const tabAll = document.getElementById('tabFilterAll');
  const tabPhoto = document.getElementById('tabFilterPhoto');
  const tabObs = document.getElementById('tabFilterObstacle');

  const activeCls = 'border-b-2 border-bgtk-navy text-bgtk-navy font-bold';
  const inactiveCls = 'text-slate-500 hover:text-slate-700 font-medium';

  if (tabAll) tabAll.className = `py-3 px-4 text-xs transition-all ${tab === 'ALL' ? activeCls : inactiveCls}`;
  if (tabPhoto) tabPhoto.className = `py-3 px-4 text-xs transition-all ${tab === 'WITH_PHOTO' ? activeCls : inactiveCls}`;
  if (tabObs) tabObs.className = `py-3 px-4 text-xs transition-all ${tab === 'WITH_OBSTACLE' ? activeCls : inactiveCls}`;

  renderDashboard();
}

function toggleSortOrder() {
  state.sortOrder = state.sortOrder === 'DESC' ? 'ASC' : 'DESC';
  const sortBtn = document.getElementById('sortOrderBtn');
  if (sortBtn) {
    sortBtn.innerHTML = state.sortOrder === 'DESC' 
      ? '<i data-lucide="arrow-down-wide-narrow" class="w-3.5 h-3.5"></i> Terbaru Dulu'
      : '<i data-lucide="arrow-up-narrow-wide" class="w-3.5 h-3.5"></i> Terlama Dulu';
  }
  renderDashboard();
}

function updateActiveFilterLabel() {
  const labelEl = document.getElementById('activeFilterDisplay');
  if (!labelEl) return;

  const currentMonthObj = state.availableMonths.find(m => m.key === state.selectedMonth);
  const mLabel = currentMonthObj ? currentMonthObj.label : 'Semua Bulan';
  
  let text = `Memantau: <strong class="text-slate-800">${state.selectedEmployee === 'ALL' ? 'Semua Pegawai' : state.selectedEmployee}</strong>`;
  
  if (state.selectedPeriodMode === 'MONTHLY') {
    text += ` • Bulan <strong class="text-slate-800">${mLabel}</strong>`;
  } else if (state.selectedPeriodMode === 'WEEKLY') {
    text += ` • Bulan <strong class="text-slate-800">${mLabel}</strong> (Minggu ke-${state.selectedWeek})`;
  } else {
    text += ` • <strong class="text-slate-800">Semua Waktu</strong>`;
  }

  labelEl.innerHTML = text;
}

function updateConnectionStatus(type, message) {
  const statusBadge = document.getElementById('connectionStatusBadge');
  if (!statusBadge) return;

  if (type === 'live') {
    statusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ${message}`;
  } else if (type === 'loading') {
    statusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20';
    statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-sky-400 animate-spin"></span> ${message}`;
  } else if (type === 'offline') {
    statusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20';
    statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span> ${message}`;
  } else {
    statusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20';
    statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-400"></span> ${message}`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Inisialisasi Saat Halaman Dimuat
document.addEventListener('DOMContentLoaded', () => {
  // Setup Search Input Listener
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderDashboard();
    });
  }

  // Load awal
  fetchGoogleSheetData();
});
