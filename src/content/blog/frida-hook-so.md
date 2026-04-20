---
title: "FridaHookSo"
description: "FridaHookSo层代码的技巧总结"
pubDate: "2025-01-01"
draft: false
---

# Frida Hook so

> 本文主要保留旧笔记中的写法和思路，其中不少示例基于 **Frida 16 及更早时期** 常见的 `Module.*` 静态 API。  
> 如果你现在使用的是 **Frida 17+**，建议优先结合这篇新笔记阅读：[Frida Hook so(Frida 17+)](/blog/frida-hook-so-frida17/)。

## 枚举各种

### 1. 枚举导入表

通过枚举**导入表**，可以获取出现在导入表中的函数地址。

```javascript
var imports = Module.enumerateImports("libxxx.so");
for (var i = 0; i < imports.length; i++) {
    if (imports[i].name === "strncat") {
        console.log(JSON.stringify(imports[i]));
        console.log(imports[i].address);
        break; 
    }
}
```

### 2. 枚举导出表

通过枚举**导出表**，可以获取出现在导出表中的函数地址。

```javascript
var exports = Module.enumerateExports("libxxx.so");
for (var i = 0; i < exports.length; i++) {
    console.log(JSON.stringify(exports[i]));
}
```

### 3. 枚举符号表

通过枚举**符号表**，可以获取出现在符号表中的函数地址。

```javascript
Module.enumerateSymbols("libxxx.so");
```

### 4. 枚举模块并进一步枚举导出表

通过枚举**模块**，再枚举模块内部的**导出表**，**可以快速找到某个导入函数出自哪个 SO**。

```javascript
Process.enumerateModules();
```

### 5. 解析表类型

- **exports** 解析的表类型为 `SHT_DYNSYM`
- **symbols** 解析的表类型为 `SHT_SYMTAB`

**SYMTAB** 更全面（`DYNSYM` 是 `SYMTAB` 的子集），但并非 SO 运行所必需，_**通常会被去掉**_。

## Hook 导出函数

### 步骤一：获取函数地址

在 SO 的导出表中，可以通过 Frida 提供的 API 获取函数地址。

```javascript
Module.findExportByName("libxxx.so", "add");
```

> **注意**：函数名以汇编中出现的为准。

### 步骤二：使用 `Interceptor.attach` 进行 Hook

获取到函数地址后，使用 `Interceptor.attach` 对函数进行 Hook。

```javascript
Interceptor.attach(Address, {
    onEnter: function(args){
        console.log(args[0]);              // 打印参数
        console.log(this.context.x1);      // 打印寄存器内容
        console.log(args[2].toInt32());    // 默认显示16进制，这里转换成10进制
    },
    onLeave: function(retval){
        console.log("retval", retval, retval.toInt32());
    }
});
```

## 模块基址的几种获取方式

1. 对于在导入表、导出表、符号表中找不到的函数，地址需要自行计算。
2. 计算方式很简单：**SO 基址 + 函数在 SO 中的偏移**（ARM 架构下 Thumb 模式需要加 1）。
3. 因此，首先需要获取 SO 的基址，即模块基址。

```javascript
Process.findModuleByName("libart.so");

Process.getModuleByName("libc.so");

Module.findBaseAddress("libart.so");

Process.enumerateModules();

Process.findModuleByAddress(address);

Process.getModuleByAddress(address);
```

## Hook 任意函数

```javascript
var soAddr = Module.findBaseAddress("libxxx.so");
console.log(soAddr);
var funcAddr = soAddr.add(0x23F4); // ARM Thumb 模式下需加 1，ARM 不需加
console.log(funcAddr);
if (funcAddr !== null) {
    Interceptor.attach(funcAddr, {
        onEnter: function(args){
            // 入参处理
        },
        onLeave: function(retval){
            console.log(hexdump(retval)); // 输出当前地址的十六进制数据
        }
    });
}
```

## so Hook 模板

```javascript
function print_arg(addr){
    var module = Process.findRangeByAddress(addr);
    if (module !== null) return hexdump(addr) + "\n";
    return ptr(addr) + "\n";
}

function hook_native_addr(funcPtr){
    var module = Process.findModuleByAddress(funcPtr);
    Interceptor.attach(funcPtr, {
        onEnter: function(args){
            this.logs = [];
            this.logs.push("call " + module.name + "!" + ptr(funcPtr).sub(module.base) + "\n");
            this.args0 = args[0];
            this.args1 = args[1];
            this.logs.push("this.args0 onEnter: " + print_arg(this.args0));
            this.logs.push("this.args1 onEnter: " + print_arg(this.args1));         
        },
        onLeave: function(retval){
            this.logs.push("this.args0 onLeave: " + print_arg(this.args0));
            this.logs.push("this.args1 onLeave: " + print_arg(this.args1));
            this.logs.push("retval onLeave: " + retval + "\n");
            console.log(this.logs);
        }
    });
}
```

## 修改函数数值参数和返回值

```javascript
var addAddr = Module.findExportByName("libxxx.so", "add");
console.log(addAddr);
if (addAddr !== null) {
    Interceptor.attach(addAddr, {
        onEnter: function(args){
            args[2] = ptr(1000); // 新值
            console.log(args[2].toInt32());
        },
        onLeave: function(retval){
            retval.replace(20000);
            console.log("retval", retval.toInt32());
        }
    });
}
```

## 获取指针参数返回值

```javascript
var soAddr = Module.findBaseAddress("libxxx.so");
console.log(soAddr);
var sub_208C = soAddr.add(0x208C);
console.log(sub_208C);
if (sub_208C !== null) {
    Interceptor.attach(sub_208C, {
        onEnter: function(args){
            this.args1 = args[1];
        },
        onLeave: function(retval){
            console.log(hexdump(this.args1));
        }
    });
}
```

## Hook `dlopen`

1. 有些函数在 SO **首次加载**时执行，而 SO 未加载前无法进行 Hook。
2. 因此，需 **监控 SO 的加载时机**，在 SO 加载完成后立即进行 Hook。

```javascript
function hook_dlopen(addr, soName, callback) {
    Interceptor.attach(addr, {
        onEnter: function(args){
            var name = args[0].readCString();
            if (name.indexOf(soName) !== -1) this.hook = true;
        }, 
        onLeave: function(retval){
            if (this.hook) callback();
        }
    });
}

var dlopen = Module.findExportByName(null, "dlopen");
var android_dlopen_ext = Module.findExportByName(null, "android_dlopen_ext");
hook_dlopen(dlopen, "libxxx.so", hookfunc);
hook_dlopen(android_dlopen_ext, "libxxx.so", hookfunc);
```

## 内存读写

### 1. 读取指定地址的字符串

```javascript
var soAddr = Module.findBaseAddress("libxxx.so");
console.log(soAddr.add(0x2C00).readCString());
```

### 2. Dump 指定地址的内存

```javascript
console.log(hexdump(soAddr.add(0x2C00)));
```

### 3. 读指定地址的内存

```javascript
console.log(soAddr.add(0x2C00).readByteArray(16));
console.log(Memory.readByteArray(soAddr.add(0x2C00), 16)); // 原先的 API
```

### 4. 写指定地址的内存

```javascript
soAddr.add(0x2C00).writeByteArray(stringToBytes("xxxxx")); 
console.log(hexdump(soAddr.add(0x2C00)));
```

### 5. 申请新内存并写入

```javascript
Memory.alloc();
Memory.allocUtf8String();
```

### 6. 修改内存权限

```javascript
Memory.protect(ptr(libso.base), libso.size, 'rwx');
```

## Frida 修改 SO 函数代码

### 1. 修改地址对应的指令

```javascript
soAddr = Module.findBaseAddress("libxxx.so");
soAddr.add(0x1684).writeByteArray(hexToBytes("0001094B"));
```

**ARM 与 Hex 在线转换**：[ARM Converter](https://armconverter.com/)

### 2. 将对应地址的指令解析成汇编

```javascript
var ins = Instruction.parse(soAddr.add(0x1684));
console.log(ins.toString());
```

### 3. 使用 Frida 提供的 API 写汇编代码

```javascript
new Arm64Writer(soAddr.add(0x167C)).putNop();
console.log(Instruction.parse(soAddr.add(0x167C)).toString());
```

### 4. 使用 Frida 提供的 API 写汇编代码

```javascript
var codeAddr = soAddr.add(0x167C);
Memory.patchCode(codeAddr, 8, function (code) {
    var writer = new Arm64Writer(code, { pc: codeAddr });
    writer.putBytes(hexToBytes("0001094B"));
    writer.putBytes(hexToBytes("FF830091"));
    writer.putRet();
    writer.flush();
});
```

## SO 层主动调用任意函数

### 1. 声明函数指针

文档：[Frida JavaScript API - NativeFunction](https://frida.re/docs/javascript-api/#NativeFunction)

语法：`new NativeFunction(address, returnType, argTypes[, abi])`

支持的 `returnType` 和 `argTypes`：

- 基本类型：`void`、`pointer`、`int`、`uint`、`long`、`ulong`、`char`、`uchar`、`float`、`double`
- 定长整数：`int8`、`uint8`、`int16`、`uint16`、`int32`、`uint32`、`int64`、`uint64`、`bool`
- 大小类型：`size_t`、`ssize_t`

### 2. 代码示例

```javascript
Java.perform(function(){
    // 获取函数地址
    var funcAddr = Module.findBaseAddress("libxxx.so").add(0x23F4);
    
    // 声明函数指针
    var func = new NativeFunction(funcAddr, "pointer", ['pointer', 'pointer']);
    
    var env = Java.vm.tryGetEnv();
    console.log("env: ", JSON.stringify(env));
    
    if (env !== null) {
        var jstr = env.newStringUtf("Je2em1ah is very good!!!");
        var cstr = func(env, jstr);
        console.log(cstr.readCString());
        console.log(hexdump(cstr));
    }
});
```

## Hook libc 读写文件

### 1. 使用 Frida API 写文件

```javascript
var file = new File("/sdcard/xxxx.txt", "w");
file.write("Je2em1ah is very good!!!\n");
file.flush();
file.close();
```

### 2. Hook libc 写文件

```javascript
var addr_fopen = Module.findExportByName("libc.so", "fopen");
var addr_fputs = Module.findExportByName("libc.so", "fputs");
var addr_fclose = Module.findExportByName("libc.so", "fclose");

console.log("addr_fopen:", addr_fopen, "addr_fputs:", addr_fputs, "addr_fclose:", addr_fclose);

var fopen = new NativeFunction(addr_fopen, "pointer", ["pointer", "pointer"]);
var fputs = new NativeFunction(addr_fputs, "int", ["pointer", "pointer"]);
var fclose = new NativeFunction(addr_fclose, "int", ["pointer"]);

var filename = Memory.allocUtf8String("/sdcard/xxx.txt");    // 注意：sdcard 权限不足可能导致写入失败
var open_mode = Memory.allocUtf8String("w");
var file = fopen(filename, open_mode);
console.log("fopen:", file);

var buffer = Memory.allocUtf8String("Jeremiah\n");
var retval = fputs(buffer, file);
console.log("fputs:", retval);

fclose(file);
```

## JNI 函数的 Hook

### 1. Hook libart 来 Hook JNI 相关函数

```javascript
var artSym = Module.enumerateSymbols("libart.so"); // 原先的 API
var NewStringUTFAddr = null;
for (var i = 0; i < artSym.length; i++) {
    if (artSym[i].name.indexOf("CheckJNI") === -1 && artSym[i].name.indexOf("NewStringUTF") !== -1) {
        NewStringUTFAddr = artSym[i].address;
    }
}

if (NewStringUTFAddr !== null) {
    Interceptor.attach(NewStringUTFAddr, {
        onEnter: function(args){
            console.log(args[1].readCString());
        },
        onLeave: function(retval){
            // 可选：在需要时添加处理逻辑
        }
    });
}
```

### 2. 计算地址方式

```javascript
Java.perform(function(){
    console.log("Process.arch: ", Process.arch);
    
    var envAddr = ptr(Java.vm.tryGetEnv().handle).readPointer();  // 获取 JNIEnv 的地址
    var newStringUtfAddr = envAddr.add(0x538).readPointer();
    console.log("newStringUtfAddr", newStringUtfAddr);
    
    if (newStringUtfAddr !== null) {
        Interceptor.attach(newStringUtfAddr, {
            onEnter: function(args){
                console.log(args[1].readCString());
            },
            onLeave: function(retval){
                // 可选：在需要时添加处理逻辑
            }
        });
    }
});
```

## 主动调用 JNI 函数

### 1. 使用 Frida 封装的函数调用 JNI

```javascript
var funcAddr = Module.findExportByName("libxxx.so", "functionName");
console.log(funcAddr);
if (funcAddr !== null) {
    Interceptor.attach(funcAddr, {
        onEnter: function(args){
            // 入参处理
        },
        onLeave: function(retval){
            var env = Java.vm.tryGetEnv();
            var jstr = env.newStringUtf("bbs.125.la");  // 主动调用 JNI 函数：CSTR 转 JSTR
            retval.replace(jstr);
            var cstr = env.getStringUtfChars(jstr); // 主动调用 JNI 函数：JSTR 转 CSTR
            console.log(cstr.readCString());
            console.log(hexdump(cstr));
        }
    });
}
```

### 2. 使用 `NativeFunction` 主动调用

```javascript
var symbols = Process.getModuleByName("libart.so").enumerateSymbols();
var newStringUtf = null;
for (let i = 0; i < symbols.length; i++) {
    var symbol = symbols[i];
    if (symbol.name.indexOf("CheckJNI") === -1 && symbol.name.indexOf("NewStringUTF") !== -1) {
        console.log(symbol.name, symbol.address);
        newStringUtf = symbol.address;
    }
}

var newStringUtf_func = new NativeFunction(newStringUtf, 'pointer', ['pointer', 'pointer']);
var jstring = newStringUtf_func(Java.vm.tryGetEnv().handle, Memory.allocUtf8String("Je2em1ah"));
console.log(jstring);

var envAddr = Java.vm.tryGetEnv().handle.readPointer();
var GetStringUTFChars = envAddr.add(0x548).readPointer();
var GetStringUTFChars_func = new NativeFunction(GetStringUTFChars, 'pointer', ['pointer', 'pointer', 'pointer']);
var cstr = GetStringUTFChars_func(Java.vm.tryGetEnv().handle, jstring, ptr(0));
console.log(cstr.readCString());
```

## SO 层打印函数调用栈

- 通过 Hook 系统函数，打印函数栈，可以快速定位到关键代码。
- Frida 提供了 SO 层打印函数栈的方法：

```javascript
console.log(Thread.backtrace(this.context, Backtracer.ACCURATE).map(DebugSymbol.fromAddress).join('\n') + '\n'); // `ACCURATE` 表示精确，`FUZZY` 表示模糊
```

## 定位静态注册函数的方法

- **静态注册**的函数会通过 `dlsym` 查找符号，因此可以通过 Hook `dlsym` 函数来快速定位。

```javascript
function hook_dlsym(){
    var dlsymAddr = Module.findExportByName("libdl.so", "dlsym");
    console.log(dlsymAddr);
    if (dlsymAddr !== null) {
        Interceptor.attach(dlsymAddr, {
            onEnter: function(args){
                this.args1 = args[1];
            },
            onLeave: function(retval){
                var module = findModuleByAddress(retval);
                console.log(this.args1.readCString(), retval, module.name, retval.sub(module.base));
            }
        });
    }
}
```

## 定位动态注册函数的方法

- **动态注册**的函数会通过 `RegisterNatives` 函数加载，因此 Hook `RegisterNatives` 可以快速定位函数位置。

```javascript
function hook_RegisterNatives() {
    var RegisterNatives_addr = null;
    var symbols = Process.findModuleByName("libart.so").enumerateSymbols();
    for (var i = 0; i < symbols.length; i++) {
        var symbol = symbols[i].name;
        if (symbol.indexOf("CheckJNI") === -1 && symbol.indexOf("JNI") >= 0) {
            if (symbol.indexOf("RegisterNatives") >= 0) {
                RegisterNatives_addr = symbols[i].address;
                console.log("RegisterNatives_addr: ", RegisterNatives_addr);
            }
        }
    }
    
    if (RegisterNatives_addr !== null) {
        Interceptor.attach(RegisterNatives_addr, {
            onEnter: function (args) {
                var env = args[0];
                var jclass = args[1];
                var class_name = Java.vm.tryGetEnv().getClassName(jclass);
                var methods_ptr = ptr(args[2]);
                var method_count = args[3].toInt32();
                console.log("RegisterNatives method counts: ", method_count);
                for (var i = 0; i < method_count; i++) {
                    var name = methods_ptr.add(i * Process.pointerSize * 3).readPointer().readCString();
                    var sig = methods_ptr.add(i * Process.pointerSize * 3 + Process.pointerSize).readPointer().readCString();
                    var fnPtr_ptr = methods_ptr.add(i * Process.pointerSize * 3 + Process.pointerSize * 2).readPointer();
                    var find_module = Process.findModuleByAddress(fnPtr_ptr);
                    console.log("RegisterNatives java_class: ", class_name, "name: ", name, "sig: ", sig, "fnPtr: ", fnPtr_ptr, "module_name: ", find_module.name, "module_base: ", find_module.base, "offset: ", ptr(fnPtr_ptr).sub(find_module.base));
                }
            },
            onLeave: function (retval) {}
        });
    }
}
```

## Frida InlineHook

```javascript
function inlineHook() {
    // 示例 1
    /*
    var nativePointer = Module.findBaseAddress("libxxx.so");
    var hookAddr = nativePointer.add(0x17BC);
    Interceptor.attach(hookAddr, {
        onEnter: function (args) {
            console.log("onEnter: ", this.context.x8);
        }, 
        onLeave: function (retval) {
            console.log("onLeave: ", this.context.x8.toInt32());
            console.log(this.context.x8 & 7);
        }
    });
    */

    // 示例 2
    var nativePointer = Module.findBaseAddress("libxxx.so");
    var hookAddr = nativePointer.add(0x1B70);
    Interceptor.attach(hookAddr, {
        onEnter: function (args) {
            console.log("onEnter: ", this.context.x1);
            console.log("onEnter: ", hexdump(this.context.x1));
        }, 
        onLeave: function (retval) {
            // 可选：在需要时添加处理逻辑
        }
    });
}
```

## Hook `init` or `initArray`

- SO 中 `init` 段和 `initarray` 段的加载时机是在 `dlopen` 函数中进行加载，因此需在 `dlopen` 执行时监控 SO 的加载并同时 Hook `init` 和 `initarray`。
- `init` 和 `initarray` 通过 `linker` 或 `linker64` 文件的 `call_constructors` 函数进行调用。

```javascript
function hook_dlopen(){
    var dlopen = Module.findExportByName(null, "dlopen");
    console.log(dlopen);
    if (dlopen !== null) {
        Interceptor.attach(dlopen, {
            onEnter: function(args){
                var soName = args[0].readCString();
                console.log(soName);
                if (soName.indexOf("libxxx.so") !== -1) {
                    hook_initarray();
                }
            },
            onLeave: function(retval){}
        });
    }

    var android_dlopen_ext = Module.findExportByName(null, "android_dlopen_ext");
    console.log(android_dlopen_ext);
    if (android_dlopen_ext !== null) {
        Interceptor.attach(android_dlopen_ext, {
            onEnter: function(args){
                var soName = args[0].readCString();
                console.log(soName);
                if (soName.indexOf("libxxx.so") !== -1) {
                    hook_initarray();
                }
            },
            onLeave: function(retval){}
        });
    }
}

var hooked = false;

function hook_initarray(){
    var call_constructorsAddr = null;
    var linkerSymbols = Module.enumerateSymbolsSync("linker64"); // 可能是 linker 或 linker64
    for (var i = 0; i < linkerSymbols.length; i++) {
        if (linkerSymbols[i].name === "__dl__ZN6soinfo17call_constructorsEv") {
            call_constructorsAddr = linkerSymbols[i].address;
            console.log(linkerSymbols[i].name, linkerSymbols[i].address);
        }
    }

    if (call_constructorsAddr !== null && !hooked) {
        Interceptor.attach(call_constructorsAddr, {
            onEnter: function(args){
                var soAddr = Module.findBaseAddress("libxxx.so");
                var initArrayTest2 = soAddr.add(0x2B08);
                var initArrayTest1 = soAddr.add(0x2AD8);
                Interceptor.replace(initArrayTest2, new NativeCallback(function(a){}, "int", ['int']));
                Interceptor.replace(initArrayTest1, new NativeCallback(function(a){}, "int", ['int']));
                hooked = true;
            },
            onLeave: function(retval){}
        });
    }
}

function main(){
    hook_dlopen();
}

setImmediate(main);
```

## Hook `JNI_OnLoad`

- 注入点在 `dlopen` 加载 **结束** 之后。

```javascript
function hook_JNI_Onload(){
    var JNI_Onload = Module.findExportByName("libxxx.so", "JNI_OnLoad");
    if (JNI_Onload !== null) {
        Interceptor.attach(JNI_Onload, {
            onEnter: function(args){
                console.log("JNI_OnLoad is called");
            },
            onLeave: function(retval){}
        });
    }
}
```

## Hook `pthread_create`

- 一些 **检测函数** 需要 **实时** 运行，可能会使用 `pthread` 开启子线程。
- Hook `pthread_create` 可查看开启了哪些子线程，并可干掉与检测相关的子线程。

### 函数原型

```c
int pthread_create(pthread_t *thread, const pthread_attr_t *attr, void *(*start_routine)(void *), void *arg);
```

- **`pthread_t *thread`**  
    指向 `pthread_t` 类型变量的指针，用于返回新创建线程的标识符。
    
- **`const pthread_attr_t *attr`**  
    指向线程属性对象的指针，用于设置线程的属性（如栈大小、调度策略等）。如果使用默认属性，可以传递 `NULL`。
    
- **`void *(*start_routine)(void *)`**  
    线程的起始函数，必须是一个返回 `void*` 并接受一个 `void*` 类型参数的函数指针。
    
- **`void *arg`**  
    传递给 `start_routine` 函数的参数，可以是任意类型的指针。如果不需要参数，可以传递 `NULL`。
    

### Hook 实现

```javascript
function hook_pthread_create(){
    var pthread_create_addr = Module.findExportByName("libc.so", "pthread_create");
    console.log("pthread_create_addr: ", pthread_create_addr);
    if (pthread_create_addr !== null) {
        Interceptor.attach(pthread_create_addr, {
            onEnter: function(args){
                console.log("pthread_t *thread:", args[0]);
                console.log("const pthread_attr_t *attr:", args[1]);
                console.log("void *(*start_routine)(void *):", args[2]);
                console.log("void *arg:", args[3]);
            },
            onLeave: function(retval){
                console.log("pthread_create retval:", retval);
            }
        });
    }
}
```

## 内存读写监控

通过 `Process.setExceptionHandler` 提供一个回调函数来 **监控内存的读写操作**。这种方法可以帮助开发者在特定内存地址发生读写时捕获异常，从而进行调试或逆向分析。

### 实现步骤

#### 1. Hook `dlopen` 函数以监控 SO 文件的加载

首先，通过 Hook `dlopen` 和 `android_dlopen_ext` 函数，监控目标 SO 文件的加载。一旦检测到指定的 SO 文件被加载，即可执行相应的回调函数。

```javascript
function hook_dlopen(addr, soName, callback) {
    Interceptor.attach(addr, {
        onEnter: function (args) {
            var soPath = args[0].readCString();
            if (soPath.indexOf(soName) !== -1) {
                this.hook = true;
            }
        },
        onLeave: function (retval) {
            if (this.hook) {
                callback();
            }
        }
    });
}

var dlopen = Module.findExportByName("libdl.so", "dlopen");
var android_dlopen_ext = Module.findExportByName("libdl.so", "android_dlopen_ext");
hook_dlopen(dlopen, "libxxx.so", set_read_write_break);
hook_dlopen(android_dlopen_ext, "libxxx.so", set_read_write_break);
```

#### 2. 设置异常处理器以监控内存读写

通过 `Process.setExceptionHandler`，设置一个异常处理器，当目标内存地址的读写操作触发异常时，回调函数将被调用。

```javascript
function set_read_write_break(){
    Process.setExceptionHandler(function(details) { // 错误回调函数
        console.log(JSON.stringify(details, null, 2));
        console.log("lr:", DebugSymbol.fromAddress(details.context.lr));
        console.log("pc:", DebugSymbol.fromAddress(details.context.pc));
        
        // 获取完成信息之后将内存权限复原
        Memory.protect(details.memory.address, Process.pointerSize, 'rwx');
        
        // 打印调用栈
        console.log(Thread.backtrace(details.context, Backtracer.ACCURATE)
            .map(DebugSymbol.fromAddress)
            .join('\n') + '\n');
        
        return true; // 继续执行
    });

    // 目标内存地址
    var addr = Module.findBaseAddress("libxxx.so").add(0x3DED);
    
    // 修改内存权限为不可读写，只能执行，触发异常
    Memory.protect(addr, 8, '---');
}
```

### 相关知识拓展

#### `Process.setExceptionHandler` 的作用
`Process.setExceptionHandler` 用于设置一个全局的异常处理器，当程序执行过程中发生异常时，该处理器会被调用。通过这种方式，可以捕获内存访问违规等异常，进行调试或逆向分析。
