# Crew Calendar

A website where friends make rooms for a daily habit, invite each other with a link,
and check in every day. Each room has a shared calendar, notes, personal streaks, and
a whole-crew streak (days turn yellow when everyone did it).

Built with Vite + React, and Supabase for sign-in (email magic links), the database and live updates.

## 1. Create the Supabase project (free tier is fine)

1. Go to <https://supabase.com>, create a project.
2. **SQL Editor → New query**: paste all of `supabase/schema.sql` and click **Run**.
3. **Project Settings → API**: copy the *Project URL* and the *anon public* key.
4. **Authentication → URL Configuration**:
   - *Site URL*: `http://localhost:5173` for now (change to your real URL after deploying).
   - *Redirect URLs*: add `http://localhost:5173/**` and later `https://your-site.vercel.app/**`.

## 2. Run it locally

```bash
cp .env.example .env.local   # then paste your URL and anon key into it
npm install
npm run dev                   # http://localhost:5173
```

## 3. Put it online (Vercel)

1. Push this folder to a GitHub repo.
2. On <https://vercel.com> → **Add New → Project** → import the repo (it detects Vite).
3. Add the two env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then deploy.
4. Back in Supabase **URL Configuration**, set *Site URL* to your Vercel URL and add it to *Redirect URLs*.

Netlify or Cloudflare Pages work the same way: build command `npm run build`, output folder `dist`.

## How it works

- **Sign in**: email magic link, no passwords. Your name defaults to the part of your email before the `@`; click it in the top bar to change it.
- **Rooms**: anyone signed in can create a room and becomes its owner. Owners can rename the room, reset the invite link, remove members, and delete the room.
- **Invites**: each room has a link like `https://your-site/#/join/ab12cd34ef`. Opening it asks the friend to sign in, shows the room, and lets them join. Resetting the link kills the old one.
- **Privacy**: row-level security in Postgres means you only see rooms you're in, the people in them, and their check-ins. You can only add or remove your own check-ins, and not for future days.

## Notes

- Supabase's built-in email sender is rate-limited (a few emails per hour) and meant for testing. For more than a handful of friends, set up custom SMTP under **Authentication → Emails** (Resend, Postmark, etc.).
- Free Supabase projects pause after a week with no activity; open the dashboard to wake it up.
