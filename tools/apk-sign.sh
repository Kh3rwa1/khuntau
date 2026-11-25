#!/usr/bin/env bash
# Signs the release APK and AAB in <dir> with the Play upload key. Called by .github/workflows/apk.yml, which hands
# the key over from the repository's secrets; the same script signs by hand when a keystore file is at hand.
#
#   KS_B64=<base64 of upload-keystore.jks>  KS_PASS=<its password>  tools/apk-sign.sh out
#
# Reads   <dir>/sohrai-unsigned-aligned.apk, <dir>/sohrai-unsigned.aab, <dir>/apksigner.jar
# Writes  <dir>/sohrai.apk, <dir>/sohrai.aab, <dir>/signed-by.txt   and removes the unsigned files and apksigner.jar
#
# Refuses to sign with a key the site does not list (public/.well-known/assetlinks.json): a build signed with the
# wrong key installs on no phone that has the app and is rejected by Play, and nothing says why until then.
# The keystore only ever exists in a private temp folder that is removed on exit; passwords travel in the
# environment, never on a command line (those are visible to other processes and end up in logs).
# Optional: KEY_PASS (default: KS_PASS; the UPLOAD_KEY_PASSWORD secret), KS_ALIAS (default: upload),
# WANT_SHA256 (default: every fingerprint in assetlinks.json).
set -euo pipefail
die() { echo "::error::$*" >&2; echo "apk-sign: $*" >&2; exit 1; }
dir=${1:?usage: tools/apk-sign.sh <dir with the unsigned build>}
alias=${KS_ALIAS:-upload}
[ -n "${KS_B64:-}" ] || die "KS_B64 is empty (the UPLOAD_KEYSTORE_B64 secret)."
[ -n "${KS_PASS:-}" ] || die "KS_PASS is empty (the UPLOAD_KEYSTORE_PASSWORD secret)."
# a password pasted from a text file often brings its line ending along
KS_PASS=${KS_PASS%$'\n'}; KS_PASS=${KS_PASS%$'\r'}; export KS_PASS
KEY_PASS=${KEY_PASS:-$KS_PASS}; KEY_PASS=${KEY_PASS%$'\n'}; KEY_PASS=${KEY_PASS%$'\r'}; export KEY_PASS
for f in sohrai-unsigned-aligned.apk sohrai-unsigned.aab apksigner.jar; do [ -s "$dir/$f" ] || die "$dir/$f is missing: nothing to sign."; done
unset JAVA_TOOL_OPTIONS # a tool that prints 'Picked up JAVA_TOOL_OPTIONS' into the output read below would break the checks

umask 077; tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT; ks=$tmp/upload.jks
printf '%s' "$KS_B64" | tr -d ' \t\r\n' | base64 -d > "$ks" 2>/dev/null || die "UPLOAD_KEYSTORE_B64 is not valid base64. Make it again from the .jks file and paste all of it."
[ -s "$ks" ] || die "UPLOAD_KEYSTORE_B64 decodes to nothing."

# 1. it opens with the password and holds the key
keytool -list -v -keystore "$ks" -storepass:env KS_PASS -alias "$alias" > "$tmp/cert.txt" 2> "$tmp/err.txt" || {
  if grep -qi "password was incorrect\|keystore was tampered" "$tmp/cert.txt" "$tmp/err.txt"; then die "The keystore does not open with UPLOAD_KEYSTORE_PASSWORD (wrong password, or the file is not the keystore)."; fi
  if grep -qi "does not exist" "$tmp/cert.txt" "$tmp/err.txt"; then die "The keystore has no key named '$alias'."; fi
  if grep -qi "Unrecognized keystore format\|EOFException\|Invalid keystore format\|DerInputStream\|toDerInputStream" "$tmp/cert.txt" "$tmp/err.txt"; then die "UPLOAD_KEYSTORE_B64 does not hold a whole keystore: cut short when pasted, or made from another file. Make it again from the .jks file."; fi
  die "keytool could not read the keystore: $(head -c 300 "$tmp/cert.txt" "$tmp/err.txt" | tr '\n' ' ')"; }
grep -q "PrivateKeyEntry" "$tmp/cert.txt" || die "'$alias' in the keystore is a certificate only, with no private key: it cannot sign."
got=$(sed -n 's/^[[:space:]]*SHA256:[[:space:]]*//p' "$tmp/cert.txt" | head -1 | tr -d ' \r')
[ -n "$got" ] || die "Could not read the certificate's SHA-256 from the keystore."

# 2. it is the key the site lists
if [ -n "${WANT_SHA256:-}" ]; then want=$WANT_SHA256; else want=$(grep -o '[0-9A-Fa-f:]\{95\}' public/.well-known/assetlinks.json | tr 'a-f' 'A-F' | tr '\n' ' '); fi
[ -n "$want" ] || die "No fingerprint to compare with (public/.well-known/assetlinks.json)."
case " $want " in *" $got "*) ;; *) die "Wrong keystore: its certificate is $got, but the site lists $want. Nothing was signed.";; esac
plain=$(printf '%s' "$got" | tr -d ':' | tr 'A-F' 'a-f')

# 3. the APK (schemes v1-v3, for Android 7 and up), checked afterwards
java -jar "$dir/apksigner.jar" sign --ks "$ks" --ks-key-alias "$alias" --ks-pass env:KS_PASS --key-pass env:KEY_PASS --min-sdk-version 24 --v4-signing-enabled false --out "$tmp/sohrai.apk" "$dir/sohrai-unsigned-aligned.apk" > "$tmp/sign.txt" 2>&1 || {
  if grep -qi "Failed to load signer\|Cannot recover key\|UnrecoverableKeyException" "$tmp/sign.txt"; then die "The key inside the keystore has a password of its own: add it as the secret UPLOAD_KEY_PASSWORD."; fi
  die "apksigner failed: $(head -c 400 "$tmp/sign.txt" | tr '\n' ' ')"; }
java -jar "$dir/apksigner.jar" verify --min-sdk-version 24 --print-certs "$tmp/sohrai.apk" > "$tmp/verify.txt" 2>&1 || die "The signed APK does not verify: $(head -c 400 "$tmp/verify.txt" | tr '\n' ' ')"
grep -qi "SHA-256 digest: $plain" "$tmp/verify.txt" || die "The signed APK carries another certificate than the keystore's."

# 4. the AAB (Play takes a jar-signed bundle), checked afterwards
# SHA-256 throughout, as Android's own build does: left alone, jarsigner picks by Java version (SHA-384 from Java 19 on)
case "$(grep -m1 "Public Key Algorithm" "$tmp/cert.txt")" in *RSA*) sig=SHA256withRSA;; *EC*) sig=SHA256withECDSA;; *) sig=;; esac
jarsigner -keystore "$ks" -storepass:env KS_PASS -keypass:env KEY_PASS -digestalg SHA-256 ${sig:+-sigalg $sig} -signedjar "$tmp/sohrai.aab" "$dir/sohrai-unsigned.aab" "$alias" > "$tmp/jar.txt" 2>&1 || die "jarsigner failed: $(head -c 400 "$tmp/jar.txt" | tr '\n' ' ')"
jarsigner -verify "$tmp/sohrai.aab" > "$tmp/jarv.txt" 2>&1 && grep -q "jar verified" "$tmp/jarv.txt" || die "The signed AAB does not verify: $(head -c 400 "$tmp/jarv.txt" | tr '\n' ' ')"

# only now does anything land in <dir>: a failure above leaves the unsigned build as it was
mv "$tmp/sohrai.apk" "$dir/sohrai.apk"; mv "$tmp/sohrai.aab" "$dir/sohrai.aab"; chmod 644 "$dir/sohrai.apk" "$dir/sohrai.aab"
rm -f "$dir/sohrai-unsigned-aligned.apk" "$dir/sohrai-unsigned.aab" "$dir/apksigner.jar"
printf 'signed with the upload key, certificate SHA-256 %s\n' "$got" > "$dir/signed-by.txt"; chmod 644 "$dir/signed-by.txt"
echo "signed: $dir/sohrai.apk ($(stat -c %s "$dir/sohrai.apk") bytes), $dir/sohrai.aab ($(stat -c %s "$dir/sohrai.aab") bytes), certificate $got"
