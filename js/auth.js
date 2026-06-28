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
  charms: [],
  equippedCharms: [null, null],
  achievements: [],
  loan: 0,
  loanInterest: 0,
  bandar: {
    isBandar: false,
    casinoName: 'CasinoKu',
    unlockedModes: ['slot'],
    income: 0,
    visitors: 50,
    rtp: 60,
  },
  lastLogin: Date.now(),
  createdAt: Date.now(),
};

// Toggle forms
if (showRegister) {
  showRegister.addEventListener('click', () => {
    loginForm.style.display = 'none';
    registerForm.style.display = 'flex';
    showRegister.style.display = 'none';
    showLogin.style.display = 'block';
  });
}

if (showLogin) {
  showLogin.addEventListener('click', () => {
    registerForm.style.display = 'none';
    loginForm.style.display = 'flex';
    showLogin.style.display = 'none';
    showRegister.style.display = 'block';
  });
}

// Register
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('regUsername')?.value?.trim();
    const email = document.getElementById('regEmail')?.value?.trim();
    const password = document.getElementById('regPassword')?.value;

    if (!username || !email || !password) {
      authError.textContent = 'Semua field harus diisi!';
      return;
    }

    try {
      const usernameRef = ref(db, `usernames/${username.toLowerCase()}`);
      const usernameSnap = await get(usernameRef);
      if (usernameSnap.exists()) {
        authError.textContent = 'Username sudah dipakai!';
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userData = {
        ...DEFAULT_USER_DATA,
        username: username,
        email: email,
        createdAt: Date.now(),
      };

      await set(ref(db, `users/${user.uid}`), userData);
      await set(ref(db, `usernames/${username.toLowerCase()}`), user.uid);

      authError.textContent = '';
      authError.style.color = '#4CAF50';
      authError.textContent = 'Register berhasil! Silakan login.';
      
      // Reset form
      registerForm.reset();
      // Switch to login
      registerForm.style.display = 'none';
      loginForm.style.display = 'flex';
      showLogin.style.display = 'none';
      showRegister.style.display = 'block';
    } catch (error) {
      authError.textContent = error.message;
      console.error('Register error:', error);
    }
  });
}

// Login
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail')?.value?.trim();
    const password = document.getElementById('loginPassword')?.value;

    if (!email || !password) {
      authError.textContent = 'Email dan password harus diisi!';
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      authError.textContent = '';
      loginForm.reset();
    } catch (error) {
      authError.textContent = error.message;
      console.error('Login error:', error);
    }
  });
}

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  });
}

// Auth state listener
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log('User logged in:', user.uid);
    authScreen.classList.remove('active');
    gameScreen.classList.add('active');
    
    try {
      const userRef = ref(db, `users/${user.uid}`);
      const snapshot = await get(userRef);
      
      if (!snapshot.exists()) {
        await set(userRef, {
          ...DEFAULT_USER_DATA,
          username: user.email?.split('@')[0] || 'Player',
          email: user.email,
          createdAt: Date.now(),
        });
      }
      
      await update(userRef, { lastLogin: Date.now() });
      
      // Trigger event for other modules
      window.dispatchEvent(new CustomEvent('userLoaded', { 
        detail: { uid: user.uid, email: user.email } 
      }));
      
      console.log('User data loaded successfully');
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  } else {
    console.log('User logged out');
    authScreen.classList.add('active');
    gameScreen.classList.remove('active');
  }
});
