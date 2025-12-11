# Planning Prompt with Real-Time Research

## Instructions for Agent

**Before generating an Implementation Plan:**

1. Use `firecrawl_deep_research` to find the latest approaches for: [TASK]
2. Use `firecrawl_search` to find recent GitHub examples
3. Use `firecrawl_scrape` to fetch official docs (Next.js, Supabase, etc.)

**Sources to prioritize:**
- Official documentation (nextjs.org/docs, supabase.com/docs)
- Community discussions (dev.to, reddit.com/r/webdev, discussions.hasura.io)
- Working code (github.com with stars:>100, forks:>20, updated:>2024)
- Benchmarks and performance reports

**Plan requirements:**
- ✓ References specific library versions
- ✓ Cites best practice sources
- ✓ Identifies known pitfalls from community
- ✓ Includes real example links
