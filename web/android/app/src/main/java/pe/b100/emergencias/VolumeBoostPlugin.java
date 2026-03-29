package pe.b100.emergencias;

import android.content.Context;
import android.media.AudioManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor plugin that temporarily maxes out media volume for alarm playback.
 * Web Audio API uses STREAM_MUSIC — if the user has media at 0, alarm is silent.
 * This plugin boosts it to max when alarm fires, restores on stop.
 */
@CapacitorPlugin(name = "VolumeBoost")
public class VolumeBoostPlugin extends Plugin {

    private int savedVolume = -1;

    @PluginMethod()
    public void boost(PluginCall call) {
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (am == null) {
            call.resolve();
            return;
        }

        // Save current volume
        savedVolume = am.getStreamVolume(AudioManager.STREAM_MUSIC);

        // Max it out
        int max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        am.setStreamVolume(AudioManager.STREAM_MUSIC, max, 0);

        call.resolve();
    }

    @PluginMethod()
    public void restore(PluginCall call) {
        if (savedVolume < 0) {
            call.resolve();
            return;
        }

        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (am == null) {
            call.resolve();
            return;
        }

        am.setStreamVolume(AudioManager.STREAM_MUSIC, savedVolume, 0);
        savedVolume = -1;

        call.resolve();
    }
}
