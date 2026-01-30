# PlayIMs Development Kanban

> Last Updated: 2026-01-30
> 
> This Kanban board tracks development tasks for PlayIMs. I update this nightly during my 11 PM work sessions.

---

## 📋 Backlog (Prioritized)

### High Priority (Core Features)

| # | Task | Description | Est. Effort | Blocked By |
|---|------|-------------|-------------|------------|
| 1 | **Game Score Tracking** | Referees/Admins can input scores, update standings automatically. | Medium | - |
| 2 | **Team Management UI** | Create/join teams, roster management, invite system, team pages. | Medium | - |
| 3 | **Player Registration Flow** | Allow players to create profiles, join teams. Player dashboard with their schedule. | Medium | - |
| 4 | **League Registration** | Browse leagues, register teams, registration deadlines. | Medium | - |
| 5 | **Schedule Management** | Create/edit game schedules, venue assignment, conflict detection. | Medium | - |

### Medium Priority (Enhancements)

| # | Task | Description | Est. Effort | Blocked By |
|---|------|-------------|-------------|------------|
| 6 | **Mobile Responsiveness Audit** | Ensure all pages work great on mobile. Touch-friendly controls. | Medium | - |
| 7 | **Search & Filtering** | Global search for teams, leagues, players. Advanced filters. | Small | - |
| 8 | **Calendar Export** | iCal/ICS export for player schedules. Google Calendar integration. | Small | - |
| 9 | **Announcements System** | Admin can create announcements, priority/urgency levels. | Small | - |
| 10 | **Email Notifications** | Game reminders, registration confirmations. SendGrid/Resend. | Small | - |

### Lower Priority (Nice-to-Have)

| # | Task | Description | Est. Effort | Blocked By |
|---|------|-------------|-------------|------------|
| 11 | **Bracket/Tournament Support** | Single/double elimination brackets. Tournament scheduling. | Large | - |
| 12 | **Stats & Analytics** | Player stats tracking, team performance analytics, reports. | Large | Game Score Tracking |
| 13 | **Mobile PWA** | Service worker, offline support, install prompt, push notifications. | Medium | - |
| 14 | **File Uploads** | Team logos, player photos, facility images. R2 integration. | Small | - |
| 15 | **Bulk Import/Export** | CSV import for teams, players. Data export for admins. | Small | - |

### Blocked / Later (Dependencies)

| # | Task | Description | Est. Effort | Blocker |
|---|------|-------------|-------------|---------|
| 16 | **Auth System** | University SSO login (SAML/OAuth). Students log in via their school's auth. | Large | Microsoft sandbox for testing SSO |
| 17 | **Payments** | Stripe integration for league fees, team registration payments. | Medium | Auth System + Business setup |
| 18 | **Email Notifications** | Welcome emails, password resets (requires auth system). | Small | Auth System |

### Technical Debt & Infrastructure

| # | Task | Description | Est. Effort | Priority |
|---|------|-------------|-------------|----------|
| 19 | **Offline Page** | Show cached content when offline, graceful degradation. | Small | High |
| 20 | **Unit Tests** | Jest/Vitest setup, test critical operations. | Medium | Medium |
| 21 | **E2E Tests** | Playwright tests for critical user flows. | Medium | Medium |
| 22 | **Error Monitoring** | Sentry integration for production error tracking. | Small | Low |
| 23 | **API Documentation** | OpenAPI/Swagger docs for all API endpoints. | Medium | Low |
| 24 | **Performance Optimization** | Lighthouse audit, bundle size optimization, image optimization. | Medium | Low |

---

## 🚀 Ready (Next Up)

These tasks are ready to be worked on. I'll pick from here during my nightly sessions.

| # | Task | Why Now | Notes |
|---|------|---------|-------|
| 1 | **SEO Meta Tags & Landing Page SEO** | Landing page needs proper meta tags for search visibility | Title, description, OG tags, favicon, structured data, sitemap |
| 2 | **404 Page** | Better UX for broken links | Match design system |
| 3 | **Offline Page** | Show cached content/service worker fallback when offline | PWA foundation step |
| 4 | **Dashboard Polish** | PR #feature/dashboard-real-data is in progress | Complete any remaining items from that PR |
| 5 | **Loading States** | Skeleton loaders for dashboard cards | Improves perceived performance |

### 🎯 Tonight's Priority (Jan 30)
Per Jake's request, focus on:
1. **SEO Meta Tags** — comprehensive meta tags for landing page
2. **Landing Page SEO improvements** — structured data, semantic HTML, sitemap
3. **404 Page** — match design system
4. **Offline Page** — service worker + offline fallback

**DO NOT touch landing page buttons — leave disabled as-is.**

---

## 🏗️ In Progress

| # | Task | Started | Branch | Status |
|---|------|---------|--------|--------|
| - | *Nothing currently in progress* | - | - | - |

---

## 👀 In Review (PR Created)

| # | PR | Description | Link | Status |
|---|-----|-------------|------|--------|
| 1 | Dashboard Real Data | Transform dashboard from static mock data to real database integration | `feature/dashboard-real-data` | 🔄 Awaiting review |
| 2 | Project Kanban | Development tracking board for organized work | `feature/project-kanban` | 🔄 Awaiting review |

---

## ✅ Done

| # | Task | Completed | PR | Notes |
|---|------|-----------|-----|-------|
| 1 | Database Schema | 2026-01-15 | - | Full schema with migrations |
| 2 | API Routes | 2026-01-18 | - | RESTful API for all entities |
| 3 | Database Operations | 2026-01-18 | - | Type-safe operations layer |
| 4 | Landing Page v1 | 2026-01-15 | - | Initial design and content |
| 5 | Dashboard v1 | 2026-01-20 | - | Initial layout with mock data |
| 6 | Facilities Page | 2026-01-20 | - | Basic facility listing |
| 7 | Comprehensive Seed Data | 2026-01-26 | - | Sports, leagues, teams, games |
| 8 | Style Guide & Design System | 2026-01-18 | - | Cursor SKILL.md with colors |
| 9 | AGENTS.md | 2026-01-29 | - | AI assistant guidelines |

---

## 📊 Sprint Goals

### Current Sprint (Week of Jan 30)
**Focus:** Complete Dashboard Real Data + SEO Improvements + Error/Offline Pages

- [ ] Merge `feature/dashboard-real-data` PR
- [ ] Merge `feature/project-kanban` PR
- [ ] Add SEO meta tags & landing page SEO improvements
- [ ] Create 404 page
- [ ] Create Offline page with service worker
- [ ] ~~Enable landing page CTAs~~ (Skip per Jake — leave disabled)

### Next Sprint (Week of Feb 6)
**Focus:** Core Features (Auth-Free)

- [ ] Game Score Tracking
- [ ] Team Management UI basics
- [ ] Schedule Management

---

## 🐛 Known Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| Landing page buttons disabled | Intentional | Disabled by design until auth flows ready |
| Dashboard needs real-time updates | Medium | Consider WebSockets for live scores |
| Mobile menu not implemented | Medium | Need responsive navigation |
| No offline support | Medium | Need service worker + offline page |

---

## 💡 Ideas & Future Considerations

- **Multi-tenancy**: Support multiple schools/organizations
- **White-labeling**: Custom branding per client
- **Payments**: Stripe integration for league fees (post-auth)
- **SMS Notifications**: Twilio for game reminders
- **Referral System**: Invite friends, earn rewards
- **Captain Features**: Team management tools for captains
- **Waitlist System**: For full leagues
- **Free Agent System**: Players without teams
- **Auth Strategy**: University SSO (SAML/OAuth) — requires Microsoft sandbox for testing

---

## 📝 Notes for Bandit (Myself)

**Style Guide Location:** `.cursor/skills/style/SKILL.md`

**Key Principles:**
- Always create feature branches: `feature/description`
- Write detailed PR descriptions
- Follow existing code patterns
- Test locally before pushing
- Respect Jake's time (student + 30hr work week)

**Jake's Constraints:**
- Full-time student
- Works 30 hours/week
- Limited time for PlayIMs daily
- Prioritize small, reviewable PRs

**Important Context:**
- **Payments:** Skip for now. Focus on software first.
- **Auth:** Skip for now. Goal is university SSO (students log in via school auth), but requires Microsoft sandbox setup for testing. Not ready yet.
- **Offline:** High priority — add service worker + offline page for PWA foundation.

**Competitor Analysis (imleagues.com):**
- Their UI is dated and clunky
- We win on design and UX
- Need to match their feature set eventually
- Focus on "easier to use" as differentiator
