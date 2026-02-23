# AI Ethics & Limitations

## Why Ethics Matter

AI systems make decisions that affect people — hiring, lending, content moderation, medical diagnosis. Understanding the limitations and risks is as important as understanding the technology.

## Bias in AI

AI models learn from data, and data reflects the world — including its inequalities.

**Sources of bias:**

- **Training data bias** — if training data underrepresents a group, the model performs poorly for that group
- **Label bias** — if human labelers have biases, the model learns those biases
- **Selection bias** — if data collection favors certain populations, the model reflects that skew

**Example:** A hiring model trained on historical hiring data will learn historical biases in hiring decisions.

## Hallucinations and Reliability

LLMs can generate text that sounds authoritative but is factually wrong. This is called **hallucination**.

- Models don't "know" things — they predict likely text
- Confidence in output doesn't correlate with correctness
- Critical applications require human verification

## Privacy Concerns

- Models trained on personal data may memorize and reproduce it
- Prompts sent to hosted models may be logged or used for training
- Generated content may inadvertently reveal private patterns from training data

## Environmental Impact

- Training large models requires massive compute resources
- GPT-3 training estimated at ~1,287 MWh of electricity
- Inference (using the model) also has ongoing energy costs

## Transparency and Explainability

- Most neural networks are "black boxes" — difficult to explain why they made a specific decision
- This matters for high-stakes decisions (healthcare, criminal justice, finance)
- Explainable AI (XAI) is an active research area

## Responsible AI Principles

1. **Fairness** — AI should not discriminate
2. **Transparency** — decisions should be explainable
3. **Privacy** — personal data should be protected
4. **Safety** — AI should not cause harm
5. **Accountability** — someone should be responsible for AI decisions
