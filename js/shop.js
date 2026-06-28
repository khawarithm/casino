import { auth, db } from './firebase-config.js';
import { ref, update } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";
import soundManager from './sound.js';
import { userData, saveUserData, setMessage, addTokens, deductTokens, updateTokenDisplay, updateEquippedCharmsLuck } from './game.js';

// ==================== CHARM SYSTEM ====================
const CHARM_TIERS = [
  { name: 'Good Charm', chance: 35, luckBonus: 5, color: '#4CAF50', img: 'img/charms/good-charm.png' },
  { name: 'Lucky Charm', chance: 25, luckBonus: 6.5, color: '#FFEB3B', img: 'img/charms/lucky-charm.png' },
  { name: 'Emerald Charm', chance: 15, luckBonus: 7.25, color: '#00C853', img: 'img/charms/emerald-charm.png' },
  { name: 'Amethyst Charm', chance: 12.5, luckBonus: 8, color: '#9C27B0', img: 'img/charms/amethyst-charm.png' },
  { name: 'Gold Charm', chance: 10, luckBonus: 8.5, color: '#FFD700', img: 'img/charms/gold-charm.png' },
  { name: 'Gambler Charm', chance: 2.5, luckBonus: 15.5, color: '#FF1744', img: 'img/charms/gambler-charm.png' },
  { name: '100 Reward Charm', chance: 0, luckBonus:10,color: '#FFD700', img: 'img/charms/reward-charm.png',isSpecial: true
];

const MAX_EQUIPPED_CHARMS = 2;
const DUPLICATE_REFUND = 250;

// ==================== DOM REFS ====================
const shopPanel = document.getElementById('shopPanel');
const shopBtn = document.getElementById('shopBtn');
const gachaPriceEl = document.getElementById('gachaPrice');
const gachaAnim = document.getElementById('gachaAnim');
const gachaResult = document.getElementById('gachaResult');
const equippedCharmsEl = document.getElementById('equippedCharms');
const charmInventoryEl = document.getElementById('charmInventory');

// ==================== SHOP FUNCTIONS ====================
function calculateGachaPrice() {
  if (!userData) return 250;
  const level = userData.level || 1;
  if (level <= 2) return 250;
  return Math.floor(250 * level / 2);
}

function updateShopUI() {
  gachaPriceEl.textContent = calculateGachaPrice();
  renderEquippedCharms();
  renderCharmInventory();
}

function renderEquippedCharms() {
  if (!equippedCharmsEl) return;
  
  equippedCharmsEl.innerHTML = '';
  for (let i = 0; i < MAX_EQUIPPED_CHARMS; i++) {
    const charmId = userData?.equippedCharms?.[i];
    const charm = charmId ? userData.charms.find(c => c.id === charmId) : null;
    
    const slot = document.createElement('div');
    slot.className = 'charm-slot' + (charm ? ' equipped' : '');
    
    if (charm) {
      const tier = CHARM_TIERS.find(t => t.name === charm.name);
      slot.innerHTML = `
        <img src="${tier?.img || ''}" alt="${charm.name}" 
             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
             style="width:40px; height:40px; border-radius:8px;">
        <span style="display:none;">🔮</span>
        <small>${charm.name}</small>
        <small style="color:${tier?.color || '#fff'};">+${charm.luckBonus}%</small>
        <button class="btn btn-sm" data-unequip="${i}">❌</button>
      `;
    } else {
      slot.innerHTML = `<span>Slot ${i + 1}</span><small>Kosong</small>`;
    }
    
    equippedCharmsEl.appendChild(slot);
  }
  
  // Add event listeners for unequip
  equippedCharmsEl.querySelectorAll('[data-unequip]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.unequip);
      unequipCharm(index);
    });
  });
}

function renderCharmInventory() {
  if (!charmInventoryEl || !userData?.charms) return;
  
  charmInventoryEl.innerHTML = '';
  
  // Count charms
  const charmCounts = {};
  userData.charms.forEach(charm => {
    if (!charmCounts[charm.name]) {
      charmCounts[charm.name] = { ...charm, count: 0 };
    }
    charmCounts[charm.name].count++;
  });
  
  for (const [name, data] of Object.entries(charmCounts)) {
    const isEquipped = userData.equippedCharms?.includes(data.id);
    const tier = CHARM_TIERS.find(t => t.name === name);
    
    const charmCard = document.createElement('div');
    charmCard.className = 'charm-card' + (isEquipped ? ' equipped' : '');
    charmCard.innerHTML = `
      <img src="${tier?.img || ''}" alt="${name}" 
           onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
           style="width:35px; height:35px; border-radius:8px;">
      <span style="display:none;">🔮</span>
      <div>
        <strong style="color:${tier?.color || '#fff'};">${name}</strong>
        <small>+${data.luckBonus}% Luck | x${data.count}</small>
      </div>
      ${!isEquipped ? `<button class="btn btn-sm" data-equip="${data.id}">✔️ Equip</button>` : '<small>Dipakai</small>'}
    `;
    
    charmInventoryEl.appendChild(charmCard);
  }
  
  // Add event listeners for equip
  charmInventoryEl.querySelectorAll('[data-equip]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const charmId = btn.dataset.equip;
      equipCharm(charmId);
    });
  });
}

async function equipCharm(charmId) {
  if (!userData) return;
  
  const charm = userData.charms.find(c => c.id === charmId);
  if (!charm) return;
  
  // Check if already equipped
  if (userData.equippedCharms?.includes(charmId)) {
    setMessage('Charm sudah dipakai!');
    return;
  }
  
  // Find empty slot
  if (!userData.equippedCharms) userData.equippedCharms = [null, null];
  
  const emptyIndex = userData.equippedCharms.findIndex(c => c === null || c === undefined);
  if (emptyIndex === -1) {
    setMessage('Slot charm penuh! Lepas salah satu dulu.', false);
    return;
  }
  
  userData.equippedCharms[emptyIndex] = charmId;
  await saveUserData();
  updateEquippedCharmsLuck();
  updateShopUI();
  soundManager.play('click');
  setMessage(`✔️ ${charm.name} dipasang!`);
}

async function unequipCharm(index) {
  if (!userData?.equippedCharms) return;
  
  const charmId = userData.equippedCharms[index];
  const charm = charmId ? userData.charms.find(c => c.id === charmId) : null;
  
  userData.equippedCharms[index] = null;
  await saveUserData();
  updateEquippedCharmsLuck();
  updateShopUI();
  soundManager.play('click');
  if (charm) setMessage(`🔽 ${charm.name} dilepas.`);
}

async function openGacha() {
  if (!userData) return;
  
  const price = calculateGachaPrice();
  if (!deductTokens(price)) {
    setMessage('Token tidak cukup!', false);
    return;
  }
  
  soundManager.play('gacha');
  
  // Show animation
  if (gachaAnim) {
    gachaAnim.innerHTML = '🎲';
    gachaAnim.classList.add('spinning');
  }
  if (gachaResult) gachaResult.innerHTML = '';
  
  // Roll for charm
  const roll = Math.random() * 100;
  let cumulativeChance = 0;
  let selectedCharm = CHARM_TIERS[0]; // Default Good Charm
  
  for (const tier of CHARM_TIERS) {
    cumulativeChance += tier.chance;
    if (roll <= cumulativeChance) {
      selectedCharm = tier;
      break;
    }
  }
  
  // Simulate animation delay
  setTimeout(async () => {
    if (gachaAnim) {
      gachaAnim.classList.remove('spinning');
      gachaAnim.innerHTML = `<img src="${selectedCharm.img}" alt="${selectedCharm.name}" 
        style="width:60px; height:60px; border-radius:12px;"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">`;
    }
    
    // Check for duplicate
    const existingCharm = userData.charms.find(c => c.name === selectedCharm.name && !c.equipped);
    
    if (existingCharm) {
      // Duplicate -> refund
      addTokens(DUPLICATE_REFUND);
      setMessage(`🔁 Duplikat ${selectedCharm.name}! +${DUPLICATE_REFUND} Token`);
    } else {
      // New charm
      const newCharm = {
        id: 'charm-' + Date.now(),
        name: selectedCharm.name,
        luckBonus: selectedCharm.luckBonus,
        equipped: false,
      };
      
      userData.charms.push(newCharm);
      
      // Auto-equip if slot available
      const emptyIndex = userData.equippedCharms?.findIndex(c => c === null || c === undefined);
      if (emptyIndex !== -1 && emptyIndex !== undefined) {
        userData.equippedCharms[emptyIndex] = newCharm.id;
      }
      
      if (gachaResult) {
        gachaResult.innerHTML = `
          <div style="color:${selectedCharm.color}; font-weight:bold;">
            🎉 ${selectedCharm.name}!
          </div>
          <small>+${selectedCharm.luckBonus}% Luck</small>
        `;
      }
      
      setMessage(`🎉 Dapat ${selectedCharm.name}! +${selectedCharm.luckBonus}% Luck`);
      soundManager.play('achievement');
    }
    
    updateEquippedCharmsLuck();
    updateShopUI();
    await saveUserData();
  }, 2000);
}

// ==================== LOAN SYSTEM ====================
const loanPanel = document.getElementById('loanPanel');
const loanBtn = document.getElementById('loanBtn');
const activeLoanEl = document.getElementById('activeLoan');
const loanAmountInput = document.getElementById('loanAmount');
const takeLoanBtn = document.getElementById('takeLoan');
const repayLoanBtn = document.getElementById('repayLoan');

const MAX_LOAN = 100000;
const LOAN_INTEREST = 0.02; // 2%

function updateLoanUI() {
  if (!userData || !activeLoanEl) return;
  activeLoanEl.textContent = (userData.loan || 0).toLocaleString();
}

loanBtn?.addEventListener('click', () => {
  if (loanPanel.style.display === 'none' || !loanPanel.style.display) {
    loanPanel.style.display = 'block';
  } else {
    loanPanel.style.display = 'none';
  }
  updateLoanUI();
});

takeLoanBtn?.addEventListener('click', async () => {
  if (!userData) return;
  
  const amount = parseInt(loanAmountInput.value);
  if (!amount || amount <= 0) {
    setMessage('Masukkan jumlah yang valid!', false);
    return;
  }
  
  if (userData.loan > 0) {
    setMessage('Lunasi pinjaman sebelumnya dulu!', false);
    return;
  }
  
  if (amount > MAX_LOAN) {
    setMessage(`Max pinjaman ${MAX_LOAN.toLocaleString()} Token!`, false);
    return;
  }
  
  userData.loan = amount;
  userData.loanInterest = Math.floor(amount * LOAN_INTEREST);
  addTokens(amount);
  
  updateLoanUI();
  await saveUserData();
  setMessage(`📝 Pinjaman ${amount.toLocaleString()} Token diterima! Bunga: ${userData.loanInterest.toLocaleString()}`);
});

repayLoanBtn?.addEventListener('click', async () => {
  if (!userData || !userData.loan) {
    setMessage('Tidak ada pinjaman!');
    return;
  }
  
  const totalRepay = userData.loan + userData.loanInterest;
  if (userData.tokens < totalRepay) {
    setMessage(`Token tidak cukup! Butuh ${totalRepay.toLocaleString()}`, false);
    return;
  }
  
  if (deductTokens(totalRepay)) {
    userData.loan = 0;
    userData.loanInterest = 0;
    updateLoanUI();
    await saveUserData();
    setMessage(`💰 Pinjaman lunas! Total: ${totalRepay.toLocaleString()} Token`);
  }
});

// ==================== EVENT LISTENERS ====================
shopBtn?.addEventListener('click', () => {
  if (shopPanel.style.display === 'none' || !shopPanel.style.display) {
    shopPanel.style.display = 'block';
    updateShopUI();
  } else {
    shopPanel.style.display = 'none';
  }
});

document.getElementById('openGacha')?.addEventListener('click', openGacha);

// Initialize on user load
window.addEventListener('userLoaded', () => {
  updateShopUI();
  updateLoanUI();
});

export { updateShopUI, updateLoanUI };
