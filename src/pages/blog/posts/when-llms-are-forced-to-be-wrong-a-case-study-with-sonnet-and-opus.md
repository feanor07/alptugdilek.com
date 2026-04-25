---
layout: ../../../layouts/BlogPost.astro
title: "When LLMs Are Forced to Be Wrong: A Case Study with Sonnet and Opus"
date: "2026-04-26"
description: "A practical case study showing how LLMs fail under ambiguity and missing signals when forced to produce an answer, even with structured constraints and careful prompting."
tags: ["llm", "prompt-engineering", "data-extraction", "ai-reliability", "claude"]
---

I thought this would be a straightforward comparison.

As a long-time fan of Galatasaray S.K., I picked a few chaotic Champions League matches full of edge cases: dense scoring, cancellations, and messy commentary.

<figure>
  <img src="/alptug_at_galatasaray_liverpool.jpg" alt="Alptug at Galatasaray vs Liverpool" />
  <figcaption>From a much happier night: Galatasaray 1–0 Liverpool. The matches in this post were far less straightforward.</figcaption>
</figure>

Then I gave two models, Claude Sonnet and Opus, a structured prompt and asked them to extract goal timestamps from noisy Turkish ASR transcripts.

In many cases, it worked exactly as expected. Clear signals led to correct answers. Even dense sequences of goals were handled without much trouble.

But things started to break as the signal got weaker. It started with ambiguity, then misleading commentary, and eventually a match with no usable signal at all.

That’s when both models began to behave in a way that was hard to ignore. They didn’t return uncertain answers. They didn’t skip the goal. They picked something that looked plausible and justified it.

Not because they misunderstood the task. But because the system required an answer, even when the data didn’t support one.

This post isn’t really about which model is better. It’s about what happens when signals are unclear, misleading, or missing, and the model is not allowed to say “I don’t know.”

Before diving into the cases, one important detail: all initial runs were done with low effort under default settings.

This means the models were encouraged to respond quickly with minimal internal reasoning. The prompt itself carries most of the structure, so the goal here was to see how well each model follows explicit constraints without relying on deeper reasoning. It’s also the more cost-efficient and faster way to run these kinds of evaluations.

### Prompt Overview

The task sounds simple: given a noisy Turkish ASR transcript of a football match and a structured `goals.json` file, extract the timestamp of each goal.

In practice, it’s a constrained extraction problem.

The transcript provides raw, unstructured commentary from a short highlight segment (typically 8–10 minutes), not the full match. The `goals.json` file defines the expected number of goals and their score progression. The model must align the two.

The prompt frames this as a multi-step process:

* **Detect candidates**: identify segments that might correspond to goals using strong and weak linguistic signals
* **Filter invalid events**: discard negations, cancelled goals (offside, foul), and replays
* **Select under constraints**: choose the earliest valid signal for each goal while maintaining score progression and chronological order
* **Validate globally**: ensure all selected timestamps are consistent, increasing, and collectively valid

This effectively turns a noisy transcript into a constrained search problem, where the model must satisfy multiple competing rules at once.

In other words, the model is not just detecting goals. It is solving a constrained selection problem under uncertainty.

When the signal is clear, this works well.

When it isn’t, the constraints begin to compete with each other.

### Case Study 1 — Early vs Strong Signal

To make this concrete, let’s start with a relatively simple case.

In this rather heartbreaking match between Eintracht Frankfurt and Galatasaray S.K. (5-1), most goals have clear signals in the transcript. On the surface, this is the kind of scenario where you’d expect both models to behave identically.

And for the most part, they do.

Except for one small detail that turns out to be surprisingly important.

For the first goal, there are two valid signals:

* An early mention: “Yunus … gol”
* A slightly later, more emphatic sequence: “gol gol gol”

The prompt explicitly instructs the model to select the earliest valid signal for each goal.

Both signals refer to the same event. But only one satisfies the rule: **pick the earliest valid signal**.

Here’s what happens:

* Claude Sonnet consistently selects the earlier timestamp
* Claude Opus consistently selects the later one

This difference is small—just a few seconds—but it’s systematic.

Sonnet follows the instruction literally. Opus prefers the stronger, more emphatic signal.

When I increased the effort level to medium, Opus corrected itself and selected the earlier timestamp.

That makes this a useful baseline:

> When the signal is clear and the task is well-defined, both models perform well. Differences appear when multiple valid interpretations exist, and reasoning depth can change which one is chosen.

### Case Study 2 — Dense Sequences, No Ambiguity

The second match between Galatasaray S.K. and Juventus F.C. (5-2), a much more enjoyable one for a Galatasaray fan, introduces a different kind of challenge: multiple goals in quick succession.

In some cases, goals occur within the same minute, with overlapping commentary and limited separation between events. This is where you might expect models to merge events or lose track of ordering.

They don’t.

Both Claude Sonnet and Claude Opus correctly identify all goal timestamps, consistently across runs.

The reason is simple: despite the density, each goal still has a clear signal and clean score progression. There’s no ambiguity about which segment corresponds to which event.

This highlights an important point:

> Dense sequences are not inherently difficult. Problems arise when signals compete, not when they are close together.

### Case Study 3 — Ambiguity and Instability

The third match between Juventus F.C. and Galatasaray S.K. (3-2) introduces a more difficult scenario: goals that are not clearly signaled.

Some goals are described without an explicit “gol,” others rely on indirect phrases or score updates, and in some cases multiple weak candidates appear close together. The structure is still there, but it’s no longer clean.

This is where things start to break.

Unlike the previous cases, both Claude Sonnet and Claude Opus become inconsistent. Across runs, they select different timestamps for the same goal, even though the input and prompt remain identical.

These runs were performed using the CLI’s default settings, which are intended to be low-randomness. Despite that, the variation observed here is not driven by randomness alone, but by multiple plausible interpretations in the input.

For example, one goal is inferred only through score progression. With no explicit signal, the models alternate between:

* an earlier summary-like segment
* a slightly later score confirmation
* or another nearby weak candidate

All of these are plausible. None are clearly dominant.

A similar pattern appears in extra time, where delayed confirmation and noisy commentary make it harder to identify the exact moment of the goal. The models again choose different points depending on the run.

What changes here is not capability, but determinism.

Increasing the effort level improves this behavior, but does not eliminate it completely. The models become more consistent across runs, and in some cases converge on the correct timestamp. However, for goals with only weak signals, variation still remains. The ambiguity is reduced—but not resolved.

> When multiple weak candidates exist and no strong signal anchors the event, the problem becomes underdetermined, meaning multiple answers are equally plausible. The models don’t consistently fail; they become unstable.

### Case Study 4 — Missing Signal and Forced Errors

The final match between Liverpool F.C. and Galatasaray S.K. (4-0) pushes the setup to its limit.

This time, the problem is not ambiguity. It’s the absence of a valid signal.

Two strong goal-like signals appear in the transcript:

* one is later cancelled for offside
* another is followed by a foul decision

According to the rules, both must be discarded.

The actual goal, however, is not clearly described at all. The commentary only repeats the player’s name, with no explicit goal signal and no immediate score update.

This leaves the model with no valid candidate.

And yet, it still has to return one.

This is where both Claude Sonnet and Claude Opus fail, completely but in different ways.

* Sonnet consistently selects the later “top ağlara gitti” *(the ball is in the back of the net)* segment, ignoring the subsequent foul
* Opus consistently selects the earlier “4-0 oldu” *(the score is now 4-0)* segment, despite the offside cancellation

In both cases, the models identify a strong signal, notice conflicting context, and proceed anyway.

The behavior is not random. It’s systematic.

You can see this directly in the reasoning:

**Claude Sonnet:**
“This is the only remaining goal signal after the cancelled one, and the final score confirms it.”

**Claude Opus:**
“This is the only 4–0 score mention in the transcript, despite the later offside review.”

In both cases, the models explicitly acknowledge conflicting evidence—and proceed anyway.

What’s happening here is not a failure of detection, but a failure of constraint.

> When no valid candidate exists, the task becomes impossible under the given rules. Instead of abstaining, the models construct an answer by selecting the least inconsistent signal.

This is the same pattern from earlier cases, taken to its extreme.

The models are not just making mistakes.

They are being forced to be wrong.

Increasing the effort level does not resolve this failure.

Claude Sonnet continues to select the same invalid candidate, despite taking significantly longer to process the input—suggesting more extensive checking without a change in outcome.

Claude Opus, on the other hand, shifts its behavior and begins selecting a different invalid candidate. The answer changes, but it remains incorrect.

In other words, more effort alters the path—but not the result.

### Takeaways

Across these four cases, a pattern emerges.

When signals are clear, both Claude Sonnet and Claude Opus perform reliably. Even dense sequences of goals are handled without issue as long as each event has a clear anchor.

**As ambiguity increases, behavior changes.** With multiple weak candidates, the models no longer converge on a single answer. The problem becomes underdetermined, with multiple plausible interpretations, and the output becomes unstable.

And when the signal disappears entirely, the failure mode shifts again.

The models don’t skip the goal, because they are not allowed to. They don’t return uncertainty. They select the most plausible remaining candidate and justify it—even when it violates the rules.

This is not a model-specific issue. Both models exhibit the same pattern under different conditions.

The root cause is structural.

The prompt defines how to select among candidates, but it never defines what to do when no valid candidate exists. Combined with the requirement to return exactly one timestamp per goal (the prompt enforces a single output per goal), this forces the model to produce an answer even when the data cannot support one.

That leads to a key insight:

> When a system requires an answer, it will produce one—even if it has to be wrong.

---

### What I would change

Two small changes would significantly improve the system:

* Allow abstention: if no valid candidate exists, return `null` instead of forcing a choice
* Strengthen tie-breaking: define explicit fallback rules when multiple weak candidates exist

These changes would not improve performance in easy cases. But they would prevent systematic errors in the hardest ones.

---

### What about higher effort?

Increasing the effort level helps—but only up to a point.

In ambiguous cases, more effort reduces instability. The models follow the rules more consistently and are more likely to converge on the same answer.

But in cases where the signal is missing, more effort does not recover the correct result. It only changes how the models justify their choice—and sometimes which incorrect answer they select.

> Reasoning improves decisions when information exists. It cannot recover information that isn’t there.

_This article was developed with the help of AI tools. The experiments, analysis, and conclusions are my own._