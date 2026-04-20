---
title: "Frida常用API记录(Frida 17+)"
description: "记录一下 Frida 17+ 下 Java Hook 和 native/so Hook 的常用 API"
pubDate: "2026-04-20"
draft: false
---

# Frida相关api(Frida 17+)

> 这篇是对旧 `Frida常用API记录` 的补充，主要记录 **Frida 17+** 下更推荐的 API 写法。  
> 老思路没怎么变，主要变化在于：
>
> 1. `Java` bridge 不再默认打包进 GumJS runtime  
> 2. 很多旧的 `Module.*` 静态 API 已经不再推荐继续使用

## 先记最重要的

### 1. REPL / 直接加载 js

这种方式大多还是和以前一样：

```bash
frida -U -f com.xxx.app -l hook.js
```

### 2. 自定义 agent / frida-compile

这种需要显式导入 bridge：

```javascript
import Java from "frida-java-bridge";
```

## 通用信息

### Frida 版本

```javascript
console.log(Frida.version);
```

### 当前脚本运行时

```javascript
console.log(Script.runtime);
```

## Java 层

### Java 是否可用

```javascript
console.log(Java.available);
console.log(Java.androidVersion);
```

### `Java.perform`

最常用入口。

```javascript
Java.perform(function () {
    console.log("inside Java.perform");
});
```

### `Java.performNow`


```javascript
Java.performNow(function () {
    console.log("performNow");
});
```

### `Java.use`

```javascript
Java.perform(function () {
    const Activity = Java.use("android.app.Activity");
    console.log(Activity);
});
```

### `Java.choose`


```javascript
Java.perform(function () {
    Java.choose("android.app.Activity", {
        onMatch(instance) {
            console.log("found:", instance);
        },
        onComplete() {
            console.log("done");
        }
    });
});
```

### `Java.retain`


```javascript
Java.perform(function () {
    const Activity = Java.use("android.app.Activity");
    let lastActivity = null;

    Activity.onResume.implementation = function () {
        lastActivity = Java.retain(this);
        return this.onResume();
    };
});
```

### `Java.cast`

```javascript
Java.perform(function () {
    const Activity = Java.use("android.app.Activity");
    const obj = Java.cast(ptr("0x1234"), Activity);
    console.log(obj);
});
```

### `Java.array`

```javascript
Java.perform(function () {
    const bytes = Java.array("byte", [0x41, 0x42, 0x43]);
    console.log(bytes.length);
});
```

### 枚举已加载类

```javascript
Java.perform(function () {
    const classes = Java.enumerateLoadedClassesSync();
    for (let i = 0; i < classes.length; i++) {
        if (classes[i].indexOf("okhttp") !== -1) {
            console.log(classes[i]);
        }
    }
});
```

### 枚举类加载器

```javascript
Java.perform(function () {
    const loaders = Java.enumerateClassLoadersSync();
    for (let i = 0; i < loaders.length; i++) {
        console.log(loaders[i].toString());
    }
});
```

### `Java.enumerateMethods`


```javascript
Java.perform(function () {
    const groups = Java.enumerateMethods("*okhttp*!*header*/su");
    console.log(JSON.stringify(groups, null, 2));
});
```

### `Java.ClassFactory.get`

遇到 class loader 问题时很好用。

```javascript
Java.perform(function () {
    const loaders = Java.enumerateClassLoadersSync();

    for (let i = 0; i < loaders.length; i++) {
        try {
            const factory = Java.ClassFactory.get(loaders[i]);
            const Target = factory.use("com.xxx.TargetClass");
            console.log("found:", Target);
            break;
        } catch (e) {
        }
    }
});
```

### `Java.openClassFile`

动态加载 dex 时常用。

```javascript
Java.perform(function () {
    const dex = Java.openClassFile("/data/local/tmp/test.dex");
    console.log(dex.getClassNames());
    dex.load();
});
```

### `Java.scheduleOnMainThread`

```javascript
Java.perform(function () {
    Java.scheduleOnMainThread(function () {
        console.log("run on main thread");
    });
});
```

### `Java.backtrace`

```javascript
Java.perform(function () {
    const trace = Java.backtrace({ limit: 16 });
    console.log(JSON.stringify(trace, null, 2));
});
```

### `Java.vm.tryGetEnv`

JNI 场景里会用到。

```javascript
Java.perform(function () {
    const env = Java.vm.tryGetEnv();
    console.log(env);
});
```

## Java Hook 常用模板

### Hook 普通方法

```javascript
Java.perform(function () {
    const Target = Java.use("com.xxx.Target");

    Target.someMethod.implementation = function (a) {
        console.log("param:", a);
        const result = this.someMethod(a);
        console.log("result:", result);
        return result;
    };
});
```

### Hook 重载方法

```javascript
Java.perform(function () {
    const Utils = Java.use("com.xxx.Utils");

    Utils.getCalc.overload("int", "int").implementation = function (a, b) {
        console.log(a, b);
        return this.getCalc(a, b);
    };
});
```

### Hook 构造函数

```javascript
Java.perform(function () {
    const Money = Java.use("com.xxx.Money");

    Money.$init.implementation = function (a, b) {
        console.log(a, b);
        return this.$init("dollar", 200);
    };
});
```

## Native / so 层

### 先拿模块对象

Frida 17+ 推荐先拿模块对象，再在它上面做事。

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
console.log(libxxx.name, libxxx.base, libxxx.size, libxxx.path);
```

### 模块可能未加载

```javascript
const libxxx = Process.findModuleByName("libxxx.so");
if (libxxx === null) {
    console.log("not loaded");
}
```

### 取模块基址

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
console.log(libxxx.base);
```

### 枚举导入表

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
const imports = libxxx.enumerateImports();
console.log(imports);
```

### 枚举导出表

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
const exports = libxxx.enumerateExports();
console.log(exports);
```

### 枚举符号表

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
const symbols = libxxx.enumerateSymbols();
console.log(symbols);
```

### 取模块导出符号

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
const addAddr = libxxx.getExportByName("add");
console.log(addAddr);
```

### 取全局导出符号

比如 `dlopen`、`android_dlopen_ext`、`open` 这种。

```javascript
const dlopen = Module.getGlobalExportByName("dlopen");
console.log(dlopen);
```

### 枚举模块

```javascript
const modules = Process.enumerateModules();
for (let i = 0; i < modules.length; i++) {
    console.log(modules[i].name, modules[i].base);
}
```

### 根据地址找模块

```javascript
const module = Process.findModuleByAddress(ptr("0x1234"));
console.log(module);
```

## Native Hook 常用模板

### `Interceptor.attach`

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
const funcAddr = libxxx.base.add(0x1234);

Interceptor.attach(funcAddr, {
    onEnter(args) {
        console.log(args[0], args[1]);
    },
    onLeave(retval) {
        console.log("retval:", retval);
    }
});
```

### 修改参数和返回值

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
const addAddr = libxxx.getExportByName("add");

Interceptor.attach(addAddr, {
    onEnter(args) {
        args[2] = ptr(1000);
    },
    onLeave(retval) {
        retval.replace(20000);
    }
});
```

### `NativeFunction`

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
const addAddr = libxxx.getExportByName("add");
const addFunc = new NativeFunction(addAddr, "int", ["int", "int"]);

console.log(addFunc(1, 2));
```

### `NativeCallback`

```javascript
const callback = new NativeCallback(function (a, b) {
    console.log(a, b);
    return 0;
}, "int", ["pointer", "pointer"]);
```

## 内存相关

### 读字符串

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
console.log(libxxx.base.add(0x2C00).readCString());
```

### 读字节

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
console.log(libxxx.base.add(0x2C00).readByteArray(16));
```

### 写字节

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
const addr = libxxx.base.add(0x2C00);
addr.writeByteArray([0x41, 0x42, 0x43, 0x44]);
```

### hexdump

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
console.log(hexdump(libxxx.base.add(0x2C00)));
```

### 申请内存

```javascript
const buf = Memory.alloc(0x100);
const str = Memory.allocUtf8String("Jeremiah");
console.log(buf, str.readCString());
```

### 修改内存权限

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
Memory.protect(libxxx.base, libxxx.size, "rwx");
```

### Patch 代码

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
const codeAddr = libxxx.base.add(0x1234);

Memory.patchCode(codeAddr, 8, function (code) {
    const writer = new Arm64Writer(code, { pc: codeAddr });
    writer.putNop();
    writer.putNop();
    writer.flush();
});
```

## 其他常用点

### `Thread.backtrace`

```javascript
Interceptor.attach(Module.getGlobalExportByName("open"), {
    onEnter(args) {
        console.log(
            Thread.backtrace(this.context, Backtracer.ACCURATE)
                .map(DebugSymbol.fromAddress)
                .join("\n")
        );
    }
});
```

### `DebugSymbol.fromAddress`

```javascript
console.log(DebugSymbol.fromAddress(ptr("0x1234")));
```

### `ApiResolver`

模糊找导出符号很方便。

```javascript
const resolver = new ApiResolver("module");
const matches = resolver.enumerateMatches("exports:*!open*");
console.log(matches);
```

## 最后给一张最常见对照表

```javascript
// 旧一点的写法
Module.findBaseAddress("libxxx.so");
Module.findExportByName("libxxx.so", "add");
Module.findExportByName(null, "dlopen");
Module.enumerateExports("libxxx.so");

// Frida 17+ 更推荐
const libxxx = Process.getModuleByName("libxxx.so");
libxxx.base;
libxxx.getExportByName("add");
Module.getGlobalExportByName("dlopen");
libxxx.enumerateExports();
```

## 总结


1. 自定义 agent 记得显式引入 `frida-java-bridge`
2. Java 层重点还是 `Java.perform / Java.use / overload / ClassLoader`
3. Native 层优先使用 `Process.getModuleByName(...).xxx()` 
