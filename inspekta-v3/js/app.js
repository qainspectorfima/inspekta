import { login, logout, getSession } from './auth.js';

let currentUser = null;

function showToast(msg, type = 'info') {
  let box = document.getElementById('toastContainer');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toastContainer';
    document.body.appendChild(box);
  }
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function showApp(profile) {
  document.getElementById('loginPage').style.display = 'none';
  const main = document.getElementById('mainApp');
  main.style.display = 'flex';
  document.getElementById('userBadge').textContent =
    (profile?.nama || '-') + ' · ' + (profile?.role || '-');
  showPage('dashboard');
}

function showLogin() {
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('loginPage').style.display = 'flex';
}

window.showPage = function (pageId) {
  document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');

  document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
  const menu = document.querySelector(`.menu-item[data-page="${pageId}"]`);
  if (menu) menu.classList.add('active');

  const titles = {
    dashboard: 'Dashboard',
    master: 'Master Data',
    ipc: 'IPC Filling & Kemas',
    lpf: 'LPF & Verifikasi',
    capa: 'Root Cause & CAPA'
  };
  const t = document.getElementById('pageTitle');
  if (t) t.textContent = titles[pageId] || pageId;
};

window.toggleSidebar = function () {
  document.getElementById('sidebar')?.classList.toggle('mini');
};

window.logout = async function () {
  await logout();
  currentUser = null;
  showLogin();
};

// Init
(async function init() {
  // Pastikan state awal: hanya login
  showLogin();

  const session = await getSession();
  if (session) {
    currentUser = session;
    showApp(session.profile);
  }

  const btnLogin = document.getElementById('btnLogin');
  if (btnLogin) {
    btnLogin.onclick = async () => {
      const email = document.getElementById('loginEmail')?.value.trim()
        || document.getElementById('loginUser')?.value.trim();
      const pass = document.getElementById('loginPass')?.value;
      const err = document.getElementById('loginError');
      if (err) err.style.display = 'none';
      try {
        btnLogin.disabled = true;
        btnLogin.textContent = 'Memeriksa...';
        const res = await login(email, pass);
        currentUser = res;
        showApp(res.profile);
        showToast('Login berhasil', 'success');
      } catch (e) {
        if (err) {
          err.textContent = e.message || 'Login gagal';
          err.style.display = 'block';
        } else {
          showToast(e.message || 'Login gagal', 'error');
        }
      } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = 'Masuk';
      }
    };
  }
})();

// ===== FALLBACK Master tab (supaya tombol pasti bisa diklik) =====
window.switchMasterTab = window.switchMasterTab || function (tab) {
  const ppi = document.getElementById('master-masterppi');
  const batch = document.getElementById('master-batch');
  const tabPpi = document.getElementById('tabMasterPPI');
  const tabBatch = document.getElementById('tabBatch');

  if (!ppi || !batch) {
    alert('Elemen #master-masterppi atau #master-batch tidak ada di HTML');
    return;
  }

  if (tab === 'batch') {
    ppi.style.display = 'none';
    batch.style.display = 'block';
    if (tabPpi) tabPpi.className = 'btn btn-outline';
    if (tabBatch) tabBatch.className = 'btn btn-primary';
  } else {
    ppi.style.display = 'block';
    batch.style.display = 'none';
    if (tabPpi) tabPpi.className = 'btn btn-primary';
    if (tabBatch) tabBatch.className = 'btn btn-outline';
  }
};

window.hitungAnsiMasterPPI = window.hitungAnsiMasterPPI || function () {
  alert('Fungsi Hitung ANSI belum ter-load. Pastikan master-ui.js termuat.');
};

window.submitMasterPPI = window.submitMasterPPI || function () {
  alert('Fungsi Simpan belum ter-load. Pastikan master-ui.js termuat tanpa error.');
};

window.submitBatchRecord = window.submitBatchRecord || function () {
  alert('Fungsi Simpan Batch belum ter-load.');
};

console.log('[app] fallback master functions ready');