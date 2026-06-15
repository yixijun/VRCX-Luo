# Bio Diff 英文标点误判问题记录

## 背景

用户个人简介和 Bio 归档都使用 diff 高亮来展示简介变更。

在部分英文简介中，界面上看起来完全相同的英文内容会被错误标记为新增或删除，例如：

- `Kitsune,`
- `maintenance,`
- `monitoring,`

这些词肉眼看起来没有变化，但归档 diff 中仍然出现红色/绿色高亮。

## 现象

打开用户信息页的 Bio 归档弹窗后，某些英文句子被大段标记为变化。

实际观察到的情况是：

- 当前 Bio 与上一条归档 Bio 内容基本一致；
- 中文部分和英文部分混排；
- 英文逗号附近容易出现误判；
- 误判通常不是单个字符高亮，而是导致后续英文片段一起被 diff 算成变化。

## 根因

问题不是 `formatDifference` 本身随机误判，而是历史归档文本中存在视觉上类似英文逗号的 Unicode 字符。

排查日志显示，旧归档文本和新文本在第一个差异处分别为：

| 文本来源 | 字符 | Unicode |
|:---|:---|:---|
| 旧归档 Bio | `‚` | `U+201A` |
| 当前 Bio | `,` | `U+002C` |

`U+201A` 是 single low-9 quotation mark，视觉上很像英文逗号，但它不是普通逗号。

因此 diff 算法认为两段文本不同，并可能把后续英文 token 一起标记为删除/新增。

## 修复策略

只在 Bio 归档 diff 的比较阶段做文本归一化，不修改用户真实 Bio 数据。

当前归档 diff 的归一化处理包括：

- 统一换行符；
- 移除零宽字符；
- 移除行尾空格；
- 使用 `NFKC` 做 Unicode 兼容归一化；
- 将 `U+201A` 归一化为普通英文逗号 `,`。

这样可以避免视觉上等价的英文标点造成假高亮，同时保留真实数据原文。

## 范围说明

该修复只应用于 Bio 归档弹窗的 diff 判断。

个人简介正文里的即时 diff 已恢复为原版逻辑：

```js
formatDifference(baseBio, latestRecord.bio || '')
```

也就是说：

- Bio 归档 diff：使用归档专用归一化包装；
- 个人简介正文 diff：保持原版 `formatDifference` 行为。

## 相关文件

- `src/shared/utils/bioArchiveDiff.js`
- `src/shared/utils/__tests__/bioArchiveDiff.test.js`
- `src/components/dialogs/UserDialog/UserDialogInfoTab.vue`
- `src/components/dialogs/UserDialog/UserDialogInfoTabJirai.vue`
- `src/views/Feed/columns.jsx`

## 验证方式

运行相关测试：

```powershell
npx vitest run src/shared/utils/__tests__/bioArchiveDiff.test.js src/views/Feed/__tests__/columns.test.js
```

当前验证结果：

- 2 个测试文件通过；
- 5 个测试用例通过。

构建 CEF 测试版前端：

```powershell
npm run prod
```

因为 CEF 打包版读取的是 `build/html`，修改前端源码后必须重新构建并重启 `build/Cef/VRCX-Jirai.exe` 才会生效。
