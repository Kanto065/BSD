# BSD — Bangladeshi Business & Service Directory
## Architecture, Data Model, and Milestone-Based Build Prompts

This document turns the client's requirement docs into a buildable plan. The client docs
come in two generations. The **v1 docs** (Website Structure, Homepage Layout, Category
Structure, Submission Form, FAQ, Contact Page, Footer, Legal Disclaimer, Privacy Policy,
About) came first. The **v2 docs** (Homepage Header, Homepage Full Body Section, Website
Footer Structural Layout, Regional Coverage Factsheet, Community Initiative Page, Free
Access Policy Page, Powered by BayConnect Page, and the logo image) are newer. **v2 is the
latest and wins every conflict.** v1 still applies wherever v2 says nothing (for example
the Submission Form fields and consent checkboxes, the Legal Disclaimer, the Privacy
Policy, the FAQ page and the About page). Every field, category, and page below is taken
directly from those documents, and anything that had to be written without client copy is
listed in Section 7 (CLIENT-REVIEW items).

---

## 0. Current Progress (updated 2026-09-25)

**Live**: https://bsd.wales (site) and https://api.bsd.wales (API health check) —
deployed on a shared VPS (169.58.119.208) alongside two unrelated client projects,
isolated in its own Docker network/containers, behind the same shared Caddy reverse
proxy. BSD's site blocks live in `/opt/caddy-sites.d/bsd.caddy` (versioned here as
`deploy/bsd.caddy`), which the shared Caddyfile pulls in with
`import /etc/caddy/sites.d/*.caddy`. Do not append BSD blocks to
`/opt/platform/deploy/caddy/Caddyfile` itself. That file belongs to the other project's
repo and is reset on each of its deploys, which took bsd.wales down on 2026-09-24
until the import folder was added.

**Repo**: https://github.com/Kanto065/BSD (public, monorepo) — `bsd-api/` and
`bsd-web/` live together in one repo instead of the three separate repos the original plan
called for; simpler for a solo build. `bsd-mobile` doesn't exist
yet (still scoped for M5).

**Deploy pipeline**: push to `main` → GitHub Actions (`.github/workflows/deploy.yml`)
→ SSHes into the VPS using a restricted deploy key (GitHub secret `VPS_SSH_KEY`,
forced to run only `/opt/bsd/deploy.sh`, no shell) → that script does
`git pull` in `/opt/bsd-src` on the VPS, then `docker compose build api web && docker
compose up -d` from `/opt/bsd/docker-compose.yml` (build contexts point at
`../bsd-src/bsd-api` and `../bsd-src/bsd-web`). Postgres runs as its own container
(`bsd-postgres`) on an internal-only network; only `api` and `web` join the shared
`platform_internal` network so Caddy can reach them.

**What's live (production runs `main`)**, milestone by milestone:
- **M0 (Foundation)**: done. Fastify 5 + Prisma 5 API, Next.js 15 website, Docker on the shared VPS, deploy on push to `main`.
- **M1.5 v2 shell (Phase 1)**: LIVE. New logo and brand colours, v2 header, homepage and footer, the 3 zone pages, Free
  Access Policy, Community Initiative, Powered by BayConnect, Verification Policy, Coverage Area, download page with the
  Regional Coverage Factsheet PDF, and placeholder shells for Community Guidelines, Complaints and Financial Transparency.
- **Phase 2 (schema v2 and real Prisma migrations)**: LIVE. Migrations `0_init` to `4_request_contacts` are applied and
  the API runs `prisma migrate deploy` at boot, so new migrations apply on deploy. Migrations are written without a
  database using `prisma migrate diff` and tested in PGlite (see `deploy/v2-migration-runbook.md`).
- **M1 (public API and wiring, Phase 3)**: LIVE. Read-only public API (`/categories`, `/businesses/search`,
  `/businesses/featured`, `/businesses/:slug`, `/zones`...) through one `publicWhere()` in `src/common/public.ts`, so
  only APPROVED listings are ever public, and Featured & Verified shows only Community Verified ones. Search by keyword
  and zone, category pages, zone pages and a page per business (with a "View on map" link when the address is public).
  Every page that shows listings renders with fresh API data on each visit (`dynamic = "force-dynamic"`, `no-store`
  fetches, `experimental.staleTimes` of 0 for dynamic and 30 seconds for static pages), with a loading skeleton
  (`app/loading.tsx`) and a retry page (`app/error.tsx`). Mobile pass done 2026-09-25: Call, WhatsApp and Map buttons
  under the business name on phones, utility links moved into the phone menu, larger tap targets, no page wider
  than a 360px screen.
- **M2 (submission flow, Phase 4)**: LIVE. `/submit` form and `POST /businesses/submit` with postcode check, WhatsApp,
  areas served, all six consent checkboxes and the exact confirmation message. Photos are compressed without quality
  loss and stored in bucket `bsd-uploads` on the restaurant platform's shared MinIO, served at `bsd.wales/uploads/...`.
- **M3 (admin panel)**: LIVE at `/admin`. Roles: VOLUNTEER (verification queue), MODERATOR (listings, claims, messages),
  ADMIN (audit log, categories), SUPER_ADMIN (team). Short-lived access token in memory plus an httpOnly SameSite=Strict
  refresh cookie, lockout after 5 failed logins, forced change of one-time passwords, every action in the audit log.
  Categories are edited in the admin panel and the website reads them from the API (refreshed within a minute), with
  `bsd-web/lib/content.ts` only as a fallback. The seed writes categories only into an empty database (or with
  `SEED_TAXONOMY=reset`). Zones and localities are still static. Set or reset an admin password on the server with
  `printf '%s' 'password' | docker exec -i bsd-api node dist/cli/set-admin-password.js email`.
- **M4 (content pages)**: LIVE and checked against the client docs on 2026-09-25. About, FAQ (all 18 questions), Legal
  Disclaimer, Privacy Policy and Contact follow the docs' wording and structure (lists kept as lists, the docs' links
  included). The only differences are the CLIENT-REVIEW items in Section 7. `/branding` is a "coming soon" shell
  because no brand guide was supplied.
- **M6 (requests, backups, monitoring)**: LIVE. Business pages have Claim This Listing, Request an update and Request
  removal (emergency flag, 24-hour target); admin queues under "Update & removal" and "Claims", emergencies first.
  Claims take a written description of proof, not uploads (the photo bucket is public). `/health/ready` checks the
  database and photo storage. Approved business pages are in the sitemap. Nightly backups (database + bsd-uploads,
  03:15, kept 14 days) run from `/etc/cron.d/bsd-backup`; they sit on the same server, so copy /root/backups/bsd off it
  from time to time.

**Remaining**:
- **M7 print export**: listings exported for the printed guide, grouped by zone then category.
- **M5 mobile app**.
- **Not built from the v1 Website Structure doc**: filters on category pages (Location, Service type, Availability),
  category descriptions (no copy supplied), a News & Updates page (marked optional), and the Branding guide (no content
  supplied). Future premium pages stay hidden, as the doc says.
- **Client review**: the items in Section 7, including the Contact page's Social Media links, which the doc says will
  be supplied later.
- **Ops**: add an external uptime monitor (for example UptimeRobot) on `https://api.bsd.wales/health/ready` and
  `https://bsd.wales/`. There is no CI job yet, so tests run by hand before each merge (`npm test` in `bsd-api`, and
  `npx tsc --noEmit` plus `next build` in `bsd-web`).

**SEO/perf choices made along the way**: every page is fully static (SSG) —
`output: "standalone"` in `next.config.ts`, per-page `metadata`/canonical/OpenGraph,
Organization + FAQPage JSON-LD, `sitemap.ts`/`robots.ts`. Category icons are
`lucide-react` components (not emoji), and the favicon/apple-icon are generated at
build time via `next/og` (`app/icon.tsx`, `app/apple-icon.tsx`) rather than a static
asset. Marketing copy was deliberately written to avoid em-dash/colon-heavy "AI-sounding"
phrasing wherever it wasn't a verbatim client quote (client's own dashes/wording were
left untouched).

---

## 1. Confirmed Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Website (public) | Next.js + TypeScript + Tailwind | SSR/SSG for SEO on listing/category pages |
| Admin panel | Same Next.js app, protected `/admin` routes | No need for a separate project |
| Backend API | Fastify + TypeScript, organized as NestJS-style feature modules (routes/service/schema per domain) rather than a flat routes/services split | Standalone service, shared by website, admin, and mobile app — module-per-domain scales better than flat folders across many AI-assisted milestone edits, without pulling in Nest's full DI/decorator framework |
| Database | PostgreSQL 16 | Relational fit, strong full-text search |
| ORM | Prisma with real migrations (`prisma migrate`) | Type-safe, migration-friendly, works well with AI-assisted edits |
| Testing | Vitest (unit) + Fastify's built-in `.inject()` (integration/API tests) against a real Postgres test database | Catches regressions between AI-assisted milestone edits — especially the public/approved-only leak risk on listing endpoints |
| Mobile app | React Native + TypeScript | Shares types/patterns with the web stack, hits the same API |
| Hosting | One shared VPS running Docker compose. Containers `bsd-web`, `bsd-api` and `bsd-postgres` sit behind a shared Caddy that terminates TLS. BSD's Caddy site file is `/opt/caddy-sites.d/bsd.caddy`, pulled in by the shared Caddyfile through an `import` line. | Website and API are independent containers, so one can restart without killing the other. The shared Caddy is owned by another project, so BSD never edits its Caddyfile. |
| CI/CD | GitHub Actions on push to `main`, SSH with a restricted deploy key that can only run `/opt/bsd/deploy.sh` | No shell access from CI, and `deploy.sh` also restores `bsd.caddy` on every deploy |
| Auth (admin only) | JWT (short-lived access + refresh token), bcrypt password hashing | Public site needs no user accounts — only admins log in |

**One monorepo** (`github.com/Kanto065/BSD`) with these folders:
1. `bsd-web/` is the Next.js public site + admin panel
2. `bsd-api/` is the Fastify backend, Prisma, Postgres
3. `bsd-mobile/` is the React Native app, added at M5 (not created yet)
4. `deploy/` holds `bsd.caddy` (Caddy site blocks) and `vps-deploy.sh` (reference copy of `/opt/bsd/deploy.sh`)

The website and mobile app are both just clients of `bsd-api`. Neither talks to the database directly.

---

## 2. Data Model (Prisma schema, v2)

This maps every field in the Submission Form, Category Structure, Contact Page and v2 docs
(Regional Coverage Factsheet, Homepage Full Body Section, Free Access Policy).

```prisma
// schema.prisma

enum ListingStatus {          // moderation state, set by admins
  PENDING
  APPROVED
  REJECTED
  REMOVED
}

enum VerificationStatus {     // community verification state, separate from moderation
  NEWLY_LISTED                // blue badge "Newly Listed"
  PENDING_VERIFICATION        // yellow badge "Verification Pending"
  COMMUNITY_VERIFIED          // green badge "Community Verified"
}

enum AdminRole {
  SUPER_ADMIN
  ADMIN
  MODERATOR
  VOLUNTEER                   // can change verification status only
}

enum ContactType {            // the 4 v2 mailboxes
  SUPPORT                     // support@bsd.wales (general, listing help, urgent corrections)
  COMPLIANCE                  // compliance@bsd.wales (privacy / GDPR)
  COMMUNITY                   // community@bsd.wales (outreach, volunteers, feedback)
  ADMIN                       // admin@bsd.wales (partnerships, governance)
}

enum ClaimStatus {
  PENDING
  APPROVED
  REJECTED
}

model AdminUser {
  id           String    @id @default(cuid())
  name         String
  email        String    @unique
  passwordHash String
  role         AdminRole @default(MODERATOR)
  createdAt    DateTime  @default(now())
  reviewedListings Business[] @relation("ReviewedBy")
  verifiedListings Business[] @relation("VerifiedBy")
  claimReviews ListingClaimRequest[] @relation("ClaimReviewedBy")
  auditLogs    AuditLog[]
}

model Category {
  id          String   @id @default(cuid())
  name        String   @unique          // e.g. "Groceries & Halal"
  slug        String   @unique
  description String?
  icon        String?
  sortOrder   Int      @default(0)
  requiresOwnerName Boolean @default(false) // true only for "Independent Professionals" — drives Business.ownerName validation instead of matching on category name in code
  subcategories Subcategory[]
  businesses  Business[]
}

model Subcategory {
  id         String     @id @default(cuid())
  name       String                       // e.g. "Halal Meat Shops"
  slug       String     @unique
  categoryId String
  category   Category   @relation(fields: [categoryId], references: [id])
  businesses Business[]
  @@unique([categoryId, name])
}

// Replaces the flat CoverageArea list. 3 zones covering SA1 to SA34 (Regional Coverage Factsheet).
model CoverageZone {
  id                String   @id @default(cuid())
  name              String   @unique        // "Greater Swansea & Gower"
  slug              String   @unique        // "zone-1", "zone-2", "zone-3"
  postcodeDistricts String[]                // ["SA1", "SA2", ...] outward codes that belong to this zone
  sortOrder         Int      @default(0)
  localities        Locality[]
  businesses        Business[]
  servedBy          BusinessServedZone[]
}

model Locality {
  id         String       @id @default(cuid())
  name       String                          // e.g. "Mumbles"
  slug       String       @unique
  zoneId     String
  zone       CoverageZone @relation(fields: [zoneId], references: [id])
  businesses BusinessLocality[]
  @@unique([zoneId, name])
}

model Business {
  id                String        @id @default(cuid())
  slug              String        @unique
  name              String                          // Q1: Business/Service Name
  categoryId        String
  category          Category      @relation(fields: [categoryId], references: [id])
  subcategoryId     String?                         // Q2: subcategory within the chosen category
  subcategory       Subcategory?  @relation(fields: [subcategoryId], references: [id])
  description       String                          // Q3: 50-150 word description
  servicesOffered   String[]                        // Q4: bullet points
  ownerName         String?                         // Q5: required when category.requiresOwnerName is true
  phone             String                          // Q6: publicly displayed
  whatsapp          String?                         // v2: optional WhatsApp number (Free Access Policy promises Telephone & WhatsApp)
  email             String?                         // Q7: publicly displayed
  websiteOrSocial   String?                         // Q8: optional
  address           String?                         // Q9: "HomeBased" if no office
  postcode          String                          // v2: normalised full UK postcode, e.g. "SA1 4PE". Validated to SA1-SA20 and SA31-SA34.
  postcodeDistrict  String                          // outward code, e.g. "SA1". Indexed. This is what public pages show for HomeBased listings.
  zoneId            String                          // derived from postcode, never typed by the submitter
  zone              CoverageZone  @relation(fields: [zoneId], references: [id])
  servedZones       BusinessServedZone[]            // "Areas you serve": zone checkboxes
  localities        BusinessLocality[]              // "Areas you serve": locality multi-select
  otherAreaText     String?                         // "Areas you serve": Others free text
  openingHours      String?                         // Q11: optional
  specialNotes      String?                         // Q13: homebased / appointment only / emergency / weekend
  status            ListingStatus @default(PENDING)
  verificationStatus VerificationStatus @default(NEWLY_LISTED)
  verifiedAt        DateTime?                       // set when verificationStatus becomes COMMUNITY_VERIFIED
  verifiedById      String?                         // cleared if the listing is downgraded
  verifiedBy        AdminUser?    @relation("VerifiedBy", fields: [verifiedById], references: [id])

  // Section 5 & 6 consent — store all four + two GDPR checkboxes explicitly for audit purposes
  consentAccurateInfo     Boolean @default(false)
  consentPublishPermission Boolean @default(false)
  consentNoLiability      Boolean @default(false)
  consentDataStorage      Boolean @default(false)
  gdprConsentStorage      Boolean @default(false)
  gdprConsentRights       Boolean @default(false)

  submittedAt       DateTime      @default(now())
  reviewedAt        DateTime?
  reviewedById      String?
  reviewedBy        AdminUser?    @relation("ReviewedBy", fields: [reviewedById], references: [id])
  rejectionReason   String?

  photos            BusinessPhoto[]
  updateRequests    ListingUpdateRequest[]
  removalRequests   ListingRemovalRequest[]
  claimRequests     ListingClaimRequest[]

  @@index([status, verificationStatus])
  @@index([zoneId])
  @@index([postcodeDistrict])
  @@index([categoryId])
}

model BusinessLocality {          // replaces BusinessCoverageArea
  businessId     String
  business       Business     @relation(fields: [businessId], references: [id])
  localityId     String
  locality       Locality     @relation(fields: [localityId], references: [id])
  @@id([businessId, localityId])
}

model BusinessServedZone {        // the "Areas you serve" zone checkboxes on the submission form
  businessId String
  business   Business     @relation(fields: [businessId], references: [id])
  zoneId     String
  zone       CoverageZone @relation(fields: [zoneId], references: [id])
  @@id([businessId, zoneId])
}

model BusinessPhoto {
  id         String   @id @default(cuid())
  businessId String
  business   Business @relation(fields: [businessId], references: [id])
  url        String
  mimeType   String                          // validated server-side against an allowlist (image/jpeg, image/png, image/webp) at upload time
  sizeBytes  Int                             // validated against a max (e.g. 5MB) at upload time
  isLogo     Boolean  @default(false)
  uploadedAt DateTime @default(now())
}

// FAQ #8: "Request Listing Update" — processed 3-7 working days
model ListingUpdateRequest {
  id               String   @id @default(cuid())
  businessId       String
  business         Business @relation(fields: [businessId], references: [id])
  requestedChanges Json     // free-form: field -> new value
  status           String   @default("PENDING") // PENDING, APPLIED, REJECTED
  requestedAt      DateTime @default(now())
}

// FAQ #9: removal request, 24hr for emergency
model ListingRemovalRequest {
  id          String   @id @default(cuid())
  businessId  String
  business    Business @relation(fields: [businessId], references: [id])
  reason      String?
  isEmergency Boolean  @default(false)
  status      String   @default("PENDING")
  requestedAt DateTime @default(now())
}

// v2: "Claim This Listing" with proof of ownership (Homepage Full Body FAQ Q4)
model ListingClaimRequest {
  id            String      @id @default(cuid())
  businessId    String
  business      Business    @relation(fields: [businessId], references: [id])
  claimantName  String
  claimantEmail String
  claimantPhone String?
  proofText     String
  proofFileUrl  String?                       // optional uploaded proof, same upload validation as photos
  status        ClaimStatus @default(PENDING)
  createdAt     DateTime    @default(now())
  reviewedAt    DateTime?
  reviewedById  String?
  reviewedBy    AdminUser?  @relation("ClaimReviewedBy", fields: [reviewedById], references: [id])
}

// Contact Page: 4 mailboxes (v2 set)
model ContactMessage {
  id        String      @id @default(cuid())
  type      ContactType
  name      String
  email     String
  message   String
  createdAt DateTime    @default(now())
  status    String      @default("OPEN") // OPEN, RESOLVED
}

// Admin accountability — every approve/reject/edit/delete/verify gets logged
model AuditLog {
  id         String    @id @default(cuid())
  adminId    String
  admin      AdminUser @relation(fields: [adminId], references: [id])
  action     String    // e.g. "APPROVE_LISTING", "EDIT_CATEGORY", "SET_VERIFICATION"
  entityType String
  entityId   String
  details    Json?
  createdAt  DateTime  @default(now())
}
```

**Visibility rules.** Every public route returns only `status = APPROVED`. The homepage
"Featured & Verified" section additionally requires `verificationStatus = COMMUNITY_VERIFIED`.
A new submission is `PENDING` plus `NEWLY_LISTED`. Role enforcement for `VOLUNTEER` (verification
status only) lands with the M3 admin routes, with tests.

**Migrations.** Two migrations: `0_init` is a baseline that exactly matches the tables `db push`
created in production, and `1_v2_schema` holds the v2 changes above. The API container runs
`prisma migrate deploy` on boot.

**Postcode helper** (`bsd-api/src/common/postcode.ts`, pure functions): normalise a UK postcode
(trim, uppercase, single space before the last three characters), extract the outward code,
map it to a zone, and reject anything outside SA1 to SA20 and SA31 to SA34. SA21 to SA30 belong
to no zone in the Factsheet, so they are rejected. If the client says otherwise it is a one-line
seed change.

### 20 categories (approved mapping)

Twelve categories stay as they were or are simple renames. Three splits (Professional Services,
Electrician/Plumber/Handyman, Health & Wellbeing) bring the total to 20 and give every v2
homepage tile its own real category. Order 1 to 14 is the v2 homepage tile order, then the rest.
Retired names are Professional Services, Electrician/Plumber/Handyman, Health & Wellbeing,
Grocery & Cash & Carry, Beauty & Henna Services and Community & Religious Services.

| # | Category | Comes from | Subcategories |
|---|---|---|---|
| 1 | Restaurants & Takeaways | Same | Bangladeshi Restaurants, Curry Houses, Bengali/Indian Takeaways |
| 2 | Legal & Financial | New, from Professional Services | Accountants, Legal Support, Immigration Advisors, Mortgage Advisors |
| 3 | Health & Care | Renamed from Health & Wellbeing | Physiotherapists, Mental Wellbeing Support |
| 4 | Trades & Contractors | New, from Electrician/Plumber/Handyman | Handyman Services, Home Maintenance |
| 5 | Groceries & Halal | Renamed from Grocery & Cash & Carry | Asian Grocery, Halal Meat Shops, Bangladeshi Spices & Essentials, Cash & Carry Stores |
| 6 | Taxi & Private Hire | Same | Private Hire Drivers, Taxi Companies, Airport Transfer Services |
| 7 | Beauty & Lifestyle | Renamed from Beauty & Henna Services | Makeup Artists, Henna Artists, Bridal Services, Beauty Consultants |
| 8 | Community & Faith | Renamed from Community & Religious Services | Mosques, Community Groups, Cultural Organisations |
| 9 | Business Consultants | New, from Professional Services | none (needs client input) |
| 10 | Mobile & Tech Repair | Same | Mobile Repair, Laptop Repair, Accessories Shops, Tech Support Services |
| 11 | Clothing & Cultural Shops | Same | Asian Clothing, Saree & Panjabi Stores, Wedding Outfits, Cultural Accessories |
| 12 | Home-Based Food Services | Same | Home Chefs, Catering Services, Tiffin Services, Event Food Supply |
| 13 | Electrician / Plumber | New, from Electrician/Plumber/Handyman | Electricians, Plumbers |
| 14 | Independent Professionals | Same, `requiresOwnerName = true` | Freelance Electricians, Freelance Plumbers, Home-based Beauticians, Home-based Barbers, Freelance Photographers, Event Decorators, Driving Instructors, Immigration Helpers, Translators, Community Advisors, Car Mechanics (home-based), Tailors (home-based), Freelance IT Support, Freelance Tutors, Freelance Designers, Any skilled individual without a physical office |
| 15 | Sweet Shops & Bakeries | Same | Bangladeshi Sweets, Cakes & Bakery Items, Event Sweets & Catering, Sweet Shops & Dessert Places |
| 16 | Car Services | Same | Car Repair, MOT Centres, Car Wash, Tyre Shops |
| 17 | Tutors & Education | Same | Private Tutors, Academic Coaching, Quran/Arabic Teachers, Language Classes |
| 18 | Property & Housing Services | Same | Estate Agents, Letting Services, Housing Support |
| 19 | Fitness & Wellbeing | New, from Health & Wellbeing | Massage Therapists, Fitness Trainers |
| 20 | Others / Miscellaneous | Same | Any service not listed above |

Moved subcategories are Sweet Shops & Dessert Places (from Restaurants & Takeaways to Sweet Shops &
Bakeries) and Mortgage Advisors (from Property & Housing Services to Legal & Financial). Old category
URLs get permanent redirects in `next.config.ts`: `grocery-and-cash-and-carry` to
`groceries-and-halal`, `health-and-wellbeing` to `health-and-care`, `beauty-and-henna-services`
to `beauty-and-lifestyle`, `community-and-religious-services` to `community-and-faith`,
`electrician-plumber-handyman` to `trades-and-contractors`, `professional-services` to
`legal-and-financial`. The submission form dropdown uses this 20-item list, not the 17-item list in
the v1 Submission Form doc.

### 3 zones and 47 localities (Regional Coverage Factsheet)

- **zone-1 Greater Swansea & Gower**, SA1 to SA7. Localities are Swansea City Centre, Uplands,
  Sketty, Brynmill, Saint Thomas, Maritime Quarter, Morriston, Manselton, Hafod, Plasmarl, Winch
  Wen, Enterprise Park, Mumbles, Gower, Killay, Dunvant, Gorseinon, Pontarddulais, Loughor.
- **zone-2 Neath Port Talbot & Swansea Valley**, SA8 to SA13. Localities are Neath Town Centre,
  Briton Ferry, Skewen, Port Talbot, Aberavon, Margam, Pontardawe, Alltwen, Rhos, Trebanos,
  Ystalyfera, Ystradgynlais, Crynant, Seven Sisters.
- **zone-3 Carmarthenshire & West Wales**, SA14 to SA20 and SA31 to SA34. Localities are Llanelli,
  Burry Port, Pembrey, Kidwelly, Ferryside, Ammanford, Cross Hands, Tycroes, Llandeilo,
  Llandovery, Carmarthen Town, Saint Clears, Laugharne, Whitland.

The old 8 towns fold in. Llanelli, Gorseinon, Mumbles, Morriston, Sketty and Uplands are Factsheet
localities as they stand, "Swansea" folds into Swansea City Centre, and "Neath Port Talbot" folds
into Neath Town Centre and Port Talbot.

---

## 3. Milestone Roadmap

| # | Milestone | What it delivers | Depends on |
|---|---|---|---|
| M0 | Foundation | Monorepo scaffolded, Postgres + Prisma schema + seed data, Fastify skeleton with health check, Next.js skeleton, deployed to the shared VPS with Docker compose behind the shared Caddy (site file imported from `/opt/caddy-sites.d`), GitHub Actions deploy | — |
| M1 | Public browsing (API and wiring) | v2 public API (`/categories`, `/businesses/*`, `/zones`, featured), APPROVED-only guard test, `/search`, category, zone and business pages wired to the API with ISR, verification badge component. Runs after the M1.5 shell and Phase 2 schema. | M0, M1.5, Phase 2 schema |
| M1.5 | v2 shell refresh | New logo and brand tokens, utility bar and header, v2 hero and homepage body, 4-column footer, `/community-initiative`, `/free-access`, `/bayconnect`, `/zone-1` to `/zone-3`, `/verification-policy`, `/download-pdf` with the factsheet PDF, `/search` placeholder, shells for `/community-guidelines`, `/complaints`, `/financial-transparency`, redirects, v2 emails, smallest-change legal edits marked CLIENT-REVIEW. Static, no API needed. | M0 |
| M2 | Submission flow | Public Submit Listing page (all v1 form fields and six consent checkboxes) with v2 changes: required Postcode that drives the zone, optional WhatsApp, "Areas you serve" as zone checkboxes plus locality multi-select plus Others. Photo/logo upload, confirmation message, API validation. New listings are `PENDING` plus `NEWLY_LISTED`. | M0, Phase 2 schema |
| M3 | Admin panel | Admin login (JWT), pending listings queue, approve/reject/edit, category management, audit log view, plus the volunteer verification queue (VOLUNTEER can change verification status only) and claim-request review | M0, M2 |
| M4 | Static content pages | About, Coverage Area, Legal Disclaimer, Privacy Policy, Contact, Branding, Footer, News (optional). Community Transparency is retired to `/financial-transparency` by M1.5. | M0 |
| M5 | Mobile app | React Native: browse, search, view listing, submit listing — same API as web | M1, M2 |
| M6 | GDPR + ops hardening | Update, removal and claim ("Claim This Listing") request flows tied to the FAQ SLAs, rate limiting on submission form, backups (database and uploads), sitemap.xml, robots.txt, external uptime monitoring | M2, M3 |
| M7 | Print export | Admin-triggered export (CSV/JSON, grouped by zone, then category) for the print-layout designer to use — not a full PDF generator unless you decide to scope that in | M3 |

Do these roughly in order. M1.5 is static and independent of the API, so it ships first and can go
to `main` on its own. Phase 2 (schema and migrations) must be live in production, after the baseline
in `deploy/v2-migration-runbook.md`, before M1 wiring, M2 or M3 are deployed.

---

## 4. Milestone Prompts

Copy each block as-is into your AI coding tool (Claude Code, Cursor, etc.) when you reach
that milestone. Each one is self-contained — it restates the stack and relevant schema so
you don't need to re-explain context every time.

### M0 — Foundation

```
You are setting up the foundation for a project called BSD (Bangladeshi Business &
Service Directory). One monorepo with these folders:

1. bsd-api: Fastify + TypeScript + Prisma + PostgreSQL. Standalone REST API, no
   server-rendering, no relation to the frontend framework.
2. bsd-web: Next.js (App Router) + TypeScript + Tailwind CSS. Consumes bsd-api over HTTP.
3. bsd-mobile: React Native + TypeScript (set up later, in M5 — skip for now).
4. deploy: the Caddy site file (bsd.caddy) and a reference copy of the VPS deploy script.

Tasks for this milestone:
1. Scaffold bsd-api: Fastify server with TypeScript, Prisma configured against a local
   Postgres instance, a /health endpoint returning { status: "ok" }, environment config
   via .env (DATABASE_URL, JWT_SECRET, PORT), and a NestJS-inspired folder structure
   (plain Fastify underneath — no Nest framework/DI, just the same module-per-domain
   shape, since it holds up better than a flat routes/services split across many
   AI-assisted milestone edits):
   src/modules/<domain>/<domain>.routes.ts    (Fastify route registration — the "controller")
   src/modules/<domain>/<domain>.service.ts   (business logic, Prisma calls)
   src/modules/<domain>/<domain>.schema.ts    (request/response validation, e.g. zod or typebox)
   src/plugins/                                (cross-cutting Fastify plugins: prisma client,
                                                 jwt auth, rate-limit, cors)
   src/common/                                 (shared utils: pagination helpers, error
                                                 handling, the sanitize.ts helper used from M2)
   prisma/                                      (schema.prisma, migrations, seed.ts)
   Domains for now: health, categories, businesses, admin, contact — empty/stub modules
   are fine except health.
2. Add the full Prisma schema for this project [paste the schema from section 2 above].
   Generate real migrations. This project deliberately has no local database, so write the SQL
   with `prisma migrate diff --from-schema-datamodel <old> --to-schema-datamodel <new> --script`
   and test it with PGlite (see bsd-api/test/migrations.test.ts). Do not use `prisma db push`.
3. Write a seed script (prisma/seed.ts) that inserts:
   - The 20 categories with their subcategories, exactly as in the Section 2 table —
     categories go in `Category`, each category's subcategory list goes into `Subcategory`
     rows linked by categoryId. Set `requiresOwnerName = true` only on the "Independent
     Professionals" category.
   - The 3 coverage zones with their postcode districts and the 47 localities listed in
     Section 2 (from the Regional Coverage Factsheet)
   - One SUPER_ADMIN AdminUser for initial login (password from env var, hashed with bcrypt)
   The seed must be idempotent and must not delete anything that has listings attached.
4. Scaffold bsd-web: Next.js App Router project, TypeScript, Tailwind configured, a
   lib/api-client.ts that wraps fetch calls to bsd-api's base URL (from env var), and an
   empty app/ folder ready for pages in M1.
5. Set up the test harness now, not later: Vitest for unit tests, and Fastify's built-in
   `.inject()` for integration tests against the running app instance (no need for a
   separate supertest-style client). Add one smoke test that hits /health. Every later
   milestone adds tests into this same harness — in particular, M1's public endpoints and
   M2's submission validation need integration tests from the start, since the biggest
   risk in this project is a non-APPROVED listing leaking through a public route.
6. Add a `src/common/sanitize.ts` helper (wrapping a library like `sanitize-html`) now,
   even though nothing calls it yet — M2 will apply it to every free-text field on
   submission, before the data ever reaches the database or a public page.
7. Deployment is Docker compose on the shared VPS. Write a Dockerfile for each of bsd-api
   and bsd-web, a docker-compose.yml with `api`, `web` and `postgres` services (postgres
   on an internal-only network, api and web also joined to the shared `platform_internal`
   network), and a `deploy/bsd.caddy` site file (bsd.wales and www.bsd.wales to the web
   container, api.bsd.wales to the API container). The shared Caddy imports
   `/opt/caddy-sites.d/*.caddy`, so BSD's file goes in that folder. NEVER edit the shared
   Caddyfile at /opt/platform/deploy/caddy/Caddyfile: it belongs to another project's repo
   and is reset on each of that project's deploys. Add a GitHub Actions workflow that on
   push to main SSHes to the VPS with a restricted deploy key whose forced command runs
   /opt/bsd/deploy.sh (git pull, docker compose build api web, docker compose up -d, then
   restore bsd.caddy and reload Caddy if it changed).

Do not build any business logic yet — this milestone is only the skeleton, schema,
seed data, test harness, and deploy plumbing. Confirm the /health endpoint responds,
its smoke test passes, and the seed script runs cleanly before considering this done.
```

### M1 — Public Browsing

```
Building on the existing bsd-api (Fastify + Prisma + Postgres) and bsd-web (Next.js +
TypeScript + Tailwind). The v2 schema and seed are already in place (Category, Subcategory,
CoverageZone, Locality, Business with postcode/zone/verificationStatus, BusinessPhoto), and the
static v2 shell from M1.5 already exists. This milestone replaces the static content with real data.

API endpoints (bsd-api):
- GET /categories: all categories with their subcategories, sorted by sortOrder
- GET /categories/:slug: category detail + paginated list of public businesses in that
  category, optional query params: ?subcategory=&zone=&locality=&q=
- GET /businesses/featured: public businesses that are COMMUNITY_VERIFIED, for the homepage
  "Featured & Verified" section
- GET /businesses/search?q=&category=&subcategory=&zone=&locality=: case-insensitive search across
  name, description, servicesOffered, category name and subcategory name
- GET /businesses/:slug: single business detail. Register this AFTER /businesses/search and
  /businesses/featured so those literal paths are not captured as slugs.
- GET /zones and GET /zones/:slug: the 3 zones with postcode districts and localities, and a
  zone's paginated public businesses

Include `verificationStatus` in every business response. Route everything through ONE shared
`publicWhere()` query builder (always `status = APPROVED`) and ONE explicit public `select` (no consent
fields, rejectionReason, reviewedById, verifiedById). Public routes must never return pending,
rejected or removed listings. For HomeBased listings return only postcodeDistrict and locality,
never the full postcode.

Write an integration test now (Vitest + `.inject()` against a real Postgres test database that
runs the migrations): seed one business for every ListingStatus x VerificationStatus combination
(12), assert that only the APPROVED ones are ever returned by any of these endpoints, and that
/businesses/featured returns only APPROVED + COMMUNITY_VERIFIED. Keep this test running as a guard
for every later milestone that touches these routes.

Website (bsd-web, App Router):
- /search reads `q`, `zone` and optional category from the query string and calls the API.
- /categories/[slug], /zone-1 to /zone-3 and the homepage "Featured & Verified" section list real
  businesses. /businesses/[slug] shows name, category, postcode district and locality, phone,
  WhatsApp, opening hours, services, photos, map placeholder, contact buttons (tel:, mailto:), the
  verification badge, this exact disclaimer "Information provided by business owner.", and a
  "Claim This Listing" mailto link to support@bsd.wales until M6 replaces it with the real flow.
- A `VerificationBadge` component with the 3 states: green "Community Verified", yellow
  "Verification Pending", blue "Newly Listed". Use icon plus text, not colour alone.
- Do NOT call the API at build time. On the VPS the web image is built before the new API is up.
  Pages render on demand with `revalidate` and show a graceful empty state if the API is
  unreachable. Search must not log queries (the Free Access Policy promises no tracking of search
  activity) and there is no third-party analytics.
```

### M1.5 v2 Shell Refresh

```
Building on bsd-web. Static only, no API calls. Apply the v2 client docs. Where a v1 doc and a v2
doc disagree, v2 wins. Copy client text verbatim, and write no em dashes or "--" in any new copy.

Foundations:
- Brand: copy the logo (WhatsApp Image 2026-09-14 at 10.56.07 PM.jpeg) to bsd-web/public/brand/
  (cropped tightly) and use it in the header and footer with next/image. Sample the exact navy,
  blue, teal and red from the image for Tailwind theme tokens, plus a darker teal for small text on
  white (brand teal fails AA contrast). Montserrat for headings through next/font/google, Inter for
  body. The v1 orange accent is dropped. Update app/icon.tsx and app/apple-icon.tsx to the new tokens.

Shell:
- Top utility bar: Free Access Policy (/free-access) | Community Initiative (/community-initiative)
  | Powered by BayConnect (/bayconnect).
- Header nav: Home | Directory (/categories) | Coverage Area | About Us | FAQ | Contact, primary CTA
  "+ Submit Listing" (/submit), and a mobile menu.
- Footer per "Website Footer Structural Layout": pre-footer CTA banner ("Grow Your Business Across South
  West Wales" with "+ Add Your Business Free" to /submit and "Download Print Guide (PDF)" to
  /download-pdf), 4 columns with the exact links, contact bar (support@, compliance@, community@ and the
  BayConnect operations line), and bottom bar "Powered by BayConnect | Creative Partner: <name>", where the name and link come from `CREATIVE_PARTNER` in `lib/content.ts`.
  Add a small "Legal Disclaimer" link in the bottom bar and log it as a CLIENT-REVIEW deviation.

Homepage in the Full Body doc's order: hero exactly per "Exact Copy & Field Specifications" (pill
badge, H1, sub-headline, search bar with keyword + zone dropdown + "Search Directory" submitting to
/search?q=&zone=, buttons "Browse Directory" outline blue and "+ Add Business Free" green, 4 trust
tags); Popular Categories (14 tiles in the client's order, "View All 20+ Categories"); Explore by
Regional Zones (3 cards to /zone-1 to /zone-3, no listing counts); Featured & Verified (empty state);
Business Owner section (3 cards + CTA); How It Works (both tracks, with the links the doc gives); a
4-question FAQ accordion with the exact answers.

Pages: /community-initiative, /free-access, /bayconnect (verbatim, with the given page titles as
absolute titles); /zone-1 to /zone-3 (zone name, postcode districts, localities, empty listing grid);
/verification-policy (Factsheet 3-tier section + badge table); /download-pdf (coming-soon page with a
"Download Coverage Factsheet (PDF)" button, PDF generated once from the Factsheet content and put in
public/); /search (works against the static category and subcategory list plus the zone filter, honest
empty state for listings); shells with short neutral placeholders for /community-guidelines,
/complaints and /financial-transparency.

Redirects (permanent, next.config): /transparency to /financial-transparency, /coverage to
/coverage-area, and the six old category slugs listed in Section 2.

Updates: /contact to the 4 v2 mailboxes (support@ covers general, listing help and urgent corrections,
compliance@, community@, admin@), /submit interim mailto to support@, /about, /faq and /coverage-area
to v2 coverage wording, sitemap.ts, metadata, and the Organization JSON-LD (contact points use the new
emails, areaServed is the 3 zones). Apply the legal wording changes in Section 7 and wrap each one with a
CLIENT-REVIEW comment. Do not rewrite any other legal text.

Verify: `npx tsc --noEmit` and `next build` pass, rendered pages match the extracted client text, no old
emails (info@, partnership@, urgent@, privacy@) or orange accent remain, and desktop and phone widths look right.
```

### M2 — Submission Flow

```
Building on bsd-api and bsd-web. Add the public submission flow, matching the BSD
Submission Form document exactly — every field and every consent checkbox listed
below must be present, none renamed or dropped. v2 changes are called out inline.

API endpoint (bsd-api):
- POST /businesses/submit — accepts multipart/form-data (for photo/logo upload).
  Validates and creates a Business record with status = PENDING and verificationStatus =
  NEWLY_LISTED. Required fields: name, categoryId, description (50-150 words — validate word
  count), servicesOffered (array), phone, postcode, and at least one of serveZoneIds, localityIds or
  otherAreaText (this keeps the v1 "areas + Others" rule). The postcode is validated with the
  postcode helper (SA1 to SA20 and SA31 to SA34 only) and the Business zone is derived from it,
  never taken from the client.
  Optional: whatsapp, subcategoryId (must belong to the chosen categoryId if present), ownerName
  (required when the chosen Category has requiresOwnerName = true — look this up from
  the Category row, do not match on category name/string in code), email,
  websiteOrSocial, address (default to "HomeBased" if blank and no office), openingHours,
  specialNotes.
  Photo/logo upload is optional but recommended — validate before storing: allowlist
  mimetypes (image/jpeg, image/png, image/webp), sniff the file's magic bytes because the request
  mimetype is client-controlled, and a max size (e.g. 5MB per file); reject anything else with a
  400. Store on a persistent volume (or S3-compatible storage), save URL + mimeType + sizeBytes to
  BusinessPhoto.
  Sanitize every free-text field (description, servicesOffered entries, ownerName,
  address, openingHours, specialNotes, otherAreaText) through the `src/common/sanitize.ts`
  helper from M0 before it touches the database — these fields render back on public
  listing pages, so this must happen at write time here, not deferred to a later
  hardening pass.
  All six consent booleans (consentAccurateInfo, consentPublishPermission,
  consentNoLiability, consentDataStorage, gdprConsentStorage, gdprConsentRights) are
  REQUIRED to be true — reject the submission with a 400 if any is false or missing.
  Rate-limit this endpoint (e.g. 5 requests per IP per hour) to prevent spam, and add a
  honeypot field.
  Add integration tests (Vitest + `.inject()`) covering: word-count rejection, missing
  consent rejection, missing areas-served rejection, postcode outside SA1 to SA34 rejection,
  zone derived from postcode, oversized/wrong-mimetype/spoofed-magic-bytes file rejection, and a
  script-tag payload in a free-text field coming back sanitized in the stored record.

Website page (bsd-web):
- /submit — a multi-section form matching the doc's structure exactly:
  Section 1: Business/Service Information (name, category dropdown with all 20
  categories, a dependent subcategory dropdown that populates from the chosen
  category's subcategories, short description with a live word counter enforcing
  50-150 words, services offered as a repeatable bullet-point input)
  Section 2: Contact Details (owner/provider name — mark as required when the selected
  category is flagged requiresOwnerName, phone, WhatsApp number (optional), email,
  website/social — all as specified, phone and email marked "will be publicly displayed")
  Section 3: Location Details (address with helper text "if no office, write
  HomeBased", a required Postcode field that shows the derived zone, and "Areas you serve" as
  zone checkboxes plus a locality multi-select grouped by zone plus "Others (Specify)" which
  reveals a free-text input bound to otherAreaText)
  Section 4: Additional Information (opening hours, photo/logo upload with client-side
  preview and the same mimetype/size limits as the API — reject before upload starts so
  the user gets instant feedback, special notes free text)
  Section 5: Terms & Conditions — 4 separate checkboxes with this exact wording:
  "I confirm that all information provided is accurate and given voluntarily.",
  "I give permission to publish this information on BSD (print + digital).",
  "I understand that BSD is not responsible for any business transactions or
  disputes.", "I agree that my data will be stored securely and used only for
  directory purposes."
  Section 6: Privacy & GDPR Consent — 2 more checkboxes: "I consent to BSD storing
  my submitted information for directory publication.", "I understand that I may
  request correction or removal of my listing at any time."
  Submit button labeled "Submit My Listing". On success, show this exact confirmation
  message: "Thank you! Your listing has been submitted for review. BSD Team will verify
  and publish it within 3–7 days."

Client-side validation should mirror the server-side rules (word count, required
consent checkboxes) but the server must re-validate everything — never trust the client.
```

### M3 — Admin Panel

```
Building on bsd-api and bsd-web. Add an authenticated admin panel under /admin on the
same Next.js app, backed by new endpoints on bsd-api.

API endpoints (bsd-api):
- POST /admin/login — email + password, verify against AdminUser.passwordHash (bcrypt),
  return a short-lived JWT access token + a refresh token (httpOnly cookie).
- POST /admin/refresh — exchange refresh token for a new access token.
- Auth middleware/plugin: verifies JWT on all /admin/* routes below, attaches
  req.adminUser, rejects with 401 if missing/invalid/expired.
- GET /admin/listings?status=PENDING — paginated list of businesses by status.
- PATCH /admin/listings/:id/approve — sets status = APPROVED, reviewedAt, reviewedById.
  Writes an AuditLog entry.
- PATCH /admin/listings/:id/reject — sets status = REJECTED, requires rejectionReason
  in body, writes AuditLog entry.
- PATCH /admin/listings/:id — general edit (any field), writes AuditLog entry with a
  diff of what changed.
- DELETE /admin/listings/:id — sets status = REMOVED (soft delete, never hard-delete
  a listing), writes AuditLog entry.
- PATCH /admin/listings/:id/verification: sets verificationStatus (NEWLY_LISTED,
  PENDING_VERIFICATION, COMMUNITY_VERIFIED). Setting COMMUNITY_VERIFIED records verifiedAt and
  verifiedById, and downgrading clears both. Writes an AuditLog entry. Allowed for VOLUNTEER,
  MODERATOR, ADMIN and SUPER_ADMIN.
- GET /admin/verification-queue: approved listings that are NEWLY_LISTED or
  PENDING_VERIFICATION, oldest first, for the volunteer audit step in the Regional Coverage
  Factsheet's 3-tier flow.
- GET /admin/claims and PATCH /admin/claims/:id/approve|reject: review ListingClaimRequest
  records with the claimant's proof. Writes an AuditLog entry.
- CRUD endpoints for /admin/categories (SUPER_ADMIN and ADMIN roles only — MODERATOR
  can view but not edit categories), including managing each category's
  requiresOwnerName flag and its Subcategory rows (add/rename/remove).
- GET /admin/audit-log — paginated, filterable by admin/entity/date.
- GET /admin/contact-messages?type=&status= — view submitted contact messages
  (see M4 for where these get created).

Enforce role checks: MODERATOR can approve/reject/edit listings but not manage
categories or admin users. VOLUNTEER can only use the verification and verification-queue
endpoints and nothing else, and a test must prove a VOLUNTEER token is rejected everywhere
else. Only SUPER_ADMIN can create new AdminUser accounts.

Website pages (bsd-web):
- /admin/login — simple login form, stores access token in memory + refresh in
  httpOnly cookie (set by the API response).
- /admin/dashboard — counts: pending listings, approved this week, open contact
  messages, listings awaiting verification, pending claims.
- /admin/listings — table of listings with status filter, search, and row actions
  (approve, reject with reason modal, edit, remove).
- /admin/listings/[id]/edit — full edit form reusing the same field set as the public
  submission form.
- /admin/verification: the volunteer queue with one-click status change.
- /admin/claims: claim requests with proof and approve/reject.
- /admin/categories — manage the 20 categories, their subcategories, and each
  category's requiresOwnerName flag.
- /admin/audit-log — read-only table.
- /admin/messages — view and mark contact messages resolved.

Protect all /admin/* routes client-side with a redirect-to-login check, but remember
the real security boundary is the API's JWT verification, not the frontend route guard.
```

### M4 — Static Content Pages

The pages below were built against the v1 docs. The v2 shell refresh (M1.5) supersedes parts of
them. `/transparency` is retired to a placeholder `/financial-transparency`, `/contact` moves to the
v2 mailboxes (support@, compliance@, community@, admin@) and no longer has a separate partnership or
urgent mailbox, the footer is replaced by the v2 4-column footer, and `/about`, `/faq` and
`/coverage-area` use v2 coverage wording. The Legal Disclaimer and Privacy Policy stay verbatim
except for the CLIENT-REVIEW edits in Section 7.

```
Building on bsd-web. Add the static/content pages from the Website Structure doc.
These are mostly content-driven, not data-driven — hardcode the copy from the client's
documents (do not paraphrase or shorten it) and keep them as simple Next.js pages,
though contact form submission does hit the API.

Pages:
1. /about — full introduction, purpose, vision, community initiative section (free
   until 30 June 2027, no fees/sponsorship/ads/premium charges during that period),
   Independent Professionals inclusion note, coverage area list, "Powered By
   BayConnect" section, and the one-paragraph summary — all copied verbatim from the
   About the Directory Page doc.
2. /coverage-area — map placeholder + the 8-area list + future expansion note.
3. /transparency — full Community Transparency statement: free period, no sponsorship,
   no ads, no listing fee, future premium plan note. Link to /legal.
4. /legal — full Legal Disclaimer doc content, all 10 numbered sections verbatim
   (Information Accuracy, No Endorsement, No Liability, Independent Professionals,
   Intellectual Property, Data & Privacy, Free Community Initiative, Right to Modify
   or Remove Listings, External Links, Acceptance of Terms).
5. /privacy — full Privacy Policy doc content, all 13 numbered sections verbatim
   including the GDPR rights list and the children's privacy clause (under-16).
6. /branding — placeholder page for BSD branding guide (logo usage, colors,
   typography) — content marked "future," so build the page shell with a
   "Coming soon" state for the downloadable assets section.
7. /contact — build a form that POSTs to a new API endpoint:
   POST /contact — body: { type: SUPPORT | COMPLIANCE | COMMUNITY | ADMIN, name,
   email, message }, creates a ContactMessage record. On the page, present the four
   contact purposes as separate sections/tabs: Support (support@bsd.wales, general
   enquiries, listing help and urgent corrections, 3-5 working days and 24 hours for
   urgent corrections), Compliance and Privacy (compliance@bsd.wales), Community
   Outreach and Feedback (community@bsd.wales), Partnerships and Governance
   (admin@bsd.wales).
   Also display operating hours (Mon-Fri 10-6, Sat 11-4, Sun closed) and placeholders
   for social media links.
8. Footer component (used site-wide): see M1.5, the v2 4-column footer replaces the v1 footer.
9. Optional: /news — simple list page for directory updates/announcements, can be a
   flat array of posts for now with no CMS.

Keep all legal/privacy/disclaimer text exact — this content was written for compliance
purposes, so no rewording beyond the logged CLIENT-REVIEW edits.
```

### M5 — Mobile App

```
New folder in the monorepo: bsd-mobile, React Native + TypeScript. Hits the same bsd-api used by the
website — no separate backend.

Scope for this milestone (matches the public website's core flows, not the admin panel):
1. Home screen — category grid (fetch from GET /categories), search bar, zone filter.
2. Category screen — business list for a category (GET /categories/:slug), with
   zone/locality filters.
3. Business detail screen — full listing info, verification badge, tap-to-call (phone),
   tap-to-email, map link if address is available, and the same disclaimer: "Information provided
   by business owner."
4. Search screen — hits GET /businesses/search.
5. Submit Listing screen — same form as the website's /submit page, same fields,
   same six required consent checkboxes worded identically, submits to the same
   POST /businesses/submit endpoint (multipart form data for photo upload — use
   react-native-image-picker or expo-image-picker depending on whether this is a
   bare RN or Expo project).
6. Basic navigation (React Navigation): bottom tabs for Home, Categories, Search,
   Submit.

No admin functionality in the mobile app. No user accounts/login for regular users —
this mirrors the website, which also has no public user accounts, only admin login.
Share TypeScript types for the API response shapes with bsd-web if convenient (e.g. a
small shared types package), but don't force a restructure if it adds overhead —
duplicating a types file is fine for this project's size.
```

### M6 — GDPR & Ops Hardening

```
Building on bsd-api and bsd-web. This milestone closes the compliance and reliability
gaps implied by the FAQ, Legal Disclaimer, and Privacy Policy docs.

API endpoints (bsd-api):
- POST /businesses/:id/request-update — public endpoint, business owner submits
  requestedChanges (JSON), creates a ListingUpdateRequest with status PENDING. Surface
  these in the admin panel (M3) for review — admin applies or rejects. Target SLA per
  FAQ: 3-7 working days (informational, not enforced in code, but visible in the
  admin queue with a "days pending" indicator so nothing silently ages past that).
- POST /businesses/:id/request-removal — public endpoint, body includes reason and
  isEmergency boolean. If isEmergency = true, surface it at the top of the admin
  queue with a visual flag (24-hour SLA per FAQ and Privacy Policy section 8).
- POST /businesses/:id/claim: public endpoint for "Claim This Listing" (Homepage Full Body
  FAQ Q4). Body has claimant name, email, optional phone, proofText and an optional proof
  file (same upload validation as photos). Creates a ListingClaimRequest with status PENDING,
  reviewed in the M3 admin claims queue.
- Rate limiting: apply to /businesses/submit, /businesses/:id/request-update,
  /businesses/:id/request-removal, /businesses/:id/claim, and /contact — use
  @fastify/rate-limit, a reasonable default (e.g. 10 requests/hour/IP), tighter on submit.
- Free-text sanitization on submit was already added in M2 (src/common/sanitize.ts) —
  in this milestone, confirm request-update's requestedChanges JSON and the claim proofText
  are sanitized through the same helper before being applied or stored, and add
  output-encoding on the frontend render path as defense-in-depth (React/Next already
  escapes by default — just confirm nothing bypasses it with dangerouslySetInnerHTML).

Website:
- /businesses/[slug]: replace the interim "Claim This Listing" mailto with a real button and form
  that hits the claim endpoint, and add "Request an update" and "Request removal" links/forms that
  hit the two other endpoints above.
- Add app/sitemap.ts (Next.js dynamic sitemap) covering all category, zone and approved
  business pages, and app/robots.ts.

Ops:
- Add a daily pg_dump backup cron on the VPS, retained for at least 14 days, written
  to a separate disk/volume from the live database. Uploaded photos, logos and claim proofs live
  on a persistent Docker volume, so back up that volume on the same schedule and retention
  — a listing's logo is part of its identity and isn't reconstructable from the database
  alone.
- Add external uptime monitoring (for example UptimeRobot) on https://bsd.wales/ and
  https://api.bsd.wales/health, and confirm the `restart: unless-stopped` policy on the bsd
  containers so a crash recovers on its own without a restart loop hammering the VPS.
- Add structured logging (pino, since it pairs natively with Fastify) with request
  IDs, so a failed submission can be traced through the logs. Do not log search queries.

Do not build user-facing accounts or login for the public — only admins authenticate.
Update/removal/claim requests are identified by business ID + contact info, not a login.
```

### M7 — Print Export (optional, scope only if the print deliverable needs live data)

```
Building on bsd-api's admin routes. This does NOT generate the final print-ready
design — that's a design deliverable, not code. This milestone only gives the
designer clean, structured data to work from.

API endpoint (bsd-api):
- GET /admin/export/directory — SUPER_ADMIN/ADMIN only, returns all APPROVED
  businesses grouped by coverage zone, then by category, as JSON. Include a CSV
  variant (?format=csv) with columns matching the Submission Form fields (name,
  category, description, services offered, owner name, phone, WhatsApp, email, address,
  postcode district, zone, localities, opening hours, special notes, verification status).

Admin UI: a single "Export Directory" button on /admin/dashboard that downloads the
CSV. No PDF/InDesign generation in code — hand the CSV/JSON to whoever does the print
layout.
```

---

## 5. Notes for you as the developer overseeing this

- Do M0 once and don't revisit it per milestone — every later prompt assumes the schema
  and repo layout from M0 already exist.
- When you paste a milestone prompt into your AI coding tool, also paste the current
  `schema.prisma` file if it has evolved since M0 (small fields tend to get added along
  the way) — that keeps the AI grounded in what's actually there instead of what this
  doc describes.
- Test each milestone against the actual client documents before moving to the next
  one — e.g. for M2, literally count that all 6 consent checkboxes are present with the
  exact wording, since GDPR wording mismatches are the kind of thing that's easy to
  quietly drift on across AI-generated edits.
- The mobile app (M5) and print export (M7) are the two pieces most likely to be
  renegotiated separately given your earlier pricing conversation — you can hand off
  M0-M4 as "the website" deliverable on its own if that ends up being the scope your
  friend actually agreed to with the client.
- Decisions folded in after review (2026-09-12): subcategories are now a real
  `Subcategory` table/relation instead of a display-only string array, so businesses can
  be filtered/reported on by subcategory; the "Independent Professionals" required-owner
  rule is a `requiresOwnerName` boolean on `Category` instead of matching on the category
  name in code; coverage area has an `otherAreaText` escape hatch for businesses outside
  the seeded areas; upload validation (mimetype allowlist, size cap) and free-text
  sanitization were pulled forward into M2 (submission time) instead of waiting until M6,
  since public pages start rendering user-submitted content as soon as M2 ships; M6's
  backup step now also covers the upload directory, not just the database; and a
  Vitest + Fastify `.inject()` test harness is set up in M0 so the "pending/rejected
  listings must never leak on public routes" invariant has an automated guard from M1
  onward. The bsd-api folder layout uses NestJS-style feature modules (routes/service/
  schema per domain) on plain Fastify — no Nest framework/DI — since that organizes more
  predictably than a flat routes/services split across many AI-assisted milestone edits.
- Never deploy the `v2-refresh` branch to production from a script. `main` auto-deploys, so merging
  is the deploy. Merge M1.5 first because it is static and independent. Do not merge the schema
  and API phases until the production baseline in `deploy/v2-migration-runbook.md` has been done by
  hand, otherwise the API container will crash-loop on `migrate deploy`.
- When a new Claude Code session picks this up, the six decisions in Section 6 are settled. Apply
  them and do not re-ask.

---

## 6. v2 decisions log (2026-09-25)

Settled with the owner. Apply them as written and do not re-ask.

1. **Coverage** is SA1 to SA34 in 3 zones with the names exactly as in the Regional Coverage
   Factsheet: Zone 1 "Greater Swansea & Gower" (SA1 to SA7), Zone 2 "Neath Port Talbot & Swansea
   Valley" (SA8 to SA13), Zone 3 "Carmarthenshire & West Wales" (SA14 to SA20 and SA31 to SA34).
   Every locality in the Factsheet is seeded under its zone, and the old 8 towns become localities.
2. **Verification is real.** Three badge states: "Community Verified" (green), "Verification
   Pending" (yellow), "Newly Listed" (blue), following the Full Body doc and the Factsheet's 3-tier
   flow. Homepage "Featured & Verified" shows only Community Verified listings.
3. **Emails are the v2 set only.** support@bsd.wales (general, listing help, urgent corrections),
   compliance@bsd.wales (privacy and GDPR), community@bsd.wales (outreach, volunteers, feedback),
   admin@bsd.wales (partnerships, governance). info@, partnership@, urgent@ and privacy@ are
   replaced everywhere.
4. **The website stays 100% free with no ads.** Print edition sponsorship is allowed (Factsheet).
5. **Where v1 legal or transparency copy contradicts v2**, make the smallest possible wording change
   to be consistent with v2, wrap each changed sentence with a `// CLIENT-REVIEW` comment in code,
   list every one in Section 7, and do not rewrite any other legal text.
6. **Brand.** Use the logo image, sample the exact navy, blue, teal and red from it for the Tailwind
   theme tokens, and use Montserrat for headings. The v1 orange accent is dropped.

Also settled in the Phase 0 review. The category set is the 20-item mapping in Section 2 (approved
2026-09-25).

---

## 7. CLIENT-REVIEW items

Send these to the client. Each code change is also marked with a `// CLIENT-REVIEW` comment.

### 7a. Legal and transparency wording changes (smallest possible edits)

| # | Where | Before | After |
|---|---|---|---|
| L1 | FAQ "Does BSD verify businesses?" | "No. BSD does not verify or guarantee the accuracy of any business information. All listings are voluntarily submitted by business owners or service providers." | "Community Verified confirms contact and operating details only; it is not an endorsement or guarantee of service quality. BSD does not otherwise verify or guarantee the accuracy of business information. All listings are voluntarily submitted by business owners or service providers." |
| L2 | Legal Disclaimer section 4 | "...does not imply verification, endorsement, or professional accreditation." | "...does not imply endorsement or professional accreditation. Any Community Verified badge confirms contact and operating details only." |
| L3 | "No sponsorships" wording in the FAQ "Is BSD free?" answer, About section 4, Legal section 7, Privacy section 11, the Contact page notes, and the Contact partnership blurb | "no sponsorships", "sponsorship or advertisement is accepted", "does not accept sponsorships or advertisements" | One word inserted each time: "no website sponsorships", "website sponsorship or advertisement is accepted", "does not accept website sponsorships or advertisements". This keeps the site consistent with print sponsorship being allowed. |
| L4 | Privacy Policy section 13 | "email privacy@bsd.wales" | "email compliance@bsd.wales" |
| L5 | Homepage Full Body FAQ Q2 (client v2 copy) | "Zone 3 (Carmarthenshire & Llanelli)" | "Zone 3 (Carmarthenshire & West Wales)" |
| L6 | Old homepage short Legal Disclaimer ("BSD does not verify or guarantee the accuracy...") | Shown on the homepage | Removed, because the v2 homepage has no such section. The full `/legal` page is unchanged apart from L2 and L3. |

### 7b. Client copy left as written that pulls against the decisions (please review)

- "Hand-verified for operational quality & accuracy" (Featured & Verified subtitle) and "Find Verified
  Services Across South West Wales" (Popular Categories subtitle) sit close to what the legal text
  disclaims.
- The v1 "until 30 June 2027" free period and the "future premium services, featured listings,
  sponsored categories" language in FAQ Q3 and Q15, About vision, Legal section 7 and Privacy section
  12. Decision 4 says the website stays free with no ads, and the v2 Free Access page says access will
  always be free. These are not small word changes, so they stay verbatim until the client decides.
- The Factsheet text about "verified Bangladeshi-owned businesses".

### 7c. Pages and content with no supplied copy, or that deviate from the docs

- `/community-guidelines`, `/complaints` and `/financial-transparency` are placeholder shells.
- `/verification-policy` badge descriptions are written by us. The badge table in the Full Body doc is
  a Bengali dev note that says "100% accurate", which is not published. Our wording follows decision
  5: Community Verified means contact and operating details were cross-checked by a field volunteer,
  Verification Pending means that check is under way, Newly Listed means recently added and not yet
  audited.
- Zone page intro text, `/search` empty-state text, and the "Business Consultants" category, which has no
  subcategories yet. "Fitness & Wellbeing" is a split we made to reach 20 categories.
- The homepage zone cards omit the listing counts ("120+", "45+", "60+") because there is no data
  behind them.
- The logo was supplied as a JPEG with a pale background and no vector or transparent version.
- The Footer diagram lists "Terms of Service" but the exact link list and copy do not include it, so it
  is not created.
- A small "Legal Disclaimer" link is added to the footer bottom bar, because the v2 footer link list
  has no way to reach `/legal`.
- `/transparency` is retired to a placeholder and its v1 copy no longer appears on the live site.
- The "Creative Partner" credit (footer, `/bayconnect`, Factsheet PDF) shows "Kanta Bhattacharjee", linked to their LinkedIn profile, instead of the client's "CREOVA Studio". This was done at the developer's request and departs from the client's wording in three docs (Footer Structural Layout, Powered by BayConnect Page, Factsheet). Confirm the client accepts it.
- The About page's v1 call to action "Read the Transparency Statement" now reads "Read the Free Access Policy" and points at `/free-access`, because the Transparency page is retired.
- The homepage "View Verified Info" step and the footer "Coverage Area" link go to `/coverage-area` directly. The docs give `/coverage`, which redirects to the same page. The coverage page carries a short verification summary so the step still leads somewhere relevant.
- The Contact page merges the v1 general, listing-help and urgent-correction text under the single support@ mailbox, and adds print sponsorship enquiries (from the Factsheet) to that channel.
- The logo header and footer image is a transparent PNG keyed from the supplied JPEG.
- Typos in supplied copy left as written: "Oversite" on the BayConnect page and the grammar of
  "adhering to UK institutional standards" in the same paragraph.
- Zone 3 postcodes are given as "SA14 to SA34" in the Community Initiative page and Full Body doc,
  but as SA14 to SA20 plus SA31 to SA34 in the Factsheet. The Factsheet is used for everything we
  write, and the Community Initiative page is reproduced verbatim. SA21 to SA30 belong to no zone.
- Public pages show only the postcode district and locality, never the full postcode, for HomeBased
  listings. Confirm whether the client wants the full postcode shown.
- Doc audit, 2026-09-25: every client doc was checked against the live site. The Legal, Privacy, FAQ, About and
  Contact pages were brought back to the docs' exact wording and structure (lists, the FAQ's Q17 and Q18, the About
  page's One-Paragraph Summary, the docs' links). What remains different, apart from the items above:
  - Contact "Social Media (Optional)" is not shown, because the doc says the links will be added later. The
    "Postal / Physical Correspondence" line is shown as written ("Now unavailable. We will add address later.").
  - FAQ Q6 and the About coverage section list the 3 v2 zones in place of the v1 town list.
  - The FAQ's and Contact page's "Request Listing Update" link opens an email to support@ and points to the
    "Request an update" form on each business page, as there is no single update page.
  - The Full Body doc names owner step 3 both "Verified & Get Listed" (diagram) and "Get Listed & Verified" (link
    list). The site uses the diagram's wording.
  - Not built from the v1 Website Structure doc: category page filters (Location, Service type, Availability),
    category descriptions (no copy), News & Updates (optional). Business pages have a "View on map" link rather
    than an embedded map, so no third-party map loads (Free Access promises no tracking).

---

## 8. Open items before production

- Run the production baseline in `deploy/v2-migration-runbook.md` (helper: `deploy/v2-baseline.sh`) by hand
  before merging any schema or API change to `main`. Skipping it makes the API restart in a loop with Prisma
  error P3005.
- Production had zero rows in `Business`, `ContactMessage` and `BusinessPhoto` on 2026-09-25 (checked read
  only). The migration adds required columns to `Business` and aborts cleanly if that ever stops being true, so
  re-run `bash deploy/v2-baseline.sh check` just before the baseline.
- A photo uploads volume must be added to `/opt/bsd/docker-compose.yml` on the VPS before M2 ships.
  That file lives only on the VPS, not in the repo.
- Uploaded images live in the `bsd-uploads` bucket on the MinIO server shared with the restaurant platform. Nothing
  backs up that MinIO today (the platform's backup script covers only its Postgres), so the M6 backup job must copy
  `bsd-uploads` too. That MinIO runs the last community release of MinIO, which gets no more security updates.
- Add an external uptime monitor on `https://bsd.wales/` and `https://api.bsd.wales/health`.
- Consider a non-public login address for the seed super admin in production. `admin@bsd.wales` is
  now a public partnership mailbox.
