// Application State
let dossiers = [];
let currentFilter = {
  q: '',
  status: 'ALL',
  surveyor: '',
  commune: '',
  quick_filter: 'ALL',
  sort_by: 'id',
  order: 'DESC'
};
let selectedDossier = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  // Set default dates in form (today)
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('formDateReceived').value = today;

  // Search input with debounce
  let searchTimeout = null;
  const searchInput = document.getElementById('searchInput');
  const btnClearSearch = document.getElementById('btnClearSearch');

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    btnClearSearch.classList.toggle('hidden', val.length === 0);
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentFilter.q = val;
      loadDossiers();
    }, 300);
  });

  btnClearSearch.addEventListener('click', () => {
    searchInput.value = '';
    btnClearSearch.classList.add('hidden');
    currentFilter.q = '';
    loadDossiers();
  });

  // Filter dropdowns
  document.getElementById('filterSurveyor').addEventListener('change', (e) => {
    currentFilter.surveyor = e.target.value;
    loadDossiers();
  });

  document.getElementById('filterCommune').addEventListener('change', (e) => {
    currentFilter.commune = e.target.value;
    loadDossiers();
  });

  document.getElementById('sortBy').addEventListener('change', (e) => {
    const [field, dir] = e.target.value.split('-');
    currentFilter.sort_by = field;
    currentFilter.order = dir;
    loadDossiers();
  });

  // Modal QR Code trigger
  document.getElementById('btnOpenQrModal').addEventListener('click', openQrModal);

  // Initial data loading
  loadStats();
  loadDossiers();
});

// Helper: Format Vietnamese Date (YYYY-MM-DD -> DD/MM/YYYY)
function formatDateVN(dateStr) {
  if (!dateStr) return '--/--/----';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

// Calculate days remaining or overdue
function calculateDueInfo(dateReturn, status) {
  if (status === 'DA_TRA') {
    return { text: 'Đã hoàn thành trả kết quả', cls: 'due-normal' };
  }
  if (!dateReturn) {
    return { text: 'Chưa có ngày hẹn trả', cls: 'bg-slate-100 text-slate-500' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(dateReturn);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      text: `Quá hạn trả ${Math.abs(diffDays)} ngày!`,
      cls: 'due-overdue'
    };
  } else if (diffDays === 0) {
    return {
      text: 'Hôm nay đến hạn trả kết quả',
      cls: 'due-today'
    };
  } else if (diffDays <= 2) {
    return {
      text: `Gấp: Còn ${diffDays} ngày đến hạn`,
      cls: 'due-today'
    };
  } else {
    return {
      text: `Còn ${diffDays} ngày đến hạn`,
      cls: 'due-normal'
    };
  }
}

// Map status to Vietnamese text and colors
const statusDisplay = {
  'CHO_DO': {
    label: 'Chờ đi đo',
    badgeCls: 'badge-CHO_DO',
    nextAction: '🚗 Đã đi đo thực địa',
    nextStatus: 'DANG_NOI_NGHIEP'
  },
  'DANG_NOI_NGHIEP': {
    label: 'Đang nội nghiệp / vẽ BĐ',
    badgeCls: 'badge-DANG_NOI_NGHIEP',
    nextAction: '📑 Đã duyệt bản đồ',
    nextStatus: 'CHO_TRA'
  },
  'CHO_TRA': {
    label: 'Chờ trả kết quả',
    badgeCls: 'badge-CHO_TRA',
    nextAction: '✅ Đã trả cho chủ đất',
    nextStatus: 'DA_TRA'
  },
  'DA_TRA': {
    label: 'Đã trả kết quả',
    badgeCls: 'badge-DA_TRA',
    nextAction: null,
    nextStatus: null
  },
  'VUONG_MAC': {
    label: 'Vướng mắc / Tạm dừng',
    badgeCls: 'badge-VUONG_MAC',
    nextAction: 'Tiếp tục xử lý',
    nextStatus: 'CHO_DO'
  }
};

// Fetch and render Stats
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error('Không thể tải thống kê');
    const data = await res.json();

    document.getElementById('statTotal').textContent = data.total;
    document.getElementById('statTodaySurvey').textContent = data.todaySurvey;
    document.getElementById('statChoDo').textContent = data.choDo;
    document.getElementById('statDangNoiNghiep').textContent = data.dangNoiNghiep;
    document.getElementById('statChoTra').textContent = data.choTra;
    document.getElementById('statOverdue').textContent = data.overdue;

    // Populate Surveyor Dropdown if empty
    const surveyorSelect = document.getElementById('filterSurveyor');
    if (surveyorSelect.options.length <= 1) {
      data.surveyors.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        surveyorSelect.appendChild(opt);
      });
    }

    // Populate Commune Dropdown if empty
    const communeSelect = document.getElementById('filterCommune');
    if (communeSelect.options.length <= 1) {
      data.communes.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        communeSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Lỗi tải thống kê:', err);
  }
}

// Fetch and render Dossiers
async function loadDossiers() {
  try {
    const container = document.getElementById('dossiersContainer');
    container.innerHTML = `
      <div class="text-center py-10 text-slate-400">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
        <p class="mt-2 text-sm">Đang tải hồ sơ...</p>
      </div>
    `;

    const params = new URLSearchParams();
    if (currentFilter.q) params.append('q', currentFilter.q);
    if (currentFilter.status && currentFilter.status !== 'ALL') params.append('status', currentFilter.status);
    if (currentFilter.surveyor) params.append('surveyor', currentFilter.surveyor);
    if (currentFilter.commune) params.append('commune', currentFilter.commune);
    if (currentFilter.quick_filter && currentFilter.quick_filter !== 'ALL') params.append('quick_filter', currentFilter.quick_filter);
    params.append('sort_by', currentFilter.sort_by);
    params.append('order', currentFilter.order);

    const res = await fetch(`/api/dossiers?${params.toString()}`);
    if (!res.ok) throw new Error('Không thể tải danh sách hồ sơ');
    dossiers = await res.json();

    document.getElementById('resultsCountBadge').textContent = dossiers.length;
    document.getElementById('lastUpdatedTime').textContent = `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')}`;

    renderDossiers(dossiers);
    loadStats(); // refresh counts
  } catch (err) {
    console.error('Lỗi tải hồ sơ:', err);
    document.getElementById('dossiersContainer').innerHTML = `
      <div class="bg-red-50 text-red-700 p-4 rounded-xl text-center text-sm">
        Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng tải lại trang!
      </div>
    `;
  }
}

// Render Dossiers Cards (Optimized for Mobile Touch)
function renderDossiers(items) {
  const container = document.getElementById('dossiersContainer');
  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-sm space-y-3">
        <div class="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
          <i data-lucide="file-x" class="w-8 h-8"></i>
        </div>
        <h4 class="text-base font-bold text-slate-800">Không tìm thấy hồ sơ nào</h4>
        <p class="text-xs text-slate-500 max-w-sm mx-auto">Thử thay đổi từ khóa tìm kiếm hoặc bấm nút "Đặt lại bộ lọc" để xem toàn bộ danh sách.</p>
        <button onclick="openCreateModal()" class="inline-flex items-center gap-1.5 bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition">
          <i data-lucide="plus" class="w-4 h-4"></i>
          <span>Tiếp nhận hồ sơ mới ngay</span>
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  const html = items.map(dossier => {
    const statusCfg = statusDisplay[dossier.status] || {
      label: dossier.status,
      badgeCls: 'bg-slate-100 text-slate-700',
      nextAction: null,
      nextStatus: null
    };

    const dueInfo = calculateDueInfo(dossier.date_return, dossier.status);
    const isSurveyToday = dossier.date_survey === today && dossier.status === 'CHO_DO';

    return `
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 hover:border-blue-400 hover:shadow-md transition space-y-3">
        <!-- Top bar: Mã HS + Trạng thái + Số ảnh -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="font-mono font-bold text-xs bg-slate-900 text-white px-2.5 py-1 rounded-md">
              ${dossier.code}
            </span>
            <span class="text-xs font-semibold text-slate-500">
              Tờ: <strong class="text-slate-800">${dossier.sheet_number || '-'}</strong> / Thửa: <strong class="text-slate-800">${dossier.plot_number || '-'}</strong>
            </span>
          </div>
          <div class="flex items-center gap-1.5">
            ${dossier.attachment_count > 0 ? `
              <span class="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200" title="Đã có ảnh thực địa">
                <i data-lucide="image" class="w-3 h-3"></i> ${dossier.attachment_count}
              </span>
            ` : ''}
            <span class="badge-status ${statusCfg.badgeCls}">
              ${statusCfg.label}
            </span>
          </div>
        </div>

        <!-- Main Info: Tên chủ đất + Điện thoại + Địa chỉ -->
        <div class="flex items-start justify-between gap-2">
          <div class="space-y-0.5">
            <h3 class="text-base font-bold text-slate-900 leading-tight">
              ${dossier.customer_name}
            </h3>
            <p class="text-xs text-slate-600 flex items-center gap-1">
              <i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>
              <span>${[dossier.village, dossier.commune].filter(Boolean).join(', ') || 'Chưa cập nhật địa chỉ'}</span>
            </p>
          </div>

          <!-- Nút gọi điện nhanh trên Mobile -->
          ${dossier.phone ? `
            <a href="tel:${dossier.phone}" class="shrink-0 flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-bold transition">
              <i data-lucide="phone-call" class="w-3.5 h-3.5"></i>
              <span>${dossier.phone}</span>
            </a>
          ` : ''}
        </div>

        <!-- Chi tiết thửa đất & Cán bộ -->
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs py-2 px-3 bg-slate-50/80 rounded-xl border border-slate-100">
          <div>
            <span class="text-slate-400 block text-[10px]">Loại hình đo:</span>
            <span class="font-medium text-slate-700">${dossier.survey_type || 'Trích lục'}</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[10px]">Diện tích / Loại đất:</span>
            <span class="font-semibold text-slate-800">${dossier.area ? `${dossier.area} m²` : '-'} (${dossier.land_type || 'ONT'})</span>
          </div>
          <div class="col-span-2 sm:col-span-1">
            <span class="text-slate-400 block text-[10px]">Cán bộ đo đạc:</span>
            <span class="font-semibold text-blue-800">${dossier.surveyor_name || 'Chưa phân công'}</span>
          </div>
        </div>

        <!-- 3 MỐC THỜI GIAN QUAN TRỌNG (NHẬN - ĐO - TRẢ) -->
        <div class="grid grid-cols-3 gap-2 text-center text-xs">
          <!-- Mốc 1: Ngày nhận -->
          <div class="p-2 bg-slate-100/80 rounded-xl border border-slate-200">
            <span class="block text-[10px] text-slate-400 font-bold uppercase">1. Ngày nhận</span>
            <span class="font-bold text-slate-800 text-xs">${formatDateVN(dossier.date_received)}</span>
          </div>

          <!-- Mốc 2: Ngày đi đo -->
          <div class="p-2 rounded-xl border ${isSurveyToday ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse' : 'bg-blue-50/80 text-blue-900 border-blue-200'}">
            <span class="block text-[10px] text-blue-600 font-bold uppercase flex items-center justify-center gap-0.5">
              ${isSurveyToday ? '<i data-lucide="bell" class="w-3 h-3 text-amber-600"></i>' : ''} 2. Ngày đi đo
            </span>
            <span class="font-bold text-xs">${formatDateVN(dossier.date_survey)}</span>
          </div>

          <!-- Mốc 3: Ngày trả -->
          <div class="p-2 rounded-xl border ${dueInfo.cls}">
            <span class="block text-[10px] font-bold uppercase">3. Hẹn trả KQ</span>
            <span class="font-bold text-xs">${formatDateVN(dossier.date_return)}</span>
          </div>
        </div>

        <!-- Cảnh báo tiến độ hạn trả -->
        <div class="flex items-center justify-between text-xs px-1">
          <span class="font-medium ${dueInfo.cls.includes('due-overdue') ? 'text-red-600 font-bold' : 'text-slate-500'} flex items-center gap-1">
            <i data-lucide="${dueInfo.cls.includes('due-overdue') ? 'alert-circle' : 'clock'}" class="w-3.5 h-3.5"></i>
            ${dueInfo.text}
          </span>
          ${dossier.notes ? `
            <span class="text-slate-400 text-[11px] truncate max-w-[180px]" title="${dossier.notes}">
              📝 ${dossier.notes}
            </span>
          ` : ''}
        </div>

        <!-- ACTION BUTTONS: 1-Touch Fast Status + More Details -->
        <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
          <!-- Nút chuyển trạng thái nhanh (1 chạm) -->
          <div>
            ${statusCfg.nextAction ? `
              <button onclick="quickUpdateStatus(${dossier.id}, '${statusCfg.nextStatus}', '${statusCfg.nextAction}')" class="bg-blue-700 hover:bg-blue-600 active:scale-95 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1">
                <span>${statusCfg.nextAction}</span>
              </button>
            ` : `
              <span class="text-xs text-emerald-700 font-bold flex items-center gap-1">
                <i data-lucide="check" class="w-3.5 h-3.5"></i> Hồ sơ hoàn tất
              </span>
            `}
          </div>

          <!-- Action icons -->
          <div class="flex items-center space-x-1.5">
            <button onclick="viewDossierDetails(${dossier.id})" class="p-2 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition" title="Xem chi tiết & Ảnh">
              <i data-lucide="eye" class="w-4 h-4"></i>
              <span class="hidden sm:inline">Chi tiết & Ảnh</span>
            </button>
            <button onclick="editDossier(${dossier.id})" class="p-2 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg text-xs font-semibold transition" title="Chỉnh sửa">
              <i data-lucide="edit" class="w-4 h-4"></i>
            </button>
            <button onclick="printSlipDirect(${dossier.id})" class="p-2 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg text-xs font-semibold transition" title="In phiếu theo dõi">
              <i data-lucide="printer" class="w-4 h-4"></i>
            </button>
            <button onclick="deleteDossierDirect(${dossier.id}, '${dossier.code}')" class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition" title="Xóa hồ sơ">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

// Filter handling
function setQuickFilter(type) {
  // Reset active classes
  document.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active-chip'));

  if (type === 'ALL') {
    currentFilter.quick_filter = 'ALL';
    currentFilter.status = 'ALL';
    const btn = document.getElementById('filterChip-ALL');
    if (btn) btn.classList.add('active-chip');
  } else if (type.startsWith('status:')) {
    const statusVal = type.replace('status:', '');
    currentFilter.status = statusVal;
    currentFilter.quick_filter = 'ALL';
    const btn = document.getElementById(`filterChip-status-${statusVal}`);
    if (btn) btn.classList.add('active-chip');
  } else {
    currentFilter.quick_filter = type;
    currentFilter.status = 'ALL';
    const btn = document.getElementById(`filterChip-${type}`);
    if (btn) btn.classList.add('active-chip');
  }

  loadDossiers();
}

function resetFilters() {
  currentFilter = {
    q: '',
    status: 'ALL',
    surveyor: '',
    commune: '',
    quick_filter: 'ALL',
    sort_by: 'id',
    order: 'DESC'
  };
  document.getElementById('searchInput').value = '';
  document.getElementById('btnClearSearch').classList.add('hidden');
  document.getElementById('filterSurveyor').value = '';
  document.getElementById('filterCommune').value = '';
  document.getElementById('sortBy').value = 'id-DESC';

  document.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active-chip'));
  document.getElementById('filterChip-ALL').classList.add('active-chip');

  loadDossiers();
}

// 1-Touch Fast Status Update
async function quickUpdateStatus(id, newStatus, actionName) {
  if (!confirm(`Xác nhận chuyển trạng thái sang: "${actionName}"?`)) return;

  try {
    const res = await fetch(`/api/dossiers/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) throw new Error('Không thể cập nhật trạng thái');

    loadDossiers();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

// Direct delete from card
async function deleteDossierDirect(id, code) {
  if (!confirm(`Bạn có chắc chắn muốn xóa hồ sơ: ${code}?`)) return;
  try {
    const res = await fetch(`/api/dossiers/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Không thể xóa hồ sơ');
    loadDossiers();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

// Clear all sample demo dossiers
async function clearSampleDossiers() {
  if (!confirm('Bạn có chắc chắn muốn xóa tất cả các hồ sơ mẫu ban đầu để bắt đầu làm việc với hồ sơ thực tế của phòng?')) return;
  try {
    const res = await fetch('/api/dossiers/clear-samples', { method: 'POST' });
    if (!res.ok) throw new Error('Không thể xóa dữ liệu mẫu');
    alert('Đã xóa toàn bộ hồ sơ mẫu thành công!');
    loadDossiers();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

// Modal Form handling
function openCreateModal() {
  document.getElementById('modalTitle').innerHTML = `
    <i data-lucide="folder-plus" class="w-5 h-5 text-yellow-300"></i>
    <span>Tiếp nhận hồ sơ đo đạc mới</span>
  `;
  document.getElementById('dossierForm').reset();
  document.getElementById('formDossierId').value = '';

  const today = new Date().toISOString().split('T')[0];
  const next7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  document.getElementById('formDateReceived').value = today;
  document.getElementById('formDateSurvey').value = today;
  document.getElementById('formDateReturn').value = next7Days;
  document.getElementById('formStatus').value = 'CHO_DO';

  openModal('dossierModal');
  if (window.lucide) lucide.createIcons();
}

async function editDossier(id) {
  try {
    const res = await fetch(`/api/dossiers/${id}`);
    if (!res.ok) throw new Error('Không thể tải thông tin hồ sơ');
    const dossier = await res.json();

    document.getElementById('modalTitle').innerHTML = `
      <i data-lucide="edit-3" class="w-5 h-5 text-yellow-300"></i>
      <span>Chỉnh sửa hồ sơ: ${dossier.code}</span>
    `;
    document.getElementById('formDossierId').value = dossier.id;
    document.getElementById('formCode').value = dossier.code;
    document.getElementById('formCustomerName').value = dossier.customer_name;
    document.getElementById('formPhone').value = dossier.phone || '';
    document.getElementById('formCommune').value = dossier.commune || '';
    document.getElementById('formVillage').value = dossier.village || '';
    document.getElementById('formSheetNumber').value = dossier.sheet_number || '';
    document.getElementById('formPlotNumber').value = dossier.plot_number || '';
    document.getElementById('formArea').value = dossier.area || '';
    document.getElementById('formLandType').value = dossier.land_type || 'ONT';
    document.getElementById('formSurveyType').value = dossier.survey_type || 'Trích lục địa chính';
    document.getElementById('formSurveyorName').value = dossier.surveyor_name || '';
    document.getElementById('formDateReceived').value = dossier.date_received || '';
    document.getElementById('formDateSurvey').value = dossier.date_survey || '';
    document.getElementById('formDateReturn').value = dossier.date_return || '';
    document.getElementById('formStatus').value = dossier.status;
    document.getElementById('formNotes').value = dossier.notes || '';

    closeModal('detailModal');
    openModal('dossierModal');
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

async function submitDossierForm() {
  const form = document.getElementById('dossierForm');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const id = document.getElementById('formDossierId').value;
  const payload = {
    code: document.getElementById('formCode').value,
    customer_name: document.getElementById('formCustomerName').value,
    phone: document.getElementById('formPhone').value,
    commune: document.getElementById('formCommune').value,
    village: document.getElementById('formVillage').value,
    sheet_number: document.getElementById('formSheetNumber').value,
    plot_number: document.getElementById('formPlotNumber').value,
    area: document.getElementById('formArea').value,
    land_type: document.getElementById('formLandType').value,
    survey_type: document.getElementById('formSurveyType').value,
    surveyor_name: document.getElementById('formSurveyorName').value,
    date_received: document.getElementById('formDateReceived').value,
    date_survey: document.getElementById('formDateSurvey').value,
    date_return: document.getElementById('formDateReturn').value,
    status: document.getElementById('formStatus').value,
    notes: document.getElementById('formNotes').value
  };

  try {
    const url = id ? `/api/dossiers/${id}` : '/api/dossiers';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Có lỗi xảy ra');
    }

    alert(id ? 'Đã cập nhật hồ sơ thành công!' : 'Đã tiếp nhận hồ sơ mới thành công!');
    closeModal('dossierModal');
    loadDossiers();
  } catch (err) {
    alert('Lỗi lưu hồ sơ: ' + err.message);
  }
}

// View dossier details & field photos
async function viewDossierDetails(id) {
  try {
    const res = await fetch(`/api/dossiers/${id}`);
    if (!res.ok) throw new Error('Không thể tải chi tiết');
    selectedDossier = await res.json();

    const d = selectedDossier;
    document.getElementById('detailBadgeCode').textContent = d.code;
    document.getElementById('detailTitle').textContent = d.customer_name;
    document.getElementById('detailCustomerName').textContent = d.customer_name;

    if (d.phone) {
      document.getElementById('detailPhoneContainer').innerHTML = `
        <a href="tel:${d.phone}" class="flex items-center gap-1 hover:underline">
          <i data-lucide="phone" class="w-4 h-4"></i> ${d.phone}
        </a>
      `;
    } else {
      document.getElementById('detailPhoneContainer').textContent = 'Chưa có SĐT';
    }

    document.getElementById('detailAddress').textContent = [d.village, d.commune].filter(Boolean).join(', ') || 'Chưa cập nhật';
    document.getElementById('detailPlotSheet').textContent = `Tờ: ${d.sheet_number || '-'} / Thửa: ${d.plot_number || '-'}`;
    document.getElementById('detailAreaType').textContent = `${d.area ? `${d.area} m²` : '-'} (${d.land_type || 'ONT'}) - ${d.survey_type}`;
    document.getElementById('detailSurveyor').textContent = d.surveyor_name || 'Chưa phân công';
    document.getElementById('detailNotes').textContent = d.notes || 'Không có ghi chú thêm.';

    document.getElementById('detailDateReceived').textContent = formatDateVN(d.date_received);
    document.getElementById('detailDateSurvey').textContent = formatDateVN(d.date_survey);
    document.getElementById('detailDateReturn').textContent = formatDateVN(d.date_return);

    const statusCfg = statusDisplay[d.status] || { label: d.status, badgeCls: 'bg-slate-100 text-slate-700' };
    document.getElementById('detailStatusBadge').textContent = statusCfg.label;
    document.getElementById('detailStatusBadge').className = `text-xs font-bold px-3 py-1 rounded-full ${statusCfg.badgeCls}`;

    // Action buttons in modal
    document.getElementById('btnEditDossier').onclick = () => editDossier(d.id);
    document.getElementById('btnPrintSlip').onclick = () => printSlipDirect(d.id);
    document.getElementById('btnDeleteDossier').onclick = () => deleteDossier(d.id);

    // Render attachments
    renderAttachments(d.attachments || []);

    openModal('detailModal');
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

function renderAttachments(attachments) {
  document.getElementById('attachmentCount').textContent = attachments.length;
  const gallery = document.getElementById('attachmentsGallery');

  if (!attachments || attachments.length === 0) {
    gallery.innerHTML = `
      <div class="col-span-full py-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
        <i data-lucide="image-off" class="w-8 h-8 mx-auto mb-1 opacity-50"></i>
        <p class="text-xs">Chưa có ảnh hiện trường hoặc biên bản nào.</p>
        <p class="text-[11px] text-slate-400">Bấm nút "Chụp / Tải ảnh" ở trên để chụp từ điện thoại.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  gallery.innerHTML = attachments.map(item => {
    const isImage = item.mimetype && item.mimetype.startsWith('image/');
    return `
      <div class="relative group bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
        ${isImage ? `
          <a href="/uploads/${item.filename}" target="_blank" class="block aspect-video bg-slate-200 overflow-hidden">
            <img src="/uploads/${item.filename}" alt="${item.original_name}" class="w-full h-full object-cover group-hover:scale-105 transition">
          </a>
        ` : `
          <a href="/uploads/${item.filename}" target="_blank" class="flex flex-col items-center justify-center aspect-video p-3 bg-blue-50 text-blue-700">
            <i data-lucide="file-text" class="w-8 h-8"></i>
            <span class="text-[10px] mt-1 truncate max-w-full font-medium">${item.original_name}</span>
          </a>
        `}
        <div class="p-2 text-xs flex items-center justify-between bg-white border-t border-slate-200">
          <span class="truncate text-[11px] text-slate-600">${item.original_name}</span>
          <button onclick="deleteAttachment(${item.id})" class="text-red-500 hover:text-red-700 p-1" title="Xóa file">
            <i data-lucide="trash" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Upload attachments (Supports Camera photo on mobile)
async function uploadAttachments(input) {
  if (!selectedDossier || !input.files || input.files.length === 0) return;

  const formData = new FormData();
  for (let i = 0; i < input.files.length; i++) {
    formData.append('files', input.files[i]);
  }
  formData.append('attachment_type', 'photo_field');

  try {
    const res = await fetch(`/api/dossiers/${selectedDossier.id}/attachments`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error('Không thể tải file lên');

    // Refresh detail modal
    viewDossierDetails(selectedDossier.id);
    loadDossiers(); // refresh counts
  } catch (err) {
    alert('Lỗi tải ảnh: ' + err.message);
  } finally {
    input.value = '';
  }
}

// Delete attachment
async function deleteAttachment(attachmentId) {
  if (!confirm('Bạn có chắc muốn xóa ảnh/tệp này?')) return;
  try {
    const res = await fetch(`/api/attachments/${attachmentId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Không thể xóa');
    if (selectedDossier) viewDossierDetails(selectedDossier.id);
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

// Delete dossier
async function deleteDossier(id) {
  if (!confirm('CẢNH BÁO: Bạn có chắc chắn muốn xóa toàn bộ hồ sơ này cùng các ảnh đính kèm?')) return;
  try {
    const res = await fetch(`/api/dossiers/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Không thể xóa hồ sơ');

    closeModal('detailModal');
    loadDossiers();
  } catch (err) {
    alert('Lỗi xóa hồ sơ: ' + err.message);
  }
}

// Print Slip (Phiếu kiểm soát và theo dõi hồ sơ đo đạc địa chính)
async function printSlipDirect(id) {
  try {
    const res = await fetch(`/api/dossiers/${id}`);
    if (!res.ok) throw new Error('Không thể tải dữ liệu để in');
    const d = await res.json();

    const printArea = document.getElementById('printArea');
    const statusCfg = statusDisplay[d.status] || { label: d.status };

    printArea.innerHTML = `
      <div style="font-family: 'Times New Roman', serif; line-height: 1.5; color: #000;">
        <table style="width: 100%; border: none; margin-bottom: 20px;">
          <tr>
            <td style="text-align: center; width: 45%; vertical-align: top;">
              <span style="font-size: 13pt; font-weight: bold;">VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI</span><br>
              <span style="font-size: 13pt; font-weight: bold; text-decoration: underline;">PHÒNG KỸ THUẬT ĐỊA CHÍNH</span><br>
              <span style="font-size: 11pt; font-style: italic;">Mã số HS: ${d.code}</span>
            </td>
            <td style="text-align: center; width: 55%; vertical-align: top;">
              <span style="font-size: 12pt; font-weight: bold;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</span><br>
              <span style="font-size: 13pt; font-weight: bold; text-decoration: underline;">Độc lập - Tự do - Hạnh phúc</span><br>
              <span style="font-size: 11pt; font-style: italic; display: block; margin-top: 5px;">..., ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</span>
            </td>
          </tr>
        </table>

        <div style="text-align: center; margin: 25px 0 15px 0;">
          <h2 style="font-size: 16pt; font-weight: bold; margin: 0; text-transform: uppercase;">PHIẾU KIỂM SOÁT VÀ THEO DÕI HỒ SƠ ĐO ĐẠC</h2>
          <span style="font-size: 11pt; font-style: italic;">(Kẹp theo hồ sơ kỹ thuật thửa đất lưu kho / nội nghiệp)</span>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;" border="1">
          <tr>
            <td style="padding: 8px; width: 30%; font-weight: bold; background: #f3f4f6;">Chủ sử dụng đất:</td>
            <td style="padding: 8px; font-weight: bold; font-size: 13pt;">${d.customer_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; background: #f3f4f6;">Số điện thoại:</td>
            <td style="padding: 8px;">${d.phone || 'Chưa cung cấp'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; background: #f3f4f6;">Địa chỉ thửa đất:</td>
            <td style="padding: 8px;">${[d.village, d.commune].filter(Boolean).join(', ')}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; background: #f3f4f6;">Thông tin địa chính:</td>
            <td style="padding: 8px;">
              Tờ bản đồ số: <strong>${d.sheet_number || '...'}</strong>; 
              Thửa đất số: <strong>${d.plot_number || '...'}</strong>; 
              Diện tích: <strong>${d.area || '...'} m²</strong>; 
              Mục đích SDĐ: <strong>${d.land_type || 'ONT'}</strong>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; background: #f3f4f6;">Yêu cầu đo đạc:</td>
            <td style="padding: 8px; font-weight: bold;">${d.survey_type}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; background: #f3f4f6;">Cán bộ thực hiện đo:</td>
            <td style="padding: 8px;"><strong>${d.surveyor_name || '...'}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; background: #f3f4f6;">Tiến độ & 3 mốc thời gian:</td>
            <td style="padding: 8px;">
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>1. Ngày tiếp nhận hồ sơ:</strong> ${formatDateVN(d.date_received)}</li>
                <li><strong>2. Ngày đi đo thực địa:</strong> ${formatDateVN(d.date_survey)} ${d.date_actual_survey ? `(Đã đo ngày: ${formatDateVN(d.date_actual_survey)})` : ''}</li>
                <li><strong>3. Ngày hẹn trả kết quả:</strong> ${formatDateVN(d.date_return)} ${d.date_actual_return ? `(Đã trả ngày: ${formatDateVN(d.date_actual_return)})` : ''}</li>
              </ul>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; background: #f3f4f6;">Trạng thái hiện tại:</td>
            <td style="padding: 8px;"><strong>${statusCfg.label}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; background: #f3f4f6;">Ghi chú ranh mốc / Biên bản:</td>
            <td style="padding: 8px; min-height: 40px;">${d.notes || 'Ranh mốc rõ ràng, không có tranh chấp giáp ranh.'}</td>
          </tr>
        </table>

        <table style="width: 100%; border: none; margin-top: 40px; text-align: center;">
          <tr>
            <td style="width: 33%; vertical-align: top;">
              <span style="font-weight: bold;">NGƯỜI NỘP HỒ SƠ</span><br>
              <span style="font-style: italic; font-size: 10pt;">(Ký, ghi rõ họ tên)</span>
              <div style="height: 60px;"></div>
              <strong>${d.customer_name}</strong>
            </td>
            <td style="width: 33%; vertical-align: top;">
              <span style="font-weight: bold;">CÁN BỘ ĐO ĐẠC</span><br>
              <span style="font-style: italic; font-size: 10pt;">(Ký, ghi rõ họ tên)</span>
              <div style="height: 60px;"></div>
              <strong>${d.surveyor_name || '...'}</strong>
            </td>
            <td style="width: 34%; vertical-align: top;">
              <span style="font-weight: bold;">LÃNH ĐẠO PHÒNG KỸ THUẬT</span><br>
              <span style="font-style: italic; font-size: 10pt;">(Ký, ghi rõ họ tên)</span>
              <div style="height: 60px;"></div>
            </td>
          </tr>
        </table>
      </div>
    `;

    window.print();
  } catch (err) {
    alert('Lỗi in phiếu: ' + err.message);
  }
}

// Mobile QR Code Modal
async function openQrModal() {
  try {
    const currentOrigin = window.location.origin;
    const res = await fetch(`/api/network-info?url=${encodeURIComponent(currentOrigin)}`);
    if (!res.ok) throw new Error('Không thể lấy thông tin mạng');
    const info = await res.json();

    const displayUrl = currentOrigin.includes('localhost') ? (info.mobileUrl || currentOrigin) : currentOrigin;

    document.getElementById('qrImage').src = info.qrDataUrl;
    document.getElementById('qrUrlText').textContent = displayUrl;

    openModal('qrModal');
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

// Modal generic helpers
function openModal(modalId) {
  const el = document.getElementById(modalId);
  el.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  el.classList.add('hidden');
  document.body.style.overflow = 'auto';
}
