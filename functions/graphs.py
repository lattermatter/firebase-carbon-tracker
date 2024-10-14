import os
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from google.cloud import firestore
import io
import json
import seaborn as sns
import functions_framework
# new imports:
import numpy as np
import base64
from flask import jsonify

# Initialize Firestore
db = firestore.Client()

# Test user ID for local development
TEST_USER_ID = "put_test_id_here"


class NoInitException(Exception):
    def __init__(self, message="Initialization data not found."):
        self.message = message
        super().__init__(self.message)

def fetch_user_data(user_id):
    future_and_current_preds = None  # Initialize the variable

    # Fetch user initialization data to get inputDays
    constants = db.collection('user_init_data').document(user_id).get()
    
    if not constants.exists:
        raise NoInitException(f"No initialization data found for user ID: {user_id}")
    
    constants_dict = constants.to_dict()
    input_days = constants_dict.get('inputDays', 0)  # Get inputDays, default to 0 if not found
    

    # Determine the number of documents to fetch from user_carbon_data
    docs_query = db.collection('user_carbon_data').where('user_id', '==', user_id).order_by('date', direction=firestore.Query.DESCENDING)
    
    # Fetch all documents if inputDays is less than 5
    if input_days < 5:
        docs = docs_query.get()  # Get all entries
    else:
        # Fetch the total number of documents
        all_docs = docs_query.get()
        total_docs = len(all_docs)
        
        # Calculate the number of documents to retrieve based on the provided logic
        num_to_fetch = (total_docs % 5) + 5
        
        # Ensure we don't exceed total documents available
        docs = all_docs[:num_to_fetch]  # Fetch only the calculated number of documents
    
    # Fetch user predictions if inputDays is 5 or more
    if input_days >= 5:
        predictions_doc = db.collection('user_predictions').document(user_id).get()
        
        if predictions_doc.exists:
            predictions = predictions_doc.to_dict()
            future_and_current_preds = {
                "past": predictions['past_predictions'], 
                "future": predictions['predictions']
            }

    # Extract the carbon data into a list of dictionaries
    data = []
    for doc in docs:
        doc_data = doc.to_dict()
        doc_data['timestamp'] = doc_data['timestamp'].isoformat()  # Convert timestamp to string
        data.append(doc_data)

    # Convert to pandas DataFrame
    df = pd.DataFrame(data)
    print(constants_dict)
    print(future_and_current_preds)

    # Reverse the order of the DataFrame to get it in ascending order by date
    df = df.sort_values(by='date', ascending=True).reset_index(drop=True)

    # Converting to CO2 units
    df['footprint_hours'] = df['hours'] * constants_dict['digital_factor']  # gCO2/KWh
    df['footprint_miles'] = df['miles'] * constants_dict['car_factor']      # gCO2/KWh
    df['footprint_energy'] = df['energy'] * constants_dict['e_factor']      # kgCO2/KWh
    print(df)

    # Return DataFrame and predictions (if available)
    return {'data': df, 'predictions': future_and_current_preds}

def create_graphs(df, preds=False):
    # Ensure timestamp is in datetime format
    df['date'] = pd.to_datetime(df['date'])
    

    # Set the Seaborn style and color palette
    sns.set_style("whitegrid")
    sns.set_palette("summer")  # Green-yellow color palette

    # List of variables to plot
    variables = ['footprint_hours', 'footprint_miles', 'footprint_energy']
    short_vars = ['hours', 'miles', 'energy']

    # Dictionary to store graph images
    graphs = {}

    for index, variable in enumerate(variables):
        # Create a new figure for each variable
        plt.figure(figsize=(10, 6))

        # Plot the corresponding variable from the DataFrame
        sns.lineplot(data=df, x='date', y=variable, label='Actual ' + variable.replace('footprint_', ''), linestyle='solid')

        # If preds is not None, plot past and future predictions
        if preds:
            # Extract past and future data
            past_data = preds['past'][variable.replace('footprint_', '')]
            future_data = preds['future'][variable.replace('footprint_', '')]

            # Ensure the length of past_data does not exceed available dates in the DataFrame
            if len(past_data) > len(df['date']):
                raise ValueError("Not enough dates in DataFrame for past predictions.")

            # Ensure 'date' is in datetime format
            df['date'] = pd.to_datetime(df['date'])

            # Get past dates from the DataFrame
            past_dates = df['date'].iloc[:len(past_data)].to_numpy()

            # Start future predictions right after the last date of past predictions
            future_start_index = len(past_data)

            # Extract the future dates available in the DataFrame
            future_dates = df['date'].iloc[future_start_index:future_start_index + len(future_data)].to_numpy()

            # If there aren't enough future dates, generate consecutive dates starting from the last one
            if len(future_dates) < len(future_data):
                remaining_days = len(future_data) - len(future_dates)
                # If no future dates exist, start from the last past date
                last_future_date = future_dates[-1] if len(future_dates) > 0 else df['date'].iloc[-1]
                future_dates = np.append(
                    future_dates, 
                    pd.date_range(start=last_future_date + pd.Timedelta(days=1), periods=remaining_days).to_numpy()
                )

            # Plot past predictions
            sns.lineplot(x=past_dates, y=past_data, label='Predictions: past ' + variable.replace('footprint_', ''), linestyle='--', color='orange')

            # Plot future predictions, ensuring they align correctly with dates
            sns.lineplot(x=future_dates, y=future_data, label='Predictions: future ' + variable.replace('footprint_', ''), linestyle='--', color='red')



        plt.xlabel('Time')
        plt.ylabel(f'Value - {"gCO2" if variable != "footprint_energy" else "kgCO2"}')
        plt.title(f'{variable} over time - {"gCO2" if variable != "footprint_energy" else "kgCO2"}')
        plt.legend()

        # Save the plot to a PNG in memory
        img_io = io.BytesIO()
        plt.savefig(img_io, format='png')
        img_io.seek(0)
        plt.close()  # Close the figure to free memory

        # Store the graph in the dictionary
        graphs[short_vars[index]] = img_io

    return graphs

def create_pie_chart(df):
    # Set the Seaborn theme
    sns.set_theme(style="whitegrid") 

    # Get the most recent entry as a DataFrame
    latest_entry = df.iloc[[-1]]  # Keep it as a DataFrame

    # Select the relevant columns for the pie chart
    pie_data = latest_entry[['footprint_hours', 'footprint_miles', 'footprint_energy']].iloc[0]

    # Ensure pie_data is a 1D array
    pie_data = pie_data.values  # Convert to a numpy array

    # Define the labels for the pie chart
    labels = ['Hours', 'Miles', 'Energy']

    # Choose a color palette
    colors = sns.color_palette("GnBu", n_colors=len(labels))  # Green-blue palette; adjust as needed

    # Plot pie chart
    plt.figure(figsize=(6, 6))
    plt.pie(pie_data, labels=labels, autopct='%1.1f%%', startangle=90, colors=colors)
    plt.title('Carbon Footprint Distribution')

    # Save the pie chart to a PNG in memory
    pie_io = io.BytesIO()
    plt.savefig(pie_io, format='png')
    plt.close()  # Close the figure to free memory
    pie_io.seek(0)

    return pie_io

@functions_framework.http
def get_user_graph(request):
    # Check if running locally
    is_local = os.getenv('LOCAL_DEV', 'false') == 'true'

    # CORS headers
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json"  # Ensure Content-Type is set
    }
    
    if request.method == "OPTIONS":
        return ("", 204, headers)

    # Parse request for user_id and graph type
    request_json = request.get_json(silent=True)
    
    # Fetch user data
    try:
        # Use test user ID if running locally
        if is_local:
            user_id = TEST_USER_ID
        else:
            if not request_json or 'user_id' not in request_json:
                return jsonify({"error": "user_id is required"}), 400, headers
            user_id = request_json['user_id']

        # Fetch user data
        user_data = fetch_user_data(user_id)
        data, predictions = user_data['data'], user_data['predictions']
        
        if data.empty:
            return jsonify({"error": "No data found for this user"}), 404, headers

        # Create all line graphs at once
        graphs = create_graphs(data, predictions)  # All graphs generated in a dictionary


        # Convert the line graphs to base64
        show_images = True
        if show_images:
            # Create a new figure for combined graphs
            plt.figure(figsize=(10, 6))

            # Number of images to plot
            num_images = len(graphs)
            rows = (num_images + 1) // 2  # Arrange images in rows

            # Iterate through each image in graphs
            for idx, (variable, img_io) in enumerate(graphs.items()):
                # Seek to the beginning of the BytesIO stream
                img_io.seek(0)

                # Read the image data from the BytesIO stream
                img_data = plt.imread(img_io)

                # Create a subplot for each image
                plt.subplot(rows, 2, idx + 1)  # Adjust as needed for layout
                plt.imshow(img_data)  # Display the image
                plt.axis('off')  # Turn off axis
                plt.title(variable)  # Set title as the variable name

            # Show the combined plot
            plt.tight_layout()
            plt.savefig('combined_graphs.png', bbox_inches='tight')  # Save the figure as an image file
            plt.close()
            print("Saved combined_graphs.png successfully.")
        
        # Create a dictionary to hold base64-encoded images
        graph_images = {}
        
        for variable, img_io in graphs.items():
            img_io.seek(0)
            graph_images[variable] = base64.b64encode(img_io.read()).decode('utf-8')

        # Optionally create a pie chart and include it
        img_io_pie = create_pie_chart(data)
        img_io_pie.seek(0)
        graph_images['pie'] = base64.b64encode(img_io_pie.read()).decode('utf-8')

        # Return all the graph images as a JSON response
        return jsonify(graph_images), 200, headers

    except Exception as e:
        # Include headers in error response
        return jsonify({"error": str(e)}), 500, headers

