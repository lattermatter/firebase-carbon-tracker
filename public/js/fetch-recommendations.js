import { displaySuccessMessage, storeData } from '../js/store-data.js';
import { auth } from '../js/firebase-init.js';  // Import the auth module

document.getElementById('carbon-issue-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const issue = document.getElementById('recommend-input').value;
    const sentimentOutputElement = document.getElementById('recommendation-output'); // Reference for sentiment output
    const loadingMessageElement = document.getElementById('loading-message'); // Reference for loading message

    // Validate the length of the input
    if (issue.length > 400) {
        displaySuccessMessage('error-message', `Text too long (over 400 characters): ${issue.length}`);
        return; // Stop the function execution if the input is too long
    }

    // Get the user ID from Firebase Authentication
    const user = auth.currentUser;  // Retrieve the current user
    const userId = user ? user.uid : null;  // Get the user ID or set to null if not logged in

    const data = { 
        user_id: userId,  // Include user_id in the data
        recommendation_input: issue, 
        timestamp: new Date() 
    };

    try {
        // Show loading message
        loadingMessageElement.style.display = 'block';

        // Call the cloud function for sentiment analysis
        const response = await fetch('https://us-central1-carbontracker-c35fd.cloudfunctions.net/nlp-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)  // Send the data directly
        });
    
        if (!response.ok) {
            const errorMessage = await response.text();  // Get the response text for debugging
            console.error('Error:', errorMessage);  // Log the error message
            throw new Error(errorMessage);
        }

        const result = await response.json(); // Get the JSON response from the cloud function
        const tips = result.tips; // Assuming tips is an object
        const tipsExists = Object.keys(tips).length === 0;
        const compound = result.sentiment.compound;
        let addedText;
        
        // Add the tips result to the data object
        data.tips = tips;
        
        // Store the data (with tips) in Firestore
        if (!tipsExists) {
            await storeData('user_recommendations', data);
            displaySuccessMessage('success-message', 'Recommendation has been submitted successfully!');
        }
        
        // Reset the form
        document.getElementById('carbon-issue-form').reset();

        // Display success message along with tips

        if (compound > 0.05) {
            addedText = "That's great to hear! Here are some tips:";
            if (tipsExists) {
                addedText = "That's great to hear!";
            }
        } else if (compound < -0.05) {
            addedText = "I am sorry to hear that. Here are some tips:";
            if (tipsExists) {
                addedText = "I am sorry to hear that.";
            }
        } else {
            addedText = "Thank you for the information. Here are some tips:";
            if (tipsExists) {
                addedText = "Thank you for the information.";
            }
        }
        
        // Clear previous output
        sentimentOutputElement.innerHTML = ''; // Clear existing content
        
        // Create a header for the tips
        const tipsHeader = document.createElement('h3');
        tipsHeader.innerText = addedText; // Add the appropriate message
        sentimentOutputElement.appendChild(tipsHeader);
        
        // Create an unordered list for tips
        const tipsList = document.createElement('ul');
        
        // Check if tips is an object
        if (typeof tips === 'object' && tips !== null) {
            // Iterate over each category in the tips dictionary
            for (const category in tips) {
                // Create a list item for the category
                const categoryItem = document.createElement('li');
                categoryItem.innerText = category.charAt(0).toUpperCase() + category.slice(1) + ':'; // Capitalize category
                tipsList.appendChild(categoryItem); // Append the category to the list
        
                // Get the tips array for that category
                const categoryTips = tips[category];
                if (Array.isArray(categoryTips)) {
                    // Create a nested list for tips within this category
                    const nestedList = document.createElement('ul');
        
                    categoryTips.forEach(tip => {
                        const listItem = document.createElement('li');
                        listItem.innerText = tip; // Add a dash before each tip for clarity
                        nestedList.appendChild(listItem); // Append the list item to the nested list
                    });
        
                    tipsList.appendChild(nestedList); // Append the nested list to the main tips list
                }
            }
        } else {
            // If tips is not an object, display an error message
            const errorItem = document.createElement('li');
            errorItem.innerText = 'No tips available at this time.'; // Set error message
            tipsList.appendChild(errorItem); // Append the error message
        }
        
        // Append the tips list to the sentiment output element
        sentimentOutputElement.appendChild(tipsList);

    } catch (error) {
        console.log(error);
        sentimentOutputElement.innerText = 'Error retrieving sentiment analysis.';
        
        // Check the error message
        if (error.message.includes("Usage limit exceeded")) {
            sentimentOutputElement.innerText = 'You can only make 10 requests per week due to limited cloud function availability.';
        } else {
            sentimentOutputElement.innerText = error.message; // Log any other errors
        }
    } finally {
        // Hide loading message after processing
        loadingMessageElement.style.display = 'none';
    }
});
