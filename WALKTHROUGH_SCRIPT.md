# Walkthrough video script (about 4½ minutes)

A natural, speakable script for the 3–5 minute recording. Each section lists what to **say**, what to **show**, what to **do**, and any **files** to open. Timings are targets; pause where it feels natural.

## Before you record (2 minutes of setup)

- **Use the live Vercel URL** with freshly seeded data, so the dashboard shows only the demo documents.
- **Window A:** a normal browser window, signed in as **Alex** (`alex@papertrail.dev`).
- **Window B:** an incognito or private window on the sign-in page (you'll sign in as **Sam** there). Two windows avoid signing out on camera.
- Keep `samples/meeting-notes.md` somewhere easy to drag from.
- **VS Code:** open `ARCHITECTURE.md` (Markdown preview, scrolled to the first diagram), `src/server/access.ts`, and `src/components/editor/use-autosave.ts`.
- Zoom the browser to 110–125% so text is readable in the recording, and close unrelated tabs and notifications.

---

## 1. Opening (0:00–0:20)

**Show:** the sign-in page in Window A, before signing in.

**Say:**
> "Hi, I'm Abdul Raheem. For the Ajaia assessment I built **Papertrail**, a lightweight collaborative document editor. You can write and format documents, import Word or Markdown files, and share them with teammates as viewers or editors. It's deployed on Vercel with a Postgres database. Let me show you how it works, then how it's built."

## 2. Product demonstration (0:20–2:50)

### Login (0:20–0:30)
**Do:** click **Alex Morgan** in the demo account list.
> "There are three seeded demo accounts. They use real server-side sessions, not a mocked user, because sharing only means something if the server knows who's asking."

### Dashboard (0:30–0:50)
**Show:** the dashboard. Point at the sidebar, *My documents*, and *Shared with me*.
> "This is Alex's dashboard. Documents he owns are separate from documents shared with him, and each shared one shows the access level, like this *Can view* badge. Search works across titles, text, and owners."

**Do:** type `design` in search, then clear it.

### Create, format, save, reopen (0:50–1:35)
**Do:** click **New document**. Type the title `Q3 planning`, press Enter, then:
1. Choose **Heading 1** in the text-style menu and type `Goals`.
2. Press Enter and type a sentence; select a word and press **Ctrl/⌘+B**, then **I**, then **U**.
3. Type `- ` to start a bulleted list and add two items.

**Point at** the status in the top right as it changes from *Saving…* to *Saved*.
> "There's no save button. It autosaves about a second after I stop typing, and the status tells me exactly where I am. If the network drops, it says so and keeps retrying, and if I try to close the tab with unsaved work, it warns me."

**Do:** reload the page.
> "After a reload, everything's still here, formatting included. Documents are stored as structured editor JSON, not HTML, and the server validates every save against the editor's schema."

### File import (1:35–2:00)
**Do:** click the back arrow, then **Import a file**, and drag in `meeting-notes.md`.
> "Import supports Word, Markdown, and plain text up to 4 MB. The file becomes a new editable document, and headings, lists, and formatting carry over. Broken or unsupported files get a specific error, and I also guard against compressed 'zip bomb' Word files."

**Show:** the imported document opening.

### Sharing and permissions (2:00–2:50)
**Do (Window A):** go back to the dashboard and open **Q3 planning**. Click **Share**, type `sam@papertrail.dev`, keep **Can view**, and click **Share**. Click **Copy link**.
> "Alex owns this document, so he can share it by email as a viewer or an editor, change roles, or remove access."

**Do (Window B):** sign in as **Sam**, open *Shared with me* and then **Q3 planning**.
> "Sam sees it under *Shared with me*. Because he's a viewer, the editor is read-only: no toolbar, and a banner saying who to ask for edit access."

**Do (Window A):** in Share, change Sam to **Can edit**. **Do (Window B):** reload; the toolbar appears, so type a word.
> "Permission changes apply on Sam's very next request. And this isn't just the UI hiding buttons: every API call is checked on the server."

**Do (Window A):** as Alex, open `<your-url>/documents/research-notes`.
> "This is Sam's private document. Alex gets 'You can't open this document', a 404 with no data, so the URL doesn't even reveal that it exists."

## 3. Technical explanation (2:50–3:45)

**Show:** `ARCHITECTURE.md` preview with the system diagram.
> "It's one **Next.js 16** app in TypeScript, with **Tailwind and shadcn/ui** for the interface and **Tiptap** as the editor. Data lives in **Postgres through Prisma**, on Neon in production. Pages read data with Server Components, writes go through API routes, and both call the same service layer."

**Show:** `src/server/access.ts`, highlighting `requireDocumentRole`.
> "All authorization goes through this one function. Roles are ordered viewer, editor, owner. No access returns a 404 and too low a role returns a 403, and it's checked on every request."

**Show:** `src/components/editor/use-autosave.ts`, scrolled to `perform()`.
> "Autosave sends one request at a time, and each save carries the version it was based on. If someone else saved first, the server returns a conflict instead of overwriting, and the editor lets you load their version or keep yours. I chose that over real-time syncing because it fits the timebox and serverless hosting, and it still guarantees nobody's work is lost silently."

> "For files, imports are converted on the server and validated with the same schema as normal saves. Originals aren't stored, so there's no paid storage dependency."

## 4. AI workflow (3:45–4:15)

**Show:** `AI_WORKFLOW.md`, the phase table.
> "I built this with **GitHub Copilot in agent mode** in VS Code. *(✍️ mention any other tools you used.)* I didn't ask for 'a Google Docs clone'. I worked in phases with a focused brief for each: engineering, then design, then an independent QA pass, then release prep. AI sped up scaffolding, tests, and debugging a lot, but I made the calls. For example, it recommended keeping my first Cloudflare version, and I chose to rewrite on this stack instead."

> "Everything is verified, not assumed: 22 integration tests against a real database, a 108-check API audit that tries to break access control, and browser tests. QA found real bugs, like keystrokes lost after choosing a heading and a zip-bomb risk in Word imports. Each was reproduced, fixed, and re-tested."

## 5. Closing (4:15–4:40)

**Show:** the dashboard.
> "I prioritized three things: access control that can't be bypassed, edits that are never silently lost, and content that's always valid. I deliberately left out real-time co-editing, comments, and version history. With more time, I'd add Playwright end-to-end tests, version history with restore, and then live collaboration with presence. Thanks for watching."

---

### Tips
- If you run long, shorten the technical section to the access-control file and one sentence on autosave.
- Speak to what the viewer sees; don't read the bullet points word for word.
- After recording, paste the link into `WALKTHROUGH_URL.txt` and the Links table in `SUBMISSION.md`.
