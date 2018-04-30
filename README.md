# Console Lite

[![Travis](https://img.shields.io/travis/CircuitCoder/Console-Lite.svg?style=flat-square)](https://travis-ci.org/CircuitCoder/Console-Lite)
[![AppVeyor](https://img.shields.io/appveyor/ci/CircuitCoder/console-lite.svg?style=flat-square)](https://ci.appveyor.com/project/CircuitCoder/console-lite)
[![David](https://img.shields.io/david/CircuitCoder/Console-Lite.svg?style=flat-square)](https://david-dm.org/CircuitCoder/Console-Lite)
[![David Dev](https://img.shields.io/david/dev/CircuitCoder/Console-Lite.svg?style=flat-square)](https://david-dm.org/CircuitCoder/Console-Lite)

A next-generation MUN hosting software.

## 下载
[Download](https://jiejiss.xyz/cle)

## 开发
在 Clone 项目过后，请使用以下指令安装依赖:

```bash
npm install
npm run rebuildNative # Rebuild native modules for Electron
```

注意：这一步需要`Node_ABI === ELECTRON_ABI`

启动应用：

```bash
npm start
```

启动服务器：

```bash
npm run server 
```

生成可执行文件：

```bash
npm prune --producation # 删除开发依赖
npm install electron-packager # 重新安装打包器
npm install electron # 重新安装Electron。一些module使用了`process.EventEmitter [deprecated]`，因此可能需要手动修改。
npm run pack
npm install # 重新安装开发依赖
```

## 许可证

本项目所有代码在 MIT 协议下发布，详细信息请参考 LICENSE 文件
