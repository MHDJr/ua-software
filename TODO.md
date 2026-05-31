# TODO - Manager pages UI updates

## Step 1 (in progress)

### Completed in `ManagerCommandCenter.tsx`

- Removed “staff online” indicator from department personnel card.

Inspect and update `project/components/manager/ManagerCommandCenter.tsx`:

- Ensure header is clean (remove any Sales Intelligence button if present).
- Remove scheduled meetings card if present.
- Remove pending CEO directives card.
- Remove team live feed card.
- Remove any “staff online” indicator.
- Add/ensure Department staff name card labeled “{Department} Department”.
- Ensure CEO-style assign task dialog shows only staff from manager’s
  department.
- Update/replace CEO broadcast card with Community Board showing real data
  (Supabase), and remove mockups.

## Step 2

Check manager navigation/header components (and mobile nav) for any “view sales
intelligence” header button; remove it.

## Step 3

Run lint/typecheck/build and smoke-test manager pages: `/sales-manager`,
`/finance-manager`, `/marketing-manager`.
