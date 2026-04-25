# Supabase Setup

## First-time setup

1. Create a Supabase project at https://supabase.com
2. Link the project:
   ```
   supabase link --project-ref <your-project-ref>
   ```
3. Push the schema migrations:
   ```
   supabase db push
   ```
4. **Important:** Seed the initial Season 1 row (`db push` does NOT run `seed.sql`).
   Run this in the **Supabase SQL Editor** (Dashboard → SQL Editor → New query):
   ```sql
   INSERT INTO seasons (number, status, money_goal, total_money_earned, started_at)
   VALUES (1, 'active', 500000, 0, now())
   ON CONFLICT (number) DO NOTHING;
   ```
5. Deploy the Edge Function:
   ```
   supabase functions deploy submit-session
   ```
6. Copy the project URL and anon key from your Supabase dashboard.
   Add to ChatsKitchen's `.env.local`:
   ```
   VITE_SUBMIT_SESSION_URL=https://<project-ref>.supabase.co/functions/v1/submit-session
   ```
   Add to chatskitchen-stats' `.env.local`:
   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```

## Season management

- The active season goal is stored in `seasons.money_goal` and can be edited directly in the Supabase Table Editor.
- A new season is created automatically when the goal is reached.
- To manually end a season, update `status` to `'ended'` and insert a new season row.
