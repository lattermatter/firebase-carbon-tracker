// Import Firebase authentication functions
import {signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { auth } from './firebase-init.js';

const googleProvider = new GoogleAuthProvider();

// Handle form submission for sign-in
const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');

loginForm.addEventListener('submit', (e) => {
  e.preventDefault(); // Prevent default form submission behavior

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!email || !password) {
    errorMessage.textContent = 'Please enter both email and password.';
    errorMessage.style.display = 'block';
    return;
  }

  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      // Successfully signed in
      const user = userCredential.user;
      console.log('User signed in:', user);
      
      window.location.href = 'index.html'; // Redirect after login
    })
    .catch((error) => {
      console.error('Error signing in:', error.message);
      errorMessage.textContent = getErrorMessage(error.code);
      errorMessage.style.display = 'block'; // Show error message
    });
});

// Handle sign-up button click
document.getElementById('signUpButton').addEventListener('click', (e) => {
  e.preventDefault(); // Prevent form submission if used within a form

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!email || !password) {
    errorMessage.textContent = 'Please enter both email and password.';
    errorMessage.style.display = 'block';
    return;
  }

  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      // Successfully signed up
      const user = userCredential.user;
      console.log("User signed up:", user);
      window.location.href = 'index.html'; // Redirect after sign-up
    })
    .catch((error) => {
      console.error("Error signing up:", error.message);
      errorMessage.textContent = getErrorMessage(error.code);
      errorMessage.style.display = 'block'; // Show error message
    });
});

// Handle sign-in button click
document.getElementById('signInButton').addEventListener('click', (e) => {
  e.preventDefault(); // Prevent form submission if used within a form

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!email || !password) {
    errorMessage.textContent = 'Please enter both email and password.';
    errorMessage.style.display = 'block';
    return;
  }

  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      // Successfully signed in
      const user = userCredential.user;
      console.log("User signed in:", user);
      window.location.href = 'index.html'; // Redirect after sign-in
    })
    .catch((error) => {
      console.error("Error signing in:", error.message);
      errorMessage.textContent = getErrorMessage(error.code);
      errorMessage.style.display = 'block'; // Show error message
    });
});

// Function to translate Firebase error codes to user-friendly messages
function getErrorMessage(errorCode) {
  switch (errorCode) {
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/email-already-in-use':
      return 'The email address is already in use by another account.';
    case 'auth/invalid-email':
      return 'Invalid email address format.';
    case 'auth/user-not-found':
      return 'No user found with this email.';
    case 'auth/wrong-password':
      return 'Incorrect password.';
    case 'auth/invalid-credential':
      return 'Incorrect password or email.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with the same email but different sign-in credentials.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completing the sign-in.';
    case 'auth/cancelled-popup-request':
      return 'Only one popup request allowed at a time.';
    default:
      return 'An error occurred. Please try again.';
  }
}

//Function for sign in with Google
document.getElementById('google-signin-button').addEventListener('click', (e) => {
  e.preventDefault(); // Prevent default form submission behavior

  const googleSignInButton = e.target;
  googleSignInButton.disabled = true; // Disable button to prevent multiple clicks

  signInWithPopup(auth, googleProvider)
    .then((result) => {
      // Successfully signed in
      const user = result.user;
      console.log("User signed in with Google:", user);
      window.location.href = 'index.html'; // Redirect after sign-in
    })
    .catch((error) => {
      console.error("Error signing in with Google:", error.message);
      errorMessage.textContent = getErrorMessage(error.code); // Improved error message
      errorMessage.style.display = 'block'; // Show error message
    })
    .finally(() => {
      googleSignInButton.disabled = false; // Re-enable the button after the request finishes
    });
});

document.getElementById('reset-password-button').addEventListener('click', (e) => {
  e.preventDefault(); // Prevent default button behavior

  const resetEmail = document.getElementById('reset-email').value.trim(); // Get email input
  const resetMessage = document.getElementById('reset-message'); // Feedback div

  if (!resetEmail) {
    resetMessage.textContent = 'Please enter your email.';
    resetMessage.style.color = 'red';
    resetMessage.style.display = 'block';
    return;
  }

  sendPasswordResetEmail(auth, resetEmail)
    .then(() => {
      // Password reset email sent
      resetMessage.textContent = 'Reset link sent! Please check your email.';
      resetMessage.style.color = 'green';
      resetMessage.style.display = 'block';
    })
    .catch((error) => {
      console.error('Error sending reset email:', error.message);
      resetMessage.textContent = getResetErrorMessage(error.code);
      resetMessage.style.color = 'red';
      resetMessage.style.display = 'block';
    });
});


document.getElementById('forgot-password-button').addEventListener('click', (e) => {
  e.preventDefault(); // Prevent default button behavior
  const resetSection = document.getElementById('reset-password-section');
  
  // Toggle the display property
  if (resetSection.style.display === 'none' || resetSection.style.display === '') {
    resetSection.style.display = 'block'; // Show the reset section
  } else {
    resetSection.style.display = 'none'; // Hide the reset section
  }
});