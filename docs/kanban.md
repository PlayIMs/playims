# PlayIMs Development Kanban

> Last Updated: 2026-01-30
> 
> This Kanban board tracks development tasks for PlayIMs. I update this nightly during my 11 PM work sessions.

---

## 📋 Backlog (Prioritized)

### High Priority (Core Features)

| # | Task | Description | Est. Effort | Blocked By |
|---|------|-------------|-------------|------------|
| 1 | **Auth System** | Implement user registration, login, JWT/session management. Email verification, password reset. | Medium | - |
| 2 | **Player Registration Flow** | Allow players to sign up, create profiles, join teams. Player dashboard with their schedule. | Medium | Auth System |
| 3 | **Team Management UI** | Create/join teams, roster management, invite system, team pages. | Medium | Auth System |
| 4 | **League Registration** | Browse leagues, register teams, payment integration (Stripe), registration deadlines. | Large | Auth System |
| 5 | **Game Score Tracking** | Referees/Admins can input scores, update standings automatically. | Medium | - |

### Medium Priority (Enhancements)

| # | Task | Description | Est. Effort | Blocked By |
|---|------|-------------|-------------|------------|
| 6 | **Mobile Responsiveness Audit** | Ensure all pages work great on mobile. Touch-friendly controls. | Medium | - |
| 7 | **Email Notifications** | Welcome emails, game reminders, registration confirmations. SendGrid/Resend integration. | Small | Auth System |
| 8 | **Search & Filtering** | Global search for teams, leagues, players. Advanced filters. | Small | - |
| 9 | **Calendar Export** | iCal/ICS export for player schedules. Google Calendar integration. | Small | - |
| 10 | **Announcements System** | Admin can create announcements, push notifications. Priority/urgency levels. | Small | - |

### Lower Priority (Nice-to-Have)

| # | Task | Description | Est. Effort | Blocked By |
|---|------|-------------|-------------|------------|
| 11 | **Bracket/Tournament Support** | Single/double elimination brackets. Tournament scheduling. | Large | - |
| 12 | **Stats & Analytics** | Player stats tracking, team performance analytics, reports. | Large | Game Score Tracking |
| 13 | **Mobile PWA** | Service worker, offline support, install prompt, push notifications. | Medium | - |
| 14 | **File Uploads** | Team logos, player photos, facility images. R2 integration. | Small | - |
| 15 | **Bulk Import/Export** | CSV import for teams, players. Data export for admins. | Small | - |

### Technical Debt & Infrastructure

| # | Task | Description | Est. Effort | Priority |
|---|------|-------------|-------------|----------|
| 16 | **Unit Tests** | Jest/Vitest setup, test critical operations. | Medium | Medium |
| 17 | **E2E Tests** | Playwright tests for critical user flows. | Medium | Medium |
| 18 | **Error Monitoring** | Sentry integration for production error tracking. | Small | Low |
| 19 | **API Documentation** | OpenAPI/Swagger docs for all API endpoints. | Medium | Low |
| 20 | **Performance Optimization** | Lighthouse audit, bundle size optimization, image optimization. | Medium | Low |

---

## 🚀 Ready (Next Up)

These tasks are ready to be worked on. I'll pick from here during my nightly sessions.

| # | Task | Why Now | Notes |
|---|------|---------|-------|
| 1 | **Landing Page - Enable CTAs** | Buttons are disabled, need to link to actual flows | Start with "Get Early Access" → email capture form |
| 2 | **Dashboard Polish** | PR #feature/dashboard-real-data is in progress | Complete any remaining items from that PR |
| 3 | **SEO Meta Tags** | Landing page needs proper meta tags for search visibility | Title, description, OG tags, favicon setup |
| 4 | **404 Page** | Better UX for broken links | Match design system |
| 5 | **Loading States** | Skeleton loaders for dashboard cards | Improves perceived performance |

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
**Focus:** Complete Dashboard Real Data + Landing Page Polish

- [ ] Merge `feature/dashboard-real-data` PR
- [ ] Enable landing page CTAs (email capture)
- [ ] Add SEO meta tags
- [ ] Create 404 page

### Next Sprint (Week of Feb 6)
**Focus:** Authentication Foundation

- [ ] Auth system design & schema
- [ ] Login/Register pages
- [ ] JWT/session implementation
- [ ] Protected routes middleware

---

## 🐛 Known Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| Landing page buttons disabled | Low | Placeholder until auth ready |
| Dashboard needs real-time updates | Medium | Consider WebSockets for live scores |
| Mobile menu not implemented | Medium | Need responsive navigation |

---

## 💡 Ideas & Future Considerations

- **Multi-tenancy**: Support multiple schools/organizations
- **White-labeling**: Custom branding per client
- **Payments**: Stripe integration for league fees
- **SMS Notifications**: Twilio for game reminders
- **Social Login**: Google, Apple sign-in
- **Referral System**: Invite friends, earn rewards
- **Captain Features**: Team management tools for captains
- **Waitlist System**: For full leagues
- **Free Agent System**: Players without teams

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

**Competitor Analysis (imleagues.com):**
- Their UI is dated and clunky
- We win on design and UX
- Need to match their feature set eventually
- Focus on "easier to use" as differentiator
