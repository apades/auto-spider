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
 * 保存数据到 data/站点/年/月/日/小时.json
 */
function saveData(siteName, year, month, day, hour, data) {
  const dir = path.join(DATA_DIR, siteName, String(year), String(month).padStart(2, '0'), String(day).padStart(2, '0'));
  ensureDir(dir);
  const filePath = path.join(dir, `${String(hour).padStart(2, '0')}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`已保存: ${filePath}`);
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

/**
 * 主入口：每小时抓取当前小时数据，并补全当天历史小时
 */
async function main() {
  const now = new Date();
  const currentHour = now.getHours();

  console.log(`开始抓取 - ${now.toISOString()}`);
  console.log(`当前小时: ${currentHour}`);

  try {
    // 1. 抓取并保存当前小时
    await fetchAndSave(now, currentHour);

    // 2. 补全当天 0 ~ currentHour-1 的数据（若文件不存在则抓取）
    const dataDir = path.join(DATA_DIR, SITE_NAME, String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'));
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
  } catch (err) {
    console.error('抓取失败:', err);
    process.exit(1);
  }

  console.log('完成');
}

main();
