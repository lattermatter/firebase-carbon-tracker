import { auth, db } from "./firebase-init.js";
import { displaySuccessMessage } from './store-data.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";


const cloudFunctionUrl = 'https://us-central1-carbontracker-c35fd.cloudfunctions.net/test-function';
let graphImages = {}; // Object to hold base64 images

// Check for user authentication and enable button
auth.onAuthStateChanged(async user => {
    if (user) {
        const fetchGraphsBtn = document.getElementById('fetch-graphs-btn');
        // Check if the user has more than 2 entries in user_carbon_data
        const userCarbonDataRef = query(
            collection(db, 'user_carbon_data'),
            where('user_id', '==', user.uid)
        );
        
        // Fetch the user_carbon_data collection
        try {
            // Fetch the user_carbon_data collection
            const querySnapshot = await getDocs(userCarbonDataRef);

            // Check the number of entries

            // Check the number of entries
            if (querySnapshot.size > 1) {
                fetchGraphsBtn.disabled = false; // Enable the button

                // Add event listener for button click
                fetchGraphsBtn.addEventListener('click', () => {
                    fetchAllGraphs(user.uid);
                });
            } else {
                displaySuccessMessage("too-little-entries", "Enter at least 2 entries into the Input Data section before viewing graphs.");
                fetchGraphsBtn.disabled = true; // Keep the button disabled
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            fetchGraphsBtn.disabled = true; // Keep the button disabled in case of error
        }
    } else {
        console.error("No user signed in. Please sign in to view your data.");
        document.getElementById('data-display').innerText = 'Error: No user signed in. Please log in first.';
    }
});

async function fetchAllGraphs(userId) {
    // Show loading message
    document.getElementById('loading-message').style.display = 'block';
    document.getElementById('fetch-graphs-btn').style.display = 'none';
    document.getElementById('tab-container').style.display = 'none'; // Hide buttons initially

    try {
        const response = await fetch(cloudFunctionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();

        graphImages = {
            'footprint_hours': data.hours,
            'footprint_miles': data.miles,
            'footprint_energy': data.energy,
            'pie_chart': data.pie
        };

        console.log('Graph images loaded!');

        // Hide loading message and show the buttons once images are loaded
        document.getElementById('loading-message').style.display = 'none';
        document.getElementById('tab-container').style.display = 'block'; // Show buttons

    } catch (error) {
        console.error('Error fetching graph images:', error);
        document.getElementById('loading-message').innerText = 'Error loading graphs.';
    }
}

window.openTab = function(graphType) {
    const testelement = document.getElementById('img_display_section');
    testelement.src = `data:image/png;base64,${graphImages[graphType]}`;
    testelement.style.display = "block";
};
