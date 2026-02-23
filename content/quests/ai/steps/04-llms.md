# Large Language Models

## What Are LLMs?

Large Language Models (LLMs) are neural networks trained on massive text datasets to understand and generate human language. Examples include GPT-4, Claude, Llama, and Gemini.

## The Core Objective: Next-Token Prediction

Despite their impressive capabilities, LLMs are fundamentally trained on a simple task: **predict the next token in a sequence**.

Given "The cat sat on the \_\_\_", the model learns to predict "mat" (or similar likely completions) by processing billions of examples of natural text.

This simple objective, applied at enormous scale, produces systems that can:

- Answer questions
- Write code
- Translate languages
- Reason about problems
- Follow complex instructions

## The Transformer Architecture

LLMs are built on the **Transformer** architecture (introduced in the 2017 paper "Attention Is All You Need"):

- **Self-Attention** — allows each token to attend to every other token in the input, capturing long-range dependencies
- **Positional Encoding** — gives the model information about word order
- **Parallel Processing** — unlike RNNs, transformers process all tokens simultaneously

## Tokens, Not Words

LLMs don't process words — they process **tokens**. A token might be a word, part of a word, or a single character:

- "understanding" → ["under", "standing"] (2 tokens)
- "AI" → ["AI"] (1 token)
- "cryptography" → ["crypt", "ography"] (2 tokens)

## Emergent Capabilities

Some abilities appear only at large scale and weren't explicitly trained:

- **In-context learning** — learning from examples in the prompt
- **Chain-of-thought reasoning** — stepping through problems logically
- **Code generation** — writing and debugging code

These are called **emergent properties** — they arise from scale, not from specific training objectives.

## Limitations

- **Hallucinations** — generating confident but incorrect information
- **Knowledge cutoff** — training data has a fixed end date
- **Context window** — limited amount of text the model can process at once
- **No true understanding** — pattern matching, not comprehension
