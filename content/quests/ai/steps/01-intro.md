# From Rules to Learning

## The Problem with Hand-Written Rules

Consider building a system to classify handwritten digits (0–9). A traditional approach would be: write rules.

```
if top_half_has_loop AND bottom_half_has_loop → 8
if single_loop AND vertical_stroke → 9
...
```

This fails immediately. Handwriting varies enormously. You would need thousands of fragile rules that still miss edge cases. Every new font or handwriting style breaks something.

## The Machine Learning Alternative

Instead of writing rules, you show the system **examples**:

- 60,000 images of handwritten digits, each labeled with the correct answer
- The system finds a function `f(image) → digit` that maps pixel values to labels
- It does this by adjusting internal parameters until predictions match the labels

This is the MNIST dataset, the "hello world" of machine learning. A well-trained neural network achieves 99.7% accuracy — better than most humans on messy handwriting.

## Supervised Learning

The most common ML paradigm. You provide:

- **Inputs** (features): pixel values, text tokens, sensor readings
- **Labels** (targets): the correct output for each input
- **A model** with adjustable parameters (weights)
- **A loss function** that measures how wrong the predictions are

Training = adjusting parameters to minimize the loss across all training examples.

## Unsupervised and Self-Supervised Learning

Not all learning requires labels:

- **Unsupervised**: Find structure in unlabeled data. K-means clustering groups similar data points. PCA finds the axes of greatest variance.
- **Self-supervised**: Generate labels from the data itself. Mask a word in a sentence and predict it (BERT). Predict the next word (GPT). These tasks require no human annotation but produce powerful representations.

Self-supervised learning is how modern LLMs are trained — the internet provides billions of text sequences, and next-token prediction provides the training signal for free.

## Reinforcement Learning

A third paradigm: an agent takes actions in an environment and receives rewards or penalties.

- No labeled examples — the agent learns from trial and error
- Used in game playing (AlphaGo, Atari), robotics, and RLHF (aligning LLMs with human preferences)
- Fundamentally different from supervised learning: the training signal is sparse and delayed

## What Makes a Problem Suitable for ML?

ML works well when:

1. A pattern exists in the data
2. You cannot write the pattern down mathematically (or it would be prohibitively complex)
3. You have enough examples of the pattern
4. The pattern in your training data reflects the real-world distribution you care about

ML fails when these conditions don't hold — which is more often than people assume.
