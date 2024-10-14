import { auth, db } from './firebase-init.js';
import { storeData, displaySuccessMessage } from './store-data.js';
import { collection, query, where, getDocs, orderBy, limit, deleteDoc, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

function hideMessages() {
    document.getElementById("success-message").style.display = "none";
    document.getElementById("warning").style.display = "none";
    document.getElementById("prediction-output").style.display = "none";
}

async function runPredictiveAnalysis(userId, numberOfEntries) {
    try {
        // Check if number of entries is a multiple of 5
        if (numberOfEntries > 0 && numberOfEntries % 5 === 0) {
            console.log("Running predictive analysis...");
            
            // Call the predictive analysis function
            const response = await fetch("https://us-central1-carbontracker-c35fd.cloudfunctions.net/data-prediction", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ user_id: userId }) 
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            return "Predictive analysis has run! Look at tracking to view your graphs." // Return the response as a string for use elsewhere
        } else {
            return "Predictive analysis will run every 5 entries.";
        }
    } catch (error) {
        console.error("Error running predictive analysis:", error);
        return `Error: ${error.message}`;
    }
}

document.getElementById('carbonInfoForm').addEventListener('submit', async (e) => {
    hideMessages();
    e.preventDefault();
    
    // Get user input values
    const dateInput = document.getElementById('date').value; 
    const miles = parseFloat(document.getElementById('miles').value) || 0;
    const hours = parseFloat(document.getElementById('hours').value) || 0;
    const energy = parseFloat(document.getElementById('energy').value) || 0;
    const user = auth.currentUser;
    const userId = user.uid;

    // Prepare data for submission
    const data = { 
        user_id: userId,
        date: dateInput,
        miles: miles, 
        hours: hours, 
        energy: energy,
        timestamp: new Date()
    };
    
    try {
        // Check for the most recent date entry
        const recentEntrySnapshot = await getDocs(query(
            collection(db, 'user_carbon_data'),
            where('user_id', '==', userId),
            orderBy('timestamp', 'desc'), // Order by the timestamp in descending order
            limit(1) // Limit to the most recent entry
        ));

        let recentDate = null;
        if (!recentEntrySnapshot.empty) {
            recentDate = recentEntrySnapshot.docs[0].data().date; // Get the most recent date as a string
        }
        

        // Check if the new date is less than or equal to the recent date
        if (recentDate && new Date(dateInput) <= new Date(recentDate + 'T00:00:00')) {
            displaySuccessMessage('success-message', `The date must be greater than the most recent entry date (${recentDate}).`);
            return; // Stop the submission
        }
        
        if (recentDate) {
            const recentDateObj = new Date(recentDate);
            const inputDateObj = new Date(dateInput);
            const consecutiveDate = new Date(recentDateObj);
            consecutiveDate.setDate(recentDateObj.getDate() + 1); // Set to the next day
            
            // Get the day after the consecutive date
            const dayAfterConsecutiveDate = new Date(consecutiveDate);
            dayAfterConsecutiveDate.setDate(consecutiveDate.getDate() + 1); // Increment by one more day
            
            // Format the date to YYYY-MM-DD
            const formatDate = (date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
            
            const formattedDayAfterConsecutiveDate = formatDate(dayAfterConsecutiveDate);
            
            if (inputDateObj > consecutiveDate) {
                displaySuccessMessage("warning", `If the display is non-consecutive, model predictions might be off. Delete previous entry and use date ${formattedDayAfterConsecutiveDate} for best results.`);
            }
        }

        // Check if constants have been made
        const userInitRef = doc(db, 'user_init_data', userId);
        const userInitSnap = await getDoc(userInitRef);
        const userConstants = userInitSnap.data();
        const requiredConstants = ['car_factor', 'digital_factor', 'e_factor'];

        // Check if user constants exist
        if (!userInitSnap.exists()) {
            alert("Please enter the necessary constants before submitting your input. Use the initialization form below.");
            return; // Stop further execution
        }

        for (const constant of requiredConstants) {
            if (userConstants[constant] === undefined || userConstants[constant] === null || userConstants[constant] === '') {
                alert(`Please enter the necessary constants before submitting your input. Use the initialization form below.`);
                return; // Stop further execution
            }
        }

        // Store the data in Firestore
        await storeData('user_carbon_data', data);

        // Count entries in user_carbon_data for the current user
        const userEntriesSnapshot = await getDocs(query(
            collection(db, 'user_carbon_data'),
            where('user_id', '==', userId)
        ));

        const numberOfEntries = userEntriesSnapshot.size; // Get the count of documents

        runPredictiveAnalysis(userId, numberOfEntries).then(result => {
            displaySuccessMessage("prediction-output", result);
        }).catch(error => {
            console.log('Error:', error);
        })
        
        const userInitDataDoc = doc(db, 'user_init_data', userId); // Create a reference to the document
        console.log("Number of entries: " + numberOfEntries);
        await setDoc(userInitDataDoc, { inputDays: numberOfEntries }, { merge: true });

        // Reset the form and display success message
        document.getElementById('carbonInfoForm').reset();
        displaySuccessMessage('success-message', `Information for the date ${dateInput} has been submitted successfully!`);

    } catch (error) {
        console.error("Error storing data or updating user_init_data:", error);
        displaySuccessMessage('success-message', 'An error occurred while processing your request.');
    }
});

document.getElementById('deleteLastEntryButton').addEventListener('click', async () => {
    hideMessages();
    const user = auth.currentUser;
    const userId = user.uid;

    try {
        // Get the last entry based on the date
        const userEntriesSnapshot = await getDocs(query(
            collection(db, 'user_carbon_data'),
            where('user_id', '==', userId),
            orderBy('date', 'desc'), // Order by date descending
        ));

        if (userEntriesSnapshot.empty) {
            displaySuccessMessage('success-message', 'No entries to delete.');
            return;
        }

        // Get the document ID and date of the last entry
        const lastEntryDoc = userEntriesSnapshot.docs[0];
        const lastEntryId = lastEntryDoc.id; // Get the document ID
        const lastEntryData = lastEntryDoc.data();
        const lastEntryDate = lastEntryData.date; // Get the date of the last entry

        // Delete the last entry from Firestore
        await deleteDoc(doc(db, 'user_carbon_data', lastEntryId));

        // Update the user_init_data collection
        const userInitDataDoc = doc(db, 'user_init_data', userId); // Create a reference to the document
        const userEntriesCount = userEntriesSnapshot.size - 1; // Decrement count

        await setDoc(userInitDataDoc, { inputDays: userEntriesCount }, { merge: true });

        // Display success message with the date of the deleted entry
        displaySuccessMessage('success-message', `Entry for date ${lastEntryDate} has been deleted successfully!`);
    } catch (error) {
        console.error("Error deleting last entry:", error);
        displaySuccessMessage('success-message', 'An error occurred while deleting the entry.');
    }
});

document.getElementById('recentEntry').addEventListener('click', async () => {
    hideMessages();
    const user = auth.currentUser;
    const userId = user.uid;

    try {
        const userEntriesSnapshot = await getDocs(query(
            collection(db, 'user_carbon_data'), 
            where('user_id', '==', userId),
            orderBy('date', 'desc'),
            limit(1)
        ));

        if (!userEntriesSnapshot.empty) {
            const lastEntry = userEntriesSnapshot.docs[0].data();
            const recentDate = lastEntry.date;

            // Display the recent date in the element with ID 'recentEntryMessage'
            displaySuccessMessage('success-message', `Most recent entry date: ${recentDate}`);
        } else {
            displaySuccessMessage('success-message', 'No entries found.');
        }
    } catch (error) {
        console.error("Error fetching most recent entry date:", error);
        displaySuccessMessage('success-message', 'An error occurred while retrieving the most recent entry date.');
    }
});
