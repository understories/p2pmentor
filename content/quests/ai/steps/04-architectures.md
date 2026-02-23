# Network Architectures: CNNs, RNNs, and Beyond

Every neural network architecture encodes assumptions about the data. These assumptions — called **inductive biases** — determine what patterns the network can learn efficiently.

## Convolutional Neural Networks (CNNs)

**Inductive bias**: local spatial patterns matter, and the same pattern can appear anywhere in the input.

A **convolutional layer** slides a small filter (e.g., 3×3) across the input image:

```
Input image (28×28)
  ↓ Convolve with 32 filters (3×3)
Feature maps (26×26×32)
  ↓ Convolve with 64 filters (3×3)
Feature maps (24×24×64)
  ↓ Flatten + Dense layers
Output (10 classes)
```

**Key properties:**

- **Weight sharing**: the same 3×3 filter is applied at every position. A vertical edge detector detects vertical edges everywhere in the image.
- **Local connectivity**: each neuron only looks at a small patch of the input, not the whole image.
- **Translation equivariance**: if you shift the input, the feature map shifts by the same amount.

**Pooling layers** (max pool, average pool) downsample feature maps, providing translation invariance and reducing computation.

CNNs dominated computer vision from AlexNet (2012) through ResNet (2015). They are still used in many production systems.

## Recurrent Neural Networks (RNNs)

**Inductive bias**: data has sequential structure, and earlier elements influence later ones.

An RNN processes a sequence one element at a time, maintaining a **hidden state** that carries information forward:

```
h₀ = 0
h₁ = tanh(W_hh · h₀ + W_xh · x₁ + b)
h₂ = tanh(W_hh · h₁ + W_xh · x₂ + b)
...
```

The same weight matrices W_hh and W_xh are applied at every time step (weight sharing across time).

**Problem**: vanishing gradients across long sequences. After 50+ time steps, gradients from early tokens are negligible.

**LSTMs** (Long Short-Term Memory) and **GRUs** (Gated Recurrent Units) partially solve this with gating mechanisms that control information flow — but they still process tokens sequentially, which limits parallelization.

## The Attention Mechanism

The breakthrough that led to transformers. Instead of processing tokens sequentially, **attention** lets every token look at every other token directly:

```
Attention(Q, K, V) = softmax(QKᵀ / √d_k) · V
```

No recurrence needed. Every position can attend to every other position in a single operation. This enables massive parallelization on GPUs.

## Residual Connections (ResNets)

A simple but transformative idea: add the input of a layer to its output.

```
output = layer(x) + x    (instead of: output = layer(x))
```

This creates a **shortcut** for gradients to flow through during backpropagation. Without residual connections, networks deeper than ~20 layers were nearly impossible to train. With them, networks of 100+ layers train reliably.

Residual connections are now used in virtually all deep architectures, including transformers.

## Why Architecture Matters

The choice of architecture determines:

- What patterns the model can efficiently learn
- How much data is needed for training
- Whether training is computationally feasible
- How the model generalizes to new inputs

CNNs were the right architecture for images when data was limited. Transformers with attention are the right architecture when data is abundant and compute is available.
