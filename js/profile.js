import { auth, db } from './firebase-config.js';
import { ref, get, update, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";
import soundManager from './sound.js';
import { userData, saveUserData, setMessage } from './game.js';

// ==================== DOM REFS ====================
const profilePanel = document.getElementById('profilePanel');
const profileBtn = document.getElementById('profileBtn');
const profileUsername = document.getElementById('profileUsername');
const profileLevel = document.getElementById('profileLevel');
const profileXP = document.getElementById('profileXP');
const profileBio = document.getElementById('profileBio');
const saveBioBtn = document.getElementById('saveBio');
const achievementsList = document.getElementById('achievementsList');
const leaderboardList = document.getElementById('leaderboardList');

// ==================== ACHIEVEMENTS ====================
const ACHIEVEMENTS = [
  { id: 'first_win', name: '🏆 First Win', desc: 'Menang pertama kali', check: (data) => data.totalWins >= 1 },
  { id: '10_wins', name: '🥉 10 Wins', desc: 'Menang 10 kali', check: (data) => data.totalWins >= 10 },
  { id: '50_wins', name: '🥈 50 Wins', desc: 'Menang 50 kali', check: (data) => data.totalWins >= 50 },
  { id: '100_wins', name: '🥇 100 Wins', desc: 'Menang 100 kali', check: (data) => data.totalWins >= 100 },
  { id: 'winstreak_5', name: '🔥 Hot Streak', desc: 'Win streak 5x', check: (data) => data.maxWinstreak >= 5 },
  { id: 'winstreak_10', name: '💀 On Fire', desc: 'Win streak 10x', check: (data) => data.maxWinstreak >= 10 },
  { id: 'level_10', name: '⭐ Rising Star', desc: 'Mencapai level 10', check: (data) => data.level >= 10 },
  { id: 'level_25', name: '🌟 Pro Player', desc: 'Mencapai level 25', check: (data) => data.level >= 25 },
  { id: 'level_50', name: '👑 Veteran', desc: 'Mencapai level 50', check: (data) => data.level >= 50 },
  { id: 'level_100', name: '🐐 GOAT', desc: 'Mencapai level 100', check: (data) => data.level >= 100 },
  { id: 'bandar', name: '🏪 Tycoon', desc: 'Menjadi Bandar', check: (data) => data.bandar?.isBandar },
  { id: 'gambler_charm', name: '🍀 Lucky Gambler', desc: 'Dapat Gambler Charm', check: (data) => data.charms?.some(c => c.name === 'Gambler Charm') },
  { id: 'rich', name: '💰 Sultan', desc: 'Punya 1 juta Token', check: (data) => data.tokens >= 1000000 },
];

// ==================== PROFILE FUNCTIONS ====================
function updateProfileUI() {
  if (!userData) return;
  
  profileUsername.textContent = userData.username || '-';
  profileLevel.textContent = userData.level || 1;
  profileXP.textContent = userData.xp || 0;
  profileBio.value = userData.bio || '';
  
  checkAchievements();
  renderAchievements();
  renderLeaderboard();
}

async function checkAchievements() {
  if (!userData) return;
  
  let newAchievements = false;
  
  for (const achievement of ACHIEVEMENTS) {
    if (!userData.achievements?.includes(achievement.id)) {
      if (achievement.check(userData)) {
        if (!userData.achievements) userData.achievements = [];
        userData.achievements.push(achievement.id);
        newAchievements = true;
        setMessage(`🏆 Achievement Unlocked: ${achievement.name}!`);
        soundManager.play('achievement');
      }
    }
  }
  
  if (newAchievements) {
    await saveUserData();
  }
}

function renderAchievements() {
  if (!achievementsList) return;
  
  achievementsList.innerHTML = '';
  
  ACHIEVEMENTS.forEach(achievement => {
    const unlocked = userData?.achievements?.includes(achievement.id);
    const div = document.createElement('div');
    div.className = 'achievement-card' + (unlocked ? ' unlocked' : ' locked');
    div.innerHTML = `
      <strong>${achievement.name}</strong>
      <small>${achievement.desc}</small>
      <span>${unlocked ? '✅' : '🔒'}</span>
    `;
    achievementsList.appendChild(div);
  });
}

async function renderLeaderboard() {
  if (!leaderboardList) return;
  
  try {
    const usersRef = ref(db, 'users');
    const leaderboardQuery = query(usersRef, orderByChild('level'), limitToLast(10));
    const snapshot = await get(leaderboardQuery);
    
    if (!snapshot.exists()) {
      leaderboardList.innerHTML = '<p>Belum ada data.</p>';
      return;
    }
    
    const users = [];
    snapshot.forEach(child => {
      users.push({
        uid: child.key,
        ...child.val(),
      });
    });
    
    // Sort descending
    users.sort((a, b) => b.level - a.level);
    
    leaderboardList.innerHTML = users.slice(0, 10).map((user, index) => {
      const isMe = auth.currentUser && user.uid === auth.currentUser.uid;
      return `
        <div class="leaderboard-row ${isMe ? 'is-me' : ''}">
          <span>#${index + 1}</span>
          <span>${user.username || 'Anonymous'}</span>
          <span>Lv.${user.level || 1}</span>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Leaderboard error:', error);
    leaderboardList.innerHTML = '<p>Gagal load leaderboard.</p>';
  }
}

// ==================== EVENT LISTENERS ====================
profileBtn?.addEventListener('click', () => {
  if (profilePanel.style.display === 'none' || !profilePanel.style.display) {
    profilePanel.style.display = 'block';
    updateProfileUI();
  } else {
    profilePanel.style.display = 'none';
  }
});

saveBioBtn?.addEventListener('click', async () => {
  if (!userData) return;
  
  const bio = profileBio.value.trim();
  if (bio.length > 100) {
    setMessage('Bio maksimal 100 karakter!', false);
    return;
  }
  
  userData.bio = bio;
  await saveUserData();
  setMessage('💾 Bio disimpan!');
});

// Initialize on user load
window.addEventListener('userLoaded', () => {
  updateProfileUI();
});

export { updateProfileUI };
