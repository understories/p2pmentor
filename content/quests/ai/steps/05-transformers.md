# The Transformer and Self-Attention

The transformer architecture (Vaswani et al., 2017 — "Attention Is All You Need") is the foundation of GPT, BERT, Claude, Llama, and virtually every frontier AI model.

## Self-Attention: The Core Mechanism

Each input token is projected into three vectors:

- **Query (Q)**: "What am I looking for?"
- **Key (K)**: "What do I contain?"
- **Value (V)**: "What information do I provide?"

These are computed via learned linear projections:

```
Q = X · W_Q    (W_Q is a learned weight matrix)
K = X · W_K
V = X · W_V
```

Attention scores are computed as:

```
Attention(Q, K, V) = softmax(Q · Kᵀ / √d_k) · V
```

**Step by step:**

1. Compute dot products between each query and all keys: `Q · Kᵀ` — measures compatibility
2. Scale by `√d_k` to prevent dot products from growing too large (which would push softmax into regions with tiny gradients)
3. Apply softmax to get attention weights (each row sums to 1)
4. Multiply attention weights by values to get the output

The result: each token's output is a weighted sum of all values, where the weights are determined by how relevant each key is to that token's query.

## Multi-Head Attention

Instead of computing attention once, transformers compute it **h** times in parallel (typically h = 8, 12, or 16):

```
head_i = Attention(Q · W_Qi, K · W_Ki, V · W_Vi)
MultiHead = Concat(head_1, ..., head_h) · W_O
```

Different heads learn to attend to different types of relationships — syntactic structure, semantic similarity, positional patterns, coreference, etc.

## The Transformer Block

A single transformer block:

```
x → Multi-Head Attention → Add & LayerNorm → Feed-Forward Network → Add & LayerNorm → output
     (self-attention)        (residual + norm)   (2-layer MLP)         (residual + norm)
```

**Feed-Forward Network (FFN)**: a position-wise 2-layer MLP applied identically to each token:

```
FFN(x) = GELU(x · W₁ + b₁) · W₂ + b₂
```

The FFN is where the model stores learned factual associations. The attention layers handle relationships between tokens; the FFN handles per-token computation.

**Residual connections** around both sub-layers ensure gradients flow through the full depth of the network.

## Positional Encoding

Self-attention is **permutation invariant** — it doesn't inherently know token order. Positional encodings inject position information:

- **Sinusoidal** (original transformer): fixed sine/cosine functions of position
- **Learned** (GPT, BERT): trainable embedding vectors for each position
- **Rotary (RoPE)** (LLaMA, modern LLMs): encode relative position directly into the attention computation

## Encoder vs Decoder

- **Encoder** (BERT): bidirectional attention. Each token can attend to all other tokens. Good for understanding.
- **Decoder** (GPT): causal (masked) attention. Each token can only attend to previous tokens. Good for generation.
- **Encoder-Decoder** (original transformer, T5): encoder processes input, decoder generates output attending to encoder states. Good for translation.

## Scale

The transformer's power comes from scale:

| Model   | Parameters | Layers | Attention Heads | Training Tokens |
| ------- | ---------- | ------ | --------------- | --------------- |
| GPT-2   | 1.5B       | 48     | 25              | 40B             |
| GPT-3   | 175B       | 96     | 96              | 300B            |
| LLaMA 2 | 70B        | 80     | 64              | 2T              |

Scaling laws (Kaplan et al., 2020) show that performance improves predictably as a power law in model size, dataset size, and compute — with no signs of saturating at current scales.
