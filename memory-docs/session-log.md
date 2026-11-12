# Session Log

Newest first. One entry per session: what was done, files touched, open threads. When this file passes ~300 lines, condense the oldest entries into a short "Earlier history" section at the bottom.

## Current state
- IN PROGRESS: moving Appwrite from Frankfurt (`cloud.appwrite.io`, project `6731632d002dcadf33aa`) to Singapore. Waiting on the user (console only): create SGP project, run Settings → Migrations → Import from Appwrite, create an API key, update `.env` (and Vercel env vars).
- When the user says it's done, Claude should: verify the new project's schema (Users/Files attributes, `owner` relationship, fulltext index on `name`), check whether DB/collection/bucket IDs and auth user IDs were preserved (users docs' `accountId` must match auth user ids), re-apply permissions (collections `[]`, bucket `read("any")` + `create("users")`), rewrite Files docs' `url` if any exist, run the SDK checks, then have the user sign in and upload.
- Also raised with the user: if the app runs on Vercel, its functions default to Washington DC (`iad1`); with Appwrite in Singapore the server→Appwrite hops get slower unless the Vercel function region moves to `sin1`.
- Direct-upload work and everything earlier are still uncommitted on `main`.

---

## 2026-11-13: Started the move to Singapore
- Appwrite Cloud has no in-place region change (checked the docs and blog): you create a new project in the target region and import with Migrations. Migrated: users, databases, rows/documents, buckets/files, functions, settings. NOT migrated: API keys, platforms, SMTP, custom domains. Unclear from the docs: permissions and ID preservation, so verify. SGP endpoint: `https://sgp.cloud.appwrite.io/v1`. Community threads (2025–2026) report some "Project is not accessible in this region" errors, usually from apps still pointing at `cloud.appwrite.io`.
- Code: `next.config.ts` image host now comes from `NEXT_PUBLIC_APPWRITE_ENDPOINT`. Nothing else hardcodes the region.
- At this point the old project has 3 users, 0 files.

## 2026-11-13: Real upload progress (direct browser → Appwrite)
- With the user's OK: bucket permissions → `read("any")`, `create("users")` (other settings unchanged).
- Live tests (cleaned up): JWT-authenticated single and 5MB-chunked uploads work; Appwrite records `read/update/delete("user:<accountId>")` on uploads; users can't delete bucket files. Real `uploadToBucket` in Chromium: 12MB in 3 chunks, progress 14→42→83→100%, monotonic. `uploadFile`'s checks pass for the uploader and fail for another user.
- Code: `getUploadToken` + reworked `uploadFile({ bucketFileId, path })` in `file.actions.ts`; `uploadToBucket` + aggregate `progress` state + determinate bar in `FileUploader.tsx`; `users` getter in `createAdminClient`; `UploadFileProps` → `{ bucketFileId, path }`; `MAX_FILE_SIZE` → 50,000,000; removed `upload-progress` keyframe and the 100mb server action body limit; `handleError` → `never` function declaration.
- Temporary test route `app/upload-test-tmp` and the test export of `uploadToBucket` were removed.

## 2026-11-13: Upload card animation + image lightbox
- `FileUploader.tsx`: preview card always mounted, fades/slides in and out (300ms), keeps the last files during fade-out, and gains an indeterminate bar at the bottom (`role="progressbar"`). Markup is now `div > h4 + ul + bar` (was `ul > h4 + li`). Added the `upload-progress` keyframe to `tailwind.config.ts`.
- New `components/FilePreview.tsx` replaces the overlay `Link` in `Card.tsx` and the dashboard recent list: images open in an animated Dialog lightbox, other files still open in a new tab.
- Verified in Playwright on a temporary page (since deleted): square/tall/wide images fit without overflow (1280px and 375px wide), the image fades in after load, close unmounts, focus returns to the card, overlay click and Esc close it.
- Not done: real upload percentage (would need an XHR/route upload instead of a server action).

## 2026-11-13: Fixed sign-in "fetch failed" (node-appwrite upgrade)
- Cause: node-appwrite 14.1.0 passes a bundled old undici `Agent` as `dispatcher` to Node's native fetch; Node v26 rejects it (`UND_ERR_INVALID_ARG: invalid onError method`). Every SDK call failed; raw fetch worked. All node-appwrite ≤ 26.0 use the same lib; 26.x late/27+ use `undici` directly.
- Upgraded to node-appwrite ^31.2.0. Breaks found and fixed: `Models.Document` → `Models.DefaultDocument` (18 uses), and relationships now need `Query.select` (added `ownerSelect` in `file.actions.ts`).
- Verified against the live project with the SDK: user lookup, all `getFiles`/`getTotalSpaceUsed` query shapes (incl. empty sort, search, paging), `getDocument` with select. Didn't call `createEmailToken`/`createSession` (they'd send an email/create a session); their positional signatures still exist in 31.
- npm blocked `sharp`'s install script (allowScripts). Builds fine; sharp 0.33 ships prebuilt binaries.

## 2026-11-13: Verified .env, locked Appwrite permissions
- Read-only checks: database, both collections, bucket and API key all valid. Files collection empty, Users has 3 docs.
- Found both collections and the bucket open to `"any"` for create/read/update/delete. With the user's OK: moved `getCurrentUser`'s users lookup and `getTotalSpaceUsed` to `createAdminClient`, removed `databases` from `createSessionClient`, then via the API set both collections' permissions to `[]` and the bucket to `read("any")`, sending all other settings back unchanged.
- Rollback if needed: re-add `create/read/update/delete("any")` in the console (Collection or Bucket → Settings → Permissions).
- Verified anonymously: list/create on collections → 401; bucket list → 200 (still public, see overview).

## 2026-11-13: Diagnosed "NEXT_REDIRECT" dev log
- The user saw `Error: NEXT_REDIRECT` on `GET /sw.js 307`. Not a bug: the logged-out redirect gets logged by `handleError`. No code changed; offered the `unstable_rethrow` log fix (see overview "Local setup state").

## 2026-11-13: Appwrite credentials help
- `.env` turned out to be the unfilled template (secret was literally `YOUR_APPWRITE_SECRETKEY`). Filled `NEXT_PUBLIC_APPWRITE_PROJECT` from the console URL the user gave; an unauthenticated `GET /v1/account` returned 401 (not 404), so the project exists on `cloud.appwrite.io/v1`.
- Console login can't be recovered from the repo: told the user to use "Forgot password" or GitHub sign-in, then copy the database/collection/bucket IDs and create an API key.

## 2026-11-13: Fix known issues #1, #2, #4-#14
- #1 Security: `file.actions.ts` gained `getOwnedFile` (session + ownership) used by rename/share/delete; delete uses the server doc's `bucketFileId`; `uploadFile` takes owner from the session and checks `MAX_FILE_SIZE`. Removed `ownerId`/`accountId` props from `FileUploader`, `Header`, `MobileNav`, and the `(root)` layout; trimmed `UploadFileProps`/`RenameFileProps`/`DeleteFileProps`.
- #2 `.env` added to `.gitignore` (it was never committed).
- #4 Share merges with `file.users`, remove filters `file.users`, emails trimmed client-side and zod-validated server-side; `closeAllModel` resets `emails`.
- #5 Rename adds the extension only if missing. #6 MobileNav calls `SignOutUser()`. #7 Sort uses `URLSearchParams`; Search encodes the query.
- #8 Chart uses `calculateAngle`. #9 Dashboard empty dates show "—". #10 `.doc` icon path → `file-doc.svg`. #11 `listAllFiles` paging.
- #12 Search effect deps → `[debounceQuery]`, input starts from `?query=`. #13 overlay link in `Card` and dashboard (dashboard items are now `<li>`). #14 error messages in AuthForm/OTPModel, toasts in ActionDropdown/FileUploader.
- Skipped #3 (public file URLs): needs Appwrite config + a design decision.
- Behavior change: shared (non-owner) users can no longer rename/share/delete.
- Smoke test to do: sign in (wrong OTP shows error), upload, rename without editing, share 2 emails then add a 3rd, remove one, delete, sort while searching, reload `/documents?query=x`, click a card's ⋮ (should not open a tab), mobile sign out, dashboard chart arc.

## 2026-11-13: Full project read
- Read all hand-written code (app/, components/ except ui/, lib/, constants/, types/, config, public assets list). Skipped stock shadcn `components/ui/` and `hooks/use-toast.ts`.
- Added "Key flows", the `owner` relationship note, local setup state, and a ranked known-issues list (14 items + minor) to `overview.md`.
- Couldn't run tsc/lint/dev: no `node_modules`.

## 2026-11-13: Set up memory-docs
- Created `CLAUDE.md` (auto-loaded, imports these docs) and `memory-docs/overview.md` + `memory-docs/session-log.md`.
- Read the codebase to document stack, layout, data model, conventions, and known issues. No app code changed.
- Not committed: `CLAUDE.md` and `memory-docs/` are untracked.
