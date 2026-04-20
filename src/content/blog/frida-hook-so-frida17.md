---
title: "Frida Hook so(Frida 17+)"
description: "记录 Frida 17+ 下 native/so Hook 常用 API 的新写法"
pubDate: "2026-04-20"
draft: false
---

# Frida Hook so(Frida 17+)

> https://frida.re/news/2025/05/17/frida-17-0-0-released/   
> 本文是对旧笔记的补充，主要记录 **Frida 17+** 下 native/so Hook 的常用写法。  
> 原来的思路和大部分 Hook 技巧并没有过时，主要变化在于 **静态 `Module.*` API 被移除**，所以很多旧脚本需要改写。

## 先记一条最重要的

Frida 17 之后，下面这些旧写法不要再继续用了：

```javascript
Module.findBaseAddress("libxxx.so");
Module.findExportByName("libxxx.so", "add");
Module.enumerateImports("libxxx.so");
Module.enumerateExports("libxxx.so");
Module.enumerateSymbols("libxxx.so");
```

对应的新写法是：

```javascript
const libxxx = Process.getModuleByName("libxxx.so");

libxxx.base;
libxxx.getExportByName("add");
libxxx.enumerateImports();
libxxx.enumerateExports();
libxxx.enumerateSymbols();
```

如果要找**全局导出符号**，比如 `dlopen`、`android_dlopen_ext` 这种，不再写 `Module.findExportByName(null, "...")`，改成：

```javascript
const dlopen = Module.getGlobalExportByName("dlopen");
const android_dlopen_ext = Module.getGlobalExportByName("android_dlopen_ext");
```

## 先拿到模块对象

后面很多操作都依赖模块对象，所以通常先取一次模块，后面重复用。

```javascript
const libxxx = Process.getModuleByName("libxxx.so");

console.log("name:", libxxx.name);
console.log("base:", libxxx.base);
console.log("size:", libxxx.size);
console.log("path:", libxxx.path);
```

如果模块可能还没加载，可以先判断：

```javascript
const libxxx = Process.findModuleByName("libxxx.so");
if (libxxx === null) {
    console.log("libxxx.so not loaded");
} else {
    console.log(libxxx.base);
}
```

## 枚举各种

### 1. 枚举导入表

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
const imports = libxxx.enumerateImports();

for (let i = 0; i < imports.length; i++) {
    if (imports[i].name === "strncat") {
        console.log(JSON.stringify(imports[i]));
        console.log(imports[i].address);
        break;
    }
}
```

### 2. 枚举导出表

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
const exports = libxxx.enumerateExports();

for (let i = 0; i < exports.length; i++) {
    console.log(JSON.stringify(exports[i]));
}
```

### 3. 枚举符号表

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
const symbols = libxxx.enumerateSymbols();
console.log(symbols);
```

> `enumerateSymbols()` 不是所有平台都支持，Android/Linux 这类 ELF 场景更常用。

### 4. 枚举模块

```javascript
const modules = Process.enumerateModules();
for (let i = 0; i < modules.length; i++) {
    console.log(modules[i].name, modules[i].base, modules[i].path);
}
```

## Hook 导出函数

### 步骤一：获取导出函数地址

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
const addAddr = libxxx.getExportByName("add");
console.log(addAddr);
```

### 步骤二：Interceptor.attach

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
const addAddr = libxxx.getExportByName("add");

Interceptor.attach(addAddr, {
    onEnter(args) {
        console.log(args[0]);
        console.log(this.context.x1);
        console.log(args[2].toInt32());
    },
    onLeave(retval) {
        console.log("retval", retval, retval.toInt32());
    }
});
```

## Hook 任意函数

导出表、导入表、符号表里找不到时，还是老思路：**模块基址 + 偏移**。

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
const funcAddr = libxxx.base.add(0x23F4); // ARM Thumb 模式下需额外考虑 +1

console.log("base:", libxxx.base);
console.log("funcAddr:", funcAddr);

Interceptor.attach(funcAddr, {
    onEnter(args) {
        // 入参处理
    },
    onLeave(retval) {
        console.log("retval:", retval);
    }
});
```

## so Hook 模板

```javascript
function printArg(addr) {
    const range = Process.findRangeByAddress(addr);
    if (range !== null) {
        return hexdump(addr) + "\n";
    }
    return ptr(addr) + "\n";
}

function hookNativeAddr(funcPtr) {
    const module = Process.findModuleByAddress(funcPtr);

    Interceptor.attach(funcPtr, {
        onEnter(args) {
            this.logs = [];
            this.args0 = args[0];
            this.args1 = args[1];

            if (module !== null) {
                this.logs.push(
                    "call " + module.name + "!" + ptr(funcPtr).sub(module.base) + "\n"
                );
            } else {
                this.logs.push("call " + funcPtr + "\n");
            }

            this.logs.push("args0 onEnter: " + printArg(this.args0));
            this.logs.push("args1 onEnter: " + printArg(this.args1));
        },
        onLeave(retval) {
            this.logs.push("args0 onLeave: " + printArg(this.args0));
            this.logs.push("args1 onLeave: " + printArg(this.args1));
            this.logs.push("retval onLeave: " + retval + "\n");
            console.log(this.logs.join(""));
        }
    });
}
```

## 修改函数参数和返回值

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
const addAddr = libxxx.getExportByName("add");

Interceptor.attach(addAddr, {
    onEnter(args) {
        args[2] = ptr(1000);
        console.log("new arg2:", args[2].toInt32());
    },
    onLeave(retval) {
        retval.replace(20000);
        console.log("new retval:", retval.toInt32());
    }
});
```

## Hook dlopen

有些函数会在 so 首次加载后才出现，所以还是要盯 `dlopen` / `android_dlopen_ext`。

```javascript
function hookDlopen(addr, soName, callback) {
    Interceptor.attach(addr, {
        onEnter(args) {
            this.shouldHook = false;

            if (!args[0].isNull()) {
                const name = args[0].readCString();
                if (name !== null && name.indexOf(soName) !== -1) {
                    this.shouldHook = true;
                }
            }
        },
        onLeave(retval) {
            if (this.shouldHook) {
                callback();
            }
        }
    });
}

const dlopen = Module.getGlobalExportByName("dlopen");
const androidDlopenExt = Module.getGlobalExportByName("android_dlopen_ext");

hookDlopen(dlopen, "libxxx.so", hookFunc);
hookDlopen(androidDlopenExt, "libxxx.so", hookFunc);
```

## 读取和写入内存

Frida 17 之后，更推荐直接用 `NativePointer` 实例方法。

### 1. 读字符串

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
console.log(libxxx.base.add(0x2C00).readCString());
```

### 2. Dump 内存

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
console.log(hexdump(libxxx.base.add(0x2C00)));
```

### 3. 读字节

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
console.log(libxxx.base.add(0x2C00).readByteArray(16));
```

### 4. 写字节

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
const addr = libxxx.base.add(0x2C00);

addr.writeByteArray([0x41, 0x41, 0x41, 0x41]);
console.log(hexdump(addr));
```

### 5. 申请新内存

```javascript
const buf1 = Memory.alloc(0x100);
const buf2 = Memory.allocUtf8String("Jeremiah");

console.log(buf1, buf2.readCString());
```

### 6. 修改内存权限

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
Memory.protect(libxxx.base, libxxx.size, "rwx");
```

## Patch 代码

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

## dlsym 的新写法

旧脚本里经常写：

```javascript
Module.findExportByName("libdl.so", "dlsym");
```

Frida 17+ 改成：

```javascript
const libdl = Process.getModuleByName("libdl.so");
const dlsymAddr = libdl.getExportByName("dlsym");

Interceptor.attach(dlsymAddr, {
    onEnter(args) {
        this.symName = args[1].readCString();
    },
    onLeave(retval) {
        const module = Process.findModuleByAddress(retval);
        if (module !== null) {
            console.log(this.symName, retval, module.name, retval.sub(module.base));
        } else {
            console.log(this.symName, retval);
        }
    }
});
```

## 最后给一个迁移对照表

```javascript
// Frida 17 之前
Module.findBaseAddress("libxxx.so");
Module.findExportByName("libxxx.so", "add");
Module.findExportByName(null, "dlopen");
Module.enumerateImports("libxxx.so");
Module.enumerateExports("libxxx.so");
Module.enumerateSymbols("libxxx.so");

// Frida 17+
const libxxx = Process.getModuleByName("libxxx.so");
libxxx.base;
libxxx.getExportByName("add");
Module.getGlobalExportByName("dlopen");
libxxx.enumerateImports();
libxxx.enumerateExports();
libxxx.enumerateSymbols();
```

## 总结

Frida 17+ 下 native/so Hook 的整体思路并没有变，主要就是：

1. 先拿模块对象：`Process.getModuleByName("libxxx.so")`
2. 和模块相关的事情都挂到模块对象上做
3. 全局导出符号改用 `Module.getGlobalExportByName(...)`
4. 内存读写更推荐直接使用 `NativePointer` 的实例方法

把这几条改完，旧脚本迁移到 Frida 17+ 基本就没什么大问题了。
