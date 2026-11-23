# Store publishing

Optional. Today Android ships as a sideloaded APK and iPhone through TestFlight, and both get JS changes over the air (`docs/technical-decisions.md`, "Over-the-air updates"). These are the steps if the app should go through Google Play or the App Store. **[Owner]** marks what only the account owner can click; the rest is a command run from `app/`.

Both stores build on EAS, which never sees the git-ignored `app/.env`. Before the first store build, put the two public Supabase values in the EAS `production` environment once: `npx eas-cli@latest env:create --environment production --visibility plaintext --name EXPO_PUBLIC_SUPABASE_URL --value <url>` and the same for `EXPO_PUBLIC_SUPABASE_ANON_KEY` (run by the owner, values from `app/.env`). Store builds use the `production` profile, so they get channel `production` and receive the same over-the-air updates.

## Google Play

1. **[Owner]** Create a Google Play developer account at play.google.com/console (one-off fee, identity check). For two people, the **internal testing** track (up to 100 testers, no review wait) is enough; a new personal account needs a closed test with testers for some days before it may publish to production, so do not plan on production.
2. **[Owner]** In Play Console: **Create app**, name "Home Setup", app, free. Package `app.homesetup.household` is fixed by the first upload.
3. Build an app bundle on EAS: `npx eas-cli@latest build --platform android --profile production`. The first run asks to generate an Android keystore: let EAS create and keep it. It becomes the **upload key**.
4. **[Owner]** Play App Signing: accept the default (Google keeps the app signing key) when the first bundle is uploaded. Note: Play-installed apps are signed by Google's key, the sideloaded APK by the local key in `~/.android-keys`, so one cannot update the other; switching a phone to the Play version means uninstalling the APK once (local data is reloaded from Supabase, unsent changes are lost, so sync first).
5. **[Owner]** Service account for `eas submit`: in Google Cloud create a service account with a JSON key (guide: https://expo.fyi/creating-google-service-account), then in Play Console **Users and permissions** invite its email with release rights for this app. Upload the JSON in the Expo dashboard: project, **Credentials**, Android, `app.homesetup.household`, **Service credentials**, **Add a Google service account key**. Never commit the JSON.
6. Submit: `npx eas-cli@latest submit --platform android --profile production --latest`. The first submission lands on the internal testing track as a draft.
7. **[Owner]** In Play Console finish the setup tasks the dashboard lists (store listing, content rating, data safety, privacy policy URL, target audience), add the two testers' Google accounts to **Internal testing**, roll out the release, and send them the opt-in link.
8. Later releases: native changes need steps 3 and 6 again (`autoIncrement` bumps the version code); JS-only changes go out with `eas update` and need neither.

## Apple App Store and TestFlight

Needs the paid Apple Developer membership (pending).

1. **[Owner]** Once the membership is active, sign in to App Store Connect, **Apps**, **+**, **New App**: iOS, name "Home Setup", bundle id `app.homesetup.household` (EAS registers it, and the widget extension `app.homesetup.household.ExpoWidgetsTarget` and app group, on the first build if it is not listed yet; then create the record), SKU of choice.
2. Export compliance is already declared: `ios.infoPlist.ITSAppUsesNonExemptEncryption: false` in `app.json`, so TestFlight does not ask per build.
3. Build on EAS: `npx eas-cli@latest build --platform ios --profile production`. **[Owner]** The first run asks for the Apple ID login and 2FA so EAS can create the certificates and provisioning profiles; let EAS manage them.
4. Submit: `npx eas-cli@latest submit --platform ios --profile production --latest`. **[Owner]** It asks for the Apple ID (or an App Store Connect API key) the first time. Optional: put the app's numeric Apple ID as `submit.production.ios.ascAppId` in `eas.json` so later submits do not ask.
5. **[Owner]** In App Store Connect, **TestFlight**: after processing (about 10 to 15 minutes) add both people as internal testers (they need App Store Connect users) or an external group (needs a short beta review). Testers install through the TestFlight app.
6. **[Owner]** App Store release, if ever wanted: fill in the listing, privacy details and screenshots, pick the build, **Submit for Review**.
7. Later releases: native changes need steps 3 and 4 again; JS-only changes go out with `eas update`.
