# v2 database migration runbook

This is the production procedure for the v2 schema. Claude Code does not run any of it. You run each step,
from your own machine, and check the result before the next one.

## What changes and why it needs care

Production tables were created with `prisma db push` before Prisma migrations existed. The API image now starts
with `prisma migrate deploy`. On a database that already has tables but no migration history, `migrate deploy`
refuses with error **P3005** and the API container restarts in a loop until someone fixes it. The **baseline**
below records the existing tables as migration `0_init` so that only the new `1_v2_schema` is applied.

| Migration | What it does |
|---|---|
| `0_init` | Baseline. Matches the tables `db push` created. Never executed on production, only marked as applied. |
| `1_v2_schema` | Adds coverage zones, localities, `Business.postcode`, `postcodeDistrict`, `zoneId`, `whatsapp`, verification status, claim requests, the `VOLUNTEER` role and the four v2 `ContactType` values. Drops the old `CoverageArea` tables. It runs as one transaction and aborts cleanly, changing nothing, if `Business` or `ContactMessage` has any rows. |

The seed then replaces the 17 v1 categories with the 20 approved ones and loads 3 zones and 47 localities.

## What was tested before this runbook was written

Run on this repo, without touching production:

- `0_init` reproduces all **79 production columns** exactly (compared with a read-only dump taken from production on
  2026-09-25).
- The whole path, `migrate resolve`, `migrate deploy`, seed, seed again, ran against a real **PostgreSQL 16.14**
  (production's version) using the real Prisma CLI, on data shaped like production. All checks passed.
- The seed is idempotent, refuses (and rolls back) if a retired category still has listings, and renames the
  straight-renamed categories in place so their listings keep their link.
- Skipping the baseline was tested too. It fails with P3005 and changes nothing.

`bsd-api/test/migrations.test.ts` keeps the schema-level checks in the test suite.

## Before you start

1. Production must have **zero** rows in `Business`, `ContactMessage` and `BusinessPhoto`. The `check` step shows this.
2. The code must be on GitHub. Pushing a branch does not deploy anything, only pushes to `main` do.
3. The website (Phase 1) does not call the API for data, so the API being briefly restarted does not affect it.

## Steps

All commands are run from the repo root in Git Bash. Each one is a separate command.

### 1. Push the branch (no deploy)

```
git push origin v2-refresh
```

### 2. Check (read only)

```
bash deploy/v2-baseline.sh check
```

Expect: PostgreSQL 16.x, migration history `none`, `Business 0`, `ContactMessage 0`, `BusinessPhoto 0`.
If any count is not 0, stop and ask.

### 3. Back up

```
bash deploy/v2-baseline.sh backup
```

This writes `/root/backups/bsd-pre-v2-<timestamp>.sql.gz` on the VPS.

### 4. Baseline

```
bash deploy/v2-baseline.sh baseline origin/v2-refresh
```

It checks out that branch in `/opt/bsd-src`, builds the API image, runs
`prisma migrate resolve --applied 0_init` in a one-off container, and puts the source tree back. It does **not**
restart any running container. It refuses to run if the history table already exists or any listing row exists.

### 5. Merge to main (this is the deploy)

```
git checkout main
git merge --ff-only v2-refresh
git push origin main
```

The normal GitHub Actions deploy runs. The API container starts, `migrate deploy` applies `1_v2_schema`, and
the API comes up. Watch it with `gh run watch <id> --repo Kanto065/BSD --exit-status`.

### 6. Seed

```
bash deploy/v2-baseline.sh seed
```

Expect output like this, then `Seed complete.`:

```
renamed category "Grocery & Cash & Carry" to "Groceries & Halal"
renamed category "Beauty & Henna Services" to "Beauty & Lifestyle"
renamed category "Community & Religious Services" to "Community & Faith"
renamed category "Others/Miscellaneous" to "Others / Miscellaneous"
removed retired category "Electrician/Plumber/Handyman"
removed retired category "Health & Wellbeing"
removed retired category "Professional Services"
removed retired subcategory "Sweet Shops & Dessert Places" of "Restaurants & Takeaways"
removed retired subcategory "Mortgage Advisors" of "Property & Housing Services"
```

The seed reads `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from `/opt/bsd/.env`. If they are set it adds that
admin (an existing admin is left alone). Use a login address that is not a public mailbox.
Running the seed a second time is safe and prints no removals.

### 7. Verify

```
bash deploy/v2-baseline.sh verify
```

Expect two finished migrations (`0_init`, `1_v2_schema`), 20 categories, 73 subcategories, 3 zones, 47 localities,
0 businesses, `Database schema is up to date!`, and `{"status":"ok"}` from the health check.

## If something goes wrong

- **`migrate deploy` fails with P3005 after the merge.** The baseline (step 4) was skipped. The API is looping but
  nothing changed in the database. Run steps 4 and then `docker restart bsd-api` on the VPS.
- **`1_v2_schema` aborts with "has rows".** A listing or contact message appeared after the check. Nothing was
  changed. The migration is marked failed, so clear that with
  `docker exec bsd-api npx prisma migrate resolve --rolled-back 1_v2_schema`, then decide how to backfill.
- **The seed stops with "Retired category ... still has N listing(s)".** Nothing was changed, the seed is one
  transaction. Move those listings to an approved category, then run the seed again.
- **Restore from the backup** (last resort, this replaces the whole database):
  ```
  ssh -i ~/.ssh/vps_fix root@169.58.119.208
  docker exec bsd-postgres psql -U bsd -d postgres -c 'drop database bsd;' -c 'create database bsd owner bsd;'
  gunzip -c /root/backups/<file>.sql.gz | docker exec -i bsd-postgres psql -U bsd -d bsd
  ```
  Then check out the previous commit on `main` and redeploy so the API image matches the restored schema.

## Later phases

Phases 3 and 4 add no schema changes of their own beyond what `1_v2_schema` already provides. Any later change is a
new migration folder under `bsd-api/prisma/migrations`, created with `prisma migrate diff` (no local database
needed) and applied automatically by the deploy from then on.
