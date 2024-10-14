import { auth } from './firebase-init.js';  

// If any other page is loaded without authentication, the user is sent back to login/home
auth.onAuthStateChanged((user) => {
  if (!user) {
    if (!window.location.href.includes('index.html')) {
      window.location.href = 'auth.html';
    } else {
      // Update header to say the message
      const header = document.getElementById("header"); // Assuming your header has this ID
      header.innerHTML = "<h4>Please make sure to login before accessing the application. <a href='auth.html'>Login</a></h4>";
    }
  }
});


// The user is signed out if the sign out button is clicked.
document.getElementById('sign-out-btn').addEventListener('click', () => {
  console.log("Sign out button clicked.");
  auth.signOut().then(() => {
    // Sign-out successful
    window.location.href = 'auth.html';
    console.log('Successfully signed out');
  }).catch((error) => {
    // An error happened
    console.error('Error signing out:', error);
  });
});