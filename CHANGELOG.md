# Changelog

All notable changes to Crew Calendar. Versions follow [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-11-03

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

[1.1.0]: https://github.com/krishna-exe/crew-calendar/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/krishna-exe/crew-calendar/releases/tag/v1.0.0
