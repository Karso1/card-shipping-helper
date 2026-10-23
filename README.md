# 开卡申请寄送卡片助手 / Card Shipping Helper

在后台“开卡申请管理”页面批量处理制卡中申请：上传图片、选择地址并提交寄送。

Processes card shipping requests on the card application page, including image upload, address selection, and submission.

## 中文

### 安装与运行

1. 先将 `manifest.json` 中的 `https://example.com/*` 改成实际后台网址，再在 Chrome 打开 `chrome://extensions`，开启开发者模式，点击“加载已解压的扩展程序”，选择本文件夹。
2. 打开对应后台页面并刷新，按页面筛选条件确认处理范围，然后使用浮动面板启动。
3. 停止后导出日志，逐笔核对跳过和结果待核实的记录。

更详细的操作、版本变更及限制见 [使用说明.txt](使用说明.txt)。

### 知识点

Chrome Manifest V3 内容脚本、DOM 控件定位、异步等待与重试、失败日志和避免重复提交。

### 注意

此脚本会在已登录的后台执行真实业务操作。首次使用先限定少量记录，核对页面筛选、结果和日志。界面结构变化可能导致识别失败。

## English

### Install and run

1. Replace `https://example.com/*` in `manifest.json` with your admin site origin. Then open `chrome://extensions`, enable Developer mode, and load this directory as an unpacked extension.
2. Open and refresh the relevant admin page, confirm its filters, then start from the floating panel.
3. Export the log and review skipped records and uncertain outcomes.

See [使用说明.txt](使用说明.txt) for detailed behavior, version history, and limitations.

### Concepts

Manifest V3 content scripts, DOM targeting, asynchronous waits and retries, failure logs, and duplicate-submission safeguards.

### Caution

This extension performs real actions in a signed-in admin session. Start with a small batch and verify filters, outcomes, and logs. Changes to the site UI may break selectors.
