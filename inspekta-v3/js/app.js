import { login, logout as doLogout, getSession } from './auth.js';
import { getProducts, createProduct } from './products.js';
import { getPpiDocuments, savePpiDocument, getPpiAktifByProduct } from './ppi.js';
import { getBatches, createBatch } from './batch.js';
import {
  getBatchFullByBN,
  getLotsDone,
  saveIpcFilling,
  saveIpcKemas,
  updateAnsiAfterIpc,
  updateBatchStatus,
  getAnsiStatus
} from './ipc.js';
import { getLpfList, createLpf, verifyLpf } from './lpf.js';
import { getCapaList, createCapa, updateCapaStatus } from './capa.js';
import { getProfiles, updateRole } from './akun.js';

let currentUser = null;
let _selectedProduct = null;
let _ipcBatch = null;

// ===================== HELPERS =====================
function toast(msg, type = 'info') {
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
  setTimeout(() => el.remove(), 3200);
}

const ANSI_JUMLAH = {
  A: 2, B: 3, C: 5, D: 8, E: 13, F: 20, G: 32, H: 50, J: 80,
  K: 125, L: 200, M: 315, N: 500, P: 800, Q: 1250, R: 2000
};
const RENTANG = [
  [2, 8, 'A', 'A', 'B'], [9, 15, 'A', 'B', 'C'], [16, 25, 'B', 'C', 'D'],
  [26, 50, 'C', 'D', 'E'], [51, 90, 'C', 'E', 'F'], [91, 150, 'D', 'F', 'G'],
  [151, 280, 'E', 'G', 'H'], [281, 500, 'F', 'H', 'J'], [501, 1200, 'G', 'J', 'K'],
  [1201, 3200, 'H', 'K', 'L'], [3201, 10000, 'J', 'L', 'M'],
  [10001, 35000, 'K', 'M', 'N'], [35001, 150000, 'L', 'N', 'P'],
  [150001, 500000, 'M', 'P', 'Q'], [500001, Infinity, 'N', 'Q', 'R']
];

function tentukanKode(bs, level) {
  const col = level === 'I' ? 2 : level === 'III' ? 4 : 3;
  for (const r of RENTANG) {
    if (bs >= r[0] && bs <= r[1]) return r[col];
  }
  return null;
}

function hitungAnsiPerLot(batchSize, jumlahLot = 1) {
  const bs = parseInt(batchSize);
  const jl = Math.max(1, parseInt(jumlahLot) || 1);
  if (!bs) throw new Error('Batch size tidak valid');
  const k1 = tentukanKode(bs, 'I');
  const k2 = tentukanKode(bs, 'II');
  const k3 = tentukanKode(bs, 'III');
  if (!k1 || !k2 || !k3) throw new Error('Batch size di luar rentang ANSI');
  return {
    ansi1: Math.ceil(ANSI_JUMLAH[k1] / jl),
    ansi2: Math.ceil(ANSI_JUMLAH[k2] / jl),
    ansi3: Math.ceil(ANSI_JUMLAH[k3] / jl)
  };
}

// ===================== AUTH UI =====================
function showLogin() {
  const loginPage = document.getElementById('loginPage');
  const mainApp = document.getElementById('mainApp');
  if (loginPage) loginPage.style.display = 'flex';
  if (mainApp) mainApp.style.display = 'none';
}

function showApp(profile) {
  const loginPage = document.getElementById('loginPage');
  const mainApp = document.getElementById('mainApp');
  if (loginPage) loginPage.style.display = 'none';
  if (mainApp) mainApp.style.display = 'flex';
  const badge = document.getElementById('userBadge');
  if (badge) badge.textContent = (profile?.nama || '-') + ' · ' + (profile?.role || '-');
  showPage('dashboard');
}

window.showPage = function (pageId) {
  document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');

  document.querySelectorAll('.menu-item[data-page]').forEach(el => el.classList.remove('active'));
  const menu = document.querySelector(`.menu-item[data-page="${pageId}"]`);
  if (menu) menu.classList.add('active');

  const titles = {
    dashboard: 'Dashboard',
    master: 'Master Data',
    ipc: 'IPC Filling & Kemas',
    lpf: 'LPF & Verifikasi',
    capa: 'Root Cause & CAPA',
    akun: 'Manajemen Akun'
  };
  const t = document.getElementById('pageTitle');
  if (t) t.textContent = titles[pageId] || pageId;

  if (pageId === 'master') switchMasterTab('masterppi');
  if (pageId === 'ipc') switchIpcTab('filling');
  if (pageId === 'lpf') loadLpfList();
  if (pageId === 'capa') loadCapaList();
  if (pageId === 'akun') loadAkunList();
};

window.toggleSidebar = function () {
  document.getElementById('sidebar')?.classList.toggle('mini');
};

window.logout = async function () {
  await doLogout();
  currentUser = null;
  showLogin();
};

// ===================== MASTER =====================
window.switchMasterTab = function (tab) {
  const ppi = document.getElementById('master-masterppi');
  const batch = document.getElementById('master-batch');
  const tabPpi = document.getElementById('tabMasterPPI');
  const tabBatch = document.getElementById('tabBatch');
  if (!ppi || !batch) return;

  if (tab === 'batch') {
    ppi.style.display = 'none';
    batch.style.display = 'block';
    if (tabPpi) tabPpi.className = 'btn btn-outline';
    if (tabBatch) tabBatch.className = 'btn btn-primary';
    loadProductDropdown();
    loadBatchList();
  } else {
    ppi.style.display = 'block';
    batch.style.display = 'none';
    if (tabPpi) tabPpi.className = 'btn btn-primary';
    if (tabBatch) tabBatch.className = 'btn btn-outline';
    loadMasterPPIList();
  }
};

window.hitungAnsiMasterPPI = function () {
  try {
    const bs = document.getElementById('mpBatchSize')?.value;
    const jl = document.getElementById('mpJumlahLot')?.value || 1;
    const res = hitungAnsiPerLot(bs, jl);
    document.getElementById('mpAnsi1').value = res.ansi1;
    document.getElementById('mpAnsi2').value = res.ansi2;
    document.getElementById('mpAnsi3').value = res.ansi3;
    const box = document.getElementById('mpAnsiBox');
    if (box) {
      box.style.display = 'block';
      box.innerHTML = `<b>ANSI per lot:</b> I=<b>${res.ansi1}</b> · II=<b>${res.ansi2}</b> · III=<b>${res.ansi3}</b>`;
    }
  } catch (e) {
    toast(e.message || 'Gagal hitung ANSI', 'error');
  }
};

window.submitMasterPPI = async function () {
  const btn = document.getElementById('btnSimpanMasterPPI');
  try {
    const kode = document.getElementById('mpKode')?.value.trim();
    const nama = document.getElementById('mpNama')?.value.trim();
    const line = document.getElementById('mpLine')?.value.trim() || '';
    const jenisRaw = document.getElementById('mpJenis')?.value || 'FILLING';
    const jenis = jenisRaw.toUpperCase().includes('KEMAS') ? 'KEMAS' : 'FILLING';
    const batchSize = document.getElementById('mpBatchSize')?.value;
    const jumlahLot = document.getElementById('mpJumlahLot')?.value || 1;
    const noDokumen = document.getElementById('mpNoDokumen')?.value.trim();
    const berlaku = document.getElementById('mpBerlakuTanggal')?.value;

    if (!kode || !nama || !noDokumen) { toast('Kode, Nama, No Dokumen wajib', 'error'); return; }
    if (!batchSize) { toast('Batch Size wajib', 'error'); return; }

    let a1 = document.getElementById('mpAnsi1')?.value;
    let a2 = document.getElementById('mpAnsi2')?.value;
    let a3 = document.getElementById('mpAnsi3')?.value;
    if (!a1 || !a2 || !a3) {
      const h = hitungAnsiPerLot(batchSize, jumlahLot);
      a1 = h.ansi1; a2 = h.ansi2; a3 = h.ansi3;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }

    const session = await getSession();
    const createdBy = session?.profile?.nama || session?.user?.email || '';

    const products = await getProducts();
    let product = products.find(p =>
      (p.kode_produk || '').toUpperCase() === kode.toUpperCase() &&
      (p.line || '').toUpperCase() === line.toUpperCase()
    );

    if (!product) {
      product = await createProduct({
        kode_produk: kode, nama_produk: nama, line,
        batch_size: batchSize, jumlah_lot: jumlahLot,
        ansi_1: a1, ansi_2: a2, ansi_3: a3, created_by: createdBy
      });
    }

    await savePpiDocument({
      product_id: product.id, jenis, no_dokumen: noDokumen,
      berlaku_tanggal: berlaku || null, created_by: createdBy
    });

    toast('✅ Master PPI tersimpan', 'success');
    ['mpKode', 'mpNama', 'mpLine', 'mpBatchSize', 'mpNoDokumen', 'mpBerlakuTanggal', 'mpAnsi1', 'mpAnsi2', 'mpAnsi3']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const jl = document.getElementById('mpJumlahLot'); if (jl) jl.value = 1;
    const box = document.getElementById('mpAnsiBox'); if (box) box.style.display = 'none';
    loadMasterPPIList();
  } catch (e) {
    console.error(e);
    toast(e.message || 'Gagal simpan', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Simpan Master PPI'; }
  }
};

async function loadMasterPPIList() {
  const tbody = document.getElementById('bodyMasterPPI');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:12px;">Memuat...</td></tr>';
  try {
    const filter = document.getElementById('filterStatusPPI')?.value || '';
    const list = await getPpiDocuments(filter || null);
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:16px;color:#999;">Belum ada data</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(p => {
      const prod = p.products || {};
      const warna = { AKTIF: '#2E7D32', WIP: '#EF6C00', OBSOLETE: '#999' }[p.status_versi] || '#666';
      return `<tr>
        <td style="padding:8px;font-weight:700;">${prod.kode_produk || '-'}</td>
        <td style="padding:8px;">${prod.nama_produk || '-'}</td>
        <td style="padding:8px;">${prod.line || '-'}</td>
        <td style="padding:8px;">${p.jenis || '-'}</td>
        <td style="padding:8px;">${p.no_dokumen || '-'}</td>
        <td style="padding:8px;">${prod.ansi_1 || '-'}/${prod.ansi_2 || '-'}/${prod.ansi_3 || '-'}</td>
        <td style="padding:8px;"><span style="color:${warna};font-weight:700;">${p.status_versi}</span></td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#D32F2F;">${e.message}</td></tr>`;
  }
}
window.loadMasterPPI = loadMasterPPIList;

async function loadProductDropdown() {
  const sel = document.getElementById('brProduct');
  if (!sel) return;
  try {
    const products = await getProducts();
    window._productList = products;
    sel.innerHTML = '<option value="">-- Pilih Produk --</option>' +
      products.map(p => `<option value="${p.id}">${p.kode_produk} | ${p.line} | ${p.nama_produk}</option>`).join('');
  } catch (e) {
    toast('Gagal muat produk: ' + e.message, 'error');
  }
}

window.onProductSelected = async function () {
  const id = document.getElementById('brProduct')?.value;
  const info = document.getElementById('brInfoProduk');
  if (!id) {
    _selectedProduct = null;
    if (info) info.style.display = 'none';
    return;
  }
  const products = window._productList || await getProducts();
  _selectedProduct = products.find(p => p.id === id);
  if (!_selectedProduct || !info) return;

  let ppiF = null, ppiK = null;
  try {
    ppiF = await getPpiAktifByProduct(id, 'FILLING');
    ppiK = await getPpiAktifByProduct(id, 'KEMAS');
  } catch (_) {}
  _selectedProduct._ppiF = ppiF;
  _selectedProduct._ppiK = ppiK;

  info.style.display = 'block';
  info.innerHTML = `
    <b>${_selectedProduct.kode_produk}</b> — ${_selectedProduct.nama_produk}<br>
    Line: <b>${_selectedProduct.line || '-'}</b> · Batch Size: <b>${_selectedProduct.batch_size || '-'}</b><br>
    ANSI: ${_selectedProduct.ansi_1 || '-'}/${_selectedProduct.ansi_2 || '-'}/${_selectedProduct.ansi_3 || '-'}<br>
    PPI Filling AKTIF: <b>${ppiF?.no_dokumen || '— belum ada —'}</b><br>
    PPI Kemas AKTIF: <b>${ppiK?.no_dokumen || '— belum ada —'}</b>`;
};

window.submitBatchRecord = async function () {
  const btn = document.getElementById('btnSimpanBatch');
  try {
    if (!_selectedProduct) { toast('Pilih produk dulu', 'error'); return; }
    const noBN = document.getElementById('brNoBN')?.value.trim();
    if (!noBN) { toast('No BN wajib', 'error'); return; }

    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
    const session = await getSession();

    await createBatch({
      no_bn: noBN,
      product_id: _selectedProduct.id,
      ppi_filling_id: _selectedProduct._ppiF?.id || null,
      ppi_kemas_id: _selectedProduct._ppiK?.id || null,
      md: document.getElementById('brMD')?.value.trim() || '',
      ed: document.getElementById('brED')?.value.trim() || '',
      het_rp: document.getElementById('brHetRp')?.value.trim() || '',
      max_lot: document.getElementById('brMaxLot')?.value.trim() || '',
      created_by: session?.profile?.nama || session?.user?.email || ''
    });

    toast('✅ Batch Record tersimpan', 'success');
    ['brNoBN', 'brMD', 'brED', 'brHetRp', 'brMaxLot'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const sel = document.getElementById('brProduct'); if (sel) sel.value = '';
    const info = document.getElementById('brInfoProduk'); if (info) info.style.display = 'none';
    _selectedProduct = null;
    loadBatchList();
  } catch (e) {
    console.error(e);
    toast(e.message || 'Gagal simpan batch', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Simpan Batch Record'; }
  }
};

async function loadBatchList() {
  const tbody = document.getElementById('bodyBatchRecord');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:12px;">Memuat...</td></tr>';
  try {
    const list = await getBatches();
    const products = window._productList || await getProducts();
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:16px;color:#999;">Belum ada data</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(b => {
      const prod = products.find(p => p.id === b.product_id) || {};
      return `<tr>
        <td style="padding:8px;font-weight:700;">${b.no_bn}</td>
        <td style="padding:8px;">${prod.kode_produk || '-'}<br><span style="font-size:11px;color:#888;">${prod.nama_produk || ''}</span></td>
        <td style="padding:8px;">${prod.line || '-'}</td>
        <td style="padding:8px;">${b.status || '-'}</td>
        <td style="padding:8px;">${b.created_by || '-'}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#D32F2F;">${e.message}</td></tr>`;
  }
}

// ===================== IPC =====================
window.switchIpcTab = function (tab) {
  const f = document.getElementById('ipc-filling');
  const k = document.getElementById('ipc-kemas');
  const tabF = document.getElementById('tabFilling');
  const tabK = document.getElementById('tabKemas');
  if (!f || !k) return;
  if (tab === 'kemas') {
    f.style.display = 'none'; k.style.display = 'block';
    if (tabF) tabF.className = 'btn btn-outline';
    if (tabK) tabK.className = 'btn btn-primary';
  } else {
    f.style.display = 'block'; k.style.display = 'none';
    if (tabF) tabF.className = 'btn btn-primary';
    if (tabK) tabK.className = 'btn btn-outline';
  }
};

window.cariBatchIpc = async function (jenis) {
  const isKemas = jenis === 'KEMAS';
  const noBN = document.getElementById(isKemas ? 'kNoBN' : 'fNoBN')?.value.trim();
  const infoEl = document.getElementById(isKemas ? 'kInfoBatch' : 'fInfoBatch');
  if (!noBN) { toast('Isi No BN dulu', 'error'); return; }
  try {
    const batch = await getBatchFullByBN(noBN);
    if (!batch) {
      toast('No BN tidak ditemukan', 'error');
      if (infoEl) infoEl.style.display = 'none';
      _ipcBatch = null;
      return;
    }
    _ipcBatch = batch;
    const p = batch.product || {};
    let lotsDone = [];
    try { lotsDone = await getLotsDone(batch.id, jenis); } catch (_) {}

    let ansiInfo = '';
    try {
      const st = await getAnsiStatus(batch.product_id);
      if (st) {
        ansiInfo = `<div>ANSI Aktif: <b>Level ${st.ansi_aktif}</b> (bersih:${st.clean_streak} / masalah:${st.problem_streak})</div>`;
      }
    } catch (_) {}

    const maxLot = (batch.max_lot || 'A').toUpperCase();
    const alfabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const idx = Math.max(0, alfabet.indexOf(maxLot));
    const allLots = alfabet.slice(0, idx + 1).split('');

    let lotHtml = '<div style="margin-top:8px;font-size:12px;font-weight:700;">Status Lot:</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">';
    allLots.forEach(l => {
      const done = lotsDone.includes(l);
      lotHtml += `<span style="display:inline-block;min-width:32px;text-align:center;padding:5px 8px;border-radius:6px;font-weight:700;font-size:13px;background:${done ? '#E8F5E9' : '#F5F5F5'};color:${done ? '#2E7D32' : '#999'};border:1.5px solid ${done ? '#A5D6A7' : '#E0E0E0'};">${l}${done ? ' ✓' : ''}</span>`;
    });
    lotHtml += '</div>';

    infoEl.style.display = 'block';
    infoEl.innerHTML = `
      <div style="margin-bottom:8px;"><b style="font-size:15px;">${batch.no_bn}</b> — ${p.kode_produk || '-'}
        <span style="color:#666;">(${p.nama_produk || ''})</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;">
        <div>Line: <b>${p.line || '-'}</b></div>
        <div>Batch Size: <b>${p.batch_size || '-'}</b></div>
        <div>MD: <b>${batch.md || '-'}</b></div>
        <div>ED: <b>${batch.ed || '-'}</b></div>
        <div>HET/RP: <b>${batch.het_rp || '-'}</b></div>
        <div>Max Lot: <b>${batch.max_lot || '-'}</b></div>
        <div>ANSI Ref: <b>${p.ansi_1 || '-'}/${p.ansi_2 || '-'}/${p.ansi_3 || '-'}</b></div>
        <div>Status: <b>${batch.status || '-'}</b></div>
      </div>${ansiInfo}${lotHtml}`;

    const sampel = p.ansi_2 || p.ansi_1 || '';
    if (isKemas) {
      const el = document.getElementById('kJmlSampel'); if (el) el.value = sampel;
    } else {
      const el = document.getElementById('fJmlSampel'); if (el) el.value = sampel;
    }
    toast('Batch ditemukan', 'success');
  } catch (e) {
    console.error(e);
    toast(e.message || 'Gagal cari batch', 'error');
  }
};

window.submitIpcFilling = async function () {
  const btn = document.getElementById('btnSimpanFilling');
  try {
    if (!_ipcBatch) { toast('Cari No BN dulu', 'error'); return; }
    const lot = document.getElementById('fLot')?.value.trim().toUpperCase();
    if (!lot) { toast('Lot wajib', 'error'); return; }
    const hasil = document.getElementById('fHasil')?.value || 'OK';
    if (hasil === 'NOK' && !document.getElementById('fCatatan')?.value.trim()) {
      toast('Isi catatan masalah', 'error'); return;
    }
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
    const session = await getSession();
    await saveIpcFilling({
      batch_id: _ipcBatch.id, lot,
      jml_sampel: parseInt(document.getElementById('fJmlSampel')?.value) || null,
      level_ansi: 2,
      flexi_bag: document.getElementById('fFlexiBag')?.value,
      port: document.getElementById('fPort')?.value,
      cap: document.getElementById('fCap')?.value,
      printing: document.getElementById('fPrinting')?.value,
      hasil,
      catatan: document.getElementById('fCatatan')?.value.trim() || '',
      pic: session?.profile?.nama || session?.user?.email || ''
    });
    if (_ipcBatch.product_id) {
      await updateAnsiAfterIpc(_ipcBatch.product_id, hasil, _ipcBatch.no_bn);
    }
    await updateBatchStatus(_ipcBatch.id, hasil === 'NOK' ? 'ADA_MASALAH' : 'IPC_RUNNING');
    toast('✅ IPC Filling tersimpan', 'success');
    document.getElementById('fLot').value = '';
    document.getElementById('fCatatan').value = '';
    document.getElementById('fHasil').value = 'OK';
    document.getElementById('fCatatanGroup').style.display = 'none';
    cariBatchIpc('FILLING');
  } catch (e) {
    console.error(e);
    toast(e.message || 'Gagal simpan IPC', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Simpan IPC Filling'; }
  }
};

window.submitIpcKemas = async function () {
  const btn = document.getElementById('btnSimpanKemas');
  try {
    if (!_ipcBatch) { toast('Cari No BN dulu', 'error'); return; }
    const lot = document.getElementById('kLot')?.value.trim().toUpperCase();
    if (!lot) { toast('Lot wajib', 'error'); return; }
    const hasil = document.getElementById('kHasil')?.value || 'OK';
    if (hasil === 'NOK' && !document.getElementById('kCatatan')?.value.trim()) {
      toast('Isi catatan masalah', 'error'); return;
    }
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
    const session = await getSession();
    await saveIpcKemas({
      batch_id: _ipcBatch.id, lot,
      jml_sampel: parseInt(document.getElementById('kJmlSampel')?.value) || null,
      level_ansi: 2,
      coding: document.getElementById('kCoding')?.value,
      overwrapping: document.getElementById('kOverwrapping')?.value,
      brosur: document.getElementById('kBrosur')?.value,
      suhu: document.getElementById('kSuhu')?.value.trim() || '',
      master_box: document.getElementById('kMasterBox')?.value.trim() || '',
      bag_ok: parseInt(document.getElementById('kBagOK')?.value) || 0,
      bag_nok: parseInt(document.getElementById('kBagNOK')?.value) || 0,
      hasil,
      catatan: document.getElementById('kCatatan')?.value.trim() || '',
      pic: session?.profile?.nama || session?.user?.email || ''
    });
    if (_ipcBatch.product_id) {
      await updateAnsiAfterIpc(_ipcBatch.product_id, hasil, _ipcBatch.no_bn);
    }
    await updateBatchStatus(_ipcBatch.id, hasil === 'NOK' ? 'ADA_MASALAH' : 'IPC_RUNNING');
    toast('✅ IPC Kemas tersimpan', 'success');
    document.getElementById('kLot').value = '';
    document.getElementById('kCatatan').value = '';
    document.getElementById('kHasil').value = 'OK';
    document.getElementById('kBagOK').value = 0;
    document.getElementById('kBagNOK').value = 0;
    document.getElementById('kCatatanGroup').style.display = 'none';
    cariBatchIpc('KEMAS');
  } catch (e) {
    console.error(e);
    toast(e.message || 'Gagal simpan IPC', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Simpan IPC Kemas'; }
  }
};

// ===================== LPF =====================
window.submitLpf = async function () {
  try {
    const noBN = document.getElementById('lpfNoBN')?.value.trim();
    const masalah = document.getElementById('lpfMasalah')?.value.trim();
    if (!noBN || !masalah) { toast('BN dan Masalah wajib', 'error'); return; }
    const session = await getSession();
    let batchId = null;
    try {
      const b = await getBatchFullByBN(noBN);
      batchId = b?.id || null;
    } catch (_) {}
    await createLpf({
      batch_id: batchId,
      no_bn: noBN.toUpperCase(),
      jenis: document.getElementById('lpfJenis')?.value,
      lot: document.getElementById('lpfLot')?.value.trim() || '',
      masalah,
      tindakan: document.getElementById('lpfTindakan')?.value.trim() || '',
      status: document.getElementById('lpfStatus')?.value || 'OPEN',
      dibuat_oleh: session?.profile?.nama || session?.user?.email || ''
    });
    toast('✅ LPF tersimpan', 'success');
    ['lpfNoBN', 'lpfLot', 'lpfMasalah', 'lpfTindakan'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    loadLpfList();
  } catch (e) {
    console.error(e);
    toast(e.message || 'Gagal LPF', 'error');
  }
};

async function loadLpfList() {
  const tbody = document.getElementById('bodyLpf');
  if (!tbody) return;
  try {
    const filter = document.getElementById('filterLpf')?.value || '';
    const list = await getLpfList(filter || null);
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:16px;color:#999;">Belum ada data</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(r => `
      <tr>
        <td style="padding:8px;font-weight:700;">${r.no_bn}</td>
        <td style="padding:8px;">${r.jenis || '-'} / ${r.lot || '-'}</td>
        <td style="padding:8px;">${r.masalah || ''}</td>
        <td style="padding:8px;">${r.status}</td>
        <td style="padding:8px;text-align:center;">
          ${r.status !== 'CLOSED'
            ? `<button type="button" class="btn btn-outline" style="width:auto;padding:4px 10px;font-size:12px;" onclick="verifikasiLpf('${r.id}')">Verifikasi</button>`
            : '—'}
        </td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:#D32F2F;text-align:center;">${e.message}</td></tr>`;
  }
}
window.loadLpfList = loadLpfList;

window.verifikasiLpf = async function (id) {
  const catatan = prompt('Catatan verifikasi:') || '';
  try {
    const session = await getSession();
    await verifyLpf(id, catatan, session?.profile?.nama || session?.user?.email || '');
    toast('LPF diverifikasi', 'success');
    loadLpfList();
  } catch (e) {
    toast(e.message || 'Gagal', 'error');
  }
};

// ===================== CAPA =====================
window.submitCapa = async function () {
  try {
    const masalah = document.getElementById('capaMasalah')?.value.trim();
    if (!masalah) { toast('Masalah wajib', 'error'); return; }
    const session = await getSession();
    const noBN = document.getElementById('capaNoBN')?.value.trim() || '';
    let batchId = null;
    if (noBN) {
      try { batchId = (await getBatchFullByBN(noBN))?.id || null; } catch (_) {}
    }
    await createCapa({
      batch_id: batchId,
      no_bn: noBN.toUpperCase(),
      sumber: document.getElementById('capaSumber')?.value,
      masalah,
      root_cause: document.getElementById('capaRoot')?.value.trim() || '',
      corrective_action: document.getElementById('capaCA')?.value.trim() || '',
      preventive_action: document.getElementById('capaPA')?.value.trim() || '',
      pic: document.getElementById('capaPic')?.value.trim() || '',
      target_selesai: document.getElementById('capaTarget')?.value || null,
      status: 'OPEN',
      dibuat_oleh: session?.profile?.nama || session?.user?.email || ''
    });
    toast('✅ CAPA tersimpan', 'success');
    ['capaNoBN', 'capaMasalah', 'capaRoot', 'capaCA', 'capaPA', 'capaPic', 'capaTarget'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    loadCapaList();
  } catch (e) {
    console.error(e);
    toast(e.message || 'Gagal CAPA', 'error');
  }
};

async function loadCapaList() {
  const tbody = document.getElementById('bodyCapa');
  if (!tbody) return;
  try {
    const filter = document.getElementById('filterCapa')?.value || '';
    const list = await getCapaList(filter || null);
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:16px;color:#999;">Belum ada data</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(r => `
      <tr>
        <td style="padding:8px;font-weight:700;">${r.no_bn || '-'}</td>
        <td style="padding:8px;">${r.masalah || ''}</td>
        <td style="padding:8px;">${r.pic || '-'}</td>
        <td style="padding:8px;">${r.status}</td>
        <td style="padding:8px;text-align:center;">
          ${r.status !== 'CLOSED' ? `
            <button type="button" class="btn btn-outline" style="width:auto;padding:4px 8px;font-size:11px;margin:2px;" onclick="setCapaStatus('${r.id}','ON_PROGRESS')">Progress</button>
            <button type="button" class="btn btn-outline" style="width:auto;padding:4px 8px;font-size:11px;margin:2px;" onclick="setCapaStatus('${r.id}','CLOSED')">Close</button>
          ` : '—'}
        </td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:#D32F2F;text-align:center;">${e.message}</td></tr>`;
  }
}
window.loadCapaList = loadCapaList;

window.setCapaStatus = async function (id, status) {
  try {
    await updateCapaStatus(id, status);
    toast('Status CAPA diubah', 'success');
    loadCapaList();
  } catch (e) {
    toast(e.message || 'Gagal', 'error');
  }
};

// ===================== AKUN =====================
async function loadAkunList() {
  const tbody = document.getElementById('bodyAkun');
  if (!tbody) return;
  try {
    const list = await getProfiles();
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:16px;color:#999;">Belum ada user</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(u => `
      <tr>
        <td style="padding:8px;font-weight:700;">${u.nama || '-'}</td>
        <td style="padding:8px;">${u.role || '-'}</td>
        <td style="padding:8px;text-align:center;">
          <select onchange="ubahRole('${u.id}', this.value)" style="padding:6px;border-radius:6px;border:1px solid #ddd;">
            ${['ADMIN', 'SPV_QA', 'SPV_PRODUKSI', 'INSPECTOR', 'VIEWER'].map(r =>
              `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`
            ).join('')}
          </select>
        </td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="3" style="color:#D32F2F;text-align:center;">${e.message}</td></tr>`;
  }
}
window.loadAkunList = loadAkunList;

window.ubahRole = async function (id, role) {
  try {
    await updateRole(id, role);
    toast('Role diperbarui', 'success');
  } catch (e) {
    toast(e.message || 'Gagal ubah role', 'error');
  }
};

// ===================== INIT =====================
(async function init() {
  showLogin();
  try {
    const session = await getSession();
    if (session) {
      currentUser = session;
      showApp(session.profile);
    }
  } catch (e) {
    console.warn('session check', e);
  }

  const btnLogin = document.getElementById('btnLogin');
  if (btnLogin) {
    btnLogin.onclick = async () => {
      const email =
        document.getElementById('loginEmail')?.value.trim() ||
        document.getElementById('loginUser')?.value.trim() || '';
      const pass = document.getElementById('loginPass')?.value || '';
      const err = document.getElementById('loginError');
      if (err) err.style.display = 'none';
      try {
        btnLogin.disabled = true;
        btnLogin.textContent = 'Memeriksa...';
        const res = await login(email, pass);
        currentUser = res;
        showApp(res.profile);
        toast('Login berhasil', 'success');
      } catch (e) {
        if (err) {
          err.textContent = e.message || 'Login gagal';
          err.style.display = 'block';
        } else {
          toast(e.message || 'Login gagal', 'error');
        }
      } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = 'Masuk';
      }
    };
  }
  console.log('[app] ready');
})();
