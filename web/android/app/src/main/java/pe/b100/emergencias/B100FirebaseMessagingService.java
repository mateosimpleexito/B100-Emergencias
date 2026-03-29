package pe.b100.emergencias;

import android.content.Intent;
import android.os.Build;
import android.util.Log;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Intercepts FCM data-only messages and starts AlarmService.
 *
 * CRITICAL: FCM must be sent as data-only (no `notification` field).
 * If `notification` is present, Android handles it directly when app
 * is in background — our onMessageReceived() is never called and
 * AlarmService never starts.
 */
public class B100FirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "B100FCM";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Log.d(TAG, "Push received — starting AlarmService");

        Map<String, String> data = remoteMessage.getData();

        String title = data.containsKey("title") ? data.get("title") : "🚨 EMERGENCIA B100";
        String body = data.containsKey("body") ? data.get("body") : "Nueva emergencia detectada";
        String url = data.containsKey("url") ? data.get("url") : "/";

        // Start AlarmService — plays selectiva through STREAM_ALARM
        Intent alarmIntent = new Intent(this, AlarmService.class);
        alarmIntent.putExtra("title", title);
        alarmIntent.putExtra("body", body);
        alarmIntent.putExtra("url", url);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(alarmIntent);
        } else {
            startService(alarmIntent);
        }
    }

    @Override
    public void onNewToken(String token) {
        Log.d(TAG, "New FCM token");
        // Capacitor push-notifications plugin handles token registration
    }
}
