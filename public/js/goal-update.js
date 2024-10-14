import { auth, db } from './firebase-init.js';
import { storeData, displaySuccessMessage } from './store-data.js';
import { collection, query, where, getDocs, orderBy, limit, deleteDoc, doc, setDoc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

let userId;
const loadingSpinner = document.getElementById('loading-spinner');
const carbonFootprintTable = document.getElementById('carbon-footprint-table');
const carbonFootprintBody = document.getElementById('carbon-footprint-body');
const badgePlaceholder = document.getElementById('badge-placeholder');
const carbonBadge = document.getElementById('carbon-badge');

// Function to display the spinner
function showSpinner() {
    loadingSpinner.style.display = 'block';
    carbonFootprintTable.style.display = 'none';
}

function showTable() {
    carbonFootprintTable.style.display = 'block'; 
}

// Function to hide the spinner
function hideSpinner() {
    loadingSpinner.style.display = 'none';
}

function displayBadge() {
    // Find the element where the badge will be inserted
    const badgeContainer = document.getElementById('badge-container');

    // Clear any existing badges to avoid duplication
    badgeContainer.innerHTML = '';

    // Create an image element for the carbon badge
    const badge = document.createElement('img');
    displaySuccessMessage('badge-success', "Great job with your Carbon Saving! You received this week's carbon badge.")

    badge.src = '../images/badge.png'; // Update with the correct path to your badge image
    badge.alt = 'Carbon Badge';

    badge.style.width = '150px'; // Set desired width
    badge.style.height = 'auto'; // Maintain aspect ratio

    badge.classList.add('carbon-badge'); // Add a class for styling if necessary

    // Append the badge to the container
    badgeContainer.appendChild(badge);
    
    // Make the badge container visible
    badgeContainer.style.display = 'block';
}


// Fetch and display user data
async function fetchAndDisplayData() {
    showSpinner();
    
    try {
        // Fetch user predictions, init data, and carbon data
        const predictionsRef = doc(db, 'user_predictions', userId);
        const predictionsSnap = await getDoc(predictionsRef);  // Correct: getDoc for single document
        
        const userInitRef = doc(db, 'user_init_data', userId);
        const userInitSnap = await getDoc(userInitRef); // Correct: getDoc for single document
        
        // Check if user_init_data document exists
        if (!userInitSnap.exists()) {
            displaySuccessMessage('error-text', 'Input 5 days before accessing tracking.');
            return;
        }
        
        // Extract inputDays from the user_init_data document
        const inputDays = userInitSnap.data().inputDays;  // Default to 0 if inputDays is not present
        console.log(inputDays)
        
        // Check if inputDays is greater than 5
        if (inputDays <= 5) {
            displaySuccessMessage('error-text', 'You must enter data for 6+ days to access predictions.');
            return;
        }
        if (!predictionsSnap.exists()) {
            displaySuccessMessage('error-text', 'Predictions have not run yet, enter more days. You may have reinitialized constants.')
            return;
        }
    
         // Fetch inputDays
        const { car_factor, digital_factor, e_factor } = userInitSnap.data(); // Get factors from init data
    
        const { goal_total, predicted_total } = predictionsSnap.data(); // Get goal and predicted totals
    
        const carbonDataRef = collection(db, 'user_carbon_data');
        const q = query(carbonDataRef, where('user_id', '==', userId), orderBy('date', 'desc'), limit(inputDays % 5 + 2));
        const carbonDataSnap = await getDocs(q);
        
        if (carbonDataSnap.empty) {
            console.error('No carbon data found!');
            return;
        }
        
        // Initialize total actual values
        let totalActual = 0;
        let count = 0;
    
        const carbonDataArray = [];
        carbonDataSnap.forEach((doc) => {
            // Push document data to the array
            const docData = doc.data();  // Get data for each document 
            carbonDataArray.push(docData);
        });
    

        // Reverse the array to show from oldest to newest
        const reversedCarbonData = carbonDataArray.reverse();

        // Now process and display the reversed data
        reversedCarbonData.forEach((data) => {
            const actualCarbon = data.energy * e_factor + data.hours * digital_factor + data.miles * car_factor;

            // Add row to table with date, goal, actual, and difference
            if (count != 0) {
                totalActual += actualCarbon;
                console.log(totalActual);
                addRowToTable(data.date, goal_total, totalActual, goal_total - totalActual);
                showTable();
                count += 1;

            } else {
                addRowToTable(data.date, goal_total, totalActual, goal_total - totalActual);
                count += 1;
            } 

            if (totalActual < goal_total && count > 5) {
                
                displayBadge(); // Function to display the badge
            }

        });
    
        // Update successTimes if conditions are met
        await updateSuccessTimes(totalActual, predicted_total);

    
    } catch (error) {
        console.error("Error fetching data: ", error);
    } finally {
        hideSpinner();
    }
}

function addRowToTable(date, goal, actual, difference) {
    const row = `<tr>
        <td>${date}</td>
        <td>${goal.toFixed(2)}</td>
        <td>${actual.toFixed(2)}</td>
        <td>${difference.toFixed(2)}</td>
    </tr>`;
    carbonFootprintBody.innerHTML += row;
}

// Update the successTimes variable
async function updateSuccessTimes(totalActual, predicted_total) {
    const userInitRef = doc(db, 'user_init_data', userId);
    const userInitSnap = await getDoc(userInitRef); // Get user init data

    if (!userInitSnap.exists()) {
        console.error("No user init data found!");
        return;
    }

    const userInitData = userInitSnap.data();
    const { inputDays, successTimes, goalReachedUpdated } = userInitData;

    if (inputDays % 5 === 0 && totalActual < predicted_total && !goalReachedUpdated) {
        const newsuccessTimes = successTimes + 1;

        // Increment successTimes
        const userInitRef = doc(db, 'user_init_data', userId);
        await updateDoc(userInitRef, {
            successTimes: newsuccessTimes,
            goalReachedUpdated: true // Use Firebase's increment method
        });
        console.log("Success times updated!");

    } else if (inputDays % 5 != 0) {
            const userInitRef = doc(db, 'user_init_data', userId);
            await updateDoc(userInitRef, {
                goalReachedUpdated: false // Use Firebase's increment method
            });
            console.log("newsuccessTimes reset.");
    }
}

// CALL ON LOAD
// Use the Auth State Listener to ensure the user is authenticated
auth.onAuthStateChanged((user) => {
    if (user) {
        userId = user.uid;
        fetchAndDisplayData(userId); // Fetch and display data once user is available
    } else {
        console.error("No user is signed in. Redirect to login page or show an error.");
        // Handle what happens if no user is signed in, e.g., redirect to login
    }
});