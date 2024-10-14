import { db } from './firebase-init.js';
import { collection, doc, setDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// Generic function to store data in Firestore
// Async means the function will run in background
export async function storeData(collectionName, data, docId = null) {
  try {
    if (docId) {
      // If a document ID is provided, set data to the specific document
      await setDoc(doc(db, collectionName, docId), data);
    } else {
      // If no document ID is provided, add a new document to the collection
      await addDoc(collection(db, collectionName), data);
    }
    console.log(collectionName + " entry successfully saved.");
  } catch (error) {
    console.error("Error saving data to Firestore:", error);
  }
}

export async function displaySuccessMessage(id, displaystring) {
  const successMessage = document.getElementById(id);
  successMessage.textContent = displaystring;
  successMessage.style.display = 'block'; // Show the success message
}