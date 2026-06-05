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
  // 建立媒體資訊並加入安全保護
  let mediaInformation = new cast.framework.messages.MediaInformation();
  mediaInformation.contentId =
      'https://storage.googleapis.com/cpe-sample-media/content/big_buck_bunny/big_buck_bunny_ts_master.m3u8';
  mediaInformation.contentType = 'application/x-mpegurl';

  let loadRequestData = new cast.framework.messages.LoadRequestData();
  loadRequestData.autoplay = true;
  loadRequestData.media = mediaInformation;

  // 安全檢查：確保 playerManager 存在再載入
  if (playerManager) {
    playerManager.load(loadRequestData);
  } else {
    castDebugLogger.error('MyAPP.LOG', 'PlayerManager is not available during READY event.');
  }
});

/**
 * Registers the LOAD request interceptor. 
 * 安全優化：加入防禦性檢查，避免 Sender 端傳入不完整的資料導致崩潰。
 **/
playerManager.setMessageInterceptor(
    cast.framework.messages.MessageType.LOAD, (loadRequestData) => {
      castDebugLogger.info('MyAPP.LOG', 'Intercepting LOAD request');

    // 【安全檢查 1】確保外層物件存在
    if (!loadRequestData) {
      castDebugLogger.error('MyAPP.LOG', 'LoadRequestData is null or undefined.');
      return null; // 回傳 null 會拒絕這次錯誤的請求，避免 Receiver 壞掉
    }

    // 【安全檢查 2】如果 media 物件不存在，幫它初始化，防止後續塞廣告時出錯
    if (!loadRequestData.media) {
      castDebugLogger.warn('MyAPP.LOG', 'MediaInformation is missing, initializing a new one.');
      loadRequestData.media = new cast.framework.messages.MediaInformation();
    }

    // 注入廣告資料
      addVASTBreaksToMedia(loadRequestData.media);

    if (loadRequestData.media.contentId) {
      castDebugLogger.warn('MyAPP.LOG', 'Playable URL: ' + loadRequestData.media.contentId);
    }

      return loadRequestData;
    });

// 1. 監測播放器與一般錯誤事件
playerManager.addEventListener(cast.framework.events.EventType.ERROR, (event) => {
  castDebugLogger.error(
    'MyAPP.LOG',
    `Player Error - Code: ${event.detailedErrorCode}, Details:`,
    JSON.stringify(event)
  );
});

// 2. 針對廣告結束事件（BREAK_CLIP_ENDED）進行記錄，觀察是否因 ERROR 結束
playerManager.addEventListener(cast.framework.events.EventType.BREAK_CLIP_ENDED, (event) => {
  castDebugLogger.warn(
    'MyAPP.LOG',
    `Ad Break Clip Ended [ID: ${event.breakClipId}] - Details:`,
    JSON.stringify(event)
  );
});


/**
 * Break Clip Load Interceptor
 * 安全優化：加入對物件屬性的存在性檢查，並調整邏輯避免誤殺廣告。
 */
breakManager.setBreakClipLoadInterceptor((breakClip, breakContext) => {
  // 【安全檢查】確保 breakContext 與內部的 break 物件存在
  if (!breakContext || !breakContext.break) {
    castDebugLogger.warn('MyAPP.LOG', 'BreakContext or Break object is missing.');
    return breakClip;
  }

  let breakObj = breakContext.break;

  /**
   * 【邏輯安全修正】
   * 原本限制小於 30 秒會導致 position 0 (Pre-roll) 與 15 (Mid-roll) 被誤跳過。
   * 這裡修正為只跳過負數（無效位置），若需特定跳過邏輯，請調整數值。
   */
  if (breakObj.position < 0) { 
    castDebugLogger.debug(
        'MyAPP.LOG',
      'Break Clip Load Interceptor skipping invalid break with ID: ' + breakObj.id);
    return null;
  } else {
    return breakClip;
  }
});

/**
 * Break Seek Interceptor
 * 安全優化：避免對 null/undefined 的陣列進行 splice 操作。
 */
breakManager.setBreakSeekInterceptor((breakSeekData) => {
  // 【安全檢查】確保尋找資料與廣告陣列存在
  if (!breakSeekData || !Array.isArray(breakSeekData.breaks) || breakSeekData.breaks.length === 0) {
    return breakSeekData;
  }

  castDebugLogger.debug(
      'MyAPP.LOG',
      'Break Seek Interceptor processing break ids ' +
          JSON.stringify(breakSeekData.breaks.map(adBreak => adBreak.id)));

  // 安全地切除複數廣告：只保留快轉區間內的第一個廣告
  if (breakSeekData.breaks.length > 1) {
    breakSeekData.breaks.splice(1); // 省略第二個參數代表直接刪除索引 1 之後的所有元素
  }

  return breakSeekData;
});

/**
 * 注入 VAST 廣告結構到媒體資訊中
 */
const addVASTBreaksToMedia = (mediaInformation) => {
  // 安全檢查：確保傳入的物件有效
  if (!mediaInformation) return;

  mediaInformation.breakClips = [
    { id: 'bc1', title: 'bc1 (Pre-roll)', vastAdsRequest: { adTagUrl: generateVastUrl('preroll') } },
    { id: 'bc2', title: 'bc2 (Mid-roll)', vastAdsRequest: {} }, //  15 秒的時候空白
    { id: 'bc3', title: 'bc3 (Mid-roll)', vastAdsRequest: { adTagUrl: 'bcd.com' } }, // 60 秒的時候錯誤的 url
    { id: 'bc4', title: 'bc4 (Mid-roll)', vastAdsRequest: { adTagUrl: generateVastUrl('midroll') } },
    { id: 'bc5', title: 'bc5 (Mid-roll)', vastAdsRequest: { adTagUrl: generateVastUrl('midroll') } },
    { id: 'bc6', title: 'bc6 (Post-roll)', vastAdsRequest: { adTagUrl: generateVastUrl('postroll') } }
  ];

  mediaInformation.breaks = [
    {id: 'b1', breakClipIds: ['bc1'], position: 0},
    {id: 'b2', breakClipIds: ['bc2'], position: 15},
    {id: 'b3', breakClipIds: ['bc3', 'bc4'], position: 60},
    {id: 'b4', breakClipIds: ['bc5'], position: 100},
    { id: 'b5', breakClipIds: ['bc6'], position: -1 } // 備註：CAF SDK 預設 -1 通常代表 Post-roll
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

// 確保所有攔截器與監聽器註冊完畢後，最後才啟動 Context
context.start();
