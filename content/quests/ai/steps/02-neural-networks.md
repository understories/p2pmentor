# Neural Networks

## How Machines Learn

A neural network is a computational model inspired by biological neurons. It consists of layers of interconnected nodes (neurons) that process information.

## Architecture

A basic neural network has three types of layers:

1. **Input Layer** — receives raw data (pixels, text tokens, numbers)
2. **Hidden Layers** — process and transform the data through learned patterns
3. **Output Layer** — produces the final prediction or classification

Each connection between neurons has a **weight** — a number that determines how much influence one neuron has on another.

## How Learning Works

1. **Forward Pass** — data flows through the network, producing an output
2. **Loss Calculation** — the output is compared to the correct answer, producing an error score
3. **Backward Pass** — the error is propagated backward through the network
4. **Weight Update** — weights are adjusted to reduce the error

This cycle repeats thousands or millions of times.

## Types of Neural Networks

- **Feedforward Networks** — data flows in one direction (input → output)
- **Convolutional Neural Networks (CNNs)** — specialized for images and spatial data
- **Recurrent Neural Networks (RNNs)** — process sequential data (text, time series)
- **Transformers** — the architecture behind modern LLMs (attention-based, parallel processing)

## Key Intuition

Think of a neural network as a function with millions of adjustable knobs (weights). Training is the process of turning those knobs until the function produces the right outputs for a given set of inputs.

The remarkable thing is that with enough data and computation, these networks discover patterns that humans never explicitly programmed.
