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
  // Populate the load request media information.
  let mediaInformation = new cast.framework.messages.MediaInformation();
  mediaInformation.contentId =
      'https://storage.googleapis.com/cpe-sample-media/content/big_buck_bunny/big_buck_bunny_ts_master.m3u8';
  mediaInformation.contentType = 'application/x-mpegurl';

  // Set the load request media information and configure it to play
  // automatically.
  let loadRequestData = new cast.framework.messages.LoadRequestData();
  loadRequestData.autoplay = true;
  loadRequestData.media = mediaInformation;

  // Dispatch the local media request.
  playerManager.load(loadRequestData);
});

/**
 * Registers the LOAD request interceptor. This handler is called by the SDK
 * whenever there is a LOAD request and provides an opportunity for the
 * application to modify the request before the SDK processes it.
 **/
playerManager.setMessageInterceptor(
    cast.framework.messages.MessageType.LOAD, (loadRequestData) => {
      castDebugLogger.info('MyAPP.LOG', 'Intercepting LOAD request');

      // Create the VMAP Ads request data and append it to the MediaInformation.
      // const vmapUrl =
      //     'https://pubads.g.doubleclick.net/gampad/ads?sz=640x480&iu=/124319096/external/ad_rule_samples&ciu_szs=300x250&ad_rule=1&impl=s&gdfp_req=1&env=vp&output=vmap&unviewed_position_start=1&cust_params=deployment%3Ddevsite%26sample_ar%3Dpremidpost&cmsid=496&vid=short_onecue&correlator='
      //     + Math.floor(Math.random() * Math.pow(10, 10));
      // let vmapRequest = new cast.framework.messages.VastAdsRequest();
      // vmapRequest.adTagUrl = vmapUrl;
      // loadRequestData.media.vmapAdsRequest = vmapRequest;

      // Append VAST ad breaks to the MediaInformation.
      addVASTBreaksToMedia(loadRequestData.media);

      castDebugLogger.warn(
          'MyAPP.LOG', 'Playable URL: ' + loadRequestData.media.contentId);

      return loadRequestData;
    });

breakManager.setBreakClipLoadInterceptor((breakClip, breakContext) => {
  /**
   * The code will skip playback of break clips if the break position is within
   * the first 30 seconds.
   */
  let breakObj = breakContext.break;
  if (breakObj.position >= 0 && breakObj.position < 30) {
    castDebugLogger.debug(
        'MyAPP.LOG',
        'Break Clip Load Interceptor skipping break with ID: ' + breakObj.id);
    return null;
  } else {
    return breakClip;
  }
});

breakManager.setBreakSeekInterceptor((breakSeekData) => {
  /**
   * The code will play the first break between the seekFrom and seekTo
   * position. Note: If the position of a break is less than 30 then it will be
   * skipped due to the setBreakClipLoadInterceptor code.
   */
  castDebugLogger.debug(
      'MyAPP.LOG',
      'Break Seek Interceptor processing break ids ' +
          JSON.stringify(breakSeekData.breaks.map(adBreak => adBreak.id)));

  // Remove all other breaks except for the first one.
  breakSeekData.breaks.splice(1,breakSeekData.breaks.length);
  return breakSeekData;
});

const addVASTBreaksToMedia = (mediaInformation) => {
  mediaInformation.breakClips = [
    {
      id: 'bc1',
      title: 'bc1 (Pre-roll)',
      vastAdsRequest: {
        adTagUrl: generateVastUrl('preroll')
      }
    },
    {
      id: 'bc2',
      title: 'bc2 (Mid-roll)',
      vastAdsRequest: {
        adTagUrl: generateVastUrl('midroll')
      }
    },
    {
      id: 'bc3',
      title: 'bc3 (Mid-roll)',
      vastAdsRequest: {
        adTagUrl: generateVastUrl('midroll')
      }
    },
    {
      id: 'bc4',
      title: 'bc4 (Mid-roll)',
      vastAdsRequest: {
        adTagUrl: generateVastUrl('midroll')
      }
    },
    {
      id: 'bc5',
      title: 'bc5 (Mid-roll)',
      vastAdsRequest: {
        adTagUrl: generateVastUrl('midroll')
      }
    },
    {
      id: 'bc6',
      title: 'bc6 (Post-roll)',
      vastAdsRequest: {
        adTagUrl: generateVastUrl('postroll')
      }
    }
  ];

  mediaInformation.breaks = [
    {id: 'b1', breakClipIds: ['bc1'], position: 0},
    {id: 'b2', breakClipIds: ['bc2'], position: 15},
    {id: 'b3', breakClipIds: ['bc3', 'bc4'], position: 60},
    {id: 'b4', breakClipIds: ['bc5'], position: 100},
    {id: 'b5', breakClipIds: ['bc6'], position: -1}
  ];
};

/**
 * Convenience method for generating and returning DoubleClick VAST ads url
 * strings.
 */
function generateVastUrl(position) {
  const url = new URL(
      'https://pubads.g.doubleclick.net/gampad/ads?slotname=/124319096/external/ad_rule_samples&sz=640x480&ciu_szs=300x250&cust_params=deployment%3Ddevsite%26sample_ar%3Dpremidpost&url=&unviewed_position_start=1&output=xml_vast3&impl=s&env=vp&gdfp_req=1&ad_rule=0&vad_type=linear&pod=1&ppos=1&lip=true&min_ad_duration=0&max_ad_duration=30000&vrid=6256&video_doc_id=short_onecue&cmsid=496&kfa=0&tfcd=0');
  url.searchParams.set('vpos', position);
  url.searchParams.set(
      'correlator', Math.floor(Math.random() * Math.pow(10, 10)));
  return url.toString();
}

// Starts the cast context.
context.start();
