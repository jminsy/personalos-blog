---
title: Stop Building What Your AI Can Already Do
subtitle: The feature I deleted taught me more than the ones I shipped
tags: [ai, developer-tools, productivity, build-in-public]
---

I built a dashboard page with buttons, text inputs, and a submit system — so I could answer questions about my own projects. Option selectors, custom input fields, API endpoints that mutated files. The whole thing.

Then I stared at it and thought: *why am I clicking buttons when I can just say the answer out loud?*

## The realization

I work with an AI assistant that already understands my entire workspace. Every file, every project, every open question. When I want to decide "use JWT for auth," I don't need a form. I just say it. The AI updates the file, adds context I didn't think of, and moves to the next thing.

A button can record a choice. A conversation can explore one.

## What changed

I ripped out the interactive layer. The page went from a mini-app to a simple list — just bullets showing what's unresolved across my projects. No forms, no state management, no API.

The result? The page became *more* useful. Turns out, seeing all your open questions in one place is the valuable part. Answering them through a constrained UI was the bottleneck.

## The bigger insight

We're at a weird moment in software. For years, the answer to "how do users interact with data?" was always "build a UI." Forms, modals, dropdowns, validation, error states — the whole ceremony.

But if you're already working alongside an AI that can read, write, and reason about your data — half of that UI is redundant. It's a worse version of something you already have.

**Dashboards should be read-only.** They show you the state of things. The action layer belongs in conversation, where nuance, context, and follow-up questions live naturally.

## The question worth asking

Before building any feature, I now ask: *is this a UI problem, or a conversation problem?*

Most of the time, it's a conversation. And the best interface for a conversation isn't a form — it's just talking.

---

*This is the first post in a build-in-public series about creating a personal operating system with AI. Follow along at [personalos.hashnode.dev](https://personalos.hashnode.dev).*
