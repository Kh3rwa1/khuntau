#!/bin/sh
# Runs on CI's Android emulator: installs the app, cuts the network BEFORE the first launch, opens the game and
# taps PLAY. Screenshots and the page's console go to out/ for a human (or Claude) to look at.
set -x
mkdir -p out
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell cmd connectivity airplane-mode enable
sleep 5
adb shell dumpsys connectivity | grep -c "NetworkAgentInfo" > out/networks-while-offline.txt || true
adb logcat -c
adb shell am start -W -n com.skyward.ascent/.MainActivity
sleep 8
adb exec-out screencap -p > out/0-offline-launch.png
sleep 80
adb exec-out screencap -p > out/1-offline-home.png
adb shell input tap 540 720
sleep 60
adb exec-out screencap -p > out/2-offline-after-play.png
adb logcat -d -s SohraiJS:V AndroidRuntime:E > out/logcat.txt
adb shell dumpsys webviewupdate | grep -i "current webview package" > out/webview.txt || true
wc -l out/logcat.txt
exit 0
