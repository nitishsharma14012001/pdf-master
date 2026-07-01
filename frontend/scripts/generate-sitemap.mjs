/**
 * scripts/generate-sitemap.mjs
 * ─────────────────────────────────────────────────────────────────────────
 * Regenerates public/sitemap.xml from the same tool catalog the app
 * itself renders pages from (src/utils/tools.js), so the sitemap can
 * never silently drift out of sync with the real set of /tools/:id
 * routes that exist in the app.
 *
 * Usage:  node scripts/generate-sitemap.mjs
 * (wired up as `npm run sitemap` — see package.json)
 * ─────────────────────────────────────────────────────────────────────────
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SITE_URL = process.env.SITE_URL || 'https://thepdfmaster.in'

// Static, non-tool routes worth indexing.
const STATIC_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/pricing', changefreq: 'monthly', priority: '0.7' },
  { path: '/about', changefreq: 'monthly', priority: '0.6' },
  { path: '/contact', changefreq: 'monthly', priority: '0.5' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
]

async function loadToolRoutes() {
  // tools.js is a plain ES module with no JSX/runtime deps, so it can be
  // imported directly under Node.
  const toolsModulePath = path.join(__dirname, '../src/utils/tools.js')
  const { allTools } = await import(`file://${toolsModulePath}`)
  return allTools.map((tool) => ({
    path: `/tools/${tool.id}`,
    changefreq: 'monthly',
    priority: '0.8',
  }))
}

function buildXml(routes) {
  const today = new Date().toISOString().split('T')[0]
  const urls = routes
    .map(
      (r) => `  <url>
    <loc>${SITE_URL}${r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

async function main() {
  const toolRoutes = await loadToolRoutes()
  const xml = buildXml([...STATIC_ROUTES, ...toolRoutes])
  const outPath = path.join(__dirname, '../public/sitemap.xml')
  fs.writeFileSync(outPath, xml)
  console.log(`Wrote ${toolRoutes.length + STATIC_ROUTES.length} URLs to ${outPath}`)
}

main().catch((err) => {
  console.error('Failed to generate sitemap:', err)
  process.exit(1)
})
