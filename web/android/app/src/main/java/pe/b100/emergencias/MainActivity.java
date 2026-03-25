package pe.b100.emergencias;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Channel ID used when sending push notifications from the web side.
    // Must match what the service worker uses (Chrome default is "fcm_fallback_notification_channel"
    // for FCM, or the browser creates its own — we override with max importance).
    public static final String CHANNEL_ID = "b100_emergency";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // ─── 1. Remove user-gesture requirement for Web Audio ──────────────
        // This is the key fix. In a native WebView we control the autoplay
        // policy — AudioContext.resume() works WITHOUT requiring a user tap.
        WebSettings settings = getBridge().getWebView().getSettings();
        settings.setMediaPlaybackRequiresUserGesture(false);

        // ─── 2. Create high-priority notification channel with siren sound ─
        // Android 8+ requires channels. We set importance to HIGH so the
        // notification makes a sound and shows as a heads-up even on Doze.
        createEmergencyNotificationChannel();
    }

    private void createEmergencyNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;

        // Only create once — Android ignores duplicate channel creation
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Emergencias B100",
            NotificationManager.IMPORTANCE_HIGH  // Heads-up notification + sound
        );
        channel.setDescription("Alertas de despacho Compañía 100");
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 400, 100, 400, 100, 400, 100, 800});
        channel.setShowBadge(true);

        // Attach the siren sound from res/raw/siren.mp3
        Uri soundUri = Uri.parse(
            "android.resource://" + getPackageName() + "/raw/siren"
        );
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .build();
        channel.setSound(soundUri, audioAttributes);

        nm.createNotificationChannel(channel);
    }
}
