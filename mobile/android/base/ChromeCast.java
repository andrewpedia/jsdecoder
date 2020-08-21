/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko;

import java.io.IOException;

import org.mozilla.gecko.util.EventCallback;
import org.json.JSONObject;
import org.json.JSONException;

import com.google.android.gms.cast.Cast;
import com.google.android.gms.cast.Cast.ApplicationConnectionResult;
import com.google.android.gms.cast.CastDevice;
import com.google.android.gms.cast.CastMediaControlIntent;
import com.google.android.gms.cast.MediaInfo;
import com.google.android.gms.cast.MediaMetadata;
import com.google.android.gms.cast.MediaStatus;
import com.google.android.gms.cast.RemoteMediaPlayer;
import com.google.android.gms.cast.RemoteMediaPlayer.MediaChannelResult;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.api.GoogleApiClient;
import com.google.android.gms.common.api.GoogleApiClient.ConnectionCallbacks;
import com.google.android.gms.common.api.ResultCallback;
import com.google.android.gms.common.api.Status;
import com.google.android.gms.common.GooglePlayServicesUtil;

import android.content.Context;
import android.os.Bundle;
import android.support.v7.media.MediaRouter.RouteInfo;
import android.util.Log;

/* Implementation of GeckoMediaPlayer for talking to ChromeCast devices */
class ChromeCast implements GeckoMediaPlayer {
    private static final boolean SHOW_DEBUG = false;
    private static final String LOGTAG = "GeckoChromeCast";

    private final Context context;
    private final RouteInfo route;
    private GoogleApiClient apiClient;
    private RemoteMediaPlayer remoteMediaPlayer;
    private String mSessionId;

    // Callback to start playback of a url on a remote device
    private class VideoPlayCallback implements ResultCallback<ApplicationConnectionResult>,
                                               RemoteMediaPlayer.OnStatusUpdatedListener,
                                               RemoteMediaPlayer.OnMetadataUpdatedListener {
        private final String url;
        private final String type;
        private final String title;
        private final EventCallback callback;

        public VideoPlayCallback(String url, String type, String title, EventCallback callback) {
            this.url = url;
            this.type = type;
            this.title = title;
            this.callback = callback;
        }

        @Override
        public void onStatusUpdated() {
            MediaStatus mediaStatus = remoteMediaPlayer.getMediaStatus();
            boolean isPlaying = mediaStatus.getPlayerState() == MediaStatus.PLAYER_STATE_PLAYING;

            // TODO: Do we want to shutdown when there are errors?
            if (mediaStatus.getPlayerState() == MediaStatus.PLAYER_STATE_IDLE &&
                mediaStatus.getIdleReason() == MediaStatus.IDLE_REASON_FINISHED) {

                GeckoAppShell.sendEventToGecko(GeckoEvent.createBroadcastEvent("Casting:Stop", null));
            }
        }

        @Override
        public void onMetadataUpdated() { }

        @Override
        public void onResult(ApplicationConnectionResult result) {
            Status status = result.getStatus();
            debug("ApplicationConnectionResultCallback.onResult: statusCode" + status.getStatusCode());
            if (status.isSuccess()) {
                remoteMediaPlayer = new RemoteMediaPlayer();
                remoteMediaPlayer.setOnStatusUpdatedListener(this);
                remoteMediaPlayer.setOnMetadataUpdatedListener(this);
                mSessionId = result.getSessionId();
                if (!verifySession(callback)) {
                    return;
                }

                try {
                    Cast.CastApi.setMessageReceivedCallbacks(apiClient, remoteMediaPlayer.getNamespace(), remoteMediaPlayer);
                } catch (IOException e) {
                    debug("Exception while creating media channel", e);
                }

                startPlayback();
            } else {
                callback.sendError(status.toString());
            }
        }

        private void startPlayback() {
            MediaMetadata mediaMetadata = new MediaMetadata(MediaMetadata.MEDIA_TYPE_MOVIE);
            mediaMetadata.putString(MediaMetadata.KEY_TITLE, title);
            MediaInfo mediaInfo = new MediaInfo.Builder(url)
                                               .setContentType(type)
                                               .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED)
                                               .setMetadata(mediaMetadata)
                                               .build();
            try {
                remoteMediaPlayer.load(apiClient, mediaInfo, true).setResultCallback(new ResultCallback<RemoteMediaPlayer.MediaChannelResult>() {
                    @Override
                    public void onResult(MediaChannelResult result) {
                        if (result.getStatus().isSuccess()) {
                            callback.sendSuccess(null);
                            debug("Media loaded successfully");
                            return;
                        }

                        debug("Media load failed " + result.getStatus());
                        callback.sendError(result.getStatus().toString());
                    }
                });

                return;
            } catch (IllegalStateException e) {
                debug("Problem occurred with media during loading", e);
            } catch (Exception e) {
                debug("Problem opening media during loading", e);
            }

            callback.sendError("");
        }
    }

    public ChromeCast(Context context, RouteInfo route) {
        int status =  GooglePlayServicesUtil.isGooglePlayServicesAvailable(context);
        if (status != ConnectionResult.SUCCESS) {
            throw new IllegalStateException("Play services are required for Chromecast support (go status code " + status + ")");
        }

        this.context = context;
        this.route = route;
    }

    // This dumps everything we can find about the device into JSON. This will hopefully make it
    // easier to filter out duplicate devices from different sources in js.
    public JSONObject toJSON() {
        final JSONObject obj = new JSONObject();
        try {
            final CastDevice device = CastDevice.getFromBundle(route.getExtras());
            if (device == null) {
                return null;
            }

            obj.put("uuid", route.getId());
            obj.put("version", device.getDeviceVersion());
            obj.put("friendlyName", device.getFriendlyName());
            obj.put("location", device.getIpAddress().toString());
            obj.put("modelName", device.getModelName());
            // For now we just assume all of these are Google devices
            obj.put("manufacturer", "Google Inc.");
        } catch(JSONException ex) {
            debug("Error building route", ex);
        }

        return obj;
    }

    public void load(final String title, final String url, final String type, final EventCallback callback) {
        final CastDevice device = CastDevice.getFromBundle(route.getExtras());
        Cast.CastOptions.Builder apiOptionsBuilder = Cast.CastOptions.builder(device, new Cast.Listener() {
            @Override
            public void onApplicationStatusChanged() { }

            @Override
            public void onVolumeChanged() { }

            @Override
            public void onApplicationDisconnected(int errorCode) { }
        });

        apiClient = new GoogleApiClient.Builder(context)
            .addApi(Cast.API, apiOptionsBuilder.build())
            .addConnectionCallbacks(new GoogleApiClient.ConnectionCallbacks() {
                @Override
                public void onConnected(Bundle connectionHint) {
                    if (!apiClient.isConnected()) {
                        debug("Connection failed");
                        callback.sendError("Not connected");
                        return;
                    }

                    // Launch the media player app and launch this url once its loaded
                    try {
                        Cast.CastApi.launchApplication(apiClient, CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID, true)
                                    .setResultCallback(new VideoPlayCallback(url, type, title, callback));
                    } catch (Exception e) {
                        debug("Failed to launch application", e);
                    }
                }

                @Override
                public void onConnectionSuspended(int cause) {
                    debug("suspended");
                }
        }).build();

        apiClient.connect();
    }

    public void start(final EventCallback callback) {
        // Nothing to be done here
        callback.sendSuccess(null);
    }

    public void stop(final EventCallback callback) {
        // Nothing to be done here
        callback.sendSuccess(null);
    }

    public boolean verifySession(final EventCallback callback) {
        String msg = null;
        if (apiClient == null || !apiClient.isConnected()) {
            msg = "Not connected";
        }

        if (mSessionId == null) {
            msg = "No session";
        }

        if (msg != null) {
            debug(msg);
            if (callback != null) {
                callback.sendError(msg);
            }
            return false;
        }

        return true;
    }

    public void play(final EventCallback callback) {
        if (!verifySession(callback)) {
            return;
        }

        remoteMediaPlayer.play(apiClient).setResultCallback(new ResultCallback<MediaChannelResult>() {
            @Override
            public void onResult(MediaChannelResult result) {
                Status status = result.getStatus();
                if (!status.isSuccess()) {
                    debug("Unable to play: " + status.getStatusCode());
                    callback.sendError(status.toString());
                } else {
                    callback.sendSuccess(null);
                }
            }
        });
    }

    public void pause(final EventCallback callback) {
        if (!verifySession(callback)) {
            return;
        }

        remoteMediaPlayer.pause(apiClient).setResultCallback(new ResultCallback<MediaChannelResult>() {
            @Override
            public void onResult(MediaChannelResult result) {
                Status status = result.getStatus();
                if (!status.isSuccess()) {
                    debug("Unable to pause: " + status.getStatusCode());
                    callback.sendError(status.toString());
                } else {
                    callback.sendSuccess(null);
                }
            }
        });
    }

    public void end(final EventCallback callback) {
        if (!verifySession(callback)) {
            return;
        }

        Cast.CastApi.stopApplication(apiClient).setResultCallback(new ResultCallback<Status>() {
            @Override
            public void onResult(Status result) {
                if (result.isSuccess()) {
                    try {
                        Cast.CastApi.removeMessageReceivedCallbacks(apiClient, remoteMediaPlayer.getNamespace());
                        remoteMediaPlayer = null;
                        mSessionId = null;
                        apiClient.disconnect();
                        apiClient = null;

                        if (callback != null) {
                            callback.sendSuccess(null);
                        }

                        return;
                    } catch(Exception ex) {
                        debug("Error ending", ex);
                    }
                }

                if (callback != null) {
                    callback.sendError(result.getStatus().toString());
                }
            }
        });
    }

    private void debug(String msg, Exception e) {
        if (SHOW_DEBUG) {
            Log.e(LOGTAG, msg, e);
        }
    }

    private void debug(String msg) {
        if (SHOW_DEBUG) {
            Log.d(LOGTAG, msg);
        }
    }
}
