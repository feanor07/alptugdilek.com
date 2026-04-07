---
layout: ../../../layouts/BlogPost.astro
title: "Visitor Pattern Strikes Back in Java"
date: "2026-04-08"
description: "Why the Visitor pattern is becoming relevant again in modern Java with sealed classes and pattern matching."
tags: ["java", "design-patterns", "visitor-pattern", "sealed-classes"]
---

For years, the Visitor pattern has been somewhat underrated in Java. I’ve encountered it far less in real-world codebases than I would have expected.

Part of the reason is simple: it used to be hard to justify.

The Visitor pattern was often considered too verbose. And honestly, that wasn’t entirely wrong.

But modern Java has changed something important. Not the Visitor pattern itself, but how we model domain hierarchies.

That makes Visitor worth revisiting.

## The Problem

Imagine you're building a payment system that supports multiple payment types:

- Credit Card
- PayPal
- Bank Transfer

You might model it like this:

```java
sealed interface Payment
        permits Payment.CreditCard, Payment.PayPal, Payment.BankTransfer {}

record CreditCard(String number) implements Payment {}
record PayPal(String email) implements Payment {}
record BankTransfer(String iban) implements Payment {}
```

Now you want to process payments:

```java
void process(Payment payment) {
    if (payment instanceof CreditCard cc) {
        ...
    } else if (payment instanceof PayPal pp) {
        ...
    } else if (payment instanceof BankTransfer bt) {
        ...
    }
}
```

This works, but problems appear over time:

- Logic spreads across the codebase
- Harder to maintain
- Easy to forget new types
- No strong compile-time guarantees

## Enter Visitor

Instead, you can use the Visitor pattern:

```java
sealed interface Payment
        permits Payment.CreditCard, Payment.PayPal, Payment.BankTransfer {

    <T> T accept(Visitor<T> visitor);

    interface Visitor<T> {
        T creditCard(CreditCard creditCard);
        T payPal(PayPal payPal);
        T bankTransfer(BankTransfer bankTransfer);
    }

    record CreditCard(String number) implements Payment {
        public <T> T accept(Visitor<T> visitor) {
            return visitor.creditCard(this);
        }
    }

    record PayPal(String email) implements Payment {
        public <T> T accept(Visitor<T> visitor) {
            return visitor.payPal(this);
        }
    }

    record BankTransfer(String iban) implements Payment {
        public <T> T accept(Visitor<T> visitor) {
            return visitor.bankTransfer(this);
        }
    }
}
```

Yes, this is still somewhat verbose; but sealed classes change something important.

## Compile-Time Exhaustiveness

Now imagine adding a new payment type:

```java
record ApplePay(String token) implements Payment {}
```

The compiler immediately tells you:

> You forgot to handle ApplePay

This is the real power of Visitor.

- No silent bugs
- No missed cases
- No runtime surprises

With sealed classes, the hierarchy is closed. The compiler knows all variants and enforces exhaustiveness.

This is what makes Visitor far more compelling in modern Java.

## A Small but Meaningful Style Shift

Traditionally, Visitor implementations used a single method name:

```java
interface Visitor<T> {
    T visit(CreditCard creditCard);
    T visit(PayPal payPal);
    T visit(BankTransfer bankTransfer);
}
```

However, Java also allows a more expressive alternative:

```java
interface Visitor<T> {
    T creditCard(CreditCard creditCard);
    T payPal(PayPal payPal);
    T bankTransfer(BankTransfer bankTransfer);
}
```

This can improve readability and domain clarity. It's not a new capability, but modern Java tends to favor clarity over strict pattern conventions.

## Java 17 vs Java 21: Visitor vs Pattern Matching

If you're using Java 17, you typically have:

- Sealed classes
- Records
- No pattern matching for switch

In that world, Visitor becomes a very practical solution.

With Java 21, you can also write:

```java
switch (payment) {
    case CreditCard cc -> ...
    case PayPal pp -> ...
    case BankTransfer bt -> ...
}
```

Now pattern matching becomes a strong alternative.

A practical rule of thumb:

Use Visitor when:

- You have multiple behaviors
- Logic grows complex
- You want reusable operations
- You're on Java 17

Use pattern matching when:

- You're on Java 21+
- Logic is small
- Used in one place
- Simpler is better

Both are valid tools.

## Why Visitor Is Relevant Again

A common guideline for Visitor is that it works well when the set of types is stable but new operations are added over time.

That still applies. But modern Java introduces another reason.

We model closed hierarchies more often now, and Visitor fits naturally there.

Visitor didn’t change. Java did.

## Final Thoughts

Sealed classes make Visitor more practical. Pattern matching offers a concise alternative.

The Visitor strikes back.

---

_This article evolved through discussions with AI. The ideas and final opinions are my own._
