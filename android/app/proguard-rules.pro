# Release builds are shrunk and obfuscated by R8 (25 Nov). The game page calls these by name through
# window.SohraiApp (ready, info, share, ...): keep every @JavascriptInterface method exactly as it is.
-keep class com.skyward.ascent.MainActivity$Bridge { @android.webkit.JavascriptInterface <methods>; }
-keepattributes JavascriptInterface,*Annotation*
# Readable crash reports: Play de-obfuscates them with the mapping file R8 packs into the bundle.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
