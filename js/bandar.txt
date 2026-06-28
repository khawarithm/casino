import { auth, db } from './firebase-config.js';
import { ref, get, update } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";
import soundManager from './sound.js';
import { userData, saveUserData, setMessage, addTokens, deductTokens } from './game.js';

// ==================== DOM REFS ====================
const bandarPanel = document.getElementById('bandarPanel');
const bandarToggle = document.getElementById('bandarToggle');
const casinoNameEl = document.getElementById('casinoName');
const visitorCountEl = document.getElementById('visitorCount');
const visitorFill = document.getElementById('visitorFill');
const bandarIncomeEl = document.getElementById('bandarIncome');
const rtpSlider = document.getElementById('rtpSlider');
const rtpValue = document.getElementById('rtpValue');

// ==================== BANDAR FUNCTIONS ====================
function updateBandarUI() {
  if (!userData?.bandar?.isBandar) return;
  
  const bandar = userData.bandar;
  casinoNameEl.textContent = bandar.casinoName || 'CasinoKu';
  visitorCountEl.textContent = bandar.visitors || 0;
  visitorFill.style.width = ((bandar.visitors || 0) / 100 * 100) + '%';
  bandarIncomeEl.textContent = bandar.income || 0;
  rtpSlider.value = bandar.rtp || 60;
  rtpValue.textContent = (bandar.rtp || 60) + '%';
}

function updateVisitors() {
  if (!userData?.bandar?.isBandar) return;
  
  const rtp = userData.bandar.rtp || 60;
  const idealVisitors = Math.floor((rtp / 100) * 100);
  const randomFactor = Math.floor(Math.random() * 20) - 10;
  userData.bandar.visitors = Math.max(5, Math.min(100, idealVisitors + randomFactor));
  
  // Income from visitors
  const incomePerVisitor = Math.floor(rtp / 10);
  userData.bandar.income = (userData.bandar.income || 0) + (userData.bandar.visitors * incomePerVisitor);
  
  updateBandarUI();
  saveUserData();
}

// Periodic visitor update
setInterval(() => {
  updateVisitors();
}, 8000);

// ==================== EVENT LISTENERS ====================
bandarToggle?.addEventListener('click', async () => {
  if (!userData) return;
  
  if (!userData.bandar?.isBandar) {
    // Become bandar
    if (userData.tokens < 1500000) {
      setMessage('Butuh 1.500.000 Token untuk jadi Bandar!', false);
      return;
    }
    
    if (!deductTokens(1500000)) {
      setMessage('Gagal jadi Bandar!', false);
      return;
    }
    
    userData.bandar = {
      isBandar: true,
      casinoName: 'CasinoKu',
      unlockedModes: ['slot'],
      income: 0,
      visitors: 50,
      rtp: 60,
    };
    
    bandarPanel.style.display = 'block';
    bandarToggle.textContent = '🎮 Main';
    updateBandarUI();
    await saveUserData();
    soundManager.play('win');
    setMessage('🏪 Selamat! Kamu sekarang Bandar Casino!');
  } else {
    // Leave bandar mode
    userData.bandar.isBandar = false;
    bandarPanel.style.display = 'none';
    bandarToggle.textContent = '🏪 Bandar';
    await saveUserData();
    setMessage('Kembali ke mode pemain.');
  }
});

// RTP Slider
rtpSlider?.addEventListener('input', async () => {
  if (!userData?.bandar?.isBandar) return;
  userData.bandar.rtp = parseInt(rtpSlider.value);
  rtpValue.textContent = userData.bandar.rtp + '%';
  updateVisitors();
  await saveUserData();
});

// Unlock modes
document.getElementById('unlockWheel')?.addEventListener('click', async () => {
  if (!userData?.bandar?.isBandar) {
    setMessage('Hanya Bandar yang bisa unlock!', false);
    return;
  }
  if (userData.bandar.unlockedModes.includes('wheel')) {
    setMessage('Mode Roda sudah terbuka!');
    return;
  }
  if (userData.tokens < 700000) {
    setMessage('Butuh 700.000 Token!', false);
    return;
  }
  
  if (deductTokens(700000)) {
    userData.bandar.unlockedModes.push('wheel');
    await saveUserData();
    soundManager.play('win');
    setMessage('🔓 Mode Roda terbuka!');
  }
});

document.getElementById('unlockHorse')?.addEventListener('click', async () => {
  if (!userData?.bandar?.isBandar) {
    setMessage('Hanya Bandar yang bisa unlock!', false);
    return;
  }
  if (userData.bandar.unlockedModes.includes('horse')) {
    setMessage('Mode Balap sudah terbuka!');
    return;
  }
  if (userData.tokens < 750000) {
    setMessage('Butuh 750.000 Token!', false);
    return;
  }
  
  if (deductTokens(750000)) {
    userData.bandar.unlockedModes.push('horse');
    await saveUserData();
    soundManager.play('win');
    setMessage('🔓 Mode Balap Kuda terbuka!');
  }
});

document.getElementById('unlockHiLo')?.addEventListener('click', async () => {
  if (!userData?.bandar?.isBandar) {
    setMessage('Hanya Bandar yang bisa unlock!', false);
    return;
  }
  if (userData.bandar.unlockedModes.includes('hilo')) {
    setMessage('Mode Hi-Lo sudah terbuka!');
    return;
  }
  if (userData.tokens < 850000) {
    setMessage('Butuh 850.000 Token!', false);
    return;
  }
  
  if (deductTokens(850000)) {
    userData.bandar.unlockedModes.push('hilo');
    await saveUserData();
    soundManager.play('win');
    setMessage('🔓 Mode Hi-Lo terbuka!');
  }
});

// Collect income
document.getElementById('collectIncome')?.addEventListener('click', async () => {
  if (!userData?.bandar?.isBandar) return;
  
  const income = userData.bandar.income || 0;
  if (income <= 0) {
    setMessage('Belum ada pendapatan!', false);
    return;
  }
  
  addTokens(income);
  userData.bandar.income = 0;
  updateBandarUI();
  await saveUserData();
  soundManager.play('win');
  setMessage(`💸 Pendapatan ${income.toLocaleString()} Token ditarik!`);
});

// Rename casino
document.getElementById('renameCasino')?.addEventListener('click', async () => {
  if (!userData?.bandar?.isBandar) return;
  
  const name = prompt('Nama casino baru:', userData.bandar.casinoName || 'CasinoKu');
  if (name && name.trim()) {
    userData.bandar.casinoName = name.trim();
    updateBandarUI();
    await saveUserData();
    setMessage(`✏️ Nama casino: ${name.trim()}`);
  }
});

// Initialize bandar panel on user load
window.addEventListener('userLoaded', () => {
  if (userData?.bandar?.isBandar) {
    bandarPanel.style.display = 'block';
    bandarToggle.textContent = '🎮 Main';
    updateBandarUI();
  }
});

export { updateBandarUI, updateVisitors };
