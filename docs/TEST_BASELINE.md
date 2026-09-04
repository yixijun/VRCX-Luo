# VRCX-Luo 测试与契约基线

> 记录时间：2026-09-04
>
> 用途：M-01 测试与契约门禁的起始基线。后续每个重构切片都必须与本文件中的对应命令对比；失败数量或错误类型增加时，停止当前切片并回滚当前 commit。

## 当前工作树

- 当前分支：`master`
- 基线建立前工作树：干净；当前工作树应在每个独立切片提交后恢复干净
- `updateLoop` scheduler/task 拆分：已完成，不在本轮重复修改
- schema 文件：`docs/schemas/screenshotMetadata-schema.json` 当前可以解析

## 命令结果

| 检查 | 命令 | 结果 | 基线说明 |
|---|---|---|---|
| 前端完整测试 | `npx vitest run --reporter=dot` | **失败** | 223 个文件：199 通过、24 失败；2292 项测试：2204 通过、88 失败；3 个未处理错误 |
| JavaScript 类型检查 | `npm run typecheck:js` | **失败** | `tsc` 当前不可执行，项目缺少可用的 TypeScript CLI |
| C# 测试发现 | `dotnet test Dotnet.Tests/VRCX.Cef.Tests.csproj --no-restore --list-tests -v normal` | **未发现测试** | 项目当前为 `OutputType=Exe`，没有正式测试框架入口；命令本身返回成功不能视为测试通过 |
| C# 手工 smoke | `dotnet run --project Dotnet.Tests/VRCX.Cef.Tests.csproj --no-build` | **通过** | `CloseToTrayDecision` smoke 用例通过 |
| JSON Schema 解析 | PowerShell `ConvertFrom-Json` | **通过** | 当前 JSON 语法有效；后续应增加自动回归检查 |
| Oxlint | `npm run lint:oxlint` | **失败** | 79 个 warning、45 个 error；本轮不顺带修复业务 lint 债务 |
| 格式检查 | `npm run format:check` | **失败** | 209 个文件存在格式差异；本轮只记录，不做全仓格式化 |

## M-01.3 后置验证

2026-09-04，`Dotnet.Tests` 已从自定义 `Main` smoke runner 转为正式 xUnit 测试项目。原有 WinForms 验证逻辑保留，由 STA 辅助器在测试线程中执行。

| 检查 | 命令 | 结果 |
|---|---|---|
| C# 测试发现 | `dotnet test Dotnet.Tests/VRCX.Cef.Tests.csproj --no-build --list-tests` | **通过**：发现 3 个测试 |
| C# 自动化测试 | `dotnet test Dotnet.Tests/VRCX.Cef.Tests.csproj --no-restore` | **通过**：3/3 |
| C# 测试项目构建 | `dotnet build Dotnet.Tests/VRCX.Cef.Tests.csproj --no-restore` | **通过**：0 警告、0 错误 |
| 前端 updateLoop 定向测试 | `npx vitest run src/stores/updateLoopTasks --reporter=dot` | **通过**：12 个文件、26 项测试 |
| Schema 结构检查 | `npm run check:schema` | **通过**：5 个属性 |

本切片只涉及 `Dotnet.Tests` 测试项目和测试代码；未修改产品运行时、公共接口、序列化格式或并发逻辑。

## 失败分类

### 完整前端测试

当前失败主要分为以下几类，后续修复必须逐类、逐切片处理：

1. 测试 mock 未覆盖新增导出，例如 `i18n.global`、`DropdownMenuPortal`、通知设置 store 和 coordinator 方法。
2. jsdom 能力不足或测试替身不完整，例如 Canvas、导航和剪贴板行为。
3. 既有测试依赖真实更新请求或数据库方法，导致异步错误和未处理 rejection。
4. 个别测试存在超时或断言与当前实现漂移。

### 质量门禁

- `typecheck:js`：先决定正式的 JavaScript 类型检查入口，再补齐工具和配置；不要把一个不可执行的脚本直接设为强制门禁。
- `Dotnet.Tests`：已引入正式测试框架和可发现的测试项目，并接入 Windows CI job；继续保留 WinForms 的 STA 线程约束。
- Oxlint / Oxfmt：先建立“新增代码不得增加错误”的增量规则，不在本任务中一次性重排全仓文件。
- Schema：增加单独的解析/结构检查，防止文件再次出现语法漂移。

## 后续门禁规则

每个重构切片必须满足：

1. 修改前运行受影响模块测试，并记录失败数量和错误分类。
2. 只做一个逻辑变更，保持公共 interface、序列化格式和并发语义不变。
3. 修改后重复同一组测试；既有失败不得增加，新增失败必须归因并修复。
4. 通过后创建一个独立 Git commit；失败时只回滚当前切片。
5. 只有当完整测试和对应质量检查均有可解释结果，才进入下一个 seam。
