import { auth, db } from './firebase-config.js';
import { ref, get, update, set } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";
import soundManager from './sound.js';

// ==================== GAME STATE ====================
let userData = null;
let currentGame = 'slot';
let currentBet = 10;
let slotSpinning = false;
let horseRaceRunning = false;
let wheelSpinning = false;
let wheelAngle = 0;
let currentCard = Math.floor(Math.random() * 13) + 1;

// Charm luck bonus
let equippedCharmsLuck = 0;

// ==================== DOM REFS ====================
const tokenDisplay = document.getElementById('tokenDisplay');
const gameArea = document.getElementById('gameArea');
const messageBox = document.getElementById('messageBox');
const betButtons = document.querySelectorAll('#betSelector .btn-bet');
const winstreakDisplay = document.getElementById('winstreakDisplay');
const winstreakCount = document.getElementById('winstreakCount');
const xpFill = document.getElementById('xpFill');
const levelDisplay = document.getElementById('levelDisplay');

// ==================== XP & LEVEL SYSTEM ====================
function getXPForLevel(level) {
  if (level <= 10) return 100;
  if (level <= 30) return 250;
  if (level <= 55) return 400;
  if (level <= 75) return 650;
  return 1000;
}

function getLevelMilestone(level) {
  const milestones = {
    10: 750,
    25: 1000,
    50: 1500,
    75: 2000,
    100: { tokens: 2500, specialCharm: '100 Reward Charm' }
  };
  return milestones[level] || null;
}

async function addXP(amount) {
  if (!userData) return;
  
  let xp = userData.xp + amount;
  let level = userData.level;
  let leveledUp = false;
  
  while (xp >= getXPForLevel(level)) {
    xp -= getXPForLevel(level);
    level++;
    leveledUp = true;
    
    // Check milestones
    const milestone = getLevelMilestone(level);
    if (milestone) {
      if (typeof milestone === 'object') {
        userData.tokens += milestone.tokens;
        // Add special charm
        const specialCharm = {
          id: 'reward-charm-' + Date.now(),
          name: '100 Reward Charm',
          luckBonus: 10,
          equipped: false,
          isSpecial: true,
        };
        userData.charms.push(specialCharm);
        setMessage(`🎉 LEVEL ${level}! Dapat ${milestone.tokens} Token + ${milestone.specialCharm}!`, true);
        soundManager.play('achievement');
      } else {
        userData.tokens += milestone;
        setMessage(`🎉 LEVEL ${level}! Dapat ${milestone} Token!`, true);
        soundManager.play('achievement');
      }
    } else if (leveledUp) {
      setMessage(`⬆️ Naik ke Level ${level}!`, true);
    }
  }
  
  userData.xp = xp;
  userData.level = level;
  
  // Update UI
  updateXPBar();
  updateTokenDisplay();
  
  // Save to Firebase
  if (auth.currentUser) {
    await update(ref(db, `users/${auth.currentUser.uid}`), {
      xp: userData.xp,
      level: userData.level,
      tokens: userData.tokens,
      charms: userData.charms,
    });
  }
}

function updateXPBar() {
  if (!userData) return;
  const xpNeeded = getXPForLevel(userData.level);
  const percentage = (userData.xp / xpNeeded) * 100;
  xpFill.style.width = percentage + '%';
  levelDisplay.textContent = userData.level;
}

function updateTokenDisplay() {
  if (!userData) return;
  tokenDisplay.textContent = userData.tokens;
}

function updateWinstreakDisplay() {
  if (!userData) return;
  if (userData.winstreak > 1) {
    winstreakDisplay.style.display = 'block';
    winstreakCount.textContent = userData.winstreak;
  } else {
    winstreakDisplay.style.display = 'none';
  }
}

// ==================== TOKEN MANAGEMENT ====================
function addTokens(amount) {
  if (!userData) return;
  userData.tokens += amount;
  updateTokenDisplay();
  saveTokens();
}

function deductTokens(amount) {
  if (!userData) return false;
  if (userData.tokens >= amount) {
    userData.tokens -= amount;
    updateTokenDisplay();
    saveTokens();
    return true;
  }
  return false;
}

async function saveTokens() {
  if (!userData || !auth.currentUser) return;
  await update(ref(db, `users/${auth.currentUser.uid}`), {
    tokens: userData.tokens,
  });
}

// ==================== WIN/LOSE HANDLER ====================
async function handleWin(amount, gameName) {
  addTokens(amount);
  userData.winstreak++;
  userData.totalWins++;
  userData.totalGames++;
  
  if (userData.winstreak > userData.maxWinstreak) {
    userData.maxWinstreak = userData.winstreak;
  }
  
  // XP Calculation
  let xpGain = 10;
  if (userData.winstreak >= 10) {
    xpGain = 1000;
  } else if (userData.winstreak >= 5) {
    xpGain = 100;
  }
  
  await addXP(xpGain);
  updateWinstreakDisplay();
  
  soundManager.play('win');
}

async function handleLose(amount) {
  userData.winstreak = 0;
  userData.totalGames++;
  updateWinstreakDisplay();
  
  soundManager.play('lose');
}

// ==================== LUCK CALCULATION ====================
function calculateLuck() {
  let totalLuck = equippedCharmsLuck;
  // Bandar RTP can affect luck
  if (userData && userData.bandar && userData.bandar.isBandar) {
    const rtp = userData.bandar.rtp;
    totalLuck += (rtp - 50) / 10; // RTP 60 = +1% luck, RTP 40 = -1% luck
  }
  return totalLuck;
}

function bandarRNG() {
  let r = Math.random();
  const luck = calculateLuck();
  // Apply luck bonus (max 25% shift)
  const shift = Math.max(-0.25, Math.min(0.25, luck / 100));
  r = Math.max(0, Math.min(0.999, r + shift));
  return r;
}

// ==================== SLOT MACHINE ====================
const symbols = ['🍒', '🍋', '🍊', '⭐', '💎', '7️⃣'];

function renderSlot() {
  gameArea.innerHTML = `
    <div class="slot-row" id="slotRow">
      <span class="slot-item">🍒</span>
      <span class="slot-item">🍋</span>
      <span class="slot-item">🍊</span>
    </div>
    <div class="bet-controls">
      <span style="color:#ffd966;">Bet: ${getBetAmount()} Token</span>
      <button class="btn" id="spinSlot" ${slotSpinning ? 'disabled' : ''}>🎰 SPIN</button>
    </div>
  `;
  document.getElementById('spinSlot')?.addEventListener('click', spinSlot);
}

function getBetAmount() {
  if (currentBet === 'max') return Math.min(userData?.tokens || 0, 1000);
  return currentBet;
}

async function spinSlot() {
  if (slotSpinning || !userData) return;
  const betAmount = getBetAmount();
  if (!deductTokens(betAmount)) {
    setMessage('Token tidak cukup!', false);
    return;
  }

  slotSpinning = true;
  soundManager.play('spin');

  const items = document.querySelectorAll('.slot-item');
  items.forEach(i => i.classList.add('spinning'));

  let count = 0;
  const interval = setInterval(() => {
    items.forEach(i => i.textContent = symbols[Math.floor(Math.random() * symbols.length)]);
    if (++count >= 15) {
      clearInterval(interval);
      items.forEach(i => i.classList.remove('spinning'));
      finalizeSlot(items, betAmount);
    }
  }, 70);
}

async function finalizeSlot(items, betAmount) {
  const r = bandarRNG();
  let res;

  if (r < 0.15) {
    const s = symbols[Math.floor(Math.random() * symbols.length)];
    res = [s, s, s];
  } else if (r < 0.45) {
    const s = symbols[Math.floor(Math.random() * symbols.length)];
    let s2 = symbols[Math.floor(Math.random() * symbols.length)];
    res = [s, s, s2];
  } else {
    let a = symbols[Math.floor(Math.random() * symbols.length)];
    let b = symbols[Math.floor(Math.random() * symbols.length)];
    let c = symbols[Math.floor(Math.random() * symbols.length)];
    if (a === b && b === c) c = symbols[(symbols.indexOf(c) + 1) % symbols.length];
    res = [a, b, c];
  }

  items[0].textContent = res[0];
  items[1].textContent = res[1];
  items[2].textContent = res[2];

  if (res[0] === res[1] && res[1] === res[2]) {
    const winAmount = betAmount * 8;
    await handleWin(winAmount, 'slot');
    soundManager.play('jackpot');
    setMessage(`🎉 JACKPOT! +${winAmount} Token`);
  } else if (res[0] === res[1] || res[1] === res[2] || res[0] === res[2]) {
    const winAmount = betAmount * 2;
    await handleWin(winAmount, 'slot');
    setMessage(`🍀 Dua sama! +${winAmount} Token`);
  } else {
    await handleLose(betAmount);
    setMessage(`💨 Coba lagi! -${betAmount} Token`, false);
  }

  slotSpinning = false;
  renderSlot();
  await saveUserData();
}

// ==================== HORSE RACE ====================
const HORSE_IMAGES = {
  horse1: 'img/horse1.png',
  horse2: 'img/horse2.png',
};

function renderHorse() {
  gameArea.innerHTML = `
    <div class="race-track">
      <div class="finish-line"></div>
      <div class="race-lane">
        <img src="${HORSE_IMAGES.horse1}" class="horse-img" id="horse1" 
             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
             alt="Kuda Emas">
        <span style="display:none; font-size:2rem;" class="horse-fallback">🐴</span>
        <span class="horse-label">Kuda Emas</span>
      </div>
      <div class="race-lane">
        <img src="${HORSE_IMAGES.horse2}" class="horse-img" id="horse2"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
             alt="Kuda Silver">
        <span style="display:none; font-size:2rem;" class="horse-fallback">🐎</span>
        <span class="horse-label">Kuda Silver</span>
      </div>
    </div>
    <div class="bet-controls">
      <span style="color:#ffd966;">Bet: ${getBetAmount()} Token</span>
      <button class="btn" id="betHorse1" ${horseRaceRunning ? 'disabled' : ''}>🐴 Emas</button>
      <button class="btn" id="betHorse2" ${horseRaceRunning ? 'disabled' : ''}>🐴 Silver</button>
    </div>
  `;

  document.getElementById('betHorse1')?.addEventListener('click', () => runHorse(1));
  document.getElementById('betHorse2')?.addEventListener('click', () => runHorse(2));
}

async function runHorse(bet) {
  if (horseRaceRunning || !userData) return;
  const betAmount = getBetAmount();
  if (!deductTokens(betAmount)) {
    setMessage('Token tidak cukup!', false);
    return;
  }

  horseRaceRunning = true;
  soundManager.play('horse');

  const h1 = document.getElementById('horse1');
  const h2 = document.getElementById('horse2');
  
  if (!h1 || !h2) {
    // Fallback to emoji
    const fallbacks = document.querySelectorAll('.horse-fallback');
    runHorseFallback(bet, betAmount, fallbacks);
    return;
  }

  // Reset position
  h1.style.marginLeft = '0px';
  h2.style.marginLeft = '0px';

  const winner = bandarRNG() < 0.5 ? 1 : 2;
  const trackWidth = document.querySelector('.race-track')?.offsetWidth - 60 || 300;

  const interval = setInterval(() => {
    let p1 = parseFloat(h1.style.marginLeft) || 0;
    let p2 = parseFloat(h2.style.marginLeft) || 0;
    p1 += Math.random() * 15 + 2;
    p2 += Math.random() * 15 + 2;
    h1.style.marginLeft = Math.min(p1, trackWidth) + 'px';
    h2.style.marginLeft = Math.min(p2, trackWidth) + 'px';

    if (p1 >= trackWidth || p2 >= trackWidth) {
      clearInterval(interval);
      if (winner === 1) h1.style.marginLeft = (trackWidth + 10) + 'px';
      else h2.style.marginLeft = (trackWidth + 10) + 'px';

      setTimeout(async () => {
        if (bet === winner) {
          const winAmount = betAmount * 2;
          await handleWin(winAmount, 'horse');
          setMessage(`🏆 Kuda ${winner === 1 ? 'Emas' : 'Silver'} menang! +${winAmount} Token`);
        } else {
          await handleLose(betAmount);
          setMessage(`😵 Kalah! -${betAmount} Token`, false);
        }
        horseRaceRunning = false;
        renderHorse();
        await saveUserData();
      }, 500);
    }
  }, 80);
}

async function runHorseFallback(bet, betAmount, fallbacks) {
  if (!fallbacks || fallbacks.length < 2) {
    horseRaceRunning = false;
    return;
  }

  fallbacks[0].style.marginLeft = '0px';
  fallbacks[1].style.marginLeft = '0px';

  const winner = bandarRNG() < 0.5 ? 1 : 2;
  const trackWidth = 250;
  let pos1 = 0, pos2 = 0;

  const interval = setInterval(() => {
    pos1 += Math.random() * 15 + 2;
    pos2 += Math.random() * 15 + 2;
    fallbacks[0].style.marginLeft = Math.min(pos1, trackWidth) + 'px';
    fallbacks[1].style.marginLeft = Math.min(pos2, trackWidth) + 'px';

    if (pos1 >= trackWidth || pos2 >= trackWidth) {
      clearInterval(interval);
      setTimeout(async () => {
        if (bet === winner) {
          const winAmount = betAmount * 2;
          await handleWin(winAmount, 'horse');
          setMessage(`🏆 Menang! +${winAmount} Token`);
        } else {
          await handleLose(betAmount);
          setMessage(`😵 Kalah! -${betAmount} Token`, false);
        }
        horseRaceRunning = false;
        renderHorse();
        await saveUserData();
      }, 500);
    }
  }, 80);
}

// ==================== WHEEL ====================
function renderWheel() {
  gameArea.innerHTML = `
    <div class="wheel-container">
      <div class="wheel-pointer">🔻</div>
      <canvas class="wheel-canvas" id="wheelCanvas" width="200" height="200"></canvas>
    </div>
    <div class="bet-controls">
      <span style="color:#ffd966;">Bet: ${getBetAmount()} Token</span>
      <button class="btn" id="spinWheelBtn" ${wheelSpinning ? 'disabled' : ''}>🎡 PUTAR</button>
    </div>
  `;
  drawWheel(0);
  document.getElementById('spinWheelBtn')?.addEventListener('click', spinWheel);
}

function drawWheel(rotation) {
  const canvas = document.getElementById('wheelCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = 100, cy = 100, r = 90;
  const segments = ['💰x5', '💨0', '✨x3', '💨0', '🔹x2', '💨0', '💰x4', '💨0'];
  const colors = ['#f7b32b', '#444', '#d48c1a', '#444', '#b37b2e', '#444', '#e6a01e', '#444'];
  ctx.clearRect(0, 0, 200, 200);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation * Math.PI / 180);
  const arc = (2 * Math.PI) / segments.length;
  for (let i = 0; i < segments.length; i++) {
    ctx.beginPath();
    ctx.fillStyle = colors[i];
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, i * arc, (i + 1) * arc);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.rotate(arc / 2);
    ctx.fillText(segments[i], 35, 4);
    ctx.rotate(arc / 2);
  }
  ctx.restore();
}

async function spinWheel() {
  if (wheelSpinning || !userData) return;
  const betAmount = getBetAmount();
  if (!deductTokens(betAmount)) {
    setMessage('Token tidak cukup!', false);
    return;
  }

  wheelSpinning = true;
  soundManager.play('wheel');

  const canvas = document.getElementById('wheelCanvas');
  const spinDeg = 1080 + Math.floor(Math.random() * 360);
  canvas.style.transition = 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
  canvas.style.transform = `rotate(${spinDeg}deg)`;
  wheelAngle = spinDeg % 360;

  setTimeout(async () => {
    const normalized = (360 - (wheelAngle % 360)) % 360;
    const seg = Math.floor(normalized / 45);
    const multipliers = [5, 0, 3, 0, 2, 0, 4, 0];
    const multiplier = multipliers[seg];
    
    if (multiplier > 0) {
      const winAmount = betAmount * multiplier;
      await handleWin(winAmount, 'wheel');
      setMessage(`🎡 Dapat ${winAmount} Token! (x${multiplier})`);
    } else {
      await handleLose(betAmount);
      setMessage('💨 Zonk! Coba lagi', false);
    }
    
    drawWheel(wheelAngle);
    canvas.style.transition = 'none';
    canvas.style.transform = `rotate(${wheelAngle}deg)`;
    wheelSpinning = false;
    
    setTimeout(() => {
      canvas.style.transition = 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
      renderWheel();
    }, 50);
    
    await saveUserData();
  }, 3100);
}

// ==================== HI-LO ====================
function renderHiLo() {
  gameArea.innerHTML = `
    <div style="font-size:2rem;">🃏 Kartu: ${currentCard}</div>
    <div class="bet-controls">
      <span style="color:#ffd966;">Bet: ${getBetAmount()} Token</span>
      <button class="btn" id="hiBtn">⬆️ Tinggi</button>
      <button class="btn" id="loBtn">⬇️ Rendah</button>
    </div>
  `;
  document.getElementById('hiBtn')?.addEventListener('click', () => guessHL('high'));
  document.getElementById('loBtn')?.addEventListener('click', () => guessHL('low'));
}

async function guessHL(guess) {
  if (!userData) return;
  const betAmount = getBetAmount();
  if (!deductTokens(betAmount)) {
    setMessage('Token tidak cukup!', false);
    return;
  }
  
  soundManager.play('click');
  const next = Math.floor(Math.random() * 13) + 1;
  const win = (guess === 'high' && next > currentCard) || (guess === 'low' && next < currentCard);
  
  if (win) {
    const winAmount = betAmount * 2;
    await handleWin(winAmount, 'hilo');
    setMessage(`✅ Benar! Kartu ${next} +${winAmount} Token`);
  } else {
    await handleLose(betAmount);
    setMessage(`❌ Salah! Kartu ${next} -${betAmount} Token`, false);
  }
  
  currentCard = next;
  renderHiLo();
  await saveUserData();
}

// ==================== UTILS ====================
function setMessage(msg, good = true) {
  messageBox.innerHTML = msg;
  messageBox.style.color = good ? '#ffd966' : '#ff8c8c';
}

async function saveUserData() {
  if (!userData || !auth.currentUser) return;
  await update(ref(db, `users/${auth.currentUser.uid}`), {
    tokens: userData.tokens,
    xp: userData.xp,
    level: userData.level,
    winstreak: userData.winstreak,
    maxWinstreak: userData.maxWinstreak,
    totalWins: userData.totalWins,
    totalGames: userData.totalGames,
    charms: userData.charms,
    equippedCharms: userData.equippedCharms,
    achievements: userData.achievements,
  });
}

// ==================== INITIALIZATION ====================
async function loadUserData(uid) {
  const snapshot = await get(ref(db, `users/${uid}`));
  if (snapshot.exists()) {
    userData = snapshot.val();
    updateEquippedCharmsLuck();
    updateTokenDisplay();
    updateXPBar();
    updateWinstreakDisplay();
    renderGame();
    
    // Start BGM
    soundManager.startBGM();
  }
}

function updateEquippedCharmsLuck() {
  equippedCharmsLuck = 0;
  if (userData?.equippedCharms) {
    userData.equippedCharms.forEach(charmId => {
      if (charmId) {
        const charm = userData.charms.find(c => c.id === charmId);
        if (charm) {
          equippedCharmsLuck += charm.luckBonus;
        }
      }
    });
  }
}

function renderGame() {
  switch (currentGame) {
    case 'slot': renderSlot(); break;
    case 'horse': renderHorse(); break;
    case 'wheel': renderWheel(); break;
    case 'hilo': renderHiLo(); break;
  }
}

// ==================== EVENT LISTENERS ====================
// Bet selector
betButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    betButtons.forEach(b => b.classList.remove('active-bet'));
    btn.classList.add('active-bet');
    const betVal = btn.dataset.bet;
    currentBet = betVal === 'max' ? 'max' : parseInt(betVal);
    soundManager.play('click');
    renderGame();
  });
});

// Game tabs
document.querySelectorAll('#gameTabs .game-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#gameTabs .game-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentGame = btn.dataset.game;
    renderGame();
    soundManager.play('click');
  });
});

// Reset tokens
document.getElementById('resetTokens')?.addEventListener('click', async () => {
  if (!userData) return;
  userData.tokens = 500;
  updateTokenDisplay();
  await saveUserData();
  soundManager.play('click');
  setMessage('Token di-reset ke 500!');
});

// Listen for user loaded event
window.addEventListener('userLoaded', async (e) => {
  await loadUserData(e.detail.uid);
});

// Export for other modules
export { 
  userData, 
  addTokens, 
  deductTokens, 
  setMessage, 
  saveUserData, 
  updateTokenDisplay,
  updateEquippedCharmsLuck,
  renderGame as renderCurrentGame,
  bandarRNG,
};
