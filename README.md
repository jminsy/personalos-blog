# personalos-blog

Build-in-public dev blog for Personal OS. Posts auto-publish to [personalos.hashnode.dev](https://personalos.hashnode.dev) on push.

## Usage

Add a markdown file to `posts/` with frontmatter:

```md
---
title: Your Post Title
subtitle: Optional subtitle
tags: [tag1, tag2]
---

Post content here...
```

Push to `main` → GitHub Action publishes to Hashnode.

Posts marked `published: true` in frontmatter are skipped on subsequent runs.
