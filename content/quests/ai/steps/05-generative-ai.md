# Generative AI

## From Classification to Creation

Traditional ML models **classify** — they take an input and produce a label (spam/not spam, cat/dog). Generative models **create** — they produce new data that resembles the training data.

## Types of Generative Models

### Text Generation (LLMs)

- Produce human-like text by predicting tokens sequentially
- Applications: chatbots, code assistants, content creation, translation

### Image Generation

- **Diffusion Models** (Stable Diffusion, DALL-E, Midjourney) — start with noise and iteratively refine it into an image guided by a text prompt
- **GANs** (Generative Adversarial Networks) — two networks compete: a generator creates images, a discriminator judges them

### Code Generation

- Specialized LLMs trained on code repositories
- Can write, debug, and explain code
- Examples: GitHub Copilot, Cursor, Claude

### Audio & Video

- Text-to-speech, music generation, video synthesis
- Rapidly improving but still developing

## How Diffusion Models Work

1. **Forward Process** — gradually add noise to an image until it becomes pure noise
2. **Reverse Process** — train a model to remove noise step by step
3. **Generation** — start with random noise and denoise it, guided by a text prompt

The model learns the statistical structure of images and can generate new ones that follow learned patterns.

## Key Concepts

- **Prompt Engineering** — crafting inputs to get better outputs from generative models
- **Fine-tuning** — adapting a pre-trained model to a specific domain or task
- **RLHF** (Reinforcement Learning from Human Feedback) — training models to align with human preferences
- **Temperature** — controls randomness in generation (low = deterministic, high = creative)

## What Generative AI Cannot Do

- Create genuinely novel ideas (it recombines patterns from training data)
- Guarantee factual accuracy
- Understand context the way humans do
- Replace domain expertise (it's a tool, not an expert)
