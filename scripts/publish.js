#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

const API_URL = 'https://gql.hashnode.com/'
const POSTS_DIR = path.resolve(__dirname, '../posts')

const HASHNODE_HOST = process.env.HASHNODE_HOST || 'personalos.hashnode.dev'

const CHECK_EXISTS_QUERY = `
  query CheckPost($host: String!, $slug: String!) {
    publication(host: $host) {
      post(slug: $slug) { id url }
    }
  }
`

const PUBLISH_MUTATION = `
  mutation PublishPost($input: PublishPostInput!) {
    publishPost(input: $input) {
      post { id title slug url }
    }
  }
`

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function checkExists(title) {
  const slug = slugify(title)
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: process.env.HASHNODE_PAT,
    },
    body: JSON.stringify({
      query: CHECK_EXISTS_QUERY,
      variables: { host: HASHNODE_HOST, slug },
    }),
  })
  const json = await res.json()
  const post = json.data?.publication?.post
  return post ? { id: post.id, url: post.url } : null
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { meta: {}, content: raw }
  const meta = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let val = line.slice(idx + 1).trim()
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
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

  // Idempotency guard: check if post already exists on Hashnode
  const existing = await checkExists(meta.title)
  if (existing) {
    console.log(`Skipping ${path.basename(filePath)} — already exists on Hashnode (${existing.url})`)
    const updated = raw.replace(/^---\n/, `---\npublished: true\nhashnode_url: ${existing.url}\n`)
    fs.writeFileSync(filePath, updated, 'utf-8')
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
