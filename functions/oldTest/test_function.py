import requests

def test_get_user_graph():
    url = 'http://localhost:8080'  # Adjust to your actual local URL
    payload = {
        'user_id': 'testID',
        'graph_type': 'line',
        'graph_variable': 'footprint_miles' # or 'pie', depending on what you want to test
    }
    
    response = requests.post(url, json=payload)

    print('Status Code:', response.status_code)
    
    if response.headers['Content-Type'] == 'image/png':
        with open('output_graph.png', 'wb') as f:
            f.write(response.content)
        print('Graph saved as output_graph.png')
    else:
        print('Response Body:', response.text)  # Handle non-binary responses normally

# Run the test
test_get_user_graph()
