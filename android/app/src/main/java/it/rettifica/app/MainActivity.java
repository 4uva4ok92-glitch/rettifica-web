package it.rettifica.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.util.Base64;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Rettifica for Android: the web app (assets/www) in a WebView, served from
 * https://appassets.androidplatform.net so storage, fetch (AI) and camera work like on the site.
 * window.RettificaAndroid gives the web code the native bits it already knows how to use
 * (share sheet, clipboard, vibration, voice, keep screen on, external links).
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/www/index.html";
    private static final int REQ_FILE = 1, REQ_CAM_PERM = 2, REQ_CAM_PERM_PICK = 3;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private WebChromeClient.FileChooserParams pendingParams;
    private Uri cameraUri;
    private PermissionRequest pendingPermission;
    private TextToSpeech tts;
    private boolean ttsReady;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(0xFF121418);
        setContentView(web);
        // Android 15 draws edge to edge: keep the page clear of status and navigation bars
        ViewCompat.setOnApplyWindowInsetsListener(web, (v, insets) -> {
            Insets b = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(b.left, b.top, b.right, Math.max(b.bottom, ime.bottom));
            return WindowInsetsCompat.CONSUMED;
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return loader.shouldInterceptRequest(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost())) return false;
                openExternal(u.toString()); // WhatsApp, SMS, phone, key pages…
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                pendingParams = params;
                if (wantsCamera(params) && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAM_PERM_PICK);
                    return true;
                }
                openChooser(params);
                return true;
            }

            @Override
            public void onPermissionRequest(PermissionRequest req) {
                runOnUiThread(() -> {
                    boolean cam = false;
                    for (String r : req.getResources()) if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) cam = true;
                    if (!cam) { req.deny(); return; }
                    if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        req.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    } else {
                        pendingPermission = req;
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAM_PERM);
                    }
                });
            }
        });

        web.addJavascriptInterface(new Bridge(), "RettificaAndroid");
        if (state != null) web.restoreState(state);
        else web.loadUrl(START);

        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) { tts.setLanguage(Locale.ITALIAN); ttsReady = true; }
        });
    }

    private static boolean wantsCamera(WebChromeClient.FileChooserParams p) {
        if (p == null) return false;
        boolean image = false;
        for (String a : p.getAcceptTypes()) if (a != null && a.startsWith("image")) image = true;
        return image && p.isCaptureEnabled();
    }

    private void openChooser(WebChromeClient.FileChooserParams params) {
        Intent pick;
        try { pick = params.createIntent(); } catch (Exception e) { pick = new Intent(Intent.ACTION_GET_CONTENT).setType("*/*"); }
        pick.addCategory(Intent.CATEGORY_OPENABLE);
        String[] accept = params.getAcceptTypes();
        boolean image = accept.length > 0 && accept[0] != null && accept[0].startsWith("image");
        if (!image) {
            // backups (.json / .rettifica): show every file, Android often has no JSON type for them
            pick = new Intent(Intent.ACTION_GET_CONTENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);
        }
        cameraUri = null;
        List<Intent> extra = new ArrayList<>();
        if (image && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            try {
                File dir = new File(getCacheDir(), "camera");
                dir.mkdirs();
                File f = new File(dir, "foto-" + System.currentTimeMillis() + ".jpg");
                cameraUri = FileProvider.getUriForFile(this, getPackageName() + ".files", f);
                Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                cam.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                cam.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                if (params.isCaptureEnabled()) {
                    startActivityForResult(cam, REQ_FILE); // «Foto»: straight to the camera
                    return;
                }
                extra.add(cam);
            } catch (Exception ignored) { cameraUri = null; }
        }
        Intent chooser = Intent.createChooser(pick, image ? "Scegli la foto" : "Scegli il file");
        if (!extra.isEmpty()) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, extra.toArray(new Intent[0]));
        try { startActivityForResult(chooser, REQ_FILE); }
        catch (ActivityNotFoundException e) { finishPick(null); }
    }

    private void finishPick(Uri[] result) {
        if (fileCallback != null) fileCallback.onReceiveValue(result);
        fileCallback = null;
        pendingParams = null;
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_FILE) return;
        if (res != RESULT_OK) { finishPick(null); return; }
        Uri picked = data != null ? data.getData() : null;
        if (picked != null) finishPick(new Uri[]{picked});
        else if (cameraUri != null) finishPick(new Uri[]{cameraUri});
        else finishPick(null);
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] results) {
        boolean ok = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
        if (req == REQ_CAM_PERM && pendingPermission != null) {
            if (ok) pendingPermission.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            else pendingPermission.deny();
            pendingPermission = null;
        } else if (req == REQ_CAM_PERM_PICK && pendingParams != null) {
            openChooser(pendingParams); // without permission it falls back to the gallery
        }
    }

    @Override
    public void onBackPressed() {
        // close an open window of the app first (same as tapping its background), then leave
        web.evaluateJavascript(
                "(function(){var m=document.getElementById('modalRoot');if(m&&m.innerHTML.trim()){m.innerHTML='';return 1;}" +
                "var p=document.body.dataset.page;if(p&&p!=='calc'){var n=document.querySelector('[data-page=\"calc\"]');if(n){n.click();return 1;}}return 0;})()",
                v -> { if (!"1".equals(v)) { if (web.canGoBack()) web.goBack(); else MainActivity.super.onBackPressed(); } });
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        if (tts != null) tts.shutdown();
        web.destroy();
        super.onDestroy();
    }

    private void openExternal(String url) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            toast("Nessuna app per aprire il link");
        }
    }

    private void toast(String t) { runOnUiThread(() -> Toast.makeText(this, t, Toast.LENGTH_SHORT).show()); }

    private static String mimeFor(String name, String mime) {
        if (mime != null && !mime.isEmpty()) return mime;
        String n = name.toLowerCase(Locale.ROOT);
        if (n.endsWith(".json") || n.endsWith(".rettifica")) return "application/json";
        if (n.endsWith(".csv")) return "text/csv";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".pdf")) return "application/pdf";
        if (n.endsWith(".html")) return "text/html";
        return "text/plain";
    }

    private void shareBytes(String filename, byte[] bytes, String mime, String caption) {
        try {
            File dir = new File(getCacheDir(), "share");
            dir.mkdirs();
            String safe = filename.replaceAll("[^A-Za-z0-9._-]", "_");
            File f = new File(dir, safe);
            try (FileOutputStream o = new FileOutputStream(f)) { o.write(bytes); }
            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".files", f);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mimeFor(safe, mime));
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.putExtra(Intent.EXTRA_SUBJECT, filename);
            if (caption != null && !caption.isEmpty()) send.putExtra(Intent.EXTRA_TEXT, caption);
            send.setClipData(ClipData.newRawUri(filename, uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent ch = Intent.createChooser(send, "Invia " + filename);
            runOnUiThread(() -> {
                try { startActivity(ch); } catch (Exception e) { toast("Nessuna app per condividere"); }
            });
            markBackup(filename);
        } catch (Exception e) {
            toast("File non creato: " + e.getMessage());
        }
    }

    /** the web code marks the backup as done only after a download / share it can see: do it for the native sheet too */
    private void markBackup(String filename) {
        if (!filename.startsWith("rettifica-beta-backup")) return;
        runOnUiThread(() -> web.evaluateJavascript(
                "try{localStorage.setItem('rweb_lastBackup',String(Date.now()));window.dispatchEvent(new Event('rweb-backup-done'));}catch(e){}", null));
    }

    /** Methods the web app calls as window.RettificaAndroid.* (only those it checks for). */
    private class Bridge {
        @JavascriptInterface public void shareText(String filename, String content) {
            shareBytes(filename, content.getBytes(StandardCharsets.UTF_8), null, null);
        }
        @JavascriptInterface public void shareFile(String filename, String content, String mime, String caption) {
            shareBytes(filename, content.getBytes(StandardCharsets.UTF_8), mime, caption);
        }
        @JavascriptInterface public void shareFileBase64(String filename, String b64, String mime) {
            shareBytes(filename, Base64.decode(b64, Base64.DEFAULT), mime, null);
        }
        @JavascriptInterface public void shareImageBase64(String filename, String b64) {
            shareBytes(filename, Base64.decode(b64, Base64.DEFAULT), "image/png", null);
        }
        @JavascriptInterface public void sharePlainText(String title, String text) {
            Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain");
            send.putExtra(Intent.EXTRA_SUBJECT, title);
            send.putExtra(Intent.EXTRA_TEXT, text);
            runOnUiThread(() -> {
                try { startActivity(Intent.createChooser(send, title)); } catch (Exception e) { toast("Nessuna app per condividere"); }
            });
        }
        @JavascriptInterface public void copyText(String text) {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Rettifica", text));
        }
        @JavascriptInterface public void vibrate(int ms) {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null || !v.hasVibrator()) return;
            long d = Math.max(5, Math.min(ms, 1000));
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(d, VibrationEffect.DEFAULT_AMPLITUDE));
            else v.vibrate(d);
        }
        @JavascriptInterface public void speak(String text) {
            if (ttsReady) tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "rettifica");
        }
        @JavascriptInterface public void setKeepScreenOn(boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }
        @JavascriptInterface public void openAppSettings() {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getPackageName(), null));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        }
        @JavascriptInterface public void openExternal(String url) {
            MainActivity.this.openExternal(url);
        }
        @JavascriptInterface public boolean isApk() { return true; }
    }
}
