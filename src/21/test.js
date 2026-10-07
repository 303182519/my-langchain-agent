'use strict';

/**
 * 腾讯云「流式文本语音合成」TextToStreamAudioWSv2 Node.js 示例
 * 运行：TTS_APPID=xxx TTS_SECRET_ID=xxx TTS_SECRET_KEY=xxx node tts-stream.js
 */

const crypto = require('crypto');
const fs = require('fs');
const WebSocket = require('ws');

/* ================= 1. 配置 ================= */
const APPID = Number(process.env.TTS_APPID);   // 账号 AppID，必须是整型
const SECRET_ID = process.env.TTS_SECRET_ID;   // 密钥 SecretId
const SECRET_KEY = process.env.TTS_SECRET_KEY; // 密钥 SecretKey

const HOST = 'tts.cloud.tencent.com';
const URL_PATH = '/stream_wsv2';

const ACTION_SYNTHESIS = 'ACTION_SYNTHESIS'; // 发送合成文本
const ACTION_COMPLETE = 'ACTION_COMPLETE';   // 全部文本发送完毕
const ACTION_RESET = 'ACTION_RESET';         // 清空服务端尚未合成的缓存文本

/* ============ 2. 生成带签名的 wss 地址 ============ */
function buildWsUrl(options = {}) {
  const {
    voiceType = 101001,
    codec = 'pcm',              // pcm | mp3
    sampleRate = 16000,         // 8000 | 16000 | 24000（部分音色支持 24k）
    speed = 0,                  // [-2, 6]，0 为 1.0 倍
    volume = 0,                 // [-10, 10]
    enableSubtitle = false,     // 是否返回时间戳（超自然音色暂不支持）
    emotionCategory,            // 仅多情感音色生效，如 neutral/happy/sad...
    emotionIntensity,           // [50, 200]，默认 100
    segmentRate,                // 断句敏感阈值 [0, 1, 2]
    fastVoiceType,              // 一句话版声音复刻音色 ID
    sessionId = crypto.randomUUID(),
    signatureExpired = 24 * 3600, // 签名有效期（秒），须 < 90 天
  } = options;

  const now = Math.floor(Date.now() / 1000);

  const params = {
    Action: 'TextToStreamAudioWSv2',
    AppId: APPID,
    SecretId: SECRET_ID,
    Timestamp: now,
    Expired: now + signatureExpired,
    SessionId: sessionId,
    VoiceType: voiceType,
    Codec: codec,
    SampleRate: sampleRate,
    Speed: speed,
    Volume: volume,
  };
  if (enableSubtitle) params.EnableSubtitle = 'True'; // 文档示例写法
  if (fastVoiceType) params.FastVoiceType = fastVoiceType;
  if (emotionCategory) params.EmotionCategory = emotionCategory;
  if (emotionIntensity !== undefined) params.EmotionIntensity = emotionIntensity;
  if (segmentRate !== undefined) params.SegmentRate = segmentRate;

  // 除 Signature 外的参数按字典序排序，拼成 k=v 并对 k、v 做 urlencode
  const keys = Object.keys(params).sort();
  const query = keys
    .map((k) => `${k}=${encodeURIComponent(String(params[k]))}`)
    .join('&');

  // 签名原文 = 请求方法(GET) + 域名地址 + 请求参数
  const signSource = `GET${HOST}${URL_PATH}?${query}`;

  // HMAC-SHA1 + base64，得到 Signature
  const signature = crypto
    .createHmac('sha1', SECRET_KEY)
    .update(signSource)
    .digest('base64');

  const url = `wss://${HOST}${URL_PATH}?${query}` +
    `&Signature=${encodeURIComponent(signature)}`; // 必须 urlencode

  return { url, sessionId };
}

/* ================= 3. 流式合成 ================= */
async function synthesize(textChunks, {
  outFile = './tts_output.pcm',
  intervalMs = 300,
  ...options
} = {}) {
  const { url, sessionId } = buildWsUrl(options);
  const ws = new WebSocket(url);

  const audioBuffers = [];
  let subtitles = [];
  let gotFinal = false;

  let resolveReady;
  let resolveFinal;
  let rejectDone;

  const readyEvent = new Promise((r) => (resolveReady = r));
  const doneEvent = new Promise((resolve, reject) => {
    resolveFinal = resolve;
    rejectDone = reject;
  });

  const fail = (err) => {
    resolveReady();          // 避免卡在等待 READY
    rejectDone(err);
    try { ws.terminate(); } catch (_) { /* ignore */ }
  };

  ws.on('open', () => console.log('WebSocket 已连接，等待 READY 事件…'));

  ws.on('message', (data, isBinary) => {
    // 二进制帧：音频数据，可边接收边播放（这里先缓存）
    if (isBinary) {
      audioBuffers.push(Buffer.from(data));
      return;
    }

    // 文本帧：JSON，含状态码、事件标记、时间戳等
    let msg;
    try {
      msg = JSON.parse(data.toString('utf8'));
    } catch (_) {
      return;
    }

    if (msg.code !== 0) {
      fail(new Error(`合成失败 code=${msg.code}, message=${msg.message}`));
      return;
    }
    if (msg.heartbeat === 1) return;                 // 心跳，忽略

    if (msg.ready === 1) {                            // 服务端已就绪
      console.log('收到 READY，开始发送文本');
      resolveReady();
    }
    if (msg.result && msg.result.subtitles) {         // 逐字时间戳
      subtitles = msg.result.subtitles;
    }
    if (msg.final === 1) {                            // 全部合成结束
      gotFinal = true;
      resolveFinal();
    }
  });

  ws.on('error', fail);
  ws.on('close', () => {
    if (!gotFinal) resolveFinal(); // 服务端异常关闭时避免挂起
  });

  await readyEvent;

  // 逐段发送文本（模拟大语言模型逐字/逐句输出）
  for (const chunk of textChunks) {
    if (ws.readyState !== WebSocket.OPEN) break;
    ws.send(JSON.stringify({
      session_id: sessionId,
      message_id: crypto.randomUUID(),
      action: ACTION_SYNTHESIS,
      data: chunk,
    }));
    if (intervalMs) await new Promise((r) => setTimeout(r, intervalMs));
  }

  // 全部文本发送完毕，通知服务端
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      session_id: sessionId,
      message_id: crypto.randomUUID(),
      action: ACTION_COMPLETE,
      data: '',
    }));
  }

  await doneEvent;      // 等待 FINAL 事件
  ws.close();           // 收到 FINAL 后主动关闭连接

  const audio = Buffer.concat(audioBuffers);
  fs.writeFileSync(outFile, audio);

  return { file: outFile, bytes: audio.length, subtitles };
}

/* ================= 4. 调用示例 ================= */
(async () => {
  const chunks = [
    '腾讯云语音合成服务，',
    '支持流式文本输入，',
    '边合成边播放，',
    '适用于大语言模型的逐字输出场景。',
  ];

  try {
    const res = await synthesize(chunks, {
      outFile: './tts_output.pcm', // codec 为 mp3 时建议改成 .mp3
      voiceType: 101001,           // 音色 ID，参见音色列表
      codec: 'pcm',
      sampleRate: 16000,
      speed: 0,
      intervalMs: 300,             // 模拟流式输入间隔
    });

    console.log('合成完成：', res.file, res.bytes, '字节');
    console.log('时间戳示例：', res.subtitles.slice(0, 3));
  } catch (e) {
    console.error('合成失败：', e.message);
  }
})();
