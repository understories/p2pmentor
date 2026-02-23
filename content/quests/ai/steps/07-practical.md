# Training in Practice: Data, Compute, and Failure Modes

## Overfitting and Underfitting

**Overfitting**: the model memorizes training data but fails on new data. Training loss drops, validation loss increases. The model has learned noise and idiosyncrasies, not the underlying pattern.

**Underfitting**: the model is too simple to capture the pattern. Both training and validation loss remain high.

The goal is to find the sweet spot: a model complex enough to capture the real pattern, but constrained enough not to memorize noise.

## Regularization Techniques

Methods to prevent overfitting:

**Dropout**: during training, randomly set a fraction of neuron outputs to zero (typically 10–50%). This prevents co-adaptation — neurons can't rely on specific other neurons, so they learn more robust features.

**Weight decay (L2 regularization)**: add a penalty proportional to the squared magnitude of weights to the loss function: L_total = L_data + λ·‖W‖². This pushes weights toward zero, preferring simpler functions.

**Data augmentation**: artificially expand the training set by applying transformations — flipping, rotating, cropping images; synonym replacement in text. The model sees more variety without collecting more data.

**Early stopping**: monitor validation loss during training. When it starts increasing (overfitting), stop training and use the weights from the best validation loss.

## The Bias-Variance Tradeoff

- **High bias** (underfitting): model assumptions are too strong, it systematically misses the pattern
- **High variance** (overfitting): model is too sensitive to training data, predictions change wildly with different training sets

More parameters → lower bias, higher variance. Regularization → increases bias slightly, reduces variance significantly.

In the deep learning era, this tradeoff is less clean — very large models can generalize well if trained with enough data (the "double descent" phenomenon).

## Data Quality

Data problems cause more ML failures than algorithm choices:

- **Label noise**: mislabeled examples poison the training signal
- **Distribution shift**: training data doesn't match deployment data (model trained on professional photos, deployed on phone camera selfies)
- **Data leakage**: test data inadvertently included in training data, giving falsely optimistic results
- **Imbalanced classes**: 99% of examples are class A, 1% are class B — the model learns to always predict A and gets 99% accuracy while being useless

## Scaling Laws

Kaplan et al. (2020) discovered that neural network performance follows predictable power laws:

```
L(N) ∝ N^(-α)    (loss decreases as model size N increases)
L(D) ∝ D^(-β)    (loss decreases as dataset size D increases)
L(C) ∝ C^(-γ)    (loss decreases as compute C increases)
```

These relationships are remarkably consistent across scales. They enable predicting the performance of a 100B parameter model from experiments on 1B parameter models — allowing labs to allocate compute budgets rationally.

The Chinchilla paper (Hoffmann et al., 2022) refined this: for a fixed compute budget, you should scale model size and data size roughly equally. Many early LLMs were undertrained (too few tokens for their parameter count).

## Compute Requirements

Training large models requires specialized hardware:

- **GPUs** (NVIDIA A100, H100): 40–80 GB memory, optimized for matrix operations
- **TPUs** (Google): custom silicon designed for tensor operations
- **Distributed training**: split model and data across hundreds or thousands of devices

GPT-3 training (175B parameters): estimated ~3,640 petaflop-days, costing $4–12 million in compute.

## Evaluation

How do you know if a model is actually good?

- **Train/validation/test split**: train on 80%, validate hyperparameters on 10%, report final performance on 10% (never seen during training or tuning)
- **Cross-validation**: rotate which portion is the test set, average results
- **Benchmarks**: standardized test sets (ImageNet for vision, GLUE/SuperGLUE for NLP, MMLU for general knowledge)
- **Human evaluation**: for generative models, automated metrics often miss quality differences that humans catch

The gap between benchmark performance and real-world usefulness is one of the persistent challenges in ML deployment.
