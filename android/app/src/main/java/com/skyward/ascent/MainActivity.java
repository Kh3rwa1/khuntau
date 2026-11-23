package com.skyward.ascent;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.AssetFileDescriptor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Sohrai, packed. The WebView opens the game's real address, but every file of the game that is inside the APK
 * (assets/www, a copy of public/) is answered from the APK instead of the network. So the game starts with no
 * connection, and because the address is the real one, the leaderboard, rooms and voice (/api, /ws, /turn) work
 * unchanged whenever there is a connection.
 */
public class MainActivity extends Activity {
    static final String HOST = "khuntau.dulalkisku0.workers.dev";
    static final String START = "https://" + HOST + "/?src=app";
    static final String TAG = "SohraiJS";
    static final int MIC = 7;

    WebView web;
    PermissionRequest pendingMic;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        web = new WebView(this);
        web.setBackgroundColor(0xFF2A140C);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportMultipleWindows(false);
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " SohraiApp/1");

        web.addJavascriptInterface(new Bridge(), "SohraiApp");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());

        if (state != null && web.restoreState(state) != null) return;
        Uri link = getIntent() == null ? null : getIntent().getData();
        web.loadUrl(link != null && HOST.equals(link.getHost()) ? link.toString() : START);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        Uri link = intent.getData();
        if (link != null && HOST.equals(link.getHost())) web.loadUrl(link.toString());
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onWindowFocusChanged(boolean has) {
        super.onWindowFocusChanged(has);
        if (has) immersive();
    }

    @SuppressWarnings("deprecation")
    void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }

    /** Back never throws the round away: it puts the game in the background. */
    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        moveTaskToBack(true);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (code != MIC || pendingMic == null) return;
        PermissionRequest r = pendingMic;
        pendingMic = null;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED)
            r.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        else r.deny();
    }

    /** What the page can ask the app to do. */
    class Bridge {
        @JavascriptInterface
        public void share(final String text) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
                startActivity(Intent.createChooser(i, "Share"));
            });
        }
    }

    class Chrome extends WebChromeClient {
        @Override
        public boolean onConsoleMessage(ConsoleMessage m) {
            Log.i(TAG, m.messageLevel() + " " + m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
            return true;
        }

        /** Voice chat: the page asks for the microphone, Android asks the player once. */
        @Override
        public void onPermissionRequest(PermissionRequest request) {
            boolean audio = false;
            for (String r : request.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) audio = true;
            Uri from = request.getOrigin();
            if (!audio || from == null || !HOST.equals(from.getHost())) { request.deny(); return; }
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            } else {
                if (pendingMic != null) pendingMic.deny();
                pendingMic = request;
                requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MIC);
            }
        }
    }

    class Client extends WebViewClient {
        /** Anything that is not the game (a WhatsApp share link, a credit link) opens outside the app. */
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (HOST.equals(u.getHost())) return false;
            try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { Log.w(TAG, "no app for " + u); }
            return true;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (!HOST.equals(u.getHost()) || !"GET".equalsIgnoreCase(request.getMethod())) return null;
            String path = u.getPath();
            if (path == null || path.isEmpty() || path.equals("/")) path = "/index.html";
            if (path.startsWith("/api/") || path.startsWith("/ws/") || path.equals("/turn") || path.contains("..")) return null;
            // The files are already here, so the browser's own offline cache would only store them twice.
            if (path.equals("/sw.js")) return reply("text/plain", "utf-8", 404, "Not Found", new ByteArrayInputStream(new byte[0]), null);
            String asset = "www" + path;
            String range = request.getRequestHeaders() == null ? null : request.getRequestHeaders().get("Range");
            try {
                if (range != null) {
                    WebResourceResponse part = ranged(asset, range);
                    if (part != null) return part;
                }
                return reply(mime(asset), charset(asset), 200, "OK", open(asset), null);
            } catch (IOException e) {
                return null; // not packed: let the network answer
            }
        }
    }

    InputStream open(String asset) throws IOException {
        try {
            return getAssets().open(asset);
        } catch (IOException e) {
            if (asset.lastIndexOf('.') > asset.lastIndexOf('/')) throw e;
            return getAssets().open(asset + ".html"); // /privacy -> privacy.html, as the site does
        }
    }

    /** Music is asked for in pieces ("Range: bytes=a-b"); answer with that piece so it can loop and seek. */
    WebResourceResponse ranged(String asset, String range) {
        try {
            if (!range.startsWith("bytes=")) return null;
            String[] ab = range.substring(6).split("-", 2);
            if (ab[0].isEmpty()) return null;
            AssetFileDescriptor fd = getAssets().openFd(asset); // only works for files stored uncompressed
            long total = fd.getLength(), a = Long.parseLong(ab[0].trim());
            long b = ab.length > 1 && !ab[1].trim().isEmpty() ? Math.min(Long.parseLong(ab[1].trim()), total - 1) : total - 1;
            if (a < 0 || a > b) { fd.close(); return null; }
            InputStream in = fd.createInputStream();
            long skipped = 0;
            while (skipped < a) {
                long n = in.skip(a - skipped);
                if (n <= 0) break;
                skipped += n;
            }
            Map<String, String> h = new HashMap<>();
            h.put("Content-Range", "bytes " + a + "-" + b + "/" + total);
            h.put("Content-Length", String.valueOf(b - a + 1));
            return reply(mime(asset), null, 206, "Partial Content", new Limited(in, b - a + 1), h);
        } catch (Exception e) {
            return null;
        }
    }

    static WebResourceResponse reply(String mime, String enc, int status, String reason, InputStream body, Map<String, String> extra) {
        Map<String, String> h = new HashMap<>();
        h.put("Cache-Control", "no-cache");
        h.put("Accept-Ranges", "bytes");
        h.put("Access-Control-Allow-Origin", "*");
        if (extra != null) h.putAll(extra);
        return new WebResourceResponse(mime, enc, status, reason, h, body);
    }

    static String charset(String p) {
        String m = mime(p);
        return m.startsWith("text/") || m.contains("json") || m.contains("javascript") || m.contains("xml") ? "utf-8" : null;
    }

    static String mime(String p) {
        int dot = p.lastIndexOf('.');
        String e = dot < 0 || dot < p.lastIndexOf('/') ? "html" : p.substring(dot + 1).toLowerCase();
        switch (e) {
            case "html": return "text/html";
            case "js": case "mjs": return "text/javascript";
            case "css": return "text/css";
            case "json": return "application/json";
            case "webmanifest": return "application/manifest+json";
            case "png": return "image/png";
            case "jpg": case "jpeg": return "image/jpeg";
            case "webp": return "image/webp";
            case "svg": return "image/svg+xml";
            case "ico": return "image/x-icon";
            case "mp3": return "audio/mpeg";
            case "ogg": return "audio/ogg";
            case "wav": return "audio/wav";
            case "woff2": return "font/woff2";
            case "woff": return "font/woff";
            case "ttf": return "font/ttf";
            case "wasm": return "application/wasm";
            case "txt": return "text/plain";
            default: return "application/octet-stream";
        }
    }

    /** At most n bytes of a stream. */
    static class Limited extends FilterInputStream {
        long left;

        Limited(InputStream in, long n) { super(in); left = n; }

        @Override
        public int read() throws IOException {
            if (left <= 0) return -1;
            int c = super.read();
            if (c >= 0) left--;
            return c;
        }

        @Override
        public int read(byte[] buf, int off, int len) throws IOException {
            if (left <= 0) return -1;
            int n = super.read(buf, off, (int) Math.min(len, left));
            if (n > 0) left -= n;
            return n;
        }

        @Override
        public int available() throws IOException {
            return (int) Math.min(super.available(), left);
        }
    }
}
