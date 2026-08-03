# Pixel Game Hub

## 自定义还没本地化的游戏

打开 `games.json` 顶部的 `customOverrides`，按游戏 `id` 修改即可。

示例：

```js
"slime-jump": {
  "title": "我的新名字",
  "coverImage": "./assets/covers/slime.png",
  "description": "这里写新的游戏介绍。",
  "url": "https://example.com/game"
}
```

- `title`：页面上显示的游戏名
- `coverImage`：封面图，可填本地路径或网络图片地址；留空会用默认像素文件夹封面
- `description`：游戏描述
- `url`：点击“开始游戏”后跳转的位置；本地化游戏可以填本地页面，比如 `./games/snake/index.html`
- `videoUrl`：点击“查看视频”后跳转的位置；没有视频地址时按钮会显示为“暂无视频”

只有填了 `url` 的游戏才会计入“可试玩”，也只有这些游戏会被“随机开玩”抽中。没有接入入口的作品仍然可以展示名称、封面、描述和标签，但按钮会显示为“待接入”。

真正已经本地化的游戏，例如 `pixel-snake`，直接在 `games` 对应条目里维护。

## 预览页面

由于页面现在会读取 `games.json`，不要直接双击 `index.html` 预览。请用本地服务器打开：

```bash
node tests/static-server.js
```

然后访问：

```text
http://127.0.0.1:4173
```

