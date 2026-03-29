package pe.b100.emergencias;

import android.content.Intent;
import android.os.Build;
import android.util.Log;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * Intercepts FCM push notifications and starts AlarmService to play
 * the full selectiva sequence — even when app is completely closed.
 */
public class B100FirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "B100FCM";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Log.d(TAG, "Push received from: " + remoteMessage.getFrom());

        String title = "";
        String body = "";
        String url = "/";

        // Extract from notification payload
        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle() != null
                ? remoteMessage.getNotification().getTitle() : "";
            body = remoteMessage.getNotification().getBody() != null
                ? remoteMessage.getNotification().getBody() : "";
        }

        // Extract from data payload
        if (remoteMessage.getData().containsKey("url")) {
            url = remoteMessage.getData().get("url");
        }
        if (remoteMessage.getData().containsKey("tag")) {
            // tag is the nro_parte
        }

        // Start AlarmService as foreground service
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
        Log.d(TAG, "New FCM token: " + token);
        // Capacitor push-notifications plugin handles token registration
    }
}
