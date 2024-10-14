import os
import random
import math
import nltk
from nltk.sentiment import SentimentIntensityAnalyzer
from google.cloud import firestore
from flask import jsonify
import functions_framework
from datetime import datetime, timedelta, timezone

# Initialize Firestore
db = firestore.Client()
TEST_USER_ID = "put_test_id_here"

# Set the path to the current directory and add it to NLTK's data path
nltk.data.path.append(os.path.join(os.getcwd(), 'nltk_data'))

# Initialize SentimentIntensityAnalyzer
sia = SentimentIntensityAnalyzer()

# Maximum allowed requests per week
MAX_REQUESTS_PER_WEEK = 10

# Data for analysis
tips_dict = {
    "vehicle": [
        "Drive fewer miles per day to reduce your carbon footprint.",
        "Consider a more fuel-efficient or electric vehicle.",
        "Carpool or use public transport when possible to minimize emissions.",
        "Consider biking or walking for short trips.",
        "Maintain your vehicle to ensure it runs efficiently and produces fewer emissions.",
        "Use eco-friendly driving techniques like accelerating smoothly and avoiding idling.",
        "Plan trips to combine errands and reduce unnecessary driving.",
        "Check tire pressure regularly to improve fuel efficiency.",
        "Use cruise control on highways to optimize fuel consumption.",
        "Avoid roof racks or carriers that create drag and reduce fuel efficiency."
    ],
    "diet": [
        "Incorporate more plant-based meals into your diet to reduce carbon emissions.",
        "Try 'Meatless Mondays' to help cut down on meat consumption.",
        "Choose locally-sourced and organic foods to reduce transportation emissions and pesticide use.",
        "Reduce food waste by planning meals and freezing leftovers.",
        "Compost food scraps to reduce landfill waste and create natural fertilizer.",
        "Opt for plant-based proteins such as beans, lentils, and tofu.",
        "Eat seasonally to reduce the environmental impact of out-of-season food transportation.",
        "Use reusable containers and bags for shopping to minimize plastic waste.",
        "Support sustainable farming practices by buying from ethical brands.",
        "Choose sustainably-sourced seafood to reduce overfishing and environmental damage."
    ],
    "energy": [
        "Turn off lights and unplug appliances when not in use to conserve electricity.",
        "Switch to energy-efficient LED or CFL bulbs to save energy.",
        "Install smart thermostats to optimize heating and cooling in your home.",
        "Use renewable energy sources such as solar or wind power, if available.",
        "Ensure your home is properly insulated to prevent energy loss.",
        "Use energy-efficient appliances to reduce electricity consumption.",
        "Air dry your clothes instead of using a dryer to save energy.",
        "Install solar panels to generate clean energy for your home.",
        "Close curtains or blinds to retain heat in winter and block out heat in summer.",
        "Use power strips to turn off multiple devices at once, preventing standby power usage."
    ],
    "water": [
        "Take shorter showers to conserve water and reduce your water footprint.",
        "Fix leaky faucets or pipes to prevent water waste.",
        "Install low-flow showerheads and faucets to minimize water usage.",
        "Turn off the tap while brushing your teeth or shaving to save water.",
        "Water your garden in the early morning or evening to reduce evaporation.",
        "Collect rainwater for gardening or cleaning to save water.",
        "Only run your dishwasher and washing machine with full loads to maximize efficiency.",
        "Use a broom, not a hose, to clean driveways or sidewalks.",
        "Install water-efficient toilets to reduce household water consumption.",
        "Opt for drought-tolerant plants in your garden to reduce the need for watering."
    ],
    "waste": [
        "Recycle paper, plastic, glass, and metal to reduce landfill waste.",
        "Donate old clothes and items instead of throwing them away.",
        "Avoid single-use plastics by using reusable water bottles, bags, and containers.",
        "Compost organic waste to reduce waste and create natural fertilizer.",
        "Buy products with minimal or eco-friendly packaging to reduce waste.",
        "Repurpose or upcycle old items instead of discarding them.",
        "Use reusable alternatives such as cloth napkins, metal straws, and beeswax wraps.",
        "Participate in community clean-ups to reduce local waste pollution.",
        "Support brands that prioritize sustainability and use eco-friendly materials.",
        "Buy in bulk to reduce packaging waste from individually wrapped items."
    ],
    "clothing": [
        "Buy second-hand clothes to reduce the demand for new production and textile waste.",
        "Choose clothes made from sustainable materials like organic cotton, hemp, or recycled fabrics.",
        "Wash clothes in cold water to save energy and extend the life of your garments.",
        "Air dry your clothes to reduce the energy used by dryers.",
        "Repair or tailor old clothes instead of throwing them away.",
        "Donate clothes instead of discarding them to reduce textile waste.",
        "Invest in high-quality clothing pieces that last longer and need fewer replacements.",
        "Avoid fast fashion and choose brands with ethical and sustainable practices.",
        "Organize clothing swaps with friends to refresh your wardrobe sustainably.",
        "Opt for timeless styles that don't go out of fashion quickly."
    ],
    "home": [
        "Install energy-efficient windows to reduce heating and cooling costs.",
        "Use eco-friendly cleaning products to reduce chemical pollution.",
        "Switch to reusable cloths instead of disposable paper towels.",
        "Install a programmable thermostat to manage energy usage efficiently.",
        "Seal windows and doors to prevent drafts and conserve energy.",
        "Switch to eco-friendly insulation materials like wool or recycled materials.",
        "Use a clothesline instead of a dryer whenever possible to save energy.",
        "Switch to biodegradable or natural household products.",
        "Set your water heater to 120°F (49°C) to conserve energy.",
        "Choose furniture made from sustainable or recycled materials."
    ],
    "technology": [
        "Opt for energy-efficient electronics with high Energy Star ratings.",
        "Turn off computers and devices when not in use to save energy.",
        "Unplug chargers and devices when fully charged to prevent phantom power usage.",
        "Buy refurbished electronics instead of new ones to reduce electronic waste.",
        "Recycle old electronics properly to prevent harmful materials from entering landfills.",
        "Use a power strip to easily turn off multiple devices at once and reduce standby power.",
        "Consider using a laptop instead of a desktop computer, as they typically use less energy.",
        "Choose cloud storage solutions that use renewable energy for data centers.",
        "Opt for digital documents instead of printing to reduce paper waste.",
        "Donate or sell old electronics instead of discarding them."
    ],
    "transportation": [
        "Walk or bike for short trips to reduce carbon emissions from driving.",
        "Use public transportation whenever possible to decrease your carbon footprint.",
        "Consider car-sharing services to reduce the need for personal vehicles.",
        "Plan car trips efficiently to minimize fuel usage and emissions.",
        "Consider working remotely to reduce commuting-related carbon emissions.",
        "Teleconference instead of traveling for meetings when possible to cut down on air travel.",
        "Opt for fuel-efficient cars or hybrid vehicles to reduce fuel consumption.",
        "Choose eco-friendly transportation options like electric scooters or bikes.",
        "Take advantage of ridesharing apps to reduce the number of cars on the road.",
        "Encourage others to carpool or use public transportation with you."
    ]
}
keywords = {
    "vehicle": ["car", "bike", "bus", "vehicle", "drive", "transport", "commute", "ride", "fuel", "gas", "electric", "hybrid", "mileage"],
    "diet": ["food", "vegetarian", "meat", "vegan", "plant-based", "poultry", "seafood", "dairy", "calories", "organic", "local", "produce", "meal"],
    "energy": ["electricity", "power", "solar", "renewable", "gas", "oil", "heating", "cooling", "AC", "insulation", "lighting", "appliance", "solar", "thermostat"],
    "water": ["shower", "washer", "sink", "water", "faucet", "leak", "sprinkler", "toilet", "hose", "rain", "flow", "garden", "drip", "conservation"],
    "waste": ["recycle", "trash", "waste", "compost", "plastic", "glass", "paper", "packaging", "bottle", "bag", "disposable", "reuse", "biodegradable"],
    "clothing": ["clothes", "fashion", "apparel", "fabric", "cotton", "wool", "polyester", "upcycle", "second-hand", "thrift", "tailor", "repair", "sew", "outfit", "sustainable"],
    "home": ["home", "insulation", "window", "light", "heat", "cool", "appliance", "energy", "electricity", "roof", "wall", "solar", "construction", "cleaning"],
    "technology": ["computer", "phone", "electronics", "device", "charger", "power", "battery", "internet", "data", "cloud", "printer", "screen", "monitor", "recycle", "refurbished"],
    "transportation": ["bus", "train", "commute", "plane", "air", "car", "fuel", "emission", "taxi", "bike", "scooter", "public transport", "rideshare", "remote", "teleconference"]
}


@functions_framework.http
def nlp_ai(request):
    # CORS preflight request handling
    if request.method == "OPTIONS":
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS, POST",
            "Access-Control-Allow-Headers": "Content-Type"
        }
        return ("", 204, headers)

    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type"
    }

    # Non-CORS
    request_json = request.get_json(silent=True)

    if request_json is None and (not os.environ.get('FUNCTION_NAME') is None):
        return jsonify({"error": "Invalid JSON request."}), 400, headers

    user_id = TEST_USER_ID if os.environ.get('FUNCTION_NAME') is None else request_json.get('userId')
    

    # Reference to the user's document in Firestore
    user_doc_ref = db.collection('user_ai_calls').document(user_id)

    # Get the user's document data
    user_doc = user_doc_ref.get()
    if not user_doc.exists:  # Accessing 'exists' as an attribute, not a method
        user_doc_ref.set({
            'pred_calls': 0,
            'nlp_calls': 0,
            'last_update': firestore.SERVER_TIMESTAMP
        })
        user_data = {'pred_calls': 0, 'nlp_calls': 0, 'last_update': None}
    else:
        user_data = user_doc.to_dict()

    nlp_calls = user_data.get('nlp_calls', 0)
    last_update = user_data.get('last_update', None)

    if last_update:
        current_time = datetime.now(timezone.utc)
        if last_update.tzinfo is None:
            last_update = last_update.replace(tzinfo=timezone.utc)

        if current_time - last_update >= timedelta(days=7):
            nlp_calls = 0

    if nlp_calls >= MAX_REQUESTS_PER_WEEK:
        return jsonify({"error": "Usage limit exceeded. You can only make 10 requests per week."}), 403, headers

    # Get the recommendation_input directly from the request
    recommendation_input = request_json.get('recommendation_input', '') if os.environ.get('FUNCTION_NAME') is not None else "car" # TESTING LOCALLY
    
    # Check if the recommendation_input exists
    if not recommendation_input:
        return jsonify({"error": "No recommendation input found."}), 400, headers  # Use 400 for a bad request

    prompt_lower = recommendation_input.lower()

    # Dictionary to store keyword counts
    keyword_counts = {main_word: 0 for main_word in keywords}

    # Loop through the main keywords and their associated sub-words
    for main_word, sub_words in keywords.items():
        keyword_counts[main_word] += prompt_lower.count(main_word)
        for sub_word in sub_words:
            keyword_counts[main_word] += prompt_lower.count(sub_word)

    keyword_counts = {k: v for k, v in keyword_counts.items() if v > 0}

    # Prepare a response with a random tip for each detected keyword
    tips_response = {}
    for keyword in keyword_counts:
        if keyword in tips_dict:
            num_tips = math.ceil(min(keyword_counts[keyword], len(tips_dict[keyword])) / 2)
            tips_response[keyword] = random.sample(tips_dict[keyword], num_tips)

    # Increment nlp_calls
    nlp_calls += 1
    user_doc_ref.update({
        'nlp_calls': nlp_calls,
        'last_update': firestore.SERVER_TIMESTAMP
    })
    
    sentiment = sia.polarity_scores(prompt_lower)

    return jsonify({
        "sentiment": sentiment,
        "recommendation_input": prompt_lower,
        "tips": tips_response
    }), 200, headers
