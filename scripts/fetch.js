/**
 * 海南空气质量数据爬虫
 * 数据源: https://hnsthb.hainan.gov.cn
 * 站点: CDDM=469029 保亭县
 */

const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');

const BASE_URL = 'https://hnsthb.hainan.gov.cn/hngxfb/dataservice/sjcl/api/21408wwfb/air/getSiteCityData';
const SITE_CODE = '469029'; // 保亭县
const SITE_NAME = '保亭县';

// 代理配置：host/username/password 由环境变量传入（GitHub Actions 通过 variables 注入）
const proxyConfig = process.env.PROXY_HOST
  ? {
      port: 3128,
      host: process.env.PROXY_HOST,
      protocol: 'http',
      ...(process.env.PROXY_USERNAME && { username: process.env.PROXY_USERNAME }),
      ...(process.env.PROXY_PASSWORD && { password: process.env.PROXY_PASSWORD }),
    }
  : null;
const proxyAgent = proxyConfig ? new HttpsProxyAgent(proxyConfig) : undefined;

const headers = {
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'zh-CN,zh;q=0.9',
  'Referer': 'https://hnsthb.hainan.gov.cn/hngxfb/resources/dist/index.html',
};

const FETCH_TIMEOUT_MS = 60000; // 60 秒超时，适应海外到国内网络延迟
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

/**
 * 带超时和代理的 fetch
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      ...(proxyAgent && { agent: proxyAgent }),
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 获取指定时间的空气质量数据（含重试）
 * @param {Date} date - 日期对象
 * @param {number} hour - 小时 (0-23)
 * @returns {Promise<Object>} API 返回的数据
 */
async function fetchAirQuality(date, hour) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hourStr = String(hour).padStart(2, '0');
  const jcsj = `${year}-${month}-${day}+${hourStr}`;

  const url = `${BASE_URL}?CDDM=${SITE_CODE}&JCSJ=${jcsj}`;
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(url, { headers });
      // console.log(await res.text())
      const data = await res.json();

      if (data.status !== '000') {
        throw new Error(`API 返回错误: ${data.msg || data.status}`);
      }

      return data;
    } catch (err) {
      lastError = err;
      const isRetryable = err.cause?.code === 'ETIMEDOUT' || err.name === 'AbortError' || err.cause?.code === 'ECONNRESET';
      if (attempt < MAX_RETRIES && isRetryable) {
        console.warn(`请求失败 (尝试 ${attempt}/${MAX_RETRIES}): ${err.message}，${RETRY_DELAY_MS / 1000} 秒后重试...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      } else {
        throw lastError;
      }
    }
  }

  throw lastError;
}

/**
 * 提取需要展示的字段
 * CDMC, SO2, PM10, O3, PM25, NO2, CO
 */
function extractDisplayData(apiData) {
  if (!apiData?.data || !Array.isArray(apiData.data)) {
    return { data: [], raw: apiData };
  }

  const displayData = apiData.data.map(item => ({
    CDMC: item.CDMC,
    SO2: item.SO2,
    PM10: item.PM10,
    O3: item.O3,
    PM25: item.PM25,
    NO2: item.NO2,
    CO: item.CO,
    JCSJ: item.JCSJ,
  }));

  const beijingTime = new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).replace(/\//g, '-');
  return {
    data: displayData,
    fetchedAt: beijingTime,
    site: SITE_NAME,
    siteCode: SITE_CODE,
  };
}

module.exports = {
  fetchAirQuality,
  extractDisplayData,
  SITE_CODE,
  SITE_NAME,
};
