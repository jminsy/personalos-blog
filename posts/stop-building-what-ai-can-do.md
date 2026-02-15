---
published: true
hashnode_url: https://personalos.hashnode.dev/stop-building-what-your-ai-can-already-do
title: Stop Building What Your AI Can Already Do
subtitle: How I deleted half a feature and got a better product
tags: [ai, developer-tools, productivity, build-in-public]
---

I built an interactive dashboard for my personal OS — a system that manages my tasks, ideas, and projects from markdown files in a workspace. One of the pages listed "Open Questions" pulled from my documents: things like *which auth method?* or *how often to run this?*

Each question had option buttons, a text input, and a submit button. When you answered, it would mutate the source markdown file — remove the question, add your answer to a Decisions section, and update the timestamp.

It worked. It was also completely pointless.

## The moment it clicked

I was staring at the answer form thinking about edge cases — what if the answer needs context? What if I want to change it later? What if the question is more nuanced than the options I parsed?

Then I realized: I already have a better interface for all of this. It's the conversation I'm having with Claude right now.

When I want to answer "which auth method?" — I don't click a button. I say "use JWT" and Claude updates the file, adds context, and moves on to implementation. The conversation *is* the interface.

## What I did

I gutted the interactive parts. Removed the `QuestionCard` component with its state management, the submit handler, the POST API that mutated markdown files. Replaced it all with a bullet list:

```
- Sources: which combo? [web search | HN | Reddit | dev.to]
- Frequency: how often to run?
- Auth: which method? [JWT | OAuth]
```

Read-only. No buttons. No forms. The dashboard shows me what questions are open. I answer them in conversation.

The diff removed ~180 lines of code. The page got simpler, faster, and more useful.

## The principle

**If your AI assistant can already do something through conversation, don't build a UI for it.**

This applies more broadly than you'd think:

- **Don't build form inputs** for things you'd rather discuss. A text box can't ask clarifying questions. A conversation can.
- **Don't build CRUD endpoints** for data your AI can edit directly. My markdown files *are* the database, and Claude already knows how to read and write them.
- **Don't build workflows** that duplicate what a prompt already handles. The overhead of maintaining UI + API + state management isn't worth it when `"use JWT for auth"` does the same thing in 3 seconds.

## What dashboards should actually do

Dashboards should **show you the state of things**. That's it. The value is in the visualization — seeing all your open questions grouped by project, seeing which ideas are stale, seeing your task pipeline.

The *action* layer belongs in conversation. That's where nuance lives. That's where you can say "actually, let's use OAuth instead, and here's why" and get an intelligent response, not just a database write.

## The meta lesson

I'm building a "personal OS" — a system to manage my life and projects. The irony of over-engineering it was not lost on me.

The best tool I have isn't the dashboard. It's the conversation with an AI that understands my entire workspace. Every feature I build should ask: *does this need a UI, or is this just a conversation?*

Most of the time, it's just a conversation.

---

*This is the first post in a build-in-public series about creating a personal operating system with Claude Code. Follow along at [personalos.hashnode.dev](https://personalos.hashnode.dev).*
