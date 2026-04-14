---
layout: ../../../layouts/BlogPost.astro
title: "Claude Code Started Calling Haiku After a Version Update"
date: "2026-04-14"
description: "A Claude Code update introduced unexpected Haiku calls alongside Opus. This post documents the discovery and version comparison."
tags: ["Claude Code", "LLM", "Observability", "Cost Optimization", "Debugging"]
---

While investigating a prompt caching issue in my Claude Code evaluation scripts, I noticed something else unexpected in the raw API responses: a Haiku call I never asked for, appearing alongside my Opus calls.

I previously wrote about the caching issue here:
[Why My Claude Prompt Cache Hit Rate Was Stuck at Around 50%](https://alptugdilek.com/blog/posts/why-my-claude-prompt-cache-hit-rate-was-stuck-at-around-50-percent/)

## The discovery

I was inspecting the `modelUsage` field in the raw JSON response, something that's easy to miss unless you inspect raw responses, when I saw this:

```json
"claude-haiku-4-5-20251001": {
  "inputTokens": 10856,
  "outputTokens": 16,
  "costUSD": 0.010936
},
"claude-opus-4-6": {
  "inputTokens": 2,
  "outputTokens": 2438,
  "costUSD": 0.163684
}
```

I had specified Opus. I was running a simple `claude -p` single-turn call. No subagents, no tools, no complex workflows. Yet Haiku read my entire prompt (10,856 tokens) and produced 16 tokens before Opus did the actual work.

## Pinning the version

My older batch runs didn't show this behavior. By checking the `.jsonl` session files Claude Code stores locally, I was able to confirm which version those runs were on:

```bash
cat ~/.claude-personal/projects/.../session.jsonl | jq -r '.version' | sort -u
# 2.1.104
```

Current version on my machine: **2.1.107**

I then ran a controlled test: downgrade, test, upgrade, test.

```bash
claude install 2.1.104
echo "test" | (cd /tmp && claude -p --no-session-persistence \
  --output-format json --model claude-opus-4-6) | jq '.modelUsage'
```

### 2.1.104 — Opus only

```json
{
  "claude-opus-4-6": {
    "inputTokens": 5,
    "outputTokens": 15,
    "cacheReadInputTokens": 0,
    "cacheCreationInputTokens": 22798,
    "costUSD": 0.1428875
  }
}
```

### 2.1.107 — Haiku appears

```json
{
  "claude-haiku-4-5-20251001": {
    "inputTokens": 339,
    "outputTokens": 11,
    "cacheReadInputTokens": 0,
    "cacheCreationInputTokens": 0,
    "costUSD": 0.000394
  },
  "claude-opus-4-6": {
    "inputTokens": 5,
    "outputTokens": 16,
    "cacheReadInputTokens": 23291,
    "cacheCreationInputTokens": 0,
    "costUSD": 0.012070
  }
}
```

Reproducible on my machine, version-pinned, no other variables changed.

## What I observed

* On my machine, Haiku is being called internally on every `claude -p` invocation on version 2.1.107
* It wasn't happening on version 2.1.104
* It reads the prompt and produces a very small number of tokens (11–16)
* It happens on simple single-turn calls with no explicit subagent usage
* The Haiku call never benefits from prompt caching. `cache_read=0` every time
* The cost scales with prompt size. My 26k token transcripts generated ~10k token Haiku calls
* On my 26k token transcripts, Haiku added roughly $0.01 per call. Against an Opus call costing ~$0.16, that's around 6–7% overhead you didn't ask for and can't currently opt out of
* It appeared between two patch versions (2.1.104 → 2.1.107). I couldn't find any release notes describing this change in the Claude Code changelog: [https://code.claude.com/docs/en/changelog#2-1-107](https://code.claude.com/docs/en/changelog#2-1-107)

## What I don't know

The exact internal mechanism is unclear. Based on the [official sub-agents documentation](https://code.claude.com/docs/en/sub-agents.md), which describes built-in subagents such as Explore that use Haiku by default, this is likely Claude Code invoking an internal subagent automatically. But I haven't confirmed the exact cause, only the behavior.

It's also possible the Haiku call is doing something useful, for example routing or classifying the prompt before the Opus call. If that were the case, you would expect to see some benefit in the Opus token counts or latency across versions. I didn't measure latency, and the token counts don't show an obvious savings. So the net effect, from where I'm sitting, looks like added cost with no visible upside.

Constantine Mirin documented a [similar finding through OpenTelemetry monitoring](https://mirin.pro/blog/claude-code-subagents-haiku-telemetry/), finding that 36% of Haiku subagent calls were doing complex reasoning tasks rather than simple lookups. Worth reading alongside this investigation.

## What you can do

Check your own runs by inspecting the raw response:

```bash
echo "test" | claude -p --output-format json --model claude-opus-4-6 | jq '.modelUsage'
```

If you see a model you didn't ask for, you're being routed. As of now I haven't found a reliable way to suppress it. If you know of a flag or workaround that does, I'd love to hear it.

## The bigger picture

Two posts in, and both findings came from the same place: inspecting raw API responses Claude Code doesn't surface in its normal output.

Silent cache invalidation. Silent model routing.

If you're running Claude Code in scripts or batch pipelines, it's worth looking at what's actually being sent and billed, not just the output.

---

_This article evolved through discussions with AI. The findings and conclusions are my own._
