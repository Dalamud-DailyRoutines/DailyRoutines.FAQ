---
title: DailyRoutines IPC
---

提供给插件开发者调用的 IPC 接口

### DailyRoutines.IsModuleEnabled

- 输入: string (模块内部名，比如 AutoAntiCensorship)
- 返回值: bool? (bool值指示模块当前的加载状态, true 为已加载，false 为已卸载，null 表示模块不存在)

### DailyRoutines.LoadModule

- 输入: string (模块内部名)
- 返回值: bool? (bool值指示模块当前的加载状态，null 表示模块不存在)

### DailyRoutines.UnloadModule

- 输入: string (模块内部名)
- 返回值: bool? (bool值指示模块当前的加载状态，null 表示模块不存在)

### DailyRoutines.Version

- 输入: 无
- 返回值: System.Version? (获取 DailyRoutines 插件的版本)