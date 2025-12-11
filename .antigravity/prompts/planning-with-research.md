# Planning Prompt with Real-Time Research

## Instructions for Agent

**Before generating an Implementation Plan:**
1. use codacy mcp every time you generate code to check for security vulnerabilities and code quality
2. always focus on robust, secure, production ready code
3. go deep into the workspase project to understand the codebase, which tech stack is used, and how it works, which files are used, and how they are related to each other, and how the project is structured. what package manager is used, and what version of node is used
4. Use `firecrawl_deep_research` to find the latest approaches for: [TASK]
5. Use `firecrawl_search` to find recent GitHub examples
6. Use `firecrawl_scrape` to fetch official docs (Next.js, Supabase, etc.)

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
