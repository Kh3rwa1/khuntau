package com.skyward.ascent;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Over-the-air game updates. The site publishes files.json: every game file with its SHA-256, and "v", a short hash
 * of the list. The app holds the same list for the files packed inside it.
 *
 * On launch, in the background, the app fetches the site's list. Files whose hash differs from the packed copy are
 * downloaded (only those), checked against their hash, and kept aside as a complete set ("ready"). The set is switched
 * in at the next launch, before the page loads, so a running game never sees files from two versions.
 *
 * Nothing here can stop the game: any failure leaves the packed files (or the last good set) in use. A set that fails
 * to bring the game up twice running is thrown away. A new APK throws the set away too, because its packed files are
 * newer than anything downloaded before it.
 */
final class Ota {
    static final String TAG = "SohraiJS";
    static final long MAX_BYTES = 40L << 20;

    final Context ctx;
    final String base;
    final File root, active, ready, tmp;
    final Map<String, String> packed = new HashMap<>();
    final Map<String, String> over = new HashMap<>(); // files served from the downloaded set instead of the APK
    final SharedPreferences prefs;
    String packedV = "", activeV = "";

    Ota(Context ctx, String base) {
        this.ctx = ctx.getApplicationContext();
        this.base = base;
        root = new File(ctx.getFilesDir(), "ota");
        active = new File(root, "active");
        ready = new File(root, "ready");
        tmp = new File(root, "tmp");
        prefs = ctx.getSharedPreferences("ota", Context.MODE_PRIVATE);
    }

    /** Before the page loads: switch in a downloaded set if one is waiting, and work out which files it replaces. */
    void start(long appVersion) {
        try {
            if (prefs.getLong("vc", -1) != appVersion) { // a new APK: its packed files win
                rm(root);
                prefs.edit().putLong("vc", appVersion).putInt("fail", 0).apply();
            }
            if (prefs.getInt("fail", 0) >= 2) {
                Log.i(TAG, "ota: the downloaded files failed to start the game twice; back to the packed files");
                rm(root);
                prefs.edit().putInt("fail", 0).apply();
            }
            if (new File(ready, "files.json").isFile()) {
                rm(active);
                if (!ready.renameTo(active)) rm(ready);
            }
            rm(tmp);
            packedV = load(text(ctx.getAssets().open("www/files.json")), packed);
            File list = new File(active, "files.json");
            if (list.isFile()) {
                Map<String, String> m = new HashMap<>();
                String v = load(text(new FileInputStream(list)), m);
                boolean whole = true;
                for (Map.Entry<String, String> e : m.entrySet()) {
                    if (e.getValue().equals(packed.get(e.getKey()))) continue;
                    if (new File(active, "f/" + e.getKey()).isFile()) over.put(e.getKey(), e.getValue());
                    else whole = false;
                }
                if (whole) activeV = v;
                else { over.clear(); rm(active); }
            }
        } catch (Exception e) {
            Log.i(TAG, "ota: start " + e);
            over.clear();
            activeV = "";
        }
        Log.i(TAG, "ota: game files " + version() + (over.isEmpty() ? " (packed)" : " (" + over.size() + " updated over the air)"));
    }

    String version() {
        return activeV.isEmpty() ? packedV : activeV;
    }

    /** The downloaded copy of a game file, or null when the packed copy is the right one. */
    File file(String rel) {
        return over.containsKey(rel) ? new File(active, "f/" + rel) : null;
    }

    /** The game came up with these files (or did not). */
    void report(boolean ok) {
        if (over.isEmpty()) return;
        prefs.edit().putInt("fail", ok ? 0 : prefs.getInt("fail", 0) + 1).apply();
    }

    /** Look for an update in the background, a few seconds after launch so it does not compete with loading. */
    void check() {
        Thread t = new Thread(() -> {
            try {
                Thread.sleep(6000);
                update();
            } catch (Exception e) {
                Log.i(TAG, "ota: no update this time (" + e + ")");
                rm(tmp);
            }
        }, "ota");
        t.setPriority(Thread.MIN_PRIORITY);
        t.setDaemon(true);
        t.start();
    }

    void update() throws Exception {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        fetch(base + "/files.json?t=" + System.currentTimeMillis(), buf);
        String txt = new String(buf.toByteArray(), StandardCharsets.UTF_8);
        Map<String, String> remote = new LinkedHashMap<>();
        String v = load(txt, remote);
        if (v.isEmpty() || remote.isEmpty()) throw new IOException("empty file list");
        if (v.equals(version())) { Log.i(TAG, "ota: up to date (" + v + ")"); return; }
        File waiting = new File(ready, "files.json");
        if (waiting.isFile() && v.equals(load(text(new FileInputStream(waiting)), new HashMap<>()))) return;
        rm(ready);
        rm(tmp);
        long bytes = 0;
        int n = 0;
        for (Map.Entry<String, String> e : remote.entrySet()) {
            String rel = e.getKey(), sha = e.getValue();
            if (!rel.matches("[A-Za-z0-9._/-]+") || rel.contains("..") || rel.startsWith("/")) throw new IOException("bad path " + rel);
            if (sha.equals(packed.get(rel))) continue; // the APK already has exactly this file
            File out = new File(tmp, "f/" + rel);
            File dir = out.getParentFile();
            if (dir != null && !dir.isDirectory() && !dir.mkdirs()) throw new IOException("cannot make " + dir);
            File have = new File(active, "f/" + rel);
            String got;
            if (sha.equals(over.get(rel)) && have.isFile()) { // already downloaded for the set in use
                try (InputStream in = new FileInputStream(have); OutputStream o = new FileOutputStream(out)) { got = pipe(in, o); }
            } else {
                try (OutputStream o = new FileOutputStream(out)) { got = fetch(base + "/" + rel + "?v=" + sha.substring(0, 8), o); }
                n++;
                bytes += out.length();
                if (bytes > MAX_BYTES) throw new IOException("update too large");
            }
            if (!got.equals(sha)) throw new IOException("hash mismatch " + rel);
        }
        try (OutputStream o = new FileOutputStream(new File(tmp, "files.json"))) { o.write(txt.getBytes(StandardCharsets.UTF_8)); }
        if (!tmp.renameTo(ready)) throw new IOException("cannot keep the update");
        Log.i(TAG, "ota: update " + v + " downloaded (" + n + " files, " + bytes / 1024 + " KB); it applies at the next launch");
    }

    /** Downloads a URL into out and returns the SHA-256 of what arrived. */
    static String fetch(String url, OutputStream out) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setRequestProperty("Cache-Control", "no-cache");
        try {
            if (c.getResponseCode() != 200) throw new IOException(c.getResponseCode() + " for " + url);
            try (InputStream in = c.getInputStream()) { return pipe(in, out); }
        } finally {
            c.disconnect();
        }
    }

    static String pipe(InputStream in, OutputStream out) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] b = new byte[32768];
        for (int n; (n = in.read(b)) > 0; ) { md.update(b, 0, n); out.write(b, 0, n); }
        StringBuilder s = new StringBuilder();
        for (byte x : md.digest()) s.append(String.format("%02x", x));
        return s.toString();
    }

    static String text(InputStream in) throws Exception {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        try (InputStream i = in) { pipe(i, o); }
        return new String(o.toByteArray(), StandardCharsets.UTF_8);
    }

    /** Reads a files.json into map (path -> sha256) and returns its "v". */
    static String load(String json, Map<String, String> map) throws Exception {
        JSONObject o = new JSONObject(json), f = o.getJSONObject("files");
        for (Iterator<String> it = f.keys(); it.hasNext(); ) { String k = it.next(); map.put(k, f.getString(k)); }
        return o.optString("v", "");
    }

    static void rm(File f) {
        if (f == null || !f.exists()) return;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) rm(k);
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }
}
