# Training & Algorithms

## The Training Process

Training a neural network means finding the set of weights that minimizes errors on your data. The key algorithms that make this work are **gradient descent** and **backpropagation**.

## Loss Functions

A loss function measures how wrong the model's predictions are:

- **Low loss** = predictions are close to correct
- **High loss** = predictions are far off

The goal of training is to minimize the loss function.

Common loss functions:

- **Mean Squared Error** — for regression (predicting numbers)
- **Cross-Entropy Loss** — for classification (predicting categories)

## Gradient Descent

Gradient descent is the optimization algorithm that adjusts weights to reduce loss:

1. Compute the loss for current weights
2. Calculate the **gradient** — the direction of steepest increase in loss
3. Move weights in the **opposite direction** (downhill)
4. Repeat with a small step size called the **learning rate**

**Analogy:** Imagine standing on a hillside in fog. You can't see the bottom, but you can feel the slope under your feet. You step downhill, feel the slope again, and step again. Eventually you reach a valley.

## Backpropagation

Backpropagation is the algorithm that efficiently computes gradients through all layers of the network. It applies the chain rule of calculus to propagate error signals backward from the output to the input.

Without backpropagation, training deep networks would be computationally infeasible.

## Key Training Concepts

- **Epoch** — one complete pass through the entire training dataset
- **Batch Size** — number of examples processed before updating weights
- **Learning Rate** — how big each weight adjustment step is
- **Overfitting** — when the model memorizes training data but fails on new data
- **Regularization** — techniques to prevent overfitting (dropout, weight decay)

## Training at Scale

Modern AI models train on massive datasets:

- GPT-3: ~300 billion tokens of text
- GPT-4: estimated trillions of tokens
- Training runs can cost millions of dollars in compute
