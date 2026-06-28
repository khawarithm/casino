import { auth, db } from './firebase-config.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { ref, set, get, update } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// DOM Elements
const authScreen = document.getElementById('authScreen');
const gameScreen = document.getElementById('gameScreen');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegister = document.getElementById('showRegister');
const showLogin = document.getElementById('showLogin');
const authError = document.getElementById('authError');
const logoutBtn = document.getElementById('logoutBtn');

// Default user data structure
const DEFAULT_USER_DATA = {
  username: '',
  email: '',
  bio: '',
  tokens: 500,
  xp: 0,
  level: 1,
  winstreak: 0,
  maxWinstreak: 0,
  totalWins: 0,
  totalGames: 0,
  charms: [], // {id, name, luckBonus, equipped}
  equippedCharms: [null, null], // max 2
  achievements: [],
  loan: 0,
  loanInterest: 0,
  bandar: {
    isBandar: false,
    casinoName: 'CasinoKu',
    unlockedModes: ['slot'],
    income: 0,
    rtp: 60,
  },
  lastLogin: Date.now(),
  createdAt: Date.now(),
};

// Toggle auth forms
showRegister.addEventListener('click', () => {
  loginForm.style.display = 'none';
  registerForm.style.display = 'flex';
  showRegister.style.display = 'none';
  showLogin.style.display = 'block';
});

showLogin.addEventListener('click', () => {
  registerForm.style.display = 'none';
  loginForm.style.display = 'flex';
  showLogin.style.display = 'none';
  showRegister.style.display = 'block';
});

// Register
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;

  try {
    // Check if username exists
    const usernameRef = ref(db, `usernames/${username.toLowerCase()}`);
    const usernameSnap = await get(usernameRef);
    if (usernameSnap.exists()) {
      authError.textContent = 'Username sudah dipakai!';
      return;
    }

    // Create user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Save user data
    const userData = {
      ...DEFAULT_USER_DATA,
      username: username,
      email: email,
      createdAt: Date.now(),
    };

    await set(ref(db, `users/${user.uid}`), userData);
    await set(ref(db, `usernames/${username.toLowerCase()}`), user.uid);

    authError.textContent = '';
    console.log('Register berhasil!');
  } catch (error) {
    authError.textContent = error.message;
  }
});

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    authError.textContent = '';
  } catch (error) {
    authError.textContent = error.message;
  }
});

// Logout
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  window.location.reload();
});

// Auth state listener
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // User signed in
    authScreen.classList.remove('active');
    gameScreen.classList.add('active');
    
    // Load user data
    const userRef = ref(db, `users/${user.uid}`);
    const snapshot = await get(userRef);
    
    if (!snapshot.exists()) {
      // First time login, create default data
      await set(userRef, {
        ...DEFAULT_USER_DATA,
        email: user.email,
        createdAt: Date.now(),
      });
    }
    
    // Update last login
    await update(userRef, { lastLogin: Date.now() });
    
    // Dispatch event for other modules
    window.dispatchEvent(new CustomEvent('userLoaded', { 
      detail: { uid: user.uid, email: user.email } 
    }));
  } else {
    // User signed out
    authScreen.classList.add('active');
    gameScreen.classList.remove('active');
  }
});

export { DEFAULT_USER_DATA };
