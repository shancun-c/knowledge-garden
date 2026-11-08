# 知序 · Knowledge Garden

自托管的个人知识卡片与间隔复习工具。将知识组织成树，把截图、PDF 和学习笔记整理成可持续复习的卡片。

## 功能

- 知识树：主题、子节点、卡片归属与知识关联。
- 卡片管理：搜索、标签、拖动排序、数学公式、图片与学习笔记。
- 间隔复习：FSRS-6 调度、学习范围、撤销评分与个人参数优化。
- AI 辅助：截图制卡、PDF 按页分批生成草稿、关联推荐和配图；审核后再保存。
- 桌面和移动端学习界面、本地草稿恢复、显式保存与失败重试。
- 按认证用户隔离的文件存储、修订冲突检查、JSON 导入与导出。

## 技术与运行条件

Next.js 16、React 19、TypeScript、Tailwind CSS 4、ts-fsrs。使用 Node.js 22.13+ 和 npm；依赖版本以 `package-lock.json` 为准。建议在目标服务器平台安装和构建，FSRS 参数优化依赖原生模块。

本仓库发布当前自托管版本。保留了部分 Sites / Cloudflare 开发工具，推荐使用下列 `selfhost` 命令。

## 安装与验证

```bash
git clone https://github.com/shancun-c/knowledge-garden.git
cd knowledge-garden
npm ci
cp .env.example .env.local
# 编辑 .env.local，设置自己的随机代理密钥和访问地址
npm run build:selfhost
npm run start:selfhost
```

应用监听 `127.0.0.1:4187`，必须通过可信认证反向代理使用。直接打开应用端口不会得到已登录身份。代理需完成 Basic Auth，覆盖 `x-knowledge-user`，并设置与应用环境一致的 `x-knowledge-proxy-secret`。不要向公网直接开放 Node 端口。

完整认证、HTTPS、systemd、持久化与回滚说明见 [部署指南](deploy/README.md)，配置样例见 [Nginx 模板](deploy/nginx.conf.template) 和 [systemd 服务](deploy/knowledge-garden.service)。`.env.local` 用于本地 Next.js；systemd 部署使用指南中的独立环境文件。

```bash
node --experimental-strip-types --test tests/*.test.ts
npx tsc --noEmit
npm run build:selfhost
```

## 数据与 AI

- 初次运行是空知识库，不附带作者的卡片、账户、截图、服务器配置或密钥。
- 每个数据目录只能运行一个应用进程；该文件存储方案不适用于多实例并发部署。
- 在「设置与数据 → OpenAI 连接」配置自己的 API Key 和模型。AI 功能会将所选资料发送给模型服务并可能产生费用；保存连接设置本身不会调用模型。
- AI 生成结果需要人工核对。PDF 当前最多 30 MB / 200 页，分批处理；模型需支持相应的图片、PDF 输入和结构化输出。
- PDF 请求的反向代理超时建议设为 210 秒；通用 Nginx 模板为 90 秒，使用 PDF 功能前需按实际请求调整。
- 浏览器草稿不跨设备同步。定期备份数据目录，并私密保管代理密钥；该密钥也用于加密保存的 AI 设置。

## 项目结构

- `app/`：页面、学习界面与 API。
- `lib/`：卡片、调度、存储、AI 与 PDF 逻辑。
- `tests/`：项目行为与回归测试。
- `deploy/`：自托管部署说明及模板。

## 贡献与许可

欢迎提交 Issue 和 Pull Request。请在提交前运行相关测试、类型检查和构建，不要在问题描述中上传真实密钥、个人卡片或账户信息。

项目原创代码采用 [MIT License](LICENSE)。第三方组件和依赖遵循各自许可证；仓库保留 `vendor/` 和 `scripts/vite/` 中已有的第三方许可文件。
