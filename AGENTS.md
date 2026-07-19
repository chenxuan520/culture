# 项目维护说明

## 语言与提交

- 本仓库沟通和文档优先使用中文。
- Git commit message 使用英文，保持当前仓库的简短祈使句风格。
- 提交前先查看最近提交历史，沿用现有格式。

## 项目目标

这是一个纯静态六边形 RTS / 文明原型。核心目标是让玩家通过城市生产、工人开荒、科研解锁和单位指挥完成实时对战。

不要把难度建立在电脑开局作弊上。AI 难度应主要来自更快、更正确的决策，而不是开局资源、科技、血量、伤害或护甲领先。

## 关键设计约束

- 基础开荒必须有意义。
- 农场、矿山、伐木场开局可建，不需要科技。
- 星晶实验站、深层萃取井、日冕电站等高级设施可以保留科技门槛。
- 主城自身资源增长不能过快，资源设施和扩张应成为主要经济来源。
- 开局科研为 0，默认科研脉冲为 +1。
- 不要通过随意拉长生产时间来解决经济问题，除非需求明确要求调整生产时间。
- 玩家手动命令优先级最高。工人 AI、自动索敌、自动追击不能抢掉玩家刚下达的移动、停止、攻击或驻守命令。
- 右键用于取消选择；无单位选择时右键拖动地图。
- WASD 和方向键只移动视野，不再绑定攻击命令。

## 浏览器验证

涉及页面、交互、视觉、输入或 GitHub Pages 的改动，必须用 Chrome DevTools MCP 验证。

不要用 Playwright、Puppeteer、Selenium、headless Chrome 或临时浏览器脚本替代 MCP。

本地静态文件可能被缓存。验证页面脚本更新时，用带 cache-buster 的 URL，例如：

```text
file:///Users/bytedance/self/culture/index.html?cb=<timestamp-or-topic>
```

或用 MCP 的忽略缓存刷新。

## 测试

改动后至少运行：

```bash
for file in assets/js/*.js; do node --check "$file" || exit 1; done
node --check tests/game-regression.test.js
npm test
git diff --check
```

如果改了浏览器交互，还要用 MCP 验证真实页面行为。

## GitHub Pages

GitHub Pages 通过 `.github/workflows/pages.yml` 从 `main` 分支自动发布。

如果 Pages 没更新，检查：

- GitHub Actions 是否成功。
- GitHub Pages Source 是否设置为 GitHub Actions。
- README 中的 Pages 地址是否仍正确。

## 文件职责

- `index.html`：页面入口、首页设置、帮助文档主体。
- `assets/js/01-world-data.js`：基础数据，包括科技、单位、建筑、资源和地图。
- `assets/js/02-simulation.js`：经济、科研、生产、寻路、战斗和工人建设。
- `assets/js/03-interface-tutorial.js`：面板、教程、帮助、按钮交互。
- `assets/js/04-rendering.js`：Canvas 渲染。
- `assets/js/05-bootstrap.js`：输入、启动、主循环。
- `assets/js/06-enhancements.js`：增强规则、阵营、AI、音频、难度。
- `assets/js/07-map-interactions.js`：框选、右键拖图、设置和帮助面板。
- `tests/game-regression.test.js`：回归测试。

## 常见回归点

- 玩家选择灰烬军团时，敌方必须使用星火联盟单位和颜色。
- 电脑不能开局资源领先。
- 开局基础工人建设不能被科技卡死。
- 工人默认 AI 设置必须影响开局工人和后续生产工人。
- 手动移动工人必须关闭该工人的 AI 并清掉当前工地。
- 手动移动士兵不能立刻被自动索敌抢回去。
- 生产快捷键只触发生产，不替换产品图标。
- `H` 打开上次生产基地，`G` 不再作为生产基地快捷键。
