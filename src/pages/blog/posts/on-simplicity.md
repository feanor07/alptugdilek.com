---
layout: ../../../layouts/BlogPost.astro
title: "On Simplicity in Software"
date: "2026-04-07"
description: "Why the best code is often the code you didn't write."
---

There's a recurring pattern I've seen across teams and codebases: we over-engineer things. Not out of malice, but out of good intentions. We anticipate future requirements that never come. We add abstractions "just in case." We build frameworks when a function would do.

## The cost of complexity

Every abstraction has a cost. It's not just the time to write it — it's the time every future developer spends understanding it, the bugs that hide in its seams, and the inertia it creates when you need to change direction.

A 200-line module that does one thing well is almost always better than a 50-line module that does one thing through three layers of indirection.

## Simple is not easy

Simplicity requires discipline. It means:

- Saying no to features that don't earn their complexity
- Deleting code that no longer serves a purpose
- Resisting the urge to generalize from a single use case
- Writing code that reads like prose, not a puzzle

The best engineers I've worked with share one trait: they make hard problems look simple. Not by hiding complexity, but by finding solutions that genuinely don't need it.

## A practical test

Before adding an abstraction, ask: "If I delete this in six months, how much code changes?" If the answer is "barely any," the abstraction probably isn't pulling its weight.

Write the straightforward thing first. Refactor when — and only when — the code tells you to.
