import { auth, db } from "./firebase-init.js";
import { displaySuccessMessage } from './store-data.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// Function to get user tips
async function getUserTips() {
    const userId = auth.currentUser.uid; // Get the current user's ID

    const tipsDiv = document.getElementById('tips');
    tipsDiv.innerHTML = ''; // Clear any existing tips

    // Create a query to get tips for the current user
    const tipsQuery = query(
        collection(db, 'user_recommendations'),
        where('user_id', '==', userId)
    );

    try {
        const querySnapshot = await getDocs(tipsQuery);
        
        if (querySnapshot.empty) {
            tipsDiv.innerHTML = 'No tips to display. Go to recommendations to get tips.';
            return;
        }

        // Create a Map to store unique tips under categories
        const tipsByCategory = new Map();

        querySnapshot.forEach(doc => {
            const tipsData = doc.data().tips; // Assuming the tips are stored under a 'tips' key

            // Iterate over categories in tips
            for (const category in tipsData) {
                const tipsArray = tipsData[category];

                // Check if tipsArray is an array
                if (Array.isArray(tipsArray)) {
                    tipsArray.forEach(tip => {
                        if (tip) {
                            // Add the tip to the map under the corresponding category
                            if (!tipsByCategory.has(category)) {
                                tipsByCategory.set(category, new Set()); // Initialize a Set for unique tips
                            }
                            tipsByCategory.get(category).add(tip); // Add tip to the Set
                        }
                    });
                }
            }
        });

        // Display tips by category
        tipsByCategory.forEach((tips, category) => {
            const categoryHeading = document.createElement('h4'); // Create an h4 element for the category
            categoryHeading.textContent = category; // Set the text to the category name
            tipsDiv.appendChild(categoryHeading); // Append the category heading to the tips div

            // Create a paragraph for each unique tip
            tips.forEach(tip => {
                const tipElement = document.createElement('p'); // Create a new paragraph for each tip
                tipElement.textContent = tip; // Set the text to the tip
                tipsDiv.appendChild(tipElement); // Append the tip to the tips div
            });
        });
    } catch (error) {
        console.error("Error fetching tips: ", error);
        tipsDiv.innerHTML = 'Error fetching tips. Please try again later.';
    }
}

// Attach event listener to the button
document.getElementById('getTipsButton').addEventListener('click', getUserTips);
