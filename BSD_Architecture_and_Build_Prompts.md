# BSD — Bangladeshi Business & Service Directory
## Architecture, Data Model, and Milestone-Based Build Prompts

This document turns the client's requirement docs (Website Structure, Homepage Layout,
Category Structure, Submission Form, FAQ, Contact Page, Footer, Legal Disclaimer,
Privacy Policy) into a buildable plan. Every field, category, and page below is taken
directly from those documents — nothing invented.

---

## 1. Confirmed Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Website (public) | Next.js + TypeScript + Tailwind | SSR/SSG for SEO on listing/category pages |
| Admin panel | Same Next.js app, protected `/admin` routes | No need for a separate project |
| Backend API | Fastify + TypeScript, organized as NestJS-style feature modules (routes/service/schema per domain) rather than a flat routes/services split | Standalone service, shared by website, admin, and mobile app — module-per-domain scales better than flat folders across many AI-assisted milestone edits, without pulling in Nest's full DI/decorator framework |
| Database | PostgreSQL | Relational fit, strong full-text search |
| ORM | Prisma | Type-safe, migration-friendly, works well with AI-assisted edits |
| Testing | Vitest (unit) + Fastify's built-in `.inject()` (integration/API tests) | Catches regressions between AI-assisted milestone edits — especially the public/approved-only leak risk on listing endpoints |
| Mobile app | React Native + TypeScript | Shares types/patterns with the web stack, hits the same API |
| Hosting | Your VPS — Nginx reverse proxy, PM2 for process management, Postgres on the same box or managed | Two independent services (website, API) so one can restart without killing the other |
| Auth (admin only) | JWT (short-lived access + refresh token), bcrypt password hashing | Public site needs no user accounts — only admins log in |

**Three repositories:**
1. `bsd-web` — Next.js public site + admin panel
2. `bsd-api` — Fastify backend, Prisma, Postgres
3. `bsd-mobile` — React Native app

The website and mobile app are both just clients of `bsd-api`. Neither talks to the database directly.

---

## 2. Data Model (Prisma schema)

This maps every field in the Submission Form, Category Structure, and Contact Page docs.

```prisma
// schema.prisma

enum ListingStatus {
  PENDING
  APPROVED
  REJECTED
  REMOVED
}

enum AdminRole {
  SUPER_ADMIN
  ADMIN
  MODERATOR
}

enum ContactType {
  GENERAL        // info@bsd.wales
  COMMUNITY      // community@bsd.wales
  PARTNERSHIP    // partnership@bsd.wales
  URGENT         // urgent@bsd.wales - 24hr SLA
}

model AdminUser {
  id           String    @id @default(cuid())
  name         String
  email        String    @unique
  passwordHash String
  role         AdminRole @default(MODERATOR)
  createdAt    DateTime  @default(now())
  reviewedListings Business[] @relation("ReviewedBy")
  auditLogs    AuditLog[]
}

model Category {
  id          String   @id @default(cuid())
  name        String   @unique          // e.g. "Grocery & Cash & Carry"
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

model CoverageArea {
  id        String   @id @default(cuid())
  name      String   @unique            // Swansea, Neath Port Talbot, Llanelli, Gorseinon, Mumbles, Morriston, Sketty, Uplands
  businesses BusinessCoverageArea[]
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
  email             String?                         // Q7: publicly displayed
  websiteOrSocial   String?                         // Q8: optional
  address           String?                         // Q9: "Home-Based" if no office
  coverageAreas     BusinessCoverageArea[]           // Q10 — the 8 seeded areas
  otherAreaText     String?                          // Q10: free-text fallback when "Others" is checked instead of/alongside the 8 seeded areas
  openingHours      String?                          // Q11: optional
  specialNotes      String?                          // Q13: home-based / appointment only / emergency / weekend
  status            ListingStatus @default(PENDING)

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
}

model BusinessCoverageArea {
  businessId     String
  business       Business     @relation(fields: [businessId], references: [id])
  coverageAreaId String
  coverageArea   CoverageArea @relation(fields: [coverageAreaId], references: [id])
  @@id([businessId, coverageAreaId])
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

// Contact Page: 4 inboxes with different SLAs
model ContactMessage {
  id        String      @id @default(cuid())
  type      ContactType
  name      String
  email     String
  message   String
  createdAt DateTime    @default(now())
  status    String      @default("OPEN") // OPEN, RESOLVED
}

// Admin accountability — every approve/reject/edit/delete gets logged
model AuditLog {
  id         String    @id @default(cuid())
  adminId    String
  admin      AdminUser @relation(fields: [adminId], references: [id])
  action     String    // e.g. "APPROVE_LISTING", "EDIT_CATEGORY"
  entityType String
  entityId   String
  details    Json?
  createdAt  DateTime  @default(now())
}
```

**17 categories with subcategories** go into the `Category` + `Subcategory` tables as seed
data — copy them directly from the Category Structure doc (Grocery & Cash & Carry,
Restaurants & Takeaways, Sweet Shops & Bakeries, Clothing & Cultural Shops, Mobile & Tech
Repair, Taxi & Private Hire, Car Services, Electrician/Plumber/Handyman, Tutors & Education,
Health & Wellbeing, Property & Housing Services, Beauty & Henna Services, Home-Based Food
Services, Independent Professionals, Professional Services, Community & Religious Services,
Others/Miscellaneous). Each category's subcategory list becomes its own `Subcategory` rows
linked by `categoryId`, so businesses can be filtered and reported on by subcategory, not
just free-text display. Set `requiresOwnerName = true` on the "Independent Professionals"
category row only — this is what M2's submission validation checks, instead of matching on
the category name in code.

**8 coverage areas** from the FAQ/Homepage docs: Swansea, Neath Port Talbot, Llanelli,
Gorseinon, Mumbles, Morriston, Sketty, Uplands.

---

## 3. Milestone Roadmap

| # | Milestone | What it delivers | Depends on |
|---|---|---|---|
| M0 | Foundation | Repos scaffolded, Postgres + Prisma schema + seed data, Fastify skeleton with health check, Next.js skeleton, deployed to VPS with Nginx + PM2, CI-free manual deploy script | — |
| M1 | Public browsing | Homepage, Categories page, Category Detail page, Business Listing page, search + filters | M0 |
| M2 | Submission flow | Public Submit Listing page (all form fields + consent), photo/logo upload, confirmation message, API validation | M0 |
| M3 | Admin panel | Admin login (JWT), pending listings queue, approve/reject/edit, category management, audit log view | M0, M2 |
| M4 | Static content pages | About, Coverage Area, Community Transparency, Legal Disclaimer, Privacy Policy, Contact (4 inboxes), Branding, Footer, News (optional) | M0 |
| M5 | Mobile app | React Native: browse, search, view listing, submit listing — same API as web | M1, M2 |
| M6 | GDPR + ops hardening | Update/removal request flows (self-service, tied to FAQ SLAs), rate limiting on submission form, backups, sitemap.xml, robots.txt, basic monitoring | M2, M3 |
| M7 | Print export | Admin-triggered export (CSV/JSON, grouped by category/coverage area) for the print-layout designer to use — not a full PDF generator unless you decide to scope that in | M3 |

Do these roughly in order, but M4 (static pages) can run in parallel with M1 since it's independent content.

---

## 4. Milestone Prompts

Copy each block as-is into your AI coding tool (Claude Code, Cursor, etc.) when you reach
that milestone. Each one is self-contained — it restates the stack and relevant schema so
you don't need to re-explain context every time.

### M0 — Foundation

```
You are setting up the foundation for a project called BSD (Bangladeshi Business &
Service Directory). Three separate repos:

1. bsd-api: Fastify + TypeScript + Prisma + PostgreSQL. Standalone REST API, no
   server-rendering, no relation to the frontend framework.
2. bsd-web: Next.js (App Router) + TypeScript + Tailwind CSS. Consumes bsd-api over HTTP.
3. bsd-mobile: React Native + TypeScript (set up later, in M5 — skip for now).

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
   Run the initial migration.
3. Write a seed script (prisma/seed.ts) that inserts:
   - The 17 categories with their subcategories, exactly as listed: [paste category
     list from Category Structure doc] — categories go in `Category`, each category's
     subcategory list goes into `Subcategory` rows linked by categoryId. Set
     `requiresOwnerName = true` only on the "Independent Professionals" category.
   - The 8 coverage areas: Swansea, Neath Port Talbot, Llanelli, Gorseinon, Mumbles,
     Morriston, Sketty, Uplands
   - One SUPER_ADMIN AdminUser for initial login (password from env var, hashed with bcrypt)
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
7. Write a deploy README for a single VPS: Nginx reverse proxy config (one subdomain or
   path for the API, one for the website), PM2 ecosystem file to run both processes,
   and basic instructions for provisioning Postgres on the same box.

Do not build any business logic yet — this milestone is only the skeleton, schema,
seed data, test harness, and deploy plumbing. Confirm the /health endpoint responds,
its smoke test passes, and the seed script runs cleanly before considering this done.
```

### M1 — Public Browsing

```
Building on the existing bsd-api (Fastify + Prisma + Postgres) and bsd-web (Next.js +
TypeScript + Tailwind) from the foundation milestone. Schema is already in place —
Category, CoverageArea, Business, BusinessPhoto models exist.

Build the public browsing experience:

API endpoints (bsd-api):
- GET /categories — list all categories with their subcategories, sorted by sortOrder
- GET /categories/:slug — category detail + paginated list of APPROVED businesses in
  that category, with optional query params: ?subcategory=&coverageArea=&search=
- GET /businesses/:slug — single business detail (only if status = APPROVED)
- GET /businesses/search?q=&category=&subcategory=&coverageArea= — full-text search
  across name, description, servicesOffered for APPROVED businesses only

Only ever return businesses with status = APPROVED on these public endpoints — pending/
rejected/removed listings must never leak through public routes. This is the single
highest-risk regression across all later milestones, so write an integration test now
(using the Vitest + `.inject()` harness from M0) that seeds one business of each status
and asserts only the APPROVED one is ever returned by any of these endpoints. Keep that
test running as a guard for every later milestone that touches these routes.

Website pages (bsd-web, App Router):
1. Homepage (/) — build exactly per this structure: hero banner with title "BSD —
   Bangladeshi Business & Service Directory", subtitle "Swansea Bay Edition", badge
   "Free Access • Community Initiative • Powered by BayConnect", three buttons (Browse
   Categories, Search Businesses, Submit Listing); search bar section with category
   dropdown + location filter; featured categories grid (8-12 cards); "About BSD" short
   section with a "Read Full Introduction" button linking to /about; coverage area
   summary linking to /coverage-area; transparency short section linking to /transparency;
   legal disclaimer short section linking to /legal; submit-your-business CTA; "Powered
   by BayConnect" section.
2. /categories — full category list with icons and descriptions, "View All Categories"
   already satisfied by being on this page.
3. /categories/[slug] — category detail: title, description, business list, filters for
   location/service type/availability, "Submit Your Business" button.
4. /businesses/[slug] — business detail page: name, category, address, phone, opening
   hours, services offered, photos, map placeholder, contact button (tel: / mailto:),
   and this exact disclaimer text: "Information provided by business owner."
5. Global search results view driven by the search bar (can live at /search).

Use server-side rendering or static generation with revalidation for category and
business pages — this is a directory site and SEO matters. Style with Tailwind, keep
it clean and mobile-responsive. Do not build the submission form yet — that's the next
milestone.
```

### M2 — Submission Flow

```
Building on bsd-api and bsd-web. Add the public submission flow, matching the BSD
Submission Form document exactly — every field and every consent checkbox listed
below must be present, none renamed or dropped.

API endpoint (bsd-api):
- POST /businesses/submit — accepts multipart/form-data (for photo/logo upload).
  Validates and creates a Business record with status = PENDING. Required fields:
  name, categoryId, description (50-150 words — validate word count), servicesOffered
  (array), phone, coverageAreaIds (array) and/or otherAreaText (at least one of the two
  must be present — this covers the "8 areas + Others" requirement from the form doc).
  Optional: subcategoryId (must belong to the chosen categoryId if present), ownerName
  (required when the chosen Category has requiresOwnerName = true — look this up from
  the Category row, do not match on category name/string in code), email,
  websiteOrSocial, address (default to "Home-Based" if blank and no office), openingHours,
  specialNotes.
  Photo/logo upload is optional but recommended — validate before storing: allowlist
  mimetypes (image/jpeg, image/png, image/webp) and a max size (e.g. 5MB per file);
  reject anything else with a 400. Store via local disk or S3-compatible storage, save
  URL + mimeType + sizeBytes to BusinessPhoto.
  Sanitize every free-text field (description, servicesOffered entries, ownerName,
  address, openingHours, specialNotes, otherAreaText) through the `src/common/sanitize.ts`
  helper from M0 before it touches the database — these fields render back on public
  listing pages, so this must happen at write time here, not deferred to a later
  hardening pass.
  All six consent booleans (consentAccurateInfo, consentPublishPermission,
  consentNoLiability, consentDataStorage, gdprConsentStorage, gdprConsentRights) are
  REQUIRED to be true — reject the submission with a 400 if any is false or missing.
  Rate-limit this endpoint (e.g. 5 requests per IP per hour) to prevent spam.
  Add integration tests (Vitest + `.inject()`) covering: word-count rejection, missing
  consent rejection, missing-both coverageAreaIds/otherAreaText rejection, oversized/
  wrong-mimetype file rejection, and a script-tag payload in a free-text field coming
  back sanitized in the stored record.

Website page (bsd-web):
- /submit — a multi-section form matching the doc's structure exactly:
  Section 1: Business/Service Information (name, category dropdown with all 17
  categories, a dependent subcategory dropdown that populates from the chosen
  category's subcategories, short description with a live word counter enforcing
  50-150 words, services offered as a repeatable bullet-point input)
  Section 2: Contact Details (owner/provider name — mark as required when the selected
  category is flagged requiresOwnerName, phone, email, website/social — all as
  specified, phone and email marked "will be publicly displayed")
  Section 3: Location Details (address with helper text "if no office, write
  Home-Based", coverage area as a multi-select checklist of the 8 areas + "Others" —
  checking "Others" reveals a free-text input bound to otherAreaText)
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
- CRUD endpoints for /admin/categories (SUPER_ADMIN and ADMIN roles only — MODERATOR
  can view but not edit categories), including managing each category's
  requiresOwnerName flag and its Subcategory rows (add/rename/remove).
- GET /admin/audit-log — paginated, filterable by admin/entity/date.
- GET /admin/contact-messages?type=&status= — view submitted contact messages
  (see M4 for where these get created).

Enforce role checks: MODERATOR can approve/reject/edit listings but not manage
categories or admin users. Only SUPER_ADMIN can create new AdminUser accounts.

Website pages (bsd-web):
- /admin/login — simple login form, stores access token in memory + refresh in
  httpOnly cookie (set by the API response).
- /admin/dashboard — counts: pending listings, approved this week, open contact
  messages.
- /admin/listings — table of listings with status filter, search, and row actions
  (approve, reject with reason modal, edit, remove).
- /admin/listings/[id]/edit — full edit form reusing the same field set as the public
  submission form.
- /admin/categories — manage the 17 categories, their subcategories, and each
  category's requiresOwnerName flag.
- /admin/audit-log — read-only table.
- /admin/messages — view and mark contact messages resolved.

Protect all /admin/* routes client-side with a redirect-to-login check, but remember
the real security boundary is the API's JWT verification, not the frontend route guard.
```

### M4 — Static Content Pages

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
   POST /contact — body: { type: GENERAL | COMMUNITY | PARTNERSHIP | URGENT, name,
   email, message }, creates a ContactMessage record. On the page, present the four
   contact purposes as separate sections/tabs matching the doc: General Enquiries
   (info@bsd.wales, 3-5 working days), Community Support & Feedback
   (community@bsd.wales), Partnership & Collaboration - non-commercial only
   (partnership@bsd.wales), Emergency Corrections (urgent@bsd.wales, 24 hours).
   Also display operating hours (Mon-Fri 10-6, Sat 11-4, Sun closed) and placeholders
   for social media links.
8. Footer component (used site-wide): Home, Browse Categories, Submit Listing,
   Transparency, Legal, Contact links; "Powered by BayConnect — Connect. Celebrate.
   Empower."; copyright line "© 2026 BSD — Bangladeshi Business & Service Directory.
   All Rights Reserved."
9. Optional: /news — simple list page for directory updates/announcements, can be a
   flat array of posts for now with no CMS.

Keep all legal/privacy/disclaimer text exact — this content was written for compliance
purposes, so no rewording.
```

### M5 — Mobile App

```
New repo: bsd-mobile, React Native + TypeScript. Hits the same bsd-api used by the
website — no separate backend.

Scope for this milestone (matches the public website's core flows, not the admin panel):
1. Home screen — category grid (fetch from GET /categories), search bar, coverage
   area filter.
2. Category screen — business list for a category (GET /categories/:slug), with
   location/service-type filters.
3. Business detail screen — full listing info, tap-to-call (phone), tap-to-email,
   map link if address is available, and the same disclaimer: "Information provided
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
small shared types package), but don't force a monorepo restructure if it adds
overhead — duplicating a types file is fine for this project's size.
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
- Rate limiting: apply to /businesses/submit, /businesses/:id/request-update,
  /businesses/:id/request-removal, and /contact — use @fastify/rate-limit, a
  reasonable default (e.g. 10 requests/hour/IP), tighter on submit.
- Free-text sanitization on submit was already added in M2 (src/common/sanitize.ts) —
  in this milestone, confirm request-update's requestedChanges JSON is sanitized
  through the same helper before being applied to a Business record, and add
  output-encoding on the frontend render path as defense-in-depth (React/Next already
  escapes by default — just confirm nothing bypasses it with dangerouslySetInnerHTML).

Website:
- /businesses/[slug] — add "Request an update" and "Request removal" links/forms
  that hit the two new endpoints above.
- Add app/sitemap.ts (Next.js dynamic sitemap) covering all category and approved
  business pages, and app/robots.ts.

Ops:
- Add a daily pg_dump backup cron on the VPS, retained for at least 14 days, written
  to a separate disk/volume from the live database. If photo/logo uploads are stored on
  local disk (per M2), back up that upload directory on the same schedule and retention
  — a listing's logo is part of its identity and isn't reconstructable from the database
  alone.
- Add basic uptime monitoring for both bsd-api and bsd-web processes under PM2
  (pm2 restart on crash is default — confirm max restart limits are sane so a crash
  loop doesn't hammer the VPS).
- Add structured logging (pino, since it pairs natively with Fastify) with request
  IDs, so a failed submission can be traced through the logs.

Do not build user-facing accounts or login for the public — only admins authenticate.
Update/removal requests are identified by business ID + contact info, not a login.
```

### M7 — Print Export (optional, scope only if the print deliverable needs live data)

```
Building on bsd-api's admin routes. This does NOT generate the final print-ready
design — that's a design deliverable, not code. This milestone only gives the
designer clean, structured data to work from.

API endpoint (bsd-api):
- GET /admin/export/directory — SUPER_ADMIN/ADMIN only, returns all APPROVED
  businesses grouped by category, then by coverage area, as JSON. Include a CSV
  variant (?format=csv) with columns matching the Submission Form fields (name,
  category, description, services offered, owner name, phone, email, address,
  coverage area, opening hours, special notes).

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
  the 8 seeded towns; upload validation (mimetype allowlist, size cap) and free-text
  sanitization were pulled forward into M2 (submission time) instead of waiting until M6,
  since public pages start rendering user-submitted content as soon as M2 ships; M6's
  backup step now also covers the upload directory, not just the database; and a
  Vitest + Fastify `.inject()` test harness is set up in M0 so the "pending/rejected
  listings must never leak on public routes" invariant has an automated guard from M1
  onward. The bsd-api folder layout uses NestJS-style feature modules (routes/service/
  schema per domain) on plain Fastify — no Nest framework/DI — since that organizes more
  predictably than a flat routes/services split across many AI-assisted milestone edits.
