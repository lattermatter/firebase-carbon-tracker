from google.cloud import firestore
from flask import jsonify
import functions_framework
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error
import numpy as np
import os
import json
from google.api_core.exceptions import PermissionDenied

# Initialize Firestore
db = firestore.Client()
TEST_USER_ID = "put_test_id_here"
is_local = os.getenv('LOCAL_DEV', 'false') == 'true'

def check_id(user_id):
    # Reference to the user_predictions collection
    predictions_ref = db.collection('user_predictions')

    # Check if the user_id already exists
    if predictions_ref.document(user_id).get().exists:
        return
    # Create the document with default values
    try:
        predictions_ref.document(user_id).set({
            "goal_total": 0,
            "predicted_total": 0,
            "predictions": {
                "hours": [0] * 5,
                "miles": [0] * 5,
                "energy": [0] * 5
            },
            "past_predictions": {
                "hours": [0] * 5,
                "miles": [0] * 5,
                "energy": [0] * 5
            }
        })
    except PermissionDenied as e:
        # Check if the error message contains specific keywords
        if "missing" in str(e):
            print("Permission Denied: Missing permissions.")
        elif "insufficient" in str(e):
            print("Permission Denied: Insufficient permissions.")
        else:
            print("Permission Denied: An unknown permissions error occurred.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

def get_carbon_data(user_id):
    # Get the last 5 days of user carbon data
    docs = db.collection('user_carbon_data') \
              .where('user_id', '==', user_id) \
              .order_by('date', direction=firestore.Query.DESCENDING) \
              .limit(5) \
              .get()
              
    data = [doc.to_dict() for doc in docs]

    # Reverse the list to get ascending order
    data.reverse()

    constants_doc = db.collection('user_init_data').document(user_id).get()
    
    if not constants_doc.exists:
        raise Exception(f"No initialization data found for user ID: {user_id}")

    constants_dict = constants_doc.to_dict()

    hours = []
    miles = []
    energy = []

    for doc in data:
        doc_data = doc
        
        footprint_hours = doc_data['hours'] * constants_dict['digital_factor']
        footprint_miles = doc_data['miles'] * constants_dict['car_factor']
        footprint_energy = doc_data['energy'] * constants_dict['e_factor']

        hours.append(footprint_hours)
        miles.append(footprint_miles)
        energy.append(footprint_energy)

    if len(hours) < 5 or len(miles) < 5 or len(energy) < 5:
        raise Exception("Not enough carbon data available for the last 5 days.")
    
    return hours, miles, energy

def fit_best_model(X, y):
    models = {}
    
    # Linear Regression
    lin_model = LinearRegression()
    lin_model.fit(X, y)
    lin_predictions = lin_model.predict(X)
    models['Linear'] = (lin_model, lin_predictions, mean_squared_error(y, lin_predictions))

    # Fractional Power Regression (degree 0.7-1)
    # Apply transformation X^0.7
    X_frac_1 = np.power(X, 0.7)
    frac_model_1 = LinearRegression()
    frac_model_1.fit(X_frac_1.reshape(-1, 1), y)  # Reshape to fit model
    frac_predictions_1 = frac_model_1.predict(X_frac_1.reshape(-1, 1))
    models['Frac_0.7-1'] = (frac_model_1, frac_predictions_1, mean_squared_error(y, frac_predictions_1))

    # Fractional Power Regression (degree 1.2-1.5)
    # Apply transformation X^1.2
    X_frac_2 = np.power(X, 1.2)
    frac_model_2 = LinearRegression()
    frac_model_2.fit(X_frac_2.reshape(-1, 1), y)  # Reshape to fit model
    frac_predictions_2 = frac_model_2.predict(X_frac_2.reshape(-1, 1))
    models['Frac_1.2-1.5'] = (frac_model_2, frac_predictions_2, mean_squared_error(y, frac_predictions_2))

    # Determine the best model based on MSE
    best_model_name, (best_model, predictions, error) = min(models.items(), key=lambda x: x[1][2])
    return best_model_name, (best_model, predictions, error)
    
    # Get the model with the lowest MSE
    # return "Frac_0.7-1", models['Frac_0.7-1'] # Return the model and its predictions

@functions_framework.http
def predictive_ai(request):
    # CORS preflight request handling
    CORS = True
    if CORS:
        if request.method == "OPTIONS":
            headers = {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS, POST",
                "Access-Control-Allow-Headers": "Content-Type"
            }
            return ("", 204, headers)

        # Initialize user_id based on environment
        if is_local:
            user_id = TEST_USER_ID  # Use test user ID if running locally
        else:
            # For non-local environments
            if request.method == 'POST':
                request_json = request.get_json(silent=True)
                user_id = request_json.get("user_id")  # Extract user_id from request_json for POST
                if not user_id:
                    return json.dumps({"error": "user_id is required"}), 400, {"Content-Type": "application/json"}
            else:
                user_id = request.args.get('user_id')  # For GET request
                if not user_id:
                    return json.dumps({"error": "user_id is required"}), 400, {"Content-Type": "application/json"}

        # Additional headers for non-local requests
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST",
            "Access-Control-Allow-Headers": "Content-Type"
        }

        # Ensure user_id is properly set
        if not user_id:
            return json.dumps({"error": "User ID not provided."}), 400, {"Content-Type": "application/json"}

    check_id(user_id)
    hours, miles, energy = get_carbon_data(user_id)

    models = {}
    numpymap = []
    init_preds = {}

    for feature, data in zip(['hours', 'miles', 'energy'], [hours, miles, energy]):
        # Reshape X for the regression models
        X = np.array(range(len(data))).reshape(-1, 1)
        y = np.array(data)
        numpymap.append(y)
        
        best_model = fit_best_model(X, y)
        preds = best_model[1][1]
        init_preds[feature] = preds.tolist()
        models[feature] = [best_model[0], best_model[1][0]]

    # Future days to predict
    future_days = np.array(range(len(data), len(data) + 5)).reshape(-1, 1)
    # Create a dictionary to hold the predictions
    predictions = {}
    # Use the best model for each feature to predict future data
    for feature in ['hours', 'miles', 'energy']:
        model_name = models[feature][0]
        model = models[feature][1]
        if 'Frac' in model_name:
            # Use the appropriate power transformation based on the model type
            # Check the model name to determine which fractional model was used
            if '0.7' in model_name:  # Assuming you check for specific feature models
                predicted_values = np.power(future_days, 0.7)
                # Use the power you used for fitting
            else:
                predicted_values = np.power(future_days, 1.2)  # Example for another model

            predictions[feature] = np.maximum(0, model.predict(predicted_values)).tolist()
        else:
            # For linear models, simply predict
            predictions[feature] = np.maximum(0, model.predict(future_days)).tolist()

    # Now you have the predictions in the `predictions` dictionary
    predicted_hours = predictions['hours']
    predicted_miles = predictions['miles']
    predicted_energy = predictions['energy']
    
    # Output predictions
    
    plotting_debug = False
    if plotting_debug == True:
        import matplotlib.pyplot as plt

        # Assuming initial predictions (0-4) are stored in init_preds
        # and future predictions (5-9) are in predicted_hours, predicted_miles, predicted_energy

        # Sample X-axis (day range from 0 to 9)
        X_init = np.array([0, 1, 2, 3, 4]).reshape(-1, 1)  # For initial predictions (0-4)
        X_future = np.array([5, 6, 7, 8, 9]).reshape(-1, 1)  # For future predictions (5-9)

        # Create subplots for hours, miles, and energy
        plt.figure(figsize=(10, 15))

        # Plot 1: Hours Prediction
        plt.subplot(3, 1, 1)
        plt.scatter(X_init, numpymap[0], color='blue', label='Actual Hours')
        plt.plot(X_init, models['hours'][1].predict(X_init), color='orange', linestyle='--', label='Initial Predicted Hours (0-4)')
        plt.plot(X_future, predicted_hours, color='red', label='Future Predicted Hours (5-9)')
        plt.xlabel('Day')
        plt.ylabel('Hours')
        plt.title('Hours Prediction')
        plt.legend()

        # Plot 2: Miles Prediction
        plt.subplot(3, 1, 2)
        plt.scatter(X_init, numpymap[1], color='blue', label='Actual Miles')
        plt.plot(X_init, models['miles'][1].predict(X_init), color='orange', linestyle='--', label='Initial Predicted Miles (0-4)')
        plt.plot(X_future, predicted_miles, color='red', label='Future Predicted Miles (5-9)')
        plt.xlabel('Day')
        plt.ylabel('Miles')
        plt.title('Miles Prediction')
        plt.legend()

        # Plot 3: Energy Prediction
        plt.subplot(3, 1, 3)
        plt.scatter(X_init, numpymap[2], color='blue', label='Actual Energy')
        plt.plot(X_init, models['energy'][1].predict(X_init), color='orange', linestyle='--', label='Initial Predicted Energy (0-4)')
        plt.plot(X_future, predicted_energy, color='red', label='Future Predicted Energy (5-9)')
        plt.xlabel('Day')
        plt.ylabel('Energy')
        plt.title('Energy Prediction')
        plt.legend()

        # Show the combined plots
        plt.tight_layout()
        plt.show()
    
    predicted_total = sum(predicted_hours) + sum(predicted_miles) + sum(predicted_energy)
    goal_total = predicted_total * 0.9

    predictions_ref = db.collection('user_predictions').document(user_id)
    
    output = {
        "past_predictions" : {
            "hours": init_preds["hours"],
            "miles": init_preds["miles"],
            "energy": init_preds["energy"]
        },
        "predictions": {
            "hours": predicted_hours,
            "miles": predicted_miles,
            "energy": predicted_energy
        },
        "predicted_total": predicted_total,
        "goal_total": goal_total
    }
    
    predictions_ref.update(output)
    
    return jsonify(output), 200, headers
