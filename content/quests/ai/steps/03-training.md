# Gradient Descent and Backpropagation

## The Loss Function

Training starts with measuring error. A **loss function** L(ŷ, y) quantifies how far the model's prediction ŷ is from the true label y.

**Mean Squared Error** (regression):

```
L = (1/n) Σ (ŷᵢ - yᵢ)²
```

**Cross-Entropy Loss** (classification):

```
L = -Σ yᵢ · log(ŷᵢ)
```

Cross-entropy heavily penalizes confident wrong predictions (predicting 0.01 when the answer is 1), which is exactly what you want for classification.

## Gradient Descent

The goal: find weights W that minimize L. Gradient descent is the workhorse algorithm:

1. Compute the loss L for the current weights
2. Compute the gradient ∂L/∂W — the direction of steepest increase
3. Update weights in the opposite direction: **W ← W - η · ∂L/∂W**
4. Repeat

**η** (eta) is the **learning rate** — the step size. Too large and training oscillates or diverges. Too small and training takes forever. Choosing η is one of the most important practical decisions in ML.

## Stochastic Gradient Descent (SGD)

Computing the gradient over the entire dataset is expensive. SGD approximates it:

- **Batch GD**: gradient over all N examples (slow, accurate)
- **Stochastic GD**: gradient from 1 random example (fast, noisy)
- **Mini-batch GD**: gradient from B examples (B = 32, 64, 128 typically) — the standard in practice

Mini-batch SGD provides a good trade-off: fast enough to train on large datasets, smooth enough to converge reliably.

## Backpropagation: The Chain Rule at Scale

The key question: how do you compute ∂L/∂w for a weight deep inside the network?

**Forward pass**: compute outputs layer by layer, left to right.

**Backward pass**: apply the chain rule layer by layer, right to left.

For a 3-layer network:

```
Forward: x → z₁ = W₁x + b₁ → a₁ = σ(z₁) → z₂ = W₂a₁ + b₂ → a₂ = σ(z₂) → L

Backward (chain rule):
∂L/∂W₂ = ∂L/∂a₂ · ∂a₂/∂z₂ · ∂z₂/∂W₂
∂L/∂W₁ = ∂L/∂a₂ · ∂a₂/∂z₂ · ∂z₂/∂a₁ · ∂a₁/∂z₁ · ∂z₁/∂W₁
```

Each factor is a local derivative that is cheap to compute. The magic is that you reuse intermediate results — `∂L/∂a₂ · ∂a₂/∂z₂` is computed once and shared by all layers below.

This is why backpropagation is efficient: it computes all gradients in one backward pass, with cost proportional to one forward pass.

## The Vanishing Gradient Problem

In deep networks with sigmoid activations, gradients multiply through many layers:

```
∂L/∂W₁ = ∂L/∂a₅ · σ'(z₅) · W₅ · σ'(z₄) · W₄ · σ'(z₃) · W₃ · σ'(z₂) · W₂ · σ'(z₁) · x
```

Since σ'(z) ≤ 0.25, multiplying many of these together drives the gradient toward zero. Early layers barely learn.

**Solutions that changed the field:**

- **ReLU activation**: gradient is 1 for positive inputs (no shrinkage)
- **Residual connections** (ResNets): add skip connections so gradients flow through shortcuts
- **Layer normalization**: stabilizes intermediate activations
- **Careful initialization** (Xavier, He): set initial weights so variance is preserved across layers

## Modern Optimizers

Plain SGD is rarely used alone. Modern optimizers adapt the learning rate per parameter:

- **Adam** (Adaptive Moment Estimation): maintains running averages of gradients and squared gradients per parameter. The de facto standard.
- **AdamW**: Adam with decoupled weight decay (used for training LLMs)
- **Learning rate schedulers**: warm up the learning rate, then decay it (cosine annealing, linear warmup)

These aren't magic — they are just more sophisticated ways to navigate the loss landscape.
