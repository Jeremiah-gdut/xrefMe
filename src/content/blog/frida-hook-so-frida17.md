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

## Frida 修改 SO 函数代码

### 1. 直接改指定地址的指令

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
libxxx.base.add(0x1684).writeByteArray([0x00, 0x01, 0x09, 0x4b]);
```

### 2. 将对应地址的指令解析成汇编

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
const ins = Instruction.parse(libxxx.base.add(0x1684));
console.log(ins.toString());
```

### 3. 使用 Writer 写汇编

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
const patchAddr = libxxx.base.add(0x167c);

Memory.patchCode(patchAddr, 4, function (code) {
    const writer = new Arm64Writer(code, { pc: patchAddr });
    writer.putNop();
    writer.flush();
});

console.log(Instruction.parse(patchAddr).toString());
```

### 4. 使用 `Memory.patchCode` 写一小段代码

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
const codeAddr = libxxx.base.add(0x167c);

Memory.patchCode(codeAddr, 12, function (code) {
    const writer = new Arm64Writer(code, { pc: codeAddr });
    writer.putBytes([0x00, 0x01, 0x09, 0x4b]);
    writer.putBytes([0xff, 0x83, 0x00, 0x91]);
    writer.putRet();
    writer.flush();
});
```

## SO 层主动调用任意函数

### 1. `NativeFunction`

文档：<https://frida.re/docs/javascript-api/#nativefunction>

语法：

```javascript
new NativeFunction(address, returnType, argTypes[, abi])
```

常见类型：

- `void`
- `pointer`
- `int` / `uint`
- `int64` / `uint64`
- `float` / `double`
- `bool`
- `size_t` / `ssize_t`

### 2. 示例

```javascript
Java.perform(function () {
    const libxxx = Process.getModuleByName("libxxx.so");
    const funcAddr = libxxx.base.add(0x23f4);
    const func = new NativeFunction(funcAddr, "pointer", ["pointer", "pointer"]);

    const env = Java.vm.tryGetEnv();
    console.log("env:", env);

    if (env !== null) {
        const jstr = env.newStringUtf("Je2em1ah is very good!!!");
        const cstr = func(env.handle, jstr);
        console.log(cstr.readCString());
        console.log(hexdump(cstr));
    }
});
```

## Hook libc 读写文件

### 1. 使用 Frida API 写文件

```javascript
const file = new File("/data/local/tmp/xxx.txt", "w");
file.write("Je2em1ah is very good!!!\n");
file.flush();
file.close();
```

### 2. Hook libc 写文件

```javascript
const libc = Process.getModuleByName("libc.so");
const addrFopen = libc.getExportByName("fopen");
const addrFputs = libc.getExportByName("fputs");
const addrFclose = libc.getExportByName("fclose");

const fopen = new NativeFunction(addrFopen, "pointer", ["pointer", "pointer"]);
const fputs = new NativeFunction(addrFputs, "int", ["pointer", "pointer"]);
const fclose = new NativeFunction(addrFclose, "int", ["pointer"]);

const filename = Memory.allocUtf8String("/data/local/tmp/xxx.txt");
const mode = Memory.allocUtf8String("w");
const file = fopen(filename, mode);

const buffer = Memory.allocUtf8String("Jeremiah\n");
const retval = fputs(buffer, file);
console.log("fputs:", retval);

fclose(file);
```

## JNI 函数的 Hook

### 1. Hook libart 里的 JNI 相关函数

```javascript
const libart = Process.getModuleByName("libart.so");
const symbols = libart.enumerateSymbols();

let newStringUtfAddr = null;
for (let i = 0; i < symbols.length; i++) {
    const name = symbols[i].name;
    if (name.indexOf("CheckJNI") === -1 && name.indexOf("NewStringUTF") !== -1) {
        newStringUtfAddr = symbols[i].address;
        break;
    }
}

if (newStringUtfAddr !== null) {
    Interceptor.attach(newStringUtfAddr, {
        onEnter(args) {
            console.log(args[1].readCString());
        }
    });
}
```

### 2. 通过 JNIEnv 函数表算地址

```javascript
Java.perform(function () {
    console.log("Process.arch:", Process.arch);

    const env = Java.vm.tryGetEnv();
    const envVtable = ptr(env.handle).readPointer();
    const newStringUtfAddr = envVtable.add(0x538).readPointer();
    console.log("newStringUtfAddr:", newStringUtfAddr);

    Interceptor.attach(newStringUtfAddr, {
        onEnter(args) {
            console.log(args[1].readCString());
        }
    });
});
```

## 主动调用 JNI 函数

### 1. 使用 Frida 封装的 `JNIEnv` 包装

```javascript
const libxxx = Process.getModuleByName("libxxx.so");
const funcAddr = libxxx.getExportByName("functionName");

Interceptor.attach(funcAddr, {
    onLeave(retval) {
        const env = Java.vm.tryGetEnv();
        const jstr = env.newStringUtf("bbs.125.la");
        retval.replace(jstr);

        const cstr = env.getStringUtfChars(jstr);
        console.log(cstr.readCString());
        console.log(hexdump(cstr));
    }
});
```

### 2. 使用 `NativeFunction` 主动调用

```javascript
Java.perform(function () {
    const libart = Process.getModuleByName("libart.so");
    const symbols = libart.enumerateSymbols();

    let newStringUtf = null;
    for (let i = 0; i < symbols.length; i++) {
        const name = symbols[i].name;
        if (name.indexOf("CheckJNI") === -1 && name.indexOf("NewStringUTF") !== -1) {
            newStringUtf = symbols[i].address;
            break;
        }
    }

    const env = Java.vm.tryGetEnv();
    const newStringUtfFunc = new NativeFunction(newStringUtf, "pointer", ["pointer", "pointer"]);
    const jstring = newStringUtfFunc(env.handle, Memory.allocUtf8String("Je2em1ah"));
    console.log(jstring);

    const envVtable = env.handle.readPointer();
    const getStringUtfChars = envVtable.add(0x548).readPointer();
    const getStringUtfCharsFunc = new NativeFunction(getStringUtfChars, "pointer", ["pointer", "pointer", "pointer"]);
    const cstr = getStringUtfCharsFunc(env.handle, jstring, ptr(0));
    console.log(cstr.readCString());
});
```

## SO 层打印函数调用栈

- 通过 Hook 系统函数打印函数栈，可以快速定位到关键代码。
- Frida 提供的常见写法：

```javascript
console.log(
    Thread.backtrace(this.context, Backtracer.ACCURATE)
        .map(DebugSymbol.fromAddress)
        .join("\n") + "\n"
);
```

## 定位静态注册函数的方法

- 静态注册函数常常会通过 `dlsym` 查符号，所以可以 Hook `dlsym` 来快速定位。

```javascript
function hookDlsym() {
    const libdl = Process.getModuleByName("libdl.so");
    const dlsymAddr = libdl.getExportByName("dlsym");

    Interceptor.attach(dlsymAddr, {
        onEnter(args) {
            this.symName = args[1];
        },
        onLeave(retval) {
            const module = Process.findModuleByAddress(retval);
            if (module !== null) {
                console.log(
                    this.symName.readCString(),
                    retval,
                    module.name,
                    retval.sub(module.base)
                );
            }
        }
    });
}
```

## 定位动态注册函数的方法

- 动态注册会走 `RegisterNatives`，所以 Hook 它就能快速找到 native 函数位置。

```javascript
function hookRegisterNatives() {
    let registerNativesAddr = null;
    const libart = Process.getModuleByName("libart.so");
    const symbols = libart.enumerateSymbols();

    for (let i = 0; i < symbols.length; i++) {
        const name = symbols[i].name;
        if (name.indexOf("CheckJNI") === -1 &&
            name.indexOf("JNI") >= 0 &&
            name.indexOf("RegisterNatives") >= 0) {
            registerNativesAddr = symbols[i].address;
            break;
        }
    }

    if (registerNativesAddr === null) return;

    Interceptor.attach(registerNativesAddr, {
        onEnter(args) {
            const jclass = args[1];
            const className = Java.vm.tryGetEnv().getClassName(jclass);
            const methodsPtr = ptr(args[2]);
            const methodCount = args[3].toInt32();

            console.log("RegisterNatives method counts:", methodCount);
            for (let i = 0; i < methodCount; i++) {
                const name = methodsPtr.add(i * Process.pointerSize * 3).readPointer().readCString();
                const sig = methodsPtr.add(i * Process.pointerSize * 3 + Process.pointerSize).readPointer().readCString();
                const fnPtr = methodsPtr.add(i * Process.pointerSize * 3 + Process.pointerSize * 2).readPointer();
                const mod = Process.findModuleByAddress(fnPtr);

                console.log(
                    "java_class:", className,
                    "name:", name,
                    "sig:", sig,
                    "fnPtr:", fnPtr,
                    "module_name:", mod !== null ? mod.name : "unknown",
                    "offset:", mod !== null ? fnPtr.sub(mod.base) : ptr(0)
                );
            }
        }
    });
}
```

## Frida InlineHook

```javascript
function inlineHook() {
    // 示例 1
    /*
    const libxxx = Process.getModuleByName("libxxx.so");
    const hookAddr = libxxx.base.add(0x17bc);
    Interceptor.attach(hookAddr, {
        onEnter(args) {
            console.log("onEnter:", this.context.x8);
        },
        onLeave(retval) {
            console.log("onLeave:", this.context.x8.toInt32());
            console.log(this.context.x8 & 7);
        }
    });
    */

    // 示例 2
    const libxxx = Process.getModuleByName("libxxx.so");
    const hookAddr = libxxx.base.add(0x1b70);
    Interceptor.attach(hookAddr, {
        onEnter(args) {
            console.log("onEnter:", this.context.x1);
            console.log("onEnter:", hexdump(this.context.x1));
        }
    });
}
```

## Hook `init` or `initArray`

- `init` 段和 `initArray` 的执行时机通常在 `dlopen` 过程中。
- 常见思路是先 Hook `dlopen`，再去盯 linker/linker64 的 `call_constructors`。

```javascript
function hookInitArray() {
    let hooked = false;

    function hookConstructors() {
        if (hooked) return;

        let linker = Process.findModuleByName("linker64");
        if (linker === null) {
            linker = Process.findModuleByName("linker");
        }
        if (linker === null) return;

        const symbols = linker.enumerateSymbols();
        let callConstructorsAddr = null;

        for (let i = 0; i < symbols.length; i++) {
            if (symbols[i].name === "__dl__ZN6soinfo17call_constructorsEv") {
                callConstructorsAddr = symbols[i].address;
                break;
            }
        }

        if (callConstructorsAddr === null) return;

        Interceptor.attach(callConstructorsAddr, {
            onEnter(args) {
                const libxxx = Process.findModuleByName("libxxx.so");
                if (libxxx === null) return;

                const initArrayTest2 = libxxx.base.add(0x2b08);
                const initArrayTest1 = libxxx.base.add(0x2ad8);

                Interceptor.replace(initArrayTest2, new NativeCallback(function (a) {}, "int", ["int"]));
                Interceptor.replace(initArrayTest1, new NativeCallback(function (a) {}, "int", ["int"]));
                hooked = true;
            }
        });
    }

    const dlopen = Module.getGlobalExportByName("dlopen");
    const androidDlopenExt = Module.getGlobalExportByName("android_dlopen_ext");

    [dlopen, androidDlopenExt].forEach(function (addr) {
        Interceptor.attach(addr, {
            onEnter(args) {
                const soName = args[0].readCString();
                if (soName.indexOf("libxxx.so") !== -1) {
                    hookConstructors();
                }
            }
        });
    });
}
```

## Hook `JNI_OnLoad`

- 注入点一般放在 `dlopen` 加载结束之后更稳。

```javascript
function hookJniOnLoad() {
    const libxxx = Process.findModuleByName("libxxx.so");
    if (libxxx === null) return;

    const jniOnLoad = libxxx.getExportByName("JNI_OnLoad");
    Interceptor.attach(jniOnLoad, {
        onEnter(args) {
            console.log("JNI_OnLoad is called");
        }
    });
}
```

## Hook `pthread_create`

- 有些检测逻辑会新开线程跑，所以先看 `pthread_create` 非常有用。

### 函数原型

```c
int pthread_create(pthread_t *thread, const pthread_attr_t *attr, void *(*start_routine)(void *), void *arg);
```

### Hook 实现

```javascript
function hookPthreadCreate() {
    const libc = Process.getModuleByName("libc.so");
    const pthreadCreateAddr = libc.getExportByName("pthread_create");

    Interceptor.attach(pthreadCreateAddr, {
        onEnter(args) {
            console.log("pthread_t *thread:", args[0]);
            console.log("const pthread_attr_t *attr:", args[1]);
            console.log("void *(*start_routine)(void *):", args[2]);
            console.log("void *arg:", args[3]);

            const mod = Process.findModuleByAddress(args[2]);
            if (mod !== null) {
                console.log("start_routine module:", mod.name, args[2].sub(mod.base));
            }
        },
        onLeave(retval) {
            console.log("pthread_create retval:", retval);
        }
    });
}
```

## 内存读写监控

通过 `Process.setExceptionHandler` 可以监控指定地址的访问异常，适合做“读写断点”。

### 实现步骤

#### 1. Hook `dlopen`

```javascript
function hookDlopenForRwBreak(addr, soName, callback) {
    Interceptor.attach(addr, {
        onEnter(args) {
            const soPath = args[0].readCString();
            if (soPath.indexOf(soName) !== -1) {
                this.shouldHook = true;
            }
        },
        onLeave(retval) {
            if (this.shouldHook) {
                callback();
            }
        }
    });
}

const dlopenForRwBreak = Module.getGlobalExportByName("dlopen");
const androidDlopenExtForRwBreak = Module.getGlobalExportByName("android_dlopen_ext");

hookDlopenForRwBreak(dlopenForRwBreak, "libxxx.so", setReadWriteBreak);
hookDlopenForRwBreak(androidDlopenExtForRwBreak, "libxxx.so", setReadWriteBreak);
```

#### 2. 设置异常处理器

```javascript
function setReadWriteBreak() {
    Process.setExceptionHandler(function (details) {
        console.log(JSON.stringify(details, null, 2));
        console.log("lr:", DebugSymbol.fromAddress(details.context.lr));
        console.log("pc:", DebugSymbol.fromAddress(details.context.pc));

        Memory.protect(details.memory.address, Process.pointerSize, "rwx");

        console.log(
            Thread.backtrace(details.context, Backtracer.ACCURATE)
                .map(DebugSymbol.fromAddress)
                .join("\n") + "\n"
        );

        return true;
    });

    const libxxx = Process.getModuleByName("libxxx.so");
    const addr = libxxx.base.add(0x3ded);
    Memory.protect(addr, 8, "---");
}
```

### 相关知识拓展

`Process.setExceptionHandler` 用来设置全局异常处理器。访问违规、非法执行这类异常触发时，回调函数会被调用，所以很适合做内存访问监控。

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

1. 先拿模块对象：`Process.getModuleByName("libxxx.so")`
2. 和模块相关的事情都挂到模块对象上做
3. 全局导出符号改用 `Module.getGlobalExportByName(...)`
4. 内存读写更推荐直接使用 `NativePointer` 的实例方法

