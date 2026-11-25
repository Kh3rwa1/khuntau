#!/bin/sh
# Runs on CI's Android 16 emulator (API 36, the level the app targets since 25 Nov because Google Play asks for it):
# the release build (signed with the rehearsal's throwaway key), network cut BEFORE the first launch. Home screen,
# PLAY, then back: it must pause the game, not close it. An app that targets API 36 no longer gets onBackPressed()
# on such a phone; MainActivity.Back33 takes the gesture instead, and this is where that is seen to work.
set -x
mkdir -p out
adb shell settings put global hide_error_dialogs 1
adb shell settings put secure immersive_mode_confirmations confirmed
adb shell input keyevent KEYCODE_WAKEUP
APK=/tmp/rehearsal/sohrai.apk; [ -f "$APK" ] || APK=android/app/build/outputs/apk/debug/app-debug.apk
echo "installed: $APK" > out/a16-install.txt
adb install -r "$APK" >> out/a16-install.txt 2>&1
adb shell cmd connectivity airplane-mode enable
sleep 5
adb logcat -c
adb shell am start -W -n com.skyward.ascent/.MainActivity
sleep 95
adb exec-out screencap -p > out/6-android16-offline-home.png
adb shell input tap 540 765
sleep 75
adb exec-out screencap -p > out/7-android16-after-play.png
adb shell input keyevent KEYCODE_BACK
sleep 6
adb exec-out screencap -p > out/8-android16-back-pauses.png
adb shell dumpsys activity activities | grep -m1 -i "ResumedActivity" > out/a16-resumed.txt || true
echo "emulator API level: $(adb shell getprop ro.build.version.sdk)" >> out/a16-install.txt
adb shell dumpsys package com.skyward.ascent | grep -i -m3 "versionCode\|versionName\|targetSdk" >> out/a16-install.txt || true
adb logcat -d -s SohraiJS:V AndroidRuntime:E > out/logcat-a16.txt
cat out/a16-install.txt out/a16-resumed.txt
exit 0
