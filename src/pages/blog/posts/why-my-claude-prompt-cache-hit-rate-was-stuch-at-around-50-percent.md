---
layout: ../../../layouts/BlogPost.astro
title: "Why My Claude Prompt Cache Hit Rate Was Stuck at ~50%"
date: "2026-04-14"
description: "Git workspace context silently changed my Claude inputs, causing prompt caching to fail and doubling evaluation costs."
tags: ["llm", "claude", "prompt-engineering", "debugging", "cost-optimization"]
---

I was running the same prompt multiple times against Claude. This is a common pattern when evaluating LLM outputs, since models can produce different results across runs.

In a 5-run batch, runs 2–5 should have been nearly free with prompt caching.

It didn't.

## Why This Matters

Prompt caching is one of the most effective cost optimizations in the Claude API. When you send identical input multiple times, Anthropic caches processed tokens server-side so subsequent calls skip reprocessing the prompt.

After the first call warms the cache, reads are much cheaper. Cache reads cost about 10% of normal input token prices. For large prompts, this can reduce input costs by 80–90% across repeated calls.

The expected behavior is simple:

* Run 1 warms the cache
* Runs 2–5 are nearly free

That wasn't happening.

## What I Observed

I observed this behavior while running `claude-sonnet-4-6`, though the issue is not model-specific.

When I looked at raw token usage across runs, each call was re-creating roughly half the cache instead of reading it:

```
run_1: 24,075 tokens  (cache_read=0,     cache_create=24,073)  ← warms cache
run_2: 24,096 tokens  (cache_read=11780, cache_create=12,314)  ← should be full read
run_3: 24,117 tokens  (cache_read=11780, cache_create=12,335)
run_4: 24,138 tokens  (cache_read=11780, cache_create=12,356)
run_5: 24,159 tokens  (cache_read=11780, cache_create=12,377)
```

A quick note on the fields: `cache_create` is the number of tokens written to the cache on that call. You pay full input price for these. `cache_read` is the number of tokens read from an existing cache, which is roughly 10× cheaper. In a healthy batch run, only run 1 should have `cache_create`. Subsequent runs should be almost entirely `cache_read`.

Cache hit rate was stuck around 50% when it should have been close to 100% from run 2 onward.

For a ~24k token prompt, that meant paying full price for roughly 12,000 tokens on every run. This effectively doubled input processing cost across the experiment.

## The Real Clue: The Input Was Growing

The numbers reveal something subtle. The total input was not stable. It grew by about 21 tokens per run.

* Run 1: 24,075 tokens
* Run 5: 24,159 tokens

The prompt file, transcript, and goals had not changed.

Prompt caching is prefix-based and keyed by exact content. Even a single token difference invalidates the cache from that point onward. Because the input kept changing, the second cache breakpoint never matched the previous run. That forced partial re-creation every time.

The cache key was never stable because the input was never stable.

## The Culprit: Git Status Injection

I was invoking Claude using `claude -p` (Claude Code's CLI print mode) in a shell script and piping the prompt via stdin.

What I did not realize was that Claude Code injects workspace context when running inside a git repository. This includes:

* current branch
* recent commits
* `git status`

`git status` includes untracked files.

My batch script creates three files per run:

* `evaluation.json`
* `output.json`
* `raw_response_debug.json`

Each run added new untracked files. That changed `git status`, which changed the injected context, which changed the input, which invalidated the cache.

The growth was remarkably consistent at about 21 tokens per run. The output files had identical structure, so each run added the same token footprint.

The prompt file was identical.
The transcript was identical.
But the effective input was not.

## The Fix

Running Claude from a neutral directory outside the git repository prevents workspace context from being injected. Combined with `--no-session-persistence`, the input becomes truly static.

```bash
TMP_INPUT="$(mktemp /tmp/claude_input_XXXXXX.txt)"
trap 'rm -f "$TMP_INPUT"' EXIT

# build prompt into TMP_INPUT ...

(cd /tmp && claude -p --no-session-persistence --output-format json \
  --model "$MODEL" < "$TMP_INPUT" > "$OUTPUT")
```

### Why This Works

* `-p` runs Claude in print mode for scripting
* `--no-session-persistence` prevents history from being saved
* `cd /tmp` removes git workspace context

Running from `/tmp` means:

* no git repository
* no workspace memory
* no injected context
* no hidden input changes

After this change:

* runs 2–5 showed full cache reads
* `cache_create` dropped to zero after run 1
* input size stayed constant
* costs dropped as expected

## You Can Reproduce This

Run inside a git repository:

```bash
echo "test" | claude -p --no-session-persistence --output-format json \
  --model "$MODEL" | jq '{cache_read: .usage.cache_read_input_tokens, cache_create: .usage.cache_creation_input_tokens}'
```

Then run from `/tmp`:

```bash
echo "test" | (cd /tmp && claude -p --no-session-persistence --output-format json \
  --model "$MODEL") | jq '{cache_read: .usage.cache_read_input_tokens, cache_create: .usage.cache_creation_input_tokens}'
```

Don't be surprised by the token counts. The `"test"` prompt itself is only a couple of tokens. The thousands of tokens in `cache_read` and `cache_create` come from the system prompt that Claude Code injects automatically. That injected context is exactly what we're measuring.

## What I Measured

Here's what I measured across four consecutive runs. Between run 1 and run 2 everything was committed, clearing untracked files from `git status`. Between run 3 and run 4 a new dummy file was added.

```
┌─────┬─────────────┬────────────┬──────────────┬────────────────────────────────────────────────────────────┐
│ Run │  Location   │ cache_read │ cache_create │                           notes                            │
├─────┼─────────────┼────────────┼──────────────┼────────────────────────────────────────────────────────────┤
│ 1   │ project dir │ 12,057     │ 4,821        │ no warm cache, untracked files present                     │
├─────┼─────────────┼────────────┼──────────────┼────────────────────────────────────────────────────────────┤
│ 1   │ /tmp        │ 12,057     │ 4,482        │ no warm cache                                              │
├─────┼─────────────┼────────────┼──────────────┼────────────────────────────────────────────────────────────┤
│ 2   │ project dir │ 12,057     │ 4,630        │ committed between runs — git context changed, still a miss │
├─────┼─────────────┼────────────┼──────────────┼────────────────────────────────────────────────────────────┤
│ 2   │ /tmp        │ 16,539     │ 0            │ full cache hit                                             │
├─────┼─────────────┼────────────┼──────────────┼────────────────────────────────────────────────────────────┤
│ 3   │ project dir │ 16,687     │ 0            │ nothing changed since run 2 — finally a full hit           │
├─────┼─────────────┼────────────┼──────────────┼────────────────────────────────────────────────────────────┤
│ 3   │ /tmp        │ 16,539     │ 0            │ full cache hit                                             │
├─────┼─────────────┼────────────┼──────────────┼────────────────────────────────────────────────────────────┤
│ 4   │ project dir │ 12,057     │ 4,638        │ one new untracked file added — cache broken again          │
├─────┼─────────────┼────────────┼──────────────┼────────────────────────────────────────────────────────────┤
│ 4   │ /tmp        │ 16,539     │ 0            │ unaffected                                                 │
└─────┴─────────────┴────────────┴──────────────┴────────────────────────────────────────────────────────────┘
```

`/tmp` is stable across all runs. The project directory breaks whenever `git status` changes. A commit, a new file, or any workspace change can invalidate the cache.

## The Generalizable Lesson

Prompt caching only works if your input is byte-for-byte identical across calls.

When using high-level CLI tools instead of calling the API directly, invisible context can be injected into your prompts:

* git workspace state
* session history
* project memory
* environment metadata

These do not appear in your prompt file. They do not cause errors. They quietly inflate token counts and invalidate caching.

If you are using `claude -p` in evaluation scripts or batch pipelines, inspect your raw API responses. Look at:

* `cache_read_input_tokens`
* `cache_creation_input_tokens`

If creation stays high after the first run, your input is not as static as you think.

---

_This article evolved through discussions with AI. The investigation, measurements, and final conclusions are my own._
