# Generative Models: Autoregressive, Diffusion, and GANs

Generative models learn a probability distribution over data and can sample new data from it. The three dominant approaches each work fundamentally differently.

## Autoregressive Models (GPT, Claude, LLaMA)

**Core idea**: factor the joint probability of a sequence as a product of conditional probabilities.

```
P(x₁, x₂, ..., xₙ) = P(x₁) · P(x₂|x₁) · P(x₃|x₁,x₂) · ... · P(xₙ|x₁,...,xₙ₋₁)
```

At each step, the model predicts a probability distribution over the entire vocabulary (50,000+ tokens), then samples one token from that distribution. That token becomes part of the context for the next prediction.

**Temperature** controls the randomness of sampling:

- Temperature = 0: always pick the highest-probability token (deterministic, repetitive)
- Temperature = 1: sample proportional to learned probabilities (balanced)
- Temperature > 1: flatten the distribution (more random, creative, error-prone)

**Top-k** and **top-p (nucleus)** sampling restrict the candidate pool to the most likely tokens, preventing the model from sampling rare nonsense tokens.

**Training objective**: maximize the log-likelihood of the training data. For each position, the model predicts the next token; the loss is the cross-entropy between its prediction and the actual next token.

## Diffusion Models (Stable Diffusion, DALL-E 3, Midjourney)

**Core idea**: learn to reverse a gradual noising process.

**Forward process** (fixed, not learned): starting from a real image x₀, add Gaussian noise in T steps until the image is pure noise xₜ.

```
x₁ = √(1-β₁)·x₀ + √β₁·ε₁      (slightly noisy)
x₂ = √(1-β₂)·x₁ + √β₂·ε₂      (more noisy)
...
xₜ ≈ N(0, I)                     (pure noise)
```

**Reverse process** (learned): train a neural network to predict the noise ε that was added at each step, then subtract it:

```
x̂₀ = (xₜ - √βₜ · ε_θ(xₜ, t)) / √(1-βₜ)
```

The model ε_θ (typically a U-Net or transformer) is trained to predict the noise at each timestep t. At generation time, start with pure random noise and iteratively denoise it.

**Conditioning**: to generate images from text, a text encoder (e.g., CLIP) produces a conditioning vector that guides the denoising process. **Classifier-free guidance** interpolates between conditioned and unconditioned predictions to strengthen prompt adherence.

## Generative Adversarial Networks (GANs)

**Core idea**: two networks compete — a generator creates fake data, a discriminator distinguishes real from fake.

```
Generator G: random noise z → fake image G(z)
Discriminator D: image → P(real)

Training:
  D maximizes: log D(x_real) + log(1 - D(G(z)))
  G minimizes: log(1 - D(G(z)))  (or equivalently, maximizes log D(G(z)))
```

**The minimax game**: G improves at fooling D, D improves at catching G. At equilibrium (in theory), G produces images indistinguishable from real data.

**Practical challenges**: GANs are notoriously unstable to train. Mode collapse (the generator only produces a few types of outputs), training oscillation, and sensitivity to hyperparameters are persistent issues.

GANs dominated image generation from 2014–2021 (StyleGAN, BigGAN) but have been largely replaced by diffusion models for image generation tasks.

## Comparing the Three

|            | Autoregressive              | Diffusion                         | GAN                    |
| ---------- | --------------------------- | --------------------------------- | ---------------------- |
| Generation | Sequential (token by token) | Iterative (many denoising steps)  | Single forward pass    |
| Training   | Stable (maximum likelihood) | Stable (denoising score matching) | Unstable (adversarial) |
| Quality    | Excellent for text          | Excellent for images              | Excellent for images   |
| Speed      | Fast per token              | Slow (many steps)                 | Fast                   |
| Diversity  | High                        | High                              | Prone to mode collapse |
