#!/bin/sh
# Runs on CI's Android emulator: installs the app, cuts the network BEFORE the first launch, opens the game and
# taps PLAY. Screenshots and the page's console go to out/ for a human (or Claude) to look at.
set -x
mkdir -p out
adb shell settings put global hide_error_dialogs 1
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
adb shell dumpsys webviewupdate | grep -i "current webview package" > out/webview.txt || true
wc -l out/logcat.txt
exit 0
