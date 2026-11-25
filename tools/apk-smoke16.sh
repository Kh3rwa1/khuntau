#!/bin/sh
# Runs on CI's Android 16 emulator (API 36, the level the app targets since 25 Nov because Google Play asks for it):
# the release build (signed with the rehearsal's throwaway key), network cut BEFORE the first launch. Home screen,
# the album opened, then back: it must close the album and stay in the game. An app that targets API 36 no longer
# gets onBackPressed() on such a phone; MainActivity.Back33 takes the gesture instead, and this is where that is seen.
# Not PLAY: on this emulator the 3D village killed the emulator itself a minute after the tap (run 33), and the
# script then waited for a device that was gone until the whole build was cancelled. So every adb call has a time
# limit, and back inside a round is proven on the Android 14 emulator (tools/apk-smoke.sh), which takes the same path
# (android:enableOnBackInvokedCallback is on).
set -x
mkdir -p out
A() { timeout 60 adb "$@"; }
A shell settings put global hide_error_dialogs 1
A shell settings put secure immersive_mode_confirmations confirmed
A shell input keyevent KEYCODE_WAKEUP
APK=/tmp/rehearsal/sohrai.apk; [ -f "$APK" ] || APK=android/app/build/outputs/apk/debug/app-debug.apk
echo "installed: $APK" > out/a16-install.txt
timeout 120 adb install -r "$APK" >> out/a16-install.txt 2>&1
A shell cmd connectivity airplane-mode enable
sleep 5
A logcat -c
A shell am start -W -n com.skyward.ascent/.MainActivity
sleep 95
A exec-out screencap -p > out/6-android16-offline-home.png
echo "emulator API level: $(A shell getprop ro.build.version.sdk)" >> out/a16-install.txt
A shell dumpsys package com.skyward.ascent | grep -i -m3 "versionCode\|versionName\|targetSdk" >> out/a16-install.txt || true
# the album row, found by its words in what the screen exposes (its place differs from phone to phone)
A shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1; sleep 3
A shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1
A exec-out cat /sdcard/ui.xml > out/a16-ui.xml 2> /dev/null
cat > /tmp/a16-find.py <<'PY'
import re
try: s = open('out/a16-ui.xml', encoding='utf-8', errors='ignore').read()
except Exception: s = ''
m = re.search(r'<node[^>]*(?:text|content-desc)="Album[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', s)
print('%d %d' % ((int(m.group(1)) + int(m.group(3))) // 2, (int(m.group(2)) + int(m.group(4))) // 2) if m else '')
PY
XY=$(python3 /tmp/a16-find.py)
if [ -n "$XY" ]; then
  echo "album row found at $XY" >> out/a16-install.txt
  A shell input tap $XY
  sleep 6
  A exec-out screencap -p > out/7-android16-album-open.png
  A shell input keyevent KEYCODE_BACK
  sleep 5
  A exec-out screencap -p > out/8-android16-back-closes-album.png
else
  echo "album row not found in the screen dump: back was pressed on the home screen only" >> out/a16-install.txt
  A shell input keyevent KEYCODE_BACK
  sleep 5
  A exec-out screencap -p > out/8-android16-back-on-home.png
fi
A shell dumpsys activity activities | grep -m1 -i "ResumedActivity" > out/a16-resumed.txt || true
A logcat -d -s SohraiJS:V AndroidRuntime:E > out/logcat-a16.txt
if grep -q 'bridge: ready' out/logcat-a16.txt; then echo 'bridge: ok in the release build' >> out/a16-install.txt; else echo 'bridge: NOT SEEN in the release build' >> out/a16-install.txt; fi
cat out/a16-install.txt out/a16-resumed.txt
exit 0
