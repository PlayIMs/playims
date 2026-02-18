# PlayIMs

PlayIMs is a next-generation intramural and tournament management platform built to replace
outdated, slow, and frustrating league software with something fast, intuitive, and reliable.

## Built To Replace Broken Workflows

If you have ever run leagues and thought:

- "Why is everything buried in endless menus?"
- "How do I get back to the scheduler again?"
- "Why is this so slow for basic tasks?"

PlayIMs is being built to end that experience.

No more hunting through confusing navigation.
No more wasting time on tasks that should take seconds.
No more sacrificing control just to keep things simple.
No more annoying ads blocking the entire screen.

PlayIMs is designed around two non-negotiables:

- Make everyday league operations simple and intuitive while preserving fine-grained control for
  administrators
- Deliver an easy-to-use experience for your participants and staff members

The goal is clear: run leagues and tournaments without fighting the platform.

## Product Direction

PlayIMs is being designed for schools, universities, municipalities, and private organizations
running intramural leagues and tournaments at real scale.

What this means in practice:

- Faster setup for leagues, divisions, teams, and seasons
- Scheduling and competition operations that stay organized under pressure
- Tournament configuration and bracket control without workflow chaos
- Clearer visibility into standings, status, and league health
- Fewer clicks, less confusion, and more confidence for admins
- A modern foundation for future automation, analytics, and integrations

## Current State

PlayIMs is in active development with strong platform foundations already in place:

- Multi-tenant-ready data model and operations layer
- API-driven backend endpoints for core resources
- Cloudflare-native deployment architecture
- Dynamic client theming system for branding and customization

The current phase is focused on turning this foundation into complete, high-value league and
tournament workflows.

If you care about faster intramural operations and better tournament management, this is a project
worth watching as major workflow releases ship.

## For Technical Viewers And Future Contributors

PlayIMs is built with a modern, pragmatic TypeScript stack:

- Framework: SvelteKit 2.x with Svelte 5 runes
- Language: TypeScript 5.x
- Styling: TailwindCSS 4.x
- Database: Cloudflare D1 (SQLite)
- ORM: Drizzle ORM
- Validation: Zod
- Deployment: Cloudflare Pages
- Package manager: pnpm

## Architecture Overview

The codebase is organized for clear boundaries between UI, API, and data access:

```text
src/
|-- lib/
|   |-- database/
|   |   |-- schema/       # Table definitions (typed, one file per table)
|   |   |-- operations/   # Business/data access layer
|   |   `-- migrations/   # Drizzle-generated SQL migrations
|   |-- server/           # Server-only utilities
|   `-- theme.ts          # Dynamic theming system
|-- routes/
|   |-- api/              # REST endpoints
|   `-- dashboard/        # Product UI routes
`-- app.css               # Global styles and themed component classes
```

Engineering approach:

- Type-safe data flow from schema to API to UI
- Migration-first database workflow (no manual SQL drift)
- Cloudflare-first runtime model for fast deployment
- Incremental feature delivery on top of stable foundations

## Why Developers Should Watch This Project

- Clear product problem with real market demand
- Modern stack with strong long-term maintainability
- Practical architecture that balances speed and quality
- Opportunity to help define the future of intramural league operations

## Creator

PlayIMs is created by **Jake Harvanchik**.  
LinkedIn: <https://www.linkedin.com/in/harvanchik/>

Jake brings both intramural operations experience and software development experience to this
project. He has worked in collegiate intramural leadership and officiating roles, including as an
Intramural Sports Lead at Cal State Fullerton and as a Graduate Assistant of Intramural Sports and
Sport Clubs at the University of Mississippi. He has also worked in live sports data collection and
auditing roles for Sports Info Solutions across college football and basketball.

On the technical side, Jake has professional web application development experience as a Junior
Software Developer building TypeScript-based solutions. His academic background combines sports and
technology: a **M.S. in Sport Management** (University of Mississippi, in progress), a **B.S. in
Computer Science** (California State University, Fullerton), and prior Computer Science study at
Oklahoma State University.

## Technical Docs

- [Development Guide](docs/DEVELOPMENT.md)
- [Database Guide](docs/DATABASE.md)
- [Commit Message Guide](docs/COMMIT_GUIDE.md)
