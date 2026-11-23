# Sohrai on the Play Store (TWA)

The Android app is the website in a Trusted Web Activity, built with Bubblewrap.
Package name: **com.skyward.ascent** (an existing Play listing whose old upload key was lost; Dulor, 23 Nov).

## The signing key (made 23 Nov)
- `upload-keystore.jks` (alias `upload`) is the new **upload key**. Claude generated it in the cloud session and
  handed it to Dulor together with `KEYSTORE-PASSWORD.txt`. It is **not in git** (`*.jks` is ignored) and must
  never be. Keep both in a password manager and a second backup: losing it means another reset.
- `upload_certificate.pem` is the public certificate of that key. It is safe to share.
  SHA-256: `49:2F:38:CE:FE:EE:4B:24:23:42:BF:B7:E7:2A:1F:B7:D6:06:B8:CE:69:A4:A9:34:C3:1C:0F:94:82:D8:42:B1`

## 1. Ask Google to accept the new upload key
Play Console > the app > Test and release > Setup > App signing > "Request upload key reset" (if the button is not
there, use the upload key reset form in Play Console Help). Choose "I lost my upload key", attach
`upload_certificate.pem`. Google emails when the new key becomes valid (it can take a day or two). This only
works when Play App Signing is on for the app; if it is not, the lost key cannot be replaced and the app needs
a new package name.

## 2. Build (on your own computer; the cloud session cannot download the Android SDK)
```
npm i -g @bubblewrap/cli
cd twa
cp /path/to/upload-keystore.jks .        # the file Claude gave you
bubblewrap build                          # asks for the keystore password (in KEYSTORE-PASSWORD.txt)
```
Before building, set `appVersionCode` in `twa-manifest.json` to a number **higher than the last version code
already on Play** for com.skyward.ascent (Play Console > App bundle explorer shows it), and `appVersionName`
to match. Play refuses an upload with a version code it has already seen.

## 3. Link the app to the site (removes the browser bar)
`public/.well-known/assetlinks.json` already lists com.skyward.ascent with the upload key's fingerprint, which is
enough for a build installed straight from your computer. For the Play version, add the **app signing key**
SHA-256 from Play Console > Setup > App signing to the same list (Play re-signs the app with that key), then
merge and deploy. Check `https://khuntau.dulalkisku0.workers.dev/.well-known/assetlinks.json` loads.

## 4. Upload
Play Console > com.skyward.ascent > create a release > upload `app-release-bundle.aab`.
The store listing (name, description, screenshots, category) currently describes the old app: replace it with
Sohrai's. A big change of what an app is can draw a Play review; describe the app honestly.
Data safety form: the game collects no personal data; it stores a random player id, a chosen display name and
village, and anonymous step counts.

## Store listing
Text, graphics list and the App content answers (ads, rating, data safety): `twa/store-listing.md`. Privacy policy: `public/privacy.html`.

To push the listing text and images through the Play API instead of pasting: `PLAY_SERVICE_ACCOUNT_JSON=... node tools/play-listing.mjs` (`DRY=1` checks without sending). The key lives in the environment, never in git.
