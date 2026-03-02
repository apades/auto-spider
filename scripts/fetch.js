/**
 * 海南空气质量数据爬虫
 * 数据源: https://hnsthb.hainan.gov.cn
 * 站点: CDDM=469029 保亭县
 */

const BASE_URL = 'https://hnsthb.hainan.gov.cn/hngxfb/dataservice/sjcl/api/21408wwfb/air/getSiteCityData';
const SITE_CODE = '469029'; // 保亭县
const SITE_NAME = '保亭县';

const headers = {
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'zh-CN,zh;q=0.9',
  'Referer': 'https://hnsthb.hainan.gov.cn/hngxfb/resources/dist/index.html',
};

/**
 * 获取指定时间的空气质量数据
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
  const res = await fetch(url, { headers });
  const data = await res.json();

  if (data.status !== '000') {
    throw new Error(`API 返回错误: ${data.msg || data.status}`);
  }

  return data;
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

  return {
    data: displayData,
    fetchedAt: new Date().toISOString(),
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
