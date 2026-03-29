package pe.b100.emergencias;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Channel ID used when sending push notifications from the web side.
    // Must match what the service worker uses (Chrome default is "fcm_fallback_notification_channel"
    // for FCM, or the browser creates its own — we override with max importance).
    public static final String CHANNEL_ID = "b100_emergency";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // ─── 0. Register VolumeBoost plugin ──────────────────────────────
        getBridge().registerPlugin(VolumeBoostPlugin.class);

        // ─── 1. Remove user-gesture requirement for Web Audio ──────────────
        try {
            android.webkit.WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
            }
        } catch (Exception ignored) {}

        // ─── 2. Create high-priority notification channel with siren sound ─
        try {
            createEmergencyNotificationChannel();
        } catch (Exception ignored) {}

        // ─── 3. Stop AlarmService when app opens (app alarm code takes over) ─
        stopAlarmService();
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        // Also stop when returning to app from notification tap
        stopAlarmService();
    }

    private void stopAlarmService() {
        try {
            android.content.Intent stopIntent = new android.content.Intent(this, AlarmService.class);
            stopIntent.setAction("STOP");
            startService(stopIntent);
        } catch (Exception ignored) {}
    }

    private void createEmergencyNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;

        // Delete old channel so new audio attributes (USAGE_ALARM) take effect
        // Android caches channel settings — only way to update sound/usage is recreate
        nm.deleteNotificationChannel(CHANNEL_ID);

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Emergencias B100",
            NotificationManager.IMPORTANCE_HIGH  // Heads-up notification + sound
        );
        channel.setDescription("Alertas de despacho Compañía 100");
        channel.enableVibration(false);   // Vibración la maneja el código de alarma (INDECI-style)
        channel.setShowBadge(true);
        channel.setBypassDnd(true);       // Suena incluso en No Molestar

        // Attach the siren sound from res/raw/siren.mp3
        Uri soundUri = Uri.parse(
            "android.resource://" + getPackageName() + "/raw/siren"
        );
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_ALARM)
            .build();
        channel.setSound(soundUri, audioAttributes);

        nm.createNotificationChannel(channel);
    }
}
