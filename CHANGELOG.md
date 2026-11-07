# Changelog

All notable changes to Crew Calendar. Versions follow [Semantic Versioning](https://semver.org/).

## [1.3.0] - 2026-11-07

### Added
- **Reactions**: tap 🔥 👏 💪 or 🎉 on a friend's check-in. They update live for everyone in the room.
- **Rest days**: room owners can pick weekdays that don't break anyone's streak. They're marked on the calendar, and also apply to past days.
- **Daily reminders**: choose a time on the home page, and each device gets one notification a day if a room is still waiting. It skips rest days and never shows room names. Works in Android and computer browsers, but not in iPhone browsers.

### Changed
- Room code split into focused files, with unit tests for streaks and reactions.

### Upgrade notes
- Run the files in `supabase/migrations` in order, then see the Reminders section of the README.

## [1.2.0] - 2026-11-07

### Added
- **Check in from the home page.** Each room card shows how many people have checked in today, with a one-tap Check in button.
- **Streak reminder**: if you haven't checked in today, the day sheet shows the streak you'd keep.
- **Nudge the crew**: share or copy a message naming who hasn't checked in today.
- **Streak milestones**: a small celebration at 7, 14, 30, 50, 100, 200 and 365 days.
- Home-screen icon for adding the site to your phone.
- **Progress bar on the day sheet**, such as "1 of 4 checked in", which turns yellow when the whole crew is done.
- **Share button** next to the invite link, on devices that support sharing.
- Link previews: a title and description when the site's link is shared in chat apps.

### Changed
- On desktop, invite, settings and members now sit under the calendar instead of in a long side column.
- You're listed first on the day sheet.
- Saving a note now confirms with "Saved".
- Future days are quieter on the calendar, and you can't page past the current month.
- On phones, tapping a day brings its sheet into view, and a bottom bar keeps today's check-in within reach.

### Fixed
- Coming back to the tab now refreshes check-ins, and moves on to the new day if the page was left open overnight.
- Failed renames, invite resets, removals and deletes now show an error instead of failing silently.
- Tapping the check-in button twice quickly no longer causes a false error.


### Added
- **Custom check-in button per room.** Room owners can set the button text under
  **Room settings → Check-in button** (up to 40 characters, e.g. "Stayed strong").
  Everyone in the room sees it straight away.
- Database: new `rooms.checkin_label` column (text, default empty, max 40 chars).

### Changed
- The check-in button now reads **Check in** by default, instead of "I did it today" / "I did it this day".
  Once checked in it shows **✓ Checked in · tap to undo**, or **✓ \<custom text\> · tap to undo**.
- Calendar legend now says **Whole crew checked in** and **You checked in**.
- Sign-in page wording updated to match.

### Upgrade notes
- Existing rooms keep working with the default **Check in** button until an owner sets custom text.
- Self-hosting: run this once in the Supabase SQL Editor (already included in `supabase/schema.sql` for new setups):
  ```sql
  alter table public.rooms add column if not exists checkin_label text not null default ''
    check (char_length(checkin_label) <= 40);
  ```

## [1.0.0] - 2026-10-30

First release.

### Added
- Email sign-in with magic links (no passwords), with editable display names.
- **Rooms**: create a room per habit, and see all your rooms on the home page.
- **Invite links**: share a link to let friends sign in and join. Owners can reset the link to stop the old one working.
- **Shared calendar**: tap any past day or today to check in, with an optional note. Avatars show who checked in each day.
- **Streaks**: current streak, best streak and monthly count for each person, plus a whole-crew streak.
  A day turns yellow when everyone who had joined by then checked in.
- **Live updates**: check-ins, new members and room renames appear without a refresh.
- **Owner controls**: rename the room, remove members, and delete the room. Members can leave.
- **Privacy**: Postgres row-level security means you only see rooms you're in, and you can only change your own check-ins (never future days).
- Light and dark themes, and a phone-friendly layout.
- `npm run demo` mode with sample data, which needs no Supabase project.

[1.3.0]: https://github.com/krishna-exe/crew-calendar/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/krishna-exe/crew-calendar/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/krishna-exe/crew-calendar/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/krishna-exe/crew-calendar/releases/tag/v1.0.0
