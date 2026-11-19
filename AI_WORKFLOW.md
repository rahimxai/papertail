# AI workflow

How I used AI to plan, build, debug, and verify Papertrail, and where I kept the engineering judgment.

## Tools

| Tool | What I used it for |
| --- | --- |
| **GitHub Copilot (agent mode) in VS Code** | Planning, implementation, refactoring, and running the toolchain (install, migrate, lint, typecheck, test, build). Its integrated browser drove the running app for end-to-end checks and screenshots, and its web search and fetch checked current library documentation. |
| **Models** | Claude Opus 5.5 for the agent's work (about 700 of 720 model calls); GPT-6 Luna for a small number of auxiliary calls |
| **Manual testing** | My own click-through of the app with the three demo accounts |

## How I worked: role-based briefs, one phase at a time

Instead of asking for "a Google Docs clone" in one prompt, I split the work into phases and gave the agent a focused brief for each, with the role, standards, and constraints I wanted applied. Each phase ended with verification before the next began.

| Phase | My brief to the agent | Outcome |
| --- | --- | --- |
| 1. Requirements | Pasted the assessment and asked to work through it **section by section, testing each** | Sections 1–5 (editing, upload, sharing, persistence, quality) were built and browser-tested one at a time |
| 2. First version | Iterated on the sections above | v1: Node + Quill, then SQLite, then Cloudflare Workers + D1 |
| 3. Rebuild | A "Principal Full-Stack Engineer" brief naming my preferred stack (Next.js, TypeScript, Tailwind, shadcn/ui, Tiptap, Prisma, Postgres, Vercel) and production standards | v2 rewrite: backend and integration tests first, then UI |
| 4. Design | A "Principal Product Designer" brief: distinctive, accessible, consistent, no generic AI look | Design system and redesign of every screen, verified in the browser |
| 5. QA | A "Principal QA Engineer / security tester" brief: be skeptical, reproduce before reporting, don't fake results | Independent audit: 0 critical/high issues, 3 medium and 8 low, all fixed after I approved them |
| 6. Release | A "Release Manager" brief: clean up, document honestly, verify everything | This documentation, cleanup, screenshots, final verification |

**Time:** about 5 hours in a single working session, from first prompt to live deployment and walkthrough recording.

## Where AI helped

### Architecture and planning
- **Turning the brief into a plan.** The agent proposed the layering (Server Components for reads, route handlers for writes, one service layer with a single authorization gate) and the core safety mechanisms: version-checked saves, schema-validated JSON content, and `404` for documents you can't access.
- **Checking current APIs before coding.** Next.js 16, Prisma 7, and Tiptap 3 all had recent breaking changes. The agent read the bundled Next.js docs and checked the npm registry instead of relying on memory. That caught that npm's `latest` tag for Prisma pointed at a **v8 release candidate**, so we pinned stable 7.10.1.
- **Tradeoff analysis I could challenge.** One example is real-time CRDT editing versus optimistic concurrency, decided against the timebox and Vercel's serverless model (see [ARCHITECTURE.md](./ARCHITECTURE.md#engineering-tradeoffs)).

### Implementation
- Scaffolding and boilerplate: the Prisma schema and SQL migration (including `CHECK` constraints), Zod schemas, route-handler wrappers, shadcn components, and the Tiptap toolbar.
- Test authoring: building real `.docx` files in memory to test Word import, every malformed-file case, and a decompression-bomb case.
- The design system: tokens, typography, and states for every screen, implemented directly in Tailwind and shadcn.

### Debugging and code review
The agent diagnosed failures from real tool output, not guesses:

- **Next 16 Cache Components build failure:** session reads at the layout's top level. Restructured into a static shell plus streamed `<Suspense>` parts.
- **Next's internal control-flow errors** were being swallowed into `500`s by a generic `try/catch`. Fixed with `unstable_rethrow`.
- **The local test database (PGlite) wedging** between test files. Fixed by disconnecting gracefully and using a pool of one.
- **React Compiler lint violations** (state set inside effects, refs read during render). Refactored rather than suppressed.

## What I changed or rejected

| AI output or first approach | What happened | Decision |
| --- | --- | --- |
| Hand-rolled `contenteditable` editor (v1) | Inconsistent lists and wrong toolbar state | **Rejected**, replaced with a real editor framework (Quill in v1, Tiptap in v2) |
| The agent's recommendation to **keep the v1 Cloudflare stack** and close the gaps | It was faster, but didn't match the stack I wanted to demonstrate, and the Workers CPU limit had forced `.docx` parsing into the browser | **I decided to rewrite** on Next.js + Postgres + Vercel, carrying over v1's lessons (roles, version-checked saves, import validation) |
| Email validation that ran before trimming and lowercasing | `" ALEX@… "` was rejected as invalid | **Fixed:** normalize first, then validate |
| `router.replace()` + `router.refresh()` after sign-in | Browser testing showed sign-in could stall on "Signing in" | **Replaced** with a full page navigation on auth changes |
| First pass of the UI redesign | Looked right in screenshots, but clicking through found three bugs: a toolbar that stayed dead until the first keystroke, keystrokes lost after choosing a text style, and two users with the same avatar color | **Fixed** each and re-verified |
| The agent's own fix for lost keystrokes | The QA pass measured focus timing and showed the fix was **incomplete** (about 100 ms of lost input remained) | **Re-fixed** and re-measured: 0 ms with the mouse, 4/4 at human typing speed |
| Import pipeline as first written | QA found a 105 KB `.docx` "zip bomb" costing about 10 s of CPU and 1.5 GB of RAM | **Added** a check of the zip directory before conversion, plus a regression test |
| Import success state | I hit "Imported. Opening…" stuck on screen and reported it with a screenshot | **Fixed:** an *Open document* button, a closable dialog, and an automatic full-page fallback |
| Documentation drafted from memory | Wrong test counts, button labels, and Node version | **Every claim checked against the code and tool output** before keeping it |

**A safety rail I kept on purpose:** Prisma refuses destructive commands (`migrate reset`) from AI agents unless the human explicitly consents. I approved it once, for the local development database only.

## How I verified the work

| Layer | Evidence |
| --- | --- |
| Static | Strict TypeScript and ESLint (Next.js + React Compiler rules): 0 errors. A production `next build` passes. |
| Integration | **22 Vitest tests** against real route handlers and a real Postgres: auth, permissions, conflicts, schema validation, every import rejection path, zip bombs |
| Black-box API | `npm run audit:api`: **108/108** checks over HTTP as three users, covering cross-account access, role escalation, revocation, XSS payloads, malicious files, and concurrent saves. Against the live Vercel deployment: **107/108** (one low-severity finding, documented in [SUBMISSION.md](./SUBMISSION.md)) |
| Browser | Agent-driven checks against the production build: formatting round-trips, autosave under offline, expired-session, and in-flight conditions, two-user conflicts, mid-session revocation and downgrade, long documents, and phone/tablet/desktop layouts |
| Manual | My own click-through of the app with the demo accounts (which is how I found the import dialog stuck on "Imported. Opening…"), and a final run-through of the main flows on the live deployment while recording the walkthrough |

Every QA finding was **reproduced before it was fixed and re-tested afterwards**, and all results in this repository come from actual runs. Remaining gaps are stated honestly: there is no committed Playwright suite yet (see [SUBMISSION.md](./SUBMISSION.md)).

## Where the engineering judgment stayed with me

The AI drafted, proposed, and executed; the decisions below were mine:

- **Scope:** viewer/editor roles rather than a single "shared" flag; import as *create a new document*; deliberately no real-time editing, comments, or version history in the timebox.
- **Stack:** rejecting the faster "keep v1" recommendation in favor of a rewrite on the stack I wanted to demonstrate.
- **Risk:** approving the one destructive database command, and only for local data; authorizing the QA fixes ("fix all") only after reviewing the prioritized list.
- **Quality bar:** requiring that every phase end with real verification, and that nothing be claimed without evidence.
