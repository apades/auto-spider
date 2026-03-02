fetch("https://hnsthb.hainan.gov.cn/hngxfb/dataservice/sjcl/api/21408wwfb/air/getSiteCityData?CDDM=469029&JCSJ=2026-03-02+14", {
    "headers": {
        "accept": "application/json, text/plain, */*",
        "accept-language": "zh-CN,zh;q=0.9",
        "authorization": "null",
        "sec-ch-ua": "\"Not:A-Brand\";v=\"99\", \"Google Chrome\";v=\"145\", \"Chromium\";v=\"145\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "Referer": "https://hnsthb.hainan.gov.cn/hngxfb/resources/dist/index.html"
    },
    "body": null,
    "method": "GET"
}).then(res => res.json()).then(data => {
    console.log(data);
});