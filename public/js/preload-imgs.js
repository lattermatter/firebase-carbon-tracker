let preloadedImages = {};
const cloudFunctionUrl = 'https://us-central1-carbontracker-c35fd.cloudfunctions.net/test-function';

// Load from sessionStorage if available
if (sessionStorage.getItem('preloadedImages')) {
  preloadedImages = JSON.parse(sessionStorage.getItem('preloadedImages'));
}

function preloadTrackingImages(userId) {
  const graphVariables = ['footprint_hours', 'footprint_miles', 'footprint_energy', 'pie_chart'];

  // Check if any images are missing or if sessionStorage is empty
  if (Object.keys(preloadedImages).length < graphVariables.length) {
    console.log("LOADING....");
    // Create an array of fetch promises
    const fetchPromises = graphVariables.map((graphVariable) => {
      let type = graphVariable === 'pie_chart' ? 'pie' : 'line';
      let subtype = graphVariable === 'pie_chart' ? null : graphVariable;

      return fetch(cloudFunctionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          graph_type: type,
          graph_variable: subtype
        })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Network response was not ok for ${graphVariable}`);
        }
        return response.blob();
      })
      .then(blob => {
        const imageUrl = URL.createObjectURL(blob);
        preloadedImages[graphVariable] = imageUrl;
        console.log(`Image preloaded for ${graphVariable}:`, imageUrl);
      })
      .catch(error => {
        console.error('Error preloading data for ' + graphVariable + ':', error);
      });
    });

    // Wait for all fetch promises to complete
    Promise.all(fetchPromises)
      .then(() => {
        // Store the preloaded images in sessionStorage after all have loaded
        sessionStorage.setItem('preloadedImages', JSON.stringify(preloadedImages));
        console.log('All images preloaded:', preloadedImages);
      })
      .catch(error => {
        console.error('Error preloading images:', error);
      });
  } else {
    console.log('Images already preloaded:', preloadedImages);
  }
}

export { preloadedImages, preloadTrackingImages };
