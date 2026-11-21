# Khuntau on the Play Store (TWA)

The Android app is the website in a Trusted Web Activity, built with Bubblewrap. Everything here is ready
except the parts tied to Dulor's Google Play account and signing key.

## What Dulor needs first
- A Google Play developer account. Personal accounts created after Nov 2023 must run a **closed test with
  at least 12 testers for 14 days** before production; organisation accounts skip that. Tell Claude which type
  and when it was created, so the plan matches.

## Build (on the Mac, once)
```
npm i -g @bubblewrap/cli
cd twa
bubblewrap build          # uses twa-manifest.json; first run asks to create khuntau-upload.keystore
```
Keep `khuntau-upload.keystore` and its passwords safe and **out of git** (it is ignored). Losing it means a
new app listing.

## Link the app to the site (removes the browser bar)
1. `keytool -list -v -keystore khuntau-upload.keystore -alias khuntau` and copy the SHA-256 fingerprint.
   If Play App Signing is on, also copy the **app signing** SHA-256 from Play Console > Setup > App signing.
2. Create `public/.well-known/assetlinks.json` with those fingerprints (`bubblewrap fingerprint add <sha256>`
   then `bubblewrap fingerprint generateAssetLinks` writes it), commit, and deploy. Check
   `https://khuntau.dulalkisku0.workers.dev/.well-known/assetlinks.json` loads.
Do not publish assetlinks.json with a placeholder fingerprint: a wrong one is worse than none.

## Upload
Play Console > create app `com.tumdah.khuntau` > upload `app-release-bundle.aab`.
