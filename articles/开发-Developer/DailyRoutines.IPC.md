---
title: 本体 IPC 一览
tags: [开发, IPC]
---

## IsModuleEnabled

检查指定模块当前的启用状态

- 名称: `DailyRoutines.IsModuleEnabled`
- 参数
  - `string`: 模块内部名称 (大小写不敏感)
- 返回值 `bool? `
  - `true`: 启用
  - `false`: 禁用
  - `null`: 未找到对应模块

## Version

检查 Daily Routines 当前的版本

- 名称: `DailyRoutines.Version`
- 返回值 `Version`

## LoadModule

开始加载指定模块 (请搭配 `IsModuleEnabled` 检查模块启用/禁用情况)

- 名称: `DailyRoutines.LoadModule`
- 参数
  - `string`: 模块内部名称 (大小写不敏感)
  - `bool`: 是否影响配置
- 返回值 `bool `
  - `true`: 成功开始启用模块
  - `false`: 未找到对应模块

## UnloadModule

开始卸载指定模块 (请搭配 `IsModuleEnabled` 检查模块启用/禁用情况)

- 名称: `DailyRoutines.UnloadModule`
- 参数
  - `string`: 模块内部名称 (大小写不敏感)
  - `bool`: 是否影响配置
  - `bool`: 是否强制卸载
- 返回值 `bool `
  - `true`: 成功开始禁用模块
  - `false`: 未找到对应模块