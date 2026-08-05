# Pixel Game Hub

## 文件结构

项目根目录的 `index.html` 是上传入口文件，页面样式在 `style.css`，页面脚本在 `script.js`，游戏数据在 `games.json`。图片资源可以放进 `images/`，已经本地化的游戏页面放在 `games/` 目录里。

## 自定义还没本地化的游戏

打开 `games.json` 顶部的 `customOverrides`，按游戏 `id` 修改即可。

示例：

```js
"slime-jump": {
  "title": "我的新名字",
  "coverImage": "./images/your-cover.png",
  "description": "这里写新的游戏介绍。",
  "url": "https://example.com/game"
}
```

- `title`：页面上显示的游戏名
- `coverImage`：封面图，可填 `./images/你的图片.png` 这样的本地路径，也可填 `https://` 开头的网络图片地址；留空会用默认像素文件夹封面
- `description`：游戏描述
- `url`：点击“开始游戏”后跳转的位置；本地化游戏可以填本地页面，比如 `./games/snake/index.html`
- `videoUrl`：点击“查看视频”后跳转的位置；没有视频地址时按钮会显示为“暂无视频”

只有填了 `url` 的游戏才会计入“可试玩”，也只有这些游戏会被“随机开玩”抽中。没有接入入口的作品仍然可以展示名称、封面、描述和标签，但按钮会显示为“待接入”。

真正已经本地化的游戏，例如 `pixel-snake`，直接在 `games` 对应条目里维护。

## 自动导入作品

如果要把标题、封面、简介、分类和游戏入口一次性导入，先把作品包放进 `incoming/`：

```text
incoming/my-demo/
├── game.json
├── index.html
└── cover.png
```

然后运行：

```bash
npm run game:import -- ./incoming/my-demo
```

导入脚本会自动复制游戏文件和封面，并更新 `games.json`。作品包格式见 `incoming/README.md`。

## 预览页面

由于页面现在会读取 `games.json`，不要直接双击 `index.html` 预览。请用本地服务器打开：

```bash
node tests/static-server.js
```

然后访问：

```text
http://127.0.0.1:4173
```

## 测试

```bash
npm test
```

`test:source-snapshot` 只检查页面源码、样式、脚本和数据文件的契约哈希；真实页面加载、筛选、搜索、游戏入口和本地记录会由 Playwright 浏览器测试覆盖。

## 隐私泄露检查

GitHub CI 已接入 Gitleaks，会在推送和 Pull Request 时扫描仓库历史，防止 token、密码、密钥等敏感信息被提交。

如果本机已经安装 Gitleaks，也可以手动运行：

```bash
npm run secrets:scan
```

