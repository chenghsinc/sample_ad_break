const context = cast.framework.CastReceiverContext.getInstance();
const playerManager = context.getPlayerManager();
const breakManager = playerManager.getBreakManager();

/** Debug Logger **/
const castDebugLogger = cast.debug.CastDebugLogger.getInstance();
castDebugLogger.setEnabled(true);

/**
 * An event listener that is called when the CastReceiverContext's state is
 * READY. Once the context is ready, the handler will dispatch a local media
 * request to play content.
 */
context.addEventListener(cast.framework.system.EventType.READY, () => {
  // Create media information and ensure robust playback settings
  let mediaInformation = new cast.framework.messages.MediaInformation();
  mediaInformation.contentId =
    'https://storage.googleapis.com/cpe-sample-media/content/big_buck_bunny/big_buck_bunny_ts_master.m3u8';
  mediaInformation.contentType = 'application/x-mpegurl';

  let loadRequestData = new cast.framework.messages.LoadRequestData();
  loadRequestData.autoplay = true;
  loadRequestData.media = mediaInformation;

  // Safety check: Ensure playerManager is available before loading
  if (playerManager) {
    playerManager.load(loadRequestData);
  } else {
    castDebugLogger.error('MyAPP.LOG', 'PlayerManager is not available during READY event.');
  }
});

/**
 * Registers the LOAD request interceptor. 
 * Intercepts LOAD requests and performs defensive checks against incomplete sender payload.
 **/
playerManager.setMessageInterceptor(
  cast.framework.messages.MessageType.LOAD, (loadRequestData) => {
    castDebugLogger.info('MyAPP.LOG', 'Intercepting LOAD request');

    // [Safety Check 1] Verify loadRequestData exists
    if (!loadRequestData) {
      castDebugLogger.error('MyAPP.LOG', 'LoadRequestData is null or undefined.');
      return null; // Reject malformed load requests to prevent receiver crashes
    }

    // [Safety Check 2] Initialize missing MediaInformation to prevent ad injection errors
    if (!loadRequestData.media) {
      castDebugLogger.warn('MyAPP.LOG', 'MediaInformation is missing, initializing a new one.');
      loadRequestData.media = new cast.framework.messages.MediaInformation();
    }

    // Inject VAST ad configuration
    addVASTBreaksToMedia(loadRequestData.media);

    if (loadRequestData.media.contentId) {
      castDebugLogger.warn('MyAPP.LOG', 'Playable URL: ' + loadRequestData.media.contentId);
    }

    return loadRequestData;
  });

// 1. Listen for player errors to trigger manual Graceful Skip recovery
playerManager.addEventListener(cast.framework.events.EventType.ERROR, (event) => {
  castDebugLogger.error(
    'MyAPP.LOG',
    `Player Error - Code: ${event.detailedErrorCode}, Details:`,
    JSON.stringify(event)
  );

  // Check if the runtime error occurred within an active Ad Break
  const currentBreak = breakManager.getBreak();
  const currentBreakClip = breakManager.getBreakClip();

  if (currentBreak || currentBreakClip) {
    castDebugLogger.error(
      'MyAPP.LOG',
      `[Graceful Skip] Runtime error detected in Ad Break "${currentBreak?.id || currentBreakClip?.id}". Removing problematic break and skipping gracefully to main content.`
    );
    try {
      if (currentBreak?.id) {
        breakManager.removeBreakById(currentBreak.id);
      }
      // Forcibly resume main content playback (smooth fallback, maintaining active Session)
      playerManager.play();
    } catch (e) {
      castDebugLogger.error('MyAPP.LOG', 'Failed to recover from Ad Error:', e.message);
    }
  }
});

// 2. Monitor BREAK_CLIP_ENDED events for ad failures and perform Graceful Skip fallback
playerManager.addEventListener(cast.framework.events.EventType.BREAK_CLIP_ENDED, (event) => {
  if (event.endedReason === cast.framework.events.BreakClipEndedReason.ERROR || event.endedReason === 'ERROR') {
    castDebugLogger.error(
      'MyAPP.LOG',
      `[Graceful Skip] BreakClip "${event.breakClipId || 'Unknown'}" failed to load (e.g., 404/Inaccessible). Skipping ad gracefully to next content.`
    );
    try {
      // Ensure player smoothly resumes main video playback within the same Session
      playerManager.play();
    } catch (e) {
      castDebugLogger.error('MyAPP.LOG', 'Failed to resume after ad error:', e.message);
    }
  } else {
    castDebugLogger.warn(
      'MyAPP.LOG',
      `Ad Break Clip Ended [ID: ${event.breakClipId}] - Details:`,
      JSON.stringify(event)
    );
  }
});


/**
 * Break Clip Load Interceptor
 * Synchronous pass-through: Performs zero upfront network checks,
 * delegating runtime ad failures (e.g. 404) to error listeners for manual Graceful Skip.
 */
breakManager.setBreakClipLoadInterceptor((breakClip, breakContext) => {
  if (!breakContext || !breakContext.break) {
    castDebugLogger.warn('MyAPP.LOG', 'BreakContext or Break object is missing.');
    return breakClip;
  }

  let breakObj = breakContext.break;
  if (breakObj.position < 0) {
    return null;
  }

  return breakClip;
});

/**
 * Break Seek Interceptor
 * Safely trims subsequent ad breaks during seek operations.
 */
breakManager.setBreakSeekInterceptor((breakSeekData) => {
  // Verify seek data and breaks array exist
  if (!breakSeekData || !Array.isArray(breakSeekData.breaks) || breakSeekData.breaks.length === 0) {
    return breakSeekData;
  }

  castDebugLogger.debug(
    'MyAPP.LOG',
    'Break Seek Interceptor processing break ids ' +
    JSON.stringify(breakSeekData.breaks.map(adBreak => adBreak.id)));

  // Retain only the first ad break within the seek interval
  if (breakSeekData.breaks.length > 1) {
    breakSeekData.breaks.splice(1); // Discard subsequent ad breaks
  }

  return breakSeekData;
});

/**
 * Injects DoubleClick VAST ad structure into MediaInformation.
 */
const addVASTBreaksToMedia = (mediaInformation) => {
  // Validate MediaInformation object exists
  if (!mediaInformation) return;

  mediaInformation.breakClips = [
    { id: 'bc1', title: 'bc1 (Pre-roll)', vastAdsRequest: { adTagUrl: generateVastUrl('preroll') } },
    { id: 'bc2', title: 'bc2 (Mid-roll)', vastAdsRequest: {} }, // Mid-roll at 15s (empty URL)
    { id: 'bc3', title: 'bc3 (Mid-roll)', vastAdsRequest: { adTagUrl: 'bcd.com' } }, // Mid-roll at 60s (malformed URL)
    { id: 'bc4', title: 'bc4 (Mid-roll)', vastAdsRequest: { adTagUrl: generateVastUrl('midroll') } },
    { id: 'bc5', title: 'bc5 (Mid-roll)', vastAdsRequest: { adTagUrl: generateVastUrl('midroll') } },
    { id: 'bc6', title: 'bc6 (Post-roll)', vastAdsRequest: { adTagUrl: generateVastUrl('postroll') } }
  ];

  mediaInformation.breaks = [
    { id: 'b1', breakClipIds: ['bc1'], position: 0 },
    { id: 'b2', breakClipIds: ['bc2'], position: 15 },
    { id: 'b3', breakClipIds: ['bc3', 'bc4'], position: 60 },
    { id: 'b4', breakClipIds: ['bc5'], position: 100 },
    { id: 'b5', breakClipIds: ['bc6'], position: -1 } // Note: CAF SDK interprets position -1 as Post-roll
  ];
};

/**
 * Convenience method for generating and returning DoubleClick VAST ads url strings.
 */
function generateVastUrl(position) {
  try {
    const url = new URL(
      'https://pubads.g.doubleclick.net/gampad/ads?slotname=/124319096/external/ad_rule_samples&sz=640x480&ciu_szs=300x250&cust_params=deployment%3Ddevsite%26sample_ar%3Dpremidpost&url=&unviewed_position_start=1&output=xml_vast3&impl=s&env=vp&gdfp_req=1&ad_rule=0&vad_type=linear&pod=1&ppos=1&lip=true&min_ad_duration=0&max_ad_duration=30000&vrid=6256&video_doc_id=short_onecue&cmsid=496&kfa=0&tfcd=0');
    url.searchParams.set('vpos', position);
    url.searchParams.set(
      'correlator', Math.floor(Math.random() * Math.pow(10, 10)));
    return url.toString();
  } catch (e) {
    castDebugLogger.error('MyAPP.LOG', 'Failed to generate VAST URL: ' + e.message);
    return '';
  }
}

// Start the context after all interceptors and listeners are registered
context.start();
