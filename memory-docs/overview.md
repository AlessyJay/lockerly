# Lockerly: Project Overview

Stable facts about the codebase. Update when architecture, conventions, or known issues change.

## What it is
File storage web app (Google Drive-like): email OTP auth, upload, list by type, rename, share by email, download, delete, dashboard with storage usage chart.

## Stack
- Next.js 15.0.7 (App Router, Server Actions, Turbopack dev), React 19 RC, TypeScript
- Appwrite via `node-appwrite` **31.x** (server-side only): auth, database, storage bucket. Upgraded from 14.1.0 on 2026-11-13: 14.x–26.0 bundle an old undici agent (`node-fetch-native-with-agent`) that Node 24+/26 native fetch rejects (`fetch failed`, cause `UND_ERR_INVALID_ARG: invalid onError method`). User runs Node v26.8.1.
- Tailwind + shadcn/ui (`components/ui/`), Radix, lucide-react icons
- react-hook-form + zod (auth form), react-dropzone (uploads), recharts (dashboard chart; README wrongly says Chart.js), use-debounce (search)
- No test setup. Scripts: `npm run dev | build | start | lint`

## Layout
- `app/(auth)/sign-in`, `app/(auth)/sign-up`: both use `components/AuthForm.tsx` + `OTPModel.tsx`
- `app/(root)/layout.tsx`: auth gate (`getCurrentUser`, redirects to `/sign-in`), renders Sidebar, MobileNav, Header, Toaster
- `app/(root)/(home)/page.tsx`: dashboard (`getFiles` limit 10 + `getTotalSpaceUsed`, Chart, usage summary)
- `app/(root)/[type]/page.tsx`: file list for `documents | images | media | others` (mapped via `getFileTypesParams` in `lib/utils.ts`), reads `?query=` and `?sort=`
- `lib/actions/user.actions.ts`: `sendEmailOTP`, `createAccount`, `verifySecret` (sets `appwrite-session` httpOnly cookie), `getCurrentUser`, `SignInUser`, `SignOutUser`
- `lib/actions/file.actions.ts`: `uploadFile`, `getFiles` (via `createQueries`), `renameFile`, `updateFileUsers` (share), `deleteFile`, `getTotalSpaceUsed`
- `lib/appwrite/index.ts`: `createSessionClient` (from cookie) and `createAdminClient` (API secret key)
- `lib/utils.ts`: `cn`, `parseStringify`, file type/icon/size/date/url helpers, `getUsageSummary`
- `constants/index.ts`: `navItems`, `actionsDropdownItems`, `sortTypes`, `MAX_FILE_SIZE` (50MB), avatar placeholder
- `types/index.d.ts`: global `declare` types (`FileType`, `*Props`)

## Data model (Appwrite)
- Users collection: `fullName`, `email`, `avatar`, `accountId`
- Files collection: `type`, `name`, `url`, `extension`, `size`, `owner` (relationship to Users; reads come back expanded, e.g. `file.owner.fullName`), `accountId`, `users` (shared emails[]), `bucketFileId`
- A user sees files where `owner == me` OR `users contains my email`
- File `url` is an unauthenticated Appwrite `/view` link; download uses `constructDownloadUrl` (`/download`)
- Users has a two-way back-reference `files` (child side of the `owner` relationship, onDelete setNull). Files has a fulltext index on `name` (needed by search).
- Appwrite permissions (set 2026-11-13): both collections have NO permissions, documentSecurity off, so only the API key can touch data. Bucket: `read("any")` + `create("users")` (for direct browser uploads), fileSecurity off, max file size 50,000,000 bytes (`MAX_FILE_SIZE` matches). Users can't update/delete bucket files directly. Before that, all three had create/read/update/delete `"any"`.
- Appwrite Cloud accepted browser requests from any Origin in tests (no Web platform registration needed for localhost).

## Key flows
- Auth: `AuthForm` → `createAccount` / `SignInUser` → Appwrite email token (OTP) → `OTPModel` → `verifySecret` sets cookie → `router.push("/")`
- Upload (direct to Appwrite, since 2026-11-13): `FileUploader` (Header + MobileNav, react-dropzone, client 50MB check) → per file: `getUploadToken()` server action (session check, then `users.createJWT(accountId, undefined, 900)` with the API key) → `uploadToBucket` in `FileUploader.tsx` POSTs straight to `<endpoint>/storage/buckets/<bucket>/files` with `X-Appwrite-JWT` via XHR (the only API with upload progress), in 5MB chunks with `Content-Range` + `X-Appwrite-ID` for files over 5MB → `uploadFile({ bucketFileId, path })` server action saves the Files doc after checking the bucket file's `$permissions` includes `delete("user:<accountId>")` (Appwrite grants the uploader read/update/delete by default) and that no doc already uses that `bucketFileId`. Owner/accountId come from the session. Bucket file is deleted if the doc create fails.
  - Why direct: real progress, files travel once, and Vercel caps function request bodies at 4.5MB (the old server-action upload likely failed over 4.5MB in production; the repo has Vercel bot commits).
  - Orphans: if the browser upload succeeds but `uploadFile` fails, the bucket file stays without a doc (users can't delete bucket files themselves).
  - The "Uploading..." card (bottom-right) is always mounted and fades/slides via classes on `files.length`. A `lastFiles` ref keeps the last items on screen while it fades out. Bottom bar shows real bytes: `progress` state maps file name → `{loaded, total}` over everything dropped since the card opened (reset on the first drop after it closes); failed files are removed from it. Drops while uploading are appended (they used to replace the list). Width transitions 300ms; respects `motion-reduce`.
- File actions: `ActionDropdown` (on `Card` and dashboard recent list) → rename / details / share / download / delete; modal bodies in `ActionsModalContent.tsx`. Failures show an error toast.
  - Only the owner can rename/share/delete (server-enforced). Shared users still see the menu items but get an error toast.
  - Share: client sends the full list (`file.users` + typed comma-separated emails); remove sends `file.users` minus one. Server validates emails (zod) and dedupes.
  - Rename: input shows the full name; server adds the extension only if missing.
  - `Card` and the dashboard recent list use `components/FilePreview.tsx` as a full-row overlay (`absolute inset-0`): images open a lightbox (shadcn `Dialog`, its built-in fade/zoom enter + exit animations, `duration-300`), other types open `file.url` in a new tab. The `ActionDropdown` trigger has `relative` to sit above the overlay. Keep the overlay before the dropdown when editing those layouts.
  - Lightbox: `DialogContent` needs `w-max` (with `left-1/2` positioning, `w-auto` only gets 50vw and wide images overflow). Image is `unoptimized` (original quality, and the optimizer rejects SVG), spinner until `onLoad`, then fades in.
- Search: `Search.tsx` in Header, debounced 1s, calls `getFiles` directly for a dropdown, clicking a result routes to `/<type>s?query=`. Input starts from `?query=`; the effect runs only on typed-text changes (deps intentionally `[debounceQuery]`).
- Sort: `Sort.tsx` sets `sort` via `URLSearchParams`, keeping other params

## Conventions
- Server actions: `"use server"`, wrap in try/catch, call local `handleError` (logs + rethrows), return `parseStringify(...)`, call `revalidatePath(path)` after mutations. In `file.actions.ts`, `handleError` is a `function` declaration returning `never` (an arrow `const` wouldn't narrow), so action return types don't include `undefined`.
- `createAdminClient` exposes `account`, `databases`, `storage`, `avatars`, `users`. `next.config.ts` no longer raises the server action body limit (no files go through server actions).
- All data access goes through `createAdminClient` (API key). `createSessionClient` only proves identity (`account.get()`, `deleteSession`); its `databases` getter was removed on purpose, since session reads would fail with the locked permissions.
- Server actions are public endpoints: never trust ids/owner data from the client. In `file.actions.ts`, mutations call `getOwnedFile(fileId)` (session + `owner.$id` check, fails closed) and use the server-fetched doc (e.g. `bucketFileId`, `extension`)
- `getFiles` without `limit` and `getTotalSpaceUsed` page through everything via `listAllFiles` (100 per page)
- node-appwrite 31: relationships are NOT returned unless selected. `file.actions.ts` has `ownerSelect = Query.select(["*", "owner.*"])`, used in `createQueries` and `getOwnedFile`. Any new query that reads `owner` (or Users' `files`) must select it.
- Document type is `Models.DefaultDocument` (has the `[key: string]: any` index); `Models.Document` no longer allows custom fields.
- SDK calls still use positional args (deprecated in 31, still work). Migrate to object params only when touching them anyway.
- Search/sort state lives in URL search params (`query`, `sort` like `$createdAt-desc`)
- Prettier + `prettier-plugin-tailwindcss`, ESLint standard + tailwind

## Env
- Local `.env` (gitignored) is fully filled as of 2026-11-13 and verified: project `6731632d002dcadf33aa` on `https://cloud.appwrite.io/v1`. The API key works and can also change collection/bucket settings (broad scopes). Never print the secret.
See `.env.example`: `NEXT_PUBLIC_APPWRITE_*` (endpoint, project, database, users/files collections, bucket) + `NEXT_APPWRITE_SECRET`. `next.config.ts` allows `next/image` from `<endpoint host>/v1/storage/**`, with the host derived from `NEXT_PUBLIC_APPWRITE_ENDPOINT` (so a region change is env-only).
- Files docs store a full `url` (endpoint + project baked in at upload time). After any endpoint/project change, existing docs' `url` must be rewritten (`constructFileUrl(bucketFileId)` with the new env).

## Local setup state
- Expected dev noise: when logged out, `handleError` logs `Error: NEXT_REDIRECT ... Failed to get the files!` because `createSessionClient` throws Next's redirect inside the actions' try/catch. It's the normal redirect to `/sign-in`, not a failure. Optional fix: call `unstable_rethrow(error)` (from `next/navigation`, available in 15.0.7) at the top of both `handleError`s. Not applied yet.
- UI checks without logging in: add a temporary route outside `(root)` (e.g. `app/preview-test-tmp/page.tsx`) that renders the component with fake data, test with the Playwright MCP, then delete it and the `.playwright-mcp/` folder it writes to the project root. On this machine the Playwright browser stops producing frames (CSS transitions stuck at 0 ms, Radix dialogs never unmount after closing): take screenshots in a loop to pump frames. That's a test artifact, not an app bug.
- `GET /sw.js` requests come from a stale service worker in the user's browser (another project on localhost:3000); they hit the `/[type]` route.
- `node_modules` installed via `npm ci` (2026-11-13). `npx tsc --noEmit`, `npx next lint`, `npx next build` all pass. No test framework exists.
- The real app has not been run against Appwrite by Claude (sign-in needs the user's OTP email).

## Known issues (open)
Fixed on 2026-11-13: the former #1, #2, #4-#14 (see session-log). Still open:
- (Confirmed, most important open item) Bucket `read("any")` is kept so `/view` links, `next/image` thumbnails and downloads work, but read also allows LISTING: anyone with the public project id can list and download every file (`GET /storage/buckets/<id>/files` → 200 anonymously). Fix: a Next route handler that checks session + owner/share and streams the file with the API key, point `constructFileUrl`/`constructDownloadUrl` at it, make those images `unoptimized` (the image optimizer has no user cookie), then drop the bucket's `read("any")`.
- `owner` loading: verified on the Users side (`files` only appears with `Query.select`) and all app query shapes pass against the live project, but no Files doc exists yet, so `file.owner.fullName` / `getOwnedFile` haven't been seen working end-to-end. Recheck after the first upload.
- Not covered: `sendEmailOTP` and `createAccount` are public actions, so anyone can trigger OTP emails or create user docs for any email (Appwrite rate limits apply).
- Minor: README claims Chart.js, version control, access control; `getFileTypesParams` maps unknown routes to documents; `[type]` page total divides by 1_000_000 while elsewhere uses 1024; `OTPModel` renders a stray "Open" trigger (it is the only way to reopen the dialog after closing it); `lib/utils.ts` redeclares `FileType` locally; `types/index.d.ts` has unused `FileUploaderProps` / `MobileNavigationProps` with stale `ownerId`/`accountId`; Sort's select doesn't show the current `?sort=` after reload.
