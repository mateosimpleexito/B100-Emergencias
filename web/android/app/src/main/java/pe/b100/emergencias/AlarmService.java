package pe.b100.emergencias;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

/**
 * Foreground service that plays the full B100 selectiva sequence through
 * STREAM_ALARM — works even with app closed, DND on, all volumes at 0.
 *
 * Sequence:
 *   1. preventiva_selectiva.mp3 (2.73s) — once
 *   2. 3s pause
 *   3. selectiva_repeat.mp3 (1s) — every 3s, up to 5 times
 *   4. Stop automatically after sequence or when user opens app
 */
public class AlarmService extends Service {

    private static final String TAG = "B100Alarm";
    private static final String CHANNEL_ID = "b100_alarm_service";
    private static final int NOTIFICATION_ID = 100;
    private static final int MAX_REPEATS = 5;
    private static final long REPEAT_INTERVAL_MS = 3000;

    private MediaPlayer mediaPlayer;
    private Handler handler;
    private PowerManager.WakeLock wakeLock;
    private AudioManager audioManager;
    private int savedAlarmVolume = -1;
    private int repeatCount = 0;
    private boolean isRunning = false;

    @Override
    public void onCreate() {
        super.onCreate();
        handler = new Handler(Looper.getMainLooper());
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "STOP".equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }

        if (isRunning) return START_NOT_STICKY;
        isRunning = true;

        // Acquire wake lock — keep CPU alive during alarm
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "b100:alarm"
            );
            wakeLock.acquire(120_000); // 2 min max
        }

        // Start as foreground service with notification
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification(intent));

        // Max alarm volume
        boostAlarmVolume();

        // Start the sequence
        playPreventiva();

        return START_NOT_STICKY;
    }

    private void boostAlarmVolume() {
        if (audioManager == null) return;
        savedAlarmVolume = audioManager.getStreamVolume(AudioManager.STREAM_ALARM);
        int max = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
        audioManager.setStreamVolume(AudioManager.STREAM_ALARM, max, 0);
    }

    private void restoreVolume() {
        if (audioManager == null || savedAlarmVolume < 0) return;
        audioManager.setStreamVolume(AudioManager.STREAM_ALARM, savedAlarmVolume, 0);
        savedAlarmVolume = -1;
    }

    private void playPreventiva() {
        Log.d(TAG, "Playing preventiva + selectiva");
        playRawResource(R.raw.preventiva_selectiva, () -> {
            // After preventiva finishes, wait 3s then start repeat loop
            handler.postDelayed(this::playRepeatLoop, REPEAT_INTERVAL_MS);
        });
    }

    private void playRepeatLoop() {
        if (!isRunning || repeatCount >= MAX_REPEATS) {
            Log.d(TAG, "Sequence complete — stopping");
            stopSelf();
            return;
        }

        Log.d(TAG, "Playing selectiva repeat #" + (repeatCount + 1));
        playRawResource(R.raw.selectiva_repeat, () -> {
            repeatCount++;
            if (isRunning && repeatCount < MAX_REPEATS) {
                handler.postDelayed(this::playRepeatLoop, REPEAT_INTERVAL_MS);
            } else {
                stopSelf();
            }
        });
    }

    private void playRawResource(int resId, Runnable onComplete) {
        releasePlayer();

        try {
            mediaPlayer = new MediaPlayer();

            // USAGE_ALARM — plays through alarm volume, bypasses DND
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            mediaPlayer.setAudioAttributes(attrs);

            Uri uri = Uri.parse("android.resource://" + getPackageName() + "/" + resId);
            mediaPlayer.setDataSource(this, uri);
            mediaPlayer.setOnCompletionListener(mp -> {
                if (onComplete != null) onComplete.run();
            });
            mediaPlayer.setOnErrorListener((mp, what, extra) -> {
                Log.e(TAG, "MediaPlayer error: " + what + "/" + extra);
                if (onComplete != null) onComplete.run();
                return true;
            });
            mediaPlayer.prepare();
            mediaPlayer.start();
        } catch (Exception e) {
            Log.e(TAG, "Failed to play resource", e);
            if (onComplete != null) onComplete.run();
        }
    }

    private void releasePlayer() {
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) mediaPlayer.stop();
                mediaPlayer.release();
            } catch (Exception ignored) {}
            mediaPlayer = null;
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Alarma B100 Activa",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Alarma de emergencia en progreso");
        channel.setBypassDnd(true);
        channel.enableVibration(false);
        channel.setSound(null, null); // Silent — audio handled by MediaPlayer
        nm.createNotificationChannel(channel);
    }

    private Notification buildNotification(Intent intent) {
        // Tap notification → open app (which stops alarm)
        Intent openApp = new Intent(this, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        // Pass the emergency URL if available
        if (intent != null && intent.hasExtra("url")) {
            openApp.putExtra("url", intent.getStringExtra("url"));
        }

        PendingIntent pendingOpen = PendingIntent.getActivity(
            this, 0, openApp,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Stop button
        Intent stopIntent = new Intent(this, AlarmService.class);
        stopIntent.setAction("STOP");
        PendingIntent pendingStop = PendingIntent.getService(
            this, 1, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String title = "🚨 EMERGENCIA B100";
        String body = intent != null ? intent.getStringExtra("body") : "Nueva emergencia detectada";
        if (body == null) body = "Nueva emergencia detectada";

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        builder.setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentIntent(pendingOpen)
            .setOngoing(true)
            .setPriority(Notification.PRIORITY_MAX)
            .setCategory(Notification.CATEGORY_ALARM)
            .setVisibility(Notification.VISIBILITY_PUBLIC);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH) {
            builder.addAction(new Notification.Action.Builder(
                null, "Abrir", pendingOpen
            ).build());
            builder.addAction(new Notification.Action.Builder(
                null, "Silenciar", pendingStop
            ).build());
        }

        return builder.build();
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        handler.removeCallbacksAndMessages(null);
        releasePlayer();
        restoreVolume();

        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }

        stopForeground(true);
        super.onDestroy();
        Log.d(TAG, "AlarmService destroyed");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
