#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const API_URL = 'https://gql.hashnode.com/'
const POSTS_DIR = path.resolve(__dirname, '../posts')
const HASHNODE_HOST = process.env.HASHNODE_HOST || 'personalos.hashnode.dev'
const VERIFY_MODE = process.argv.includes('--verify')

// --- GraphQL ---

const POST_BY_ID_QUERY = `
  query PostById($id: ID!) {
    post(id: $id) { id title slug url }
  }
`

const PUBLICATION_POSTS_QUERY = `
  query PubPosts($host: String!, $first: Int!) {
    publication(host: $host) {
      posts(first: $first) {
        edges { node { id title slug url } }
      }
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

const UPDATE_MUTATION = `
  mutation UpdatePost($input: UpdatePostInput!) {
    updatePost(input: $input) {
      post { id title slug url }
    }
  }
`

// --- Helpers ---

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function gql(query, variables, requireAuth = true) {
  const headers = { 'Content-Type': 'application/json' }
  if (requireAuth) {
    if (!process.env.HASHNODE_PAT) throw new Error('HASHNODE_PAT not set')
    headers.Authorization = process.env.HASHNODE_PAT
  }
  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} from GraphQL API`)
  const json = await res.json()
  if (json.errors) {
    const msg = json.errors.map((e) => e.message).join('; ')
    throw new Error(`GraphQL error: ${msg}`)
  }
  return json.data
}

// --- Frontmatter ---

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { meta: {}, content: raw }
  const meta = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let val = line.slice(idx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map((s) => s.trim().replace(/"/g, ''))
    }
    meta[key] = val
  }
  return { meta, content: match[2] }
}

function needsQuoting(val) {
  return /[:'"#\[\]{}]/.test(val)
}

function serializeFrontmatter(meta, content) {
  const lines = []
  for (const [key, val] of Object.entries(meta)) {
    if (val === undefined || val === null) continue
    if (Array.isArray(val)) {
      lines.push(`${key}: [${val.join(', ')}]`)
    } else if (typeof val === 'string' && needsQuoting(val)) {
      lines.push(`${key}: "${val.replace(/"/g, '\\"')}"`)
    } else {
      lines.push(`${key}: ${val}`)
    }
  }
  return `---\n${lines.join('\n')}\n---\n${content}`
}

// --- API Operations ---

async function fetchPostById(id) {
  try {
    const data = await gql(POST_BY_ID_QUERY, { id }, false)
    return data.post || null
  } catch {
    return null
  }
}

async function fetchPublicationPosts() {
  const data = await gql(PUBLICATION_POSTS_QUERY, { host: HASHNODE_HOST, first: 50 }, false)
  return (data.publication?.posts?.edges || []).map((e) => e.node)
}

async function findPostByTitle(title) {
  const posts = await fetchPublicationPosts()
  return posts.find((p) => p.title === title) || null
}

function toPublishedAt(date) {
  if (!date) return undefined
  return new Date(`${date}T00:00:00Z`).toISOString()
}

async function updatePost(id, meta, content) {
  const input = { id, title: meta.title, contentMarkdown: content }
  if (meta.subtitle) input.subtitle = meta.subtitle
  if (meta.date) input.publishedAt = toPublishedAt(meta.date)
  if (meta.tags && Array.isArray(meta.tags)) {
    input.tags = meta.tags.map((t) => ({ name: t, slug: t.toLowerCase().replace(/\s+/g, '-') }))
  }
  if (meta.canonical_url) input.originalArticleURL = meta.canonical_url
  const data = await gql(UPDATE_MUTATION, { input })
  return data.updatePost.post
}

async function publishNew(meta, content) {
  if (!process.env.HASHNODE_PUBLICATION_ID) throw new Error('HASHNODE_PUBLICATION_ID not set')
  const input = {
    publicationId: process.env.HASHNODE_PUBLICATION_ID,
    title: meta.title,
    contentMarkdown: content,
    slug: slugify(meta.title),
    tags: [],
  }
  if (meta.subtitle) input.subtitle = meta.subtitle
  if (meta.date) input.publishedAt = toPublishedAt(meta.date)
  if (meta.tags && Array.isArray(meta.tags)) {
    input.tags = meta.tags.map((t) => ({ name: t, slug: t.toLowerCase().replace(/\s+/g, '-') }))
  }
  if (meta.canonical_url) input.originalArticleURL = meta.canonical_url
  const data = await gql(PUBLISH_MUTATION, { input })
  return data.publishPost.post
}

// --- Core Logic ---

function writeFrontmatter(filePath, meta, content) {
  fs.writeFileSync(filePath, serializeFrontmatter(meta, content), 'utf-8')
}

async function processPost(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const { meta, content } = parseFrontmatter(raw)
  const basename = path.basename(filePath)

  // Draft — skip
  if (meta.published === 'false') {
    console.log(`[skip] ${basename} — draft`)
    return
  }

  // Has hashnode_id — verify by ID
  if (meta.hashnode_id) {
    const remote = await fetchPostById(meta.hashnode_id)
    if (remote) {
      // Post exists — sync content
      const updated = await updatePost(meta.hashnode_id, meta, content)
      console.log(`[sync] ${basename} — updated existing post (${updated.url})`)
      meta.published = 'true'
      meta.hashnode_url = updated.url
      writeFrontmatter(filePath, meta, content)
      return
    }
    // ID is stale — clear and fall through
    console.log(`[warn] ${basename} — hashnode_id ${meta.hashnode_id} not found, clearing stale markers`)
    delete meta.hashnode_id
    delete meta.hashnode_url
    meta.published = undefined
    delete meta.published
  }

  // Has published: true but no hashnode_id — try title match
  if (meta.published === 'true' && !meta.hashnode_id) {
    const match = await findPostByTitle(meta.title)
    if (match) {
      // Found by title — store ID, sync
      const updated = await updatePost(match.id, meta, content)
      console.log(`[recover] ${basename} — found by title, stored ID (${updated.url})`)
      meta.hashnode_id = match.id
      meta.hashnode_url = updated.url
      meta.published = 'true'
      writeFrontmatter(filePath, meta, content)
      return
    }
    // Not found — stale marker, clear and fall through
    console.log(`[warn] ${basename} — marked published but not found on Hashnode, clearing`)
    delete meta.hashnode_url
    meta.published = undefined
    delete meta.published
  }

  // No published field (or cleared above) — publish as new
  if (meta.published !== 'true' && meta.published !== 'false') {
    const post = await publishNew(meta, content)
    console.log(`[new] ${basename} — published → ${post.url}`)
    meta.hashnode_id = post.id
    meta.hashnode_url = post.url
    meta.published = 'true'
    writeFrontmatter(filePath, meta, content)
    return
  }

  // Shouldn't reach here, but just in case
  console.log(`[skip] ${basename} — no action needed`)
}

// --- Verify Mode ---

async function verify() {
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'))
  let allGood = true

  for (const file of files) {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8')
    const { meta } = parseFrontmatter(raw)

    if (meta.published !== 'true') {
      console.log(`[--] ${file} — not published`)
      continue
    }

    if (!meta.hashnode_id) {
      console.log(`[!!] ${file} — published=true but no hashnode_id`)
      allGood = false
      continue
    }

    const remote = await fetchPostById(meta.hashnode_id)
    if (remote) {
      console.log(`[ok] ${file} — synced (${remote.url})`)
    } else {
      console.log(`[!!] ${file} — hashnode_id ${meta.hashnode_id} not found on Hashnode`)
      allGood = false
    }
  }

  if (!allGood) {
    console.log('\nSome posts have mismatches. Run without --verify to repair.')
    process.exit(1)
  }
  console.log('\nAll published posts verified.')
}

// --- Main ---

async function main() {
  if (VERIFY_MODE) {
    await verify()
    return
  }

  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'))
  if (files.length === 0) {
    console.log('No posts found')
    return
  }

  // Sort by date (oldest first)
  const sorted = files
    .map((f) => {
      const raw = fs.readFileSync(path.join(POSTS_DIR, f), 'utf-8')
      const { meta } = parseFrontmatter(raw)
      return { file: f, date: meta.date || '9999-99-99' }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  for (const { file } of sorted) {
    await processPost(path.join(POSTS_DIR, file))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
