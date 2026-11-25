#!/bin/sh
# Runs on CI's Android emulator: installs the app, cuts the network BEFORE the first launch, opens the game and
# taps PLAY. Screenshots and the page's console go to out/ for a human (or Claude) to look at.
set -x
mkdir -p out
adb shell settings put global hide_error_dialogs 1
adb shell settings put secure immersive_mode_confirmations confirmed
adb shell input keyevent KEYCODE_WAKEUP
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell cmd connectivity airplane-mode enable
sleep 5
adb shell dumpsys connectivity | grep -c "NetworkAgentInfo" > out/networks-while-offline.txt || true
adb logcat -c
adb shell am start -W -n com.skyward.ascent/.MainActivity
sleep 4
adb exec-out screencap -p > out/0-offline-launch.png
sleep 85
adb exec-out screencap -p > out/1-offline-home.png
adb shell input tap 540 765
sleep 70
adb exec-out screencap -p > out/2-offline-after-play.png
adb shell input keyevent KEYCODE_BACK
sleep 6
adb exec-out screencap -p > out/3-offline-back-pauses.png
adb shell dumpsys activity activities | grep -m1 -i "ResumedActivity" > out/resumed.txt || true
adb logcat -d -s SohraiJS:V AndroidRuntime:E > out/logcat.txt

# Over-the-air update, end to end. Serve a changed copy of the game from this machine (the emulator reaches it at
# 10.0.2.2), let the app download it online, then cut the network and relaunch: the changed tagline must be on screen.
adb shell cmd connectivity airplane-mode disable
sleep 12
rm -rf /tmp/ota && mkdir -p /tmp/ota && cp -r public/. /tmp/ota/
sed -i 's/Snatch the pitha. Dodge the bull./Over the air update applied/' /tmp/ota/index.html
node tools/files-manifest.mjs /tmp/ota
(cd /tmp/ota && python3 -m http.server 8799 > /tmp/ota-server.log 2>&1 &)
sleep 2
adb shell am force-stop com.skyward.ascent
adb logcat -c
adb shell am start -W -n com.skyward.ascent/.MainActivity --es ota http://10.0.2.2:8799
sleep 75
adb logcat -d -s SohraiJS:V AndroidRuntime:E > out/logcat-ota-1-download.txt
adb shell am force-stop com.skyward.ascent
adb shell cmd connectivity airplane-mode enable
sleep 5
adb logcat -c
adb shell am start -W -n com.skyward.ascent/.MainActivity
sleep 90
adb exec-out screencap -p > out/4-ota-applied-offline.png
adb logcat -d -s SohraiJS:V AndroidRuntime:E > out/logcat-ota-2-applied.txt
adb logcat -d --pid=$(adb shell pidof com.skyward.ascent) | tail -n 300 > out/logcat-ota-2-full.txt || true
adb shell run-as com.skyward.ascent ls -laR files/ota > out/ota-files.txt 2>&1 || true
cat out/logcat-ota-1-download.txt out/logcat-ota-2-applied.txt
adb shell dumpsys webviewupdate | grep -i "current webview package" > out/webview.txt || true
wc -l out/logcat.txt

# Everything above runs the debug build. The release build, the one that is signed and shipped, had only ever been
# built, never started. The workflow's signing rehearsal has put it through tools/apk-sign.sh with a throwaway key:
# install that in place of the debug app and open it with the network still off. (The real key's signature is
# checked where it is made, by apksigner verify in tools/apk-sign.sh; a throwaway-signed copy differs in nothing else.)
if [ -f /tmp/rehearsal/sohrai.apk ]; then
  adb uninstall com.skyward.ascent
  adb install /tmp/rehearsal/sohrai.apk > out/release-install.txt 2>&1
  adb logcat -c
  adb shell am start -W -n com.skyward.ascent/.MainActivity
  sleep 90
  adb exec-out screencap -p > out/5-release-build-offline-home.png
  adb logcat -d -s SohraiJS:V AndroidRuntime:E > out/logcat-release.txt
  # the release build is shrunk by R8: the page must still reach the app through window.SohraiApp
  if grep -q 'bridge: ready' out/logcat-release.txt; then echo 'bridge: ok in the release build' >> out/release-install.txt; else echo 'bridge: NOT SEEN in the release build' >> out/release-install.txt; fi
  adb shell dumpsys package com.skyward.ascent | grep -i -m2 "versionCode\|versionName" >> out/release-install.txt || true
  cat out/release-install.txt
fi
exit 0
