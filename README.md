# solo-8800002

一个基于 Vite + Vue 3 的纯前端小众业务示例项目，主题是古籍虫蛀修复批次管理。

## 开发

```bash
npm install
npm run dev
```

`vite.config.js` 已显式配置 `server.open = false`，启动开发服务时不会自动打开浏览器。

## 构建

```bash
npm run build
```

## 测试

阶段模型（`src/utils/restorationStages.js`）使用 Node 内置测试运行器，无额外依赖：

```bash
npm test
```
