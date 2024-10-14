import { auth, db } from './firebase-init.js';
import { displaySuccessMessage } from './store-data.js';
import { doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

document.getElementById('initializeForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const car_factor = parseFloat(document.getElementById('carfactor').value) || 0;
    const digital_factor = parseFloat(document.getElementById('digitalfactor').value) || 0;
    const e_factor = parseFloat(document.getElementById('efactor').value) || 0;

    const user = auth.currentUser;
    const userId = user.uid;

    const userPredictionsDocRef = doc(db, 'user_predictions', userId); // Use 'user_predictions'
    const userInitDataDocRef = doc(db, 'user_init_data', userId); // Reference for user_init_data

    try {
        // Check if the user_init_data document exists
        const userInitDataDocSnapshot = await getDoc(userInitDataDocRef);
        if (userInitDataDocSnapshot.exists()) {
            // If the document exists, merge with existing data
            const existingData = userInitDataDocSnapshot.data();
            const updatedData = {
                ...existingData,
                car_factor: car_factor,
                digital_factor: digital_factor,
                e_factor: e_factor,
                timestamp: new Date(),
                goalReachedUpdated: false,
                inputDays: existingData.inputDays || 0,
                successTimes: existingData.successTimes || 0,
                carbonScore: existingData.carbonScore || 0
            };
    
            await setDoc(userInitDataDocRef, updatedData); // Update user_init_data
        } else {
            // If the document does not exist, create a new document with default values
            const newDataWithDefaults = {
                car_factor: car_factor,
                digital_factor: digital_factor,
                e_factor: e_factor,
                timestamp: new Date(),
                goalReachedUpdated: false,
                inputDays: 0,
                successTimes: 0,
                carbonScore: 0
            };
    
            await setDoc(userInitDataDocRef, newDataWithDefaults); // Create new document in user_init_data
        }

        // Check if the user_predictions document exists and delete if necessary
        const userPredictionsDocSnapshot = await getDoc(userPredictionsDocRef);
        if (userPredictionsDocSnapshot.exists()) {
            await deleteDoc(userPredictionsDocRef);
        }

        // Reset the form and display a success message
        document.getElementById('initializeForm').reset();
        displaySuccessMessage('success-message-init', `Your data has now been initialized! Go to the Enter section to enter data for a specific date.`);
    } catch (error) {
        console.error("Error storing data:", error);
    }
});
