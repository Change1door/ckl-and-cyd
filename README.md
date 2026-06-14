# 🌸 Travel Diary · 牡蛎游乐园

一个 Y2K / 卡通手账风格的个人旅行网站。

- **index.html** —— Loading + 双按钮（ENTER → 主页 / OR? → 地图）
- **about.html** —— 个人简介 + 照片墙
- **map.html** —— Leaflet 世界地图 + 13 个示例城市点位

## ✨ 特性

| 特性 | 实现 |
| --- | --- |
| VHS 老电视扫描线 + 暗角 | CSS `body::before / ::after` + `mix-blend-mode` |
| 飘落 Emoji 粒子（蝴蝶 / 樱花 / 爱心） | Canvas + `requestAnimationFrame` |
| 流星光标 + 拖尾星星 | 鼠标事件 + CSS 动画 |
| 点击页面任意位置弹出 +1 Emoji | DOM 临时节点 |
| 复古 Win98 边框小窗口 | CSS `box-shadow` 复合 |
| Leaflet 水彩风格地图 + 自定义 emoji pin | Leaflet 1.9 + `divIcon` |
| 复古音乐播放器（右下角） | HTML5 `<audio>` + localStorage 配置 |
| 4 种字体混排（VT323 / Press Start 2P / Patrick Hand） | Google Fonts |

## 🚀 本地启动

```bash
cd travel-diary
python3 -m http.server 8765
# 打开 http://127.0.0.1:8765/
```

> ⚠️ 必须用 HTTP 服务器打开，不能直接 `file://` 双击，因为 `map.js` 要 `fetch('data/trips.json')`，浏览器对本地文件 fetch 会失败（有 FALLBACK 兜底，但仍推荐起 server）。

## ✏️ 如何改数据

### 加一个城市
编辑 `data/trips.json`：

```json
{
  "city": "厦门",
  "country": "CN",
  "lat": 24.4798,
  "lng": 118.0894,
  "date": "2025-01",
  "photo": "https://example.com/photo.jpg",
  "note": "在鼓浪屿吃了一碗沙茶面。"
}
```

- `lat` / `lng`：经纬度（小数）
- `photo`：可以是外链，也可以放 `assets/photos/xxx.jpg` 后用相对路径
- `note`：点 pin 弹窗里那行小字

### 换背景音乐
打开浏览器控制台：

```js
localStorage.setItem('bgm', JSON.stringify({
  src: 'assets/audio/your-song.mp3',
  name: '歌名 - 艺人'
}));
location.reload();
```

### 换头像 / 照片墙
改 `about.html` 里 `<img src="https://picsum.photos/seed/...">` 为你自己的图片（建议丢进 `assets/photos/` 后用相对路径）。

## 🌐 部署

直接 push 到 GitHub 后开启 Pages，或丢 Vercel / Netlify 静态托管。零后端。

## 🗂️ 目录

```
travel-diary/
├── index.html          首页（loading + 双按钮）
├── about.html          主页
├── map.html            地图页
├── css/
│   ├── base.css        全局：配色/字体/VHS/光标/飘落
│   ├── landing.css     首页
│   └── map.css         地图页
├── js/
│   ├── cursor.js       流星光标
│   ├── confetti.js     飘落 Emoji
│   ├── landing.js      首页进度条 + 跳转
│   ├── map.js          Leaflet 地图 + 城市
│   └── music.js        复古播放器
└── data/
    └── trips.json      旅行数据
```

## 📌 后续可加

- 城市之间连虚线飞行路线
- 时间线视图（按日期排序）
- Markdown 行程自动生成城市 pin
- 后台管理（新增 / 编辑 / 删除）
- 把照片上传到图床后引用云端链接