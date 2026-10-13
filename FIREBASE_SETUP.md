# Sharing your stats with Firebase

How it works: you keep importing logs the way you do now (in **admin view**). Click **Publish to shared database** and your games + alias/hidden settings are copied to Firestore. Everyone else who opens the site sees a **read-only shared view** of that data (search, sort by any column, click Details) - they can't change anything.

- Shared view (everyone): `https://katzklaw.github.io/AmongUs-stat-tracker/`
- Admin view (you): `https://katzklaw.github.io/AmongUs-stat-tracker/?admin` (bookmark this)

Until you fill in the config below, the site behaves exactly as before (local only).

## 1. Use your existing Firebase project (or make one)
Reusing your score-sheet project is fine - this app uses its own collections (`amongus_games`, `amongus_meta`) so nothing collides.

## 2. Paste the web config
Firebase console -> Project settings -> General -> Your apps -> Web app -> Config.
Copy the values into `firebase-config.js`. (This config is public by design; the rules below are what protect your data.)

## 3. Turn on Firestore and Google sign-in
- Build -> Firestore Database -> create it if you don't have one.
- Build -> Authentication -> Sign-in method -> enable **Google**.
- Authentication -> Settings -> Authorized domains -> make sure `katzklaw.github.io` is listed.

## 4. Add these rules (merge them - don't replace your score-sheet rules!)
Firestore -> Rules. Rules are one file per project, so ADD this block inside your existing `match /databases/{database}/documents { ... }` and keep whatever your score sheets already use:

```
    match /amongus_games/{doc} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.token.email == "katzklaw@gmail.com"
                   && request.auth.token.email_verified == true;
    }
    match /amongus_meta/{doc} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.token.email == "katzklaw@gmail.com"
                   && request.auth.token.email_verified == true;
    }
```
Publish the rules. Anyone can read; only your Google account can write.

## 5. Publish
Open the site with `?admin`, click **Sign in to publish**, then **Publish to shared database**. Re-publish whenever you add games or change aliases/hidden players.

**Load from shared database** pulls the published copy into this browser (useful on a second computer).

## Notes
- Hidden players, aliases and the 1-game auto-hide are applied in the shared view too, using the settings you published.
- Reads are cheap: ~700 games is roughly 10-20 documents per visitor load.
- The shared view shows when it was last updated.
