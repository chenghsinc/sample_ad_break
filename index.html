<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Custom CAF Receiver - Forced Subtitle Fix</title>
  <!-- Load the CAF SDK -->
  <script src="https://www.gstatic.com/cast/sdk/libs/caf/bundle/cast_receiver_framework.js"></script>
  <style>
    body {
      --playback-logo-image: url('https://www.gstatic.com/images/branding/googlelogo/svg/googlelogo_clr_74x24px.svg');
      background-color: #000000;
      margin: 0;
    }
    cast-media-player {
      width: 100vw;
      height: 100vh;
    }
  </style>
</head>
<body>
  <cast-media-player></cast-media-player>
  
  <script>
    const context = cast.framework.CastReceiverContext.getInstance();
    const playerManager = context.getPlayerManager();

    // Workaround: Re-sync forced subtitles after the DAI ad break finishes
    playerManager.addEventListener(
      cast.framework.events.EventType.BREAK_ENDED,
      () => {
        console.log('Ad break ended. Re-evaluating forced subtitles...');
        
        const audioTracksManager = playerManager.getAudioTracksManager();
        const activeAudio = audioTracksManager.getActiveTrack();
        
        if (activeAudio && activeAudio.language) {
          console.log(`Active main content audio language: ${activeAudio.language}`);
          
          // 1. Force-sync using CAF TextTracksManager
          const textTracksManager = playerManager.getTextTracksManager();
          try {
            textTracksManager.setActiveByLanguage(activeAudio.language);
            console.log(`CAF TextTracksManager set to: ${activeAudio.language}`);
          } catch (cafError) {
            console.warn('CAF TextTracksManager failed to set language:', cafError);
          }

          // 2. Direct Shaka Player fallback (forces hidden/forced tracks to activate)
          const shakaPlayer = playerManager.getShakaPlayer();
          if (shakaPlayer) {
            console.log('Syncing text track language and visibility in Shaka Player...');
            try {
              shakaPlayer.selectTextLanguage(activeAudio.language);
              shakaPlayer.setTextTrackVisibility(true);
            } catch (shakaError) {
              console.error('Shaka track update failed:', shakaError);
            }
          }
        }
      }
    );

    context.start();
  </script>
</body>
</html>
