/**
 * 主运行脚本
 * 每小时抓取当前小时及历史数据，存储到 data/站点/年/月/日/小时.json
 */

const fs = require('fs');
const path = require('path');
const { fetchAirQuality, extractDisplayData, SITE_NAME } = require('./fetch');

const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 获取某天的数据目录路径
 */
function getDayDir(siteName, year, month, day) {
  return path.join(DATA_DIR, siteName, String(year), String(month).padStart(2, '0'), String(day).padStart(2, '0'));
}

/**
 * 保存数据到 data/站点/年/月/日/小时.json
 */
function saveData(siteName, year, month, day, hour, data) {
  const dir = getDayDir(siteName, year, month, day);
  ensureDir(dir);
  const filePath = path.join(dir, `${String(hour).padStart(2, '0')}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`已保存: ${filePath}`);
}

/**
 * 生成 all.json：汇总当天所有小时数据，供前端单次请求使用
 */
function buildAllJson(siteName, year, month, day) {
  const dir = getDayDir(siteName, year, month, day);
  if (!fs.existsSync(dir)) return;

  const hours = [];
  for (let h = 0; h < 24; h++) {
    const hourStr = String(h).padStart(2, '0');
    const filePath = path.join(dir, `${hourStr}.json`);
    if (fs.existsSync(filePath)) {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      hours.push({ hour: h, ...content });
    } else {
      hours.push(null);
    }
  }

  const allData = {
    site: siteName,
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    hours,
  };
  const allPath = path.join(dir, 'all.json');
  fs.writeFileSync(allPath, JSON.stringify(allData, null, 2), 'utf-8');
  console.log(`已生成: ${allPath}`);
}

/**
 * 抓取并保存指定时间的数据
 * 若 data 为空则不保存
 */
async function fetchAndSave(date, hour) {
  const apiData = await fetchAirQuality(date, hour);
  const displayData = extractDisplayData(apiData);

  if (!displayData.data || displayData.data.length === 0) {
    console.log(`小时 ${hour} 数据为空，跳过保存`);
    return;
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  saveData(SITE_NAME, year, month, day, hour, displayData);
}

const TZ_BEIJING = 'Asia/Shanghai';

/**
 * 获取北京时间（GitHub Actions 运行在 UTC，需显式使用 Asia/Shanghai）
 * 返回带 getFullYear/getMonth/getDate/getHours 的对象，供抓取逻辑使用
 */
function getBeijingNow() {
  const d = new Date();
  const year = parseInt(new Intl.DateTimeFormat('en', { timeZone: TZ_BEIJING, year: 'numeric' }).format(d), 10);
  const month = parseInt(new Intl.DateTimeFormat('en', { timeZone: TZ_BEIJING, month: '2-digit' }).format(d), 10) - 1;
  const day = parseInt(new Intl.DateTimeFormat('en', { timeZone: TZ_BEIJING, day: '2-digit' }).format(d), 10);
  let hour = parseInt(new Intl.DateTimeFormat('en', { timeZone: TZ_BEIJING, hour: '2-digit', hour12: false, hourCycle: 'h23' }).format(d), 10);
  if (hour === 24) hour = 0; // 某些环境下 24 表示午夜
  return {
    getFullYear: () => year,
    getMonth: () => month,
    getDate: () => day,
    getHours: () => hour,
  };
}

/**
 * 主入口：每小时抓取当前小时数据，并补全当天历史小时
 */
async function main() {
  const now = getBeijingNow();
  const currentHour = now.getHours();

  console.log(`开始抓取 - 北京时间 ${new Date().toLocaleString('zh-CN', { timeZone: TZ_BEIJING })}`);
  console.log(`当前小时: ${currentHour}`);

  try {
    // 1. 抓取并保存当前小时
    await fetchAndSave(now, currentHour);

    // 2. 补全当天 0 ~ currentHour-1 的数据（若文件不存在则抓取）
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const dataDir = path.join(DATA_DIR, SITE_NAME, String(year),
      String(month).padStart(2, '0'),
      String(day).padStart(2, '0'));
    for (let h = 0; h < currentHour; h++) {
      const hourFile = path.join(dataDir, `${String(h).padStart(2, '0')}.json`);
      if (!fs.existsSync(hourFile)) {
        try {
          await fetchAndSave(now, h);
          await new Promise(r => setTimeout(r, 300));
        } catch (e) {
          console.warn(`补全小时 ${h} 失败:`, e.message);
        }
      }
    }

    // 3. 生成 all.json 供前端单次请求
    buildAllJson(SITE_NAME, year, month, day);
  } catch (err) {
    console.error('抓取失败:', err);
    process.exit(1);
  }

  console.log('完成');
}

main();
