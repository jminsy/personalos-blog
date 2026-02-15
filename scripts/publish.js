#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

const API_URL = 'https://gql.hashnode.com/'
const POSTS_DIR = path.resolve(__dirname, '../posts')

const PUBLISH_MUTATION = `
  mutation PublishPost($input: PublishPostInput!) {
    publishPost(input: $input) {
      post { id title slug url }
    }
  }
`

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { meta: {}, content: raw }
  const meta = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let val = line.slice(idx + 1).trim()
    // Handle arrays like [tag1, tag2]
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map((s) => s.trim().replace(/"/g, ''))
    }
    meta[key] = val
  }
  return { meta, content: match[2] }
}

async function publish(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const { meta, content } = parseFrontmatter(raw)

  if (meta.published === 'true') {
    console.log(`Skipping ${path.basename(filePath)} — already published`)
    return
  }

  const input = {
    publicationId: process.env.HASHNODE_PUBLICATION_ID,
    title: meta.title,
    contentMarkdown: content,
    subtitle: meta.subtitle || undefined,
    tags: [],
  }

  if (meta.tags && Array.isArray(meta.tags)) {
    input.tags = meta.tags.map((t) => ({ name: t, slug: t.toLowerCase().replace(/\s+/g, '-') }))
  }

  if (meta.canonical_url) {
    input.originalArticleURL = meta.canonical_url
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: process.env.HASHNODE_PAT,
    },
    body: JSON.stringify({ query: PUBLISH_MUTATION, variables: { input } }),
  })

  const json = await res.json()

  if (json.errors) {
    console.error(`Failed to publish ${path.basename(filePath)}:`, json.errors)
    process.exit(1)
  }

  const post = json.data.publishPost.post
  console.log(`Published: ${post.title} → ${post.url}`)

  // Mark as published in frontmatter
  const updated = raw.replace(/^---\n/, `---\npublished: true\nhashnode_url: ${post.url}\n`)
  fs.writeFileSync(filePath, updated, 'utf-8')
}

async function main() {
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'))

  if (files.length === 0) {
    console.log('No posts found')
    return
  }

  for (const file of files) {
    await publish(path.join(POSTS_DIR, file))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
