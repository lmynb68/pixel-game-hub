这里用来临时放待导入的 GodotMaker 作品包。

每个作品一个文件夹，至少包含：

```text
incoming/my-demo/
├── game.json
├── index.html
└── cover.png
```

`game.json` 示例：

```json
{
  "id": "my-demo",
  "title": "我的 DEMO",
  "description": "这里写玩家能看到的作品简介。",
  "category": "动作原型",
  "tags": ["GodotMaker", "动作", "DEMO"],
  "entry": "index.html",
  "cover": "cover.png"
}
```

导入：

```bash
npm run game:import -- ./incoming/my-demo
```

导入后脚本会自动：

- 把作品文件复制到 `games/my-demo/`
- 把封面复制到 `images/my-demo-cover.png`
- 把标题、封面、简介、分类、标签、入口写进 `games.json`

确认导入成功后，可以删除 `incoming/my-demo/` 临时文件夹。

