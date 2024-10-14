import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error

# Example data (5 inputs and their corresponding outputs)
X = np.array([1, 2, 3, 4, 5]).reshape(-1, 1)  # Reshape for a single feature
y = np.array([10500, 13500, 12000, 3000, 2550])  # Target values
print(X,y)
# Create and train the model

lin_model = LinearRegression()
lin_model.fit(X, y)
lin_predictions = lin_model.predict(X)
print(lin_model, lin_predictions, mean_squared_error(y, lin_predictions))



future_X = np.array([6, 7, 8]).reshape(-1, 1)
future_predictions = lin_model.predict(future_X)
print("Predicted future values:", future_predictions)

import matplotlib.pyplot as plt

# Assuming `X` and `y` are your features and target respectively
plt.figure(figsize=(10, 5))
plt.scatter(X, y, color='blue', label='Actual Data')
plt.plot(X, lin_predictions, color='orange', label='Predicted Linear Fit')
plt.xlabel('Day')
plt.ylabel('Value')
plt.title('Linear Regression Fit')
plt.legend()
plt.show()


model = LinearRegression()
model.fit(X, y)

# Predict future values (for example, predicting for inputs 6, 7, and 8)
future_X = np.array([6, 7, 8]).reshape(-1, 1)
future_predictions = model.predict(future_X)

# Print future predictions
print("Predicted future values:", future_predictions)