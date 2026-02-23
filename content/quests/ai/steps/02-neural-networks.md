# Neurons, Layers, and Activation Functions

## The Perceptron

The fundamental unit of a neural network is the **perceptron** (artificial neuron). It computes:

```
z = w₁x₁ + w₂x₂ + ... + wₙxₙ + b
output = activation(z)
```

Where:

- **x₁...xₙ** are inputs (e.g., pixel intensities, features)
- **w₁...wₙ** are weights (learnable parameters that determine importance)
- **b** is the bias (a learnable offset)
- **z** is the weighted sum (also called the pre-activation)
- **activation()** is a nonlinear function applied to z

A single perceptron can learn linear decision boundaries — it can solve AND and OR, but famously cannot solve XOR (Minsky & Papert, 1969). Stacking layers solves this.

## Why Activation Functions Matter

Without activation functions, a neural network is just matrix multiplication:

```
Layer 1: z₁ = W₁x + b₁
Layer 2: z₂ = W₂z₁ + b₂ = W₂(W₁x + b₁) + b₂ = (W₂W₁)x + (W₂b₁ + b₂)
```

This collapses to a single linear transformation. No matter how many layers you stack, the result is equivalent to one layer. Nonlinear activations break this — they let the network learn curved, complex decision boundaries.

## Common Activation Functions

**Sigmoid**: σ(z) = 1 / (1 + e⁻ᶻ)

- Maps any input to (0, 1)
- Historically popular, but causes vanishing gradients in deep networks because σ'(z) ≤ 0.25

**tanh**: tanh(z) = (eᶻ - e⁻ᶻ) / (eᶻ + e⁻ᶻ)

- Maps to (-1, 1), zero-centered
- Also suffers from vanishing gradients, but less than sigmoid

**ReLU** (Rectified Linear Unit): ReLU(z) = max(0, z)

- Dead simple: pass positive values through, zero out negatives
- Gradient is 1 for z > 0, 0 for z < 0
- Solved the vanishing gradient problem for positive inputs, enabling training of deep networks
- Problem: "dying ReLU" — neurons with z < 0 for all inputs get stuck with zero gradient

**GELU** (Gaussian Error Linear Unit): used in modern transformers (BERT, GPT)

- Smooth approximation of ReLU weighted by the probability of the input being positive
- Slightly better empirical performance than ReLU for large models

## Layers and Depth

A **feedforward neural network** stacks layers:

```
Input (784 pixels) → Hidden Layer 1 (256 neurons) → Hidden Layer 2 (128 neurons) → Output (10 classes)
```

Each layer applies: `output = activation(W · input + b)`

**Why depth helps**: Each layer learns increasingly abstract features. In image recognition:

- Layer 1: edges and gradients
- Layer 2: corners and textures
- Layer 3: parts of objects (eyes, wheels)
- Layer 4+: whole objects and scenes

This **hierarchical feature extraction** is why deep networks outperform shallow ones on complex tasks.

## Parameters and Capacity

The total number of learnable parameters determines a network's capacity:

- A layer with 256 inputs and 128 outputs has 256 × 128 weights + 128 biases = 32,896 parameters
- GPT-3: 175 billion parameters
- GPT-4: estimated >1 trillion parameters

More parameters = more capacity to fit complex functions, but also more data needed to avoid memorization (overfitting).
