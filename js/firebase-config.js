// Firebase configuration & initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB_fFqjywlvxJtJF_M4VI8OhRgyUE1qVXs",
  authDomain: "sheeeha-67d46.firebaseapp.com",
  databaseURL: "https://sheeeha-67d46-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sheeeha-67d46",
  storageBucket: "sheeeha-67d46.firebasestorage.app",
  messagingSenderId: "203910243490",
  appId: "1:203910243490:web:cf5ed592f43910f3f0a3fb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

export { app, auth, db };
