---
title: "ARM汇编初探"
description: "记录一下学习ARM汇编指令的一篇笔记"
pubDate: "2025-01-21"
draft: false
---

## 1. ARM 可执行文件的生成过程

在使用 Clang/LLVM 或 GCC 等工具链时，从 C 语言源文件到可执行文件通常要经历以下 4 个阶段：

1. **预处理（Preprocessing）**
2. **编译（Compilation）**
3. **汇编（Assembly）**
4. **链接（Linking）**

下面以 Clang 的交叉编译选项为例（目标为 `armv7a-linux-androideabi29`）：

### 1.1 预处理

- **命令**:
  
    ```bash
    clang -target armv7a-linux-androideabi29 -E hello.c -o hello.i
    ```
    
- **说明**:
    - `-E` 选项表示只执行预处理阶段，把所有 `#include`、宏定义等处理后输出到 `hello.i`。

### 1.2 编译

- **命令**:
  
    ```bash
    clang -target armv7a-linux-androideabi29 -S hello.i -o hello.s
    ```
    
- **说明**:
    - `-S` 选项表示执行到编译阶段，并将结果生成汇编文件 `hello.s`。此时还没有进行汇编与链接。

### 1.3 汇编

- **命令**:
  
    ```bash
    clang -target armv7a-linux-androideabi29 -c hello.s -o hello.o
    ```
    
- **说明**:
    - `-c` 表示执行汇编，将汇编代码 `hello.s` 转为目标文件 `hello.o`。此时还没有进行链接。

### 1.4 链接

- **命令**:
  
    ```bash
    clang -target armv7a-linux-androideabi29 hello.o -o hello
    ```
    
- **说明**:
    - 将目标文件（可以是多个 `.o` 文件）与库文件一起链接生成最终的可执行文件 `hello`。
    - 如果有多个 `.o` 文件，需要都包含在链接命令中。

---

## 2. ARM 汇编代码的基本结构

在查看或编写 ARM 汇编文件（例如上面生成的 `hello.s`）时，常见的关键字与结构如下：

1. **`.text`**
   
    - 声明接下来的内容属于代码段。
2. **`.syntax`**
   
    - 指示汇编器使用何种语法（`arm` 或 `thumb` 等）。
3. **`.file`**
   
    - 记录当前生成的文件符号信息（一般由编译器自动生成）。
4. **`.globl <symbol>`**
   
    - 声明符号是全局可见的，可以被其他模块引用。常用于声明 `main`。
5. **`.type <symbol>, %function`**
   
    - 指定某个符号的类型为函数。
6. **`<label>:`**
   
    - 定义一个标号（Label）。典型用法是 `main:` 用于标识函数入口点。
7. **`.section <section_name>`**
   
    - 切换或声明后续内容所在的段，如 `.section .data` 等，用来存放全局或静态变量等。

例如，典型的汇编片段可能如下：

```asm
    .text
    .syntax unified
    .file   "hello.c"
    .globl  main
    .type   main, %function
main:
    ; 函数正文
    ; ...
    bx lr
```

---

## 3. ARM 指令集概览

本节介绍在 ARM 模式下常见的指令分类及示例，包括数据处理、移位、乘法、内存读写、跳转、堆栈操作和软件中断等。

### 3.1 数据处理指令

- **MOV**
  
    - 用法：`MOV <Rd>, <operand>`
    - 示例：`MOV r11, sp` → `r11 = sp`
- **ADD**
  
    - 用法：`ADD <Rd>, <Rn>, <operand>`
    - 示例：`ADD r2, pc, r2` → `r2 = pc + r2`
- **SUB**
  
    - 用法：`SUB <Rd>, <Rn>, <operand>`
    - 示例：`SUB sp, sp, #16` → `sp = sp - 16`
- **AND**
  
    - 用法：`AND <Rd>, <Rn>, <operand>`
    - 示例：`AND r0, r0, #0x9` → `r0 &= 0x9`
- **ORR**
  
    - 用法：`ORR <Rd>, <Rn>, <operand>`
    - 示例：`ORR r0, r0, #0x2` → `r0 |= 0x2`
- **EOR**
  
    - 用法：`EOR <Rd>, <Rn>, <operand>`
    - 示例：`EOR r0, r0, #0xAA` → `r0 ^= 0xAA`
- **BIC**
  
    - 用法：`BIC <Rd>, <Rn>, <operand>`
    - 示例：`BIC r0, r0, #0xF` → `r0 &= ~0xF`

---

### 3.2 移位指令

- **LSL (逻辑左移)**
  
    - `LSL r0, r0, #4` → `r0 <<= 4`
- **LSR (逻辑右移)**
  
    - `LSR r0, r0, #8` → `r0 >>= 8`（高位补 0）
- **ROR (循环右移)**
  
    - `ROR r0, r0, #4` → 将 `r0` 循环右移 4 位

---

### 3.3 乘法指令

- **MUL**
  
    - `MUL r0, r0, r1` → `r0 = r0 * r1`
- **MLA (Multiply Accumulate)**
  
    - `MLA r0, r0, r1, r2` → `r0 = (r0 * r1) + r2`

---

### 3.4 内存访问指令

- **LDR (Load Register)**
  
    - 用法：`LDR <Rd>, [<Rn>, #<offset>]`
    - 示例：`LDR r0, [r1, #4]` → `r0 = *(uint32_t *)(r1 + 4)`
- **STR (Store Register)**
  
    - 用法：`STR <Rd>, [<Rn>, #<offset>]`
    - 示例：`STR r0, [r2, #4]` → `*(uint32_t *)(r2 + 4) = r0`

> 字节级与半字节级读写指令：
>
> - `STRB` / `LDRB` → 单字节存取
> - `STRH` / `LDRH` → 半字（2 字节）存取
> - `STR` / `LDR` → 字（4 字节）存取

---

### 3.5 跳转指令

- **B (Branch)**
  
    - 无条件跳转：`B <label>`
- **BL (Branch with Link)**
  
    - 带返回地址记录（保存在 `LR`）的跳转：`BL <label>`
- **BX (Branch and Exchange)**
  
    - 带状态切换（ARM ↔ Thumb）的跳转：`BX <Rm>`
- **BLX (Branch with Link and Exchange)**
  
    - 同时记录返回地址并切换状态：`BLX <Rm>`

---

### 3.6 数据加载与存储指令（多寄存器）

- **PUSH / POP**
  
    - `PUSH {r4, r5, r6}`：一次性将 `r4, r5, r6` 入栈
    - `POP {r4, r5, r6}`：一次性将栈顶数据弹出到 `r4, r5, r6`
- **LDM / STM (Load/Store Multiple)**
  
    - `LDMIA SP, {r0, r1, r2}`：从 `SP` 所在地址开始，依次读入 `r0, r1, r2`
    - `STMIA SP, {r0, r1, r2}`：依次将 `r0, r1, r2` 写入以 `SP` 为起始的内存

---

### 3.7 中断指令

- **SVC (Supervisor Call)**
    - `SVC 0` → 触发软件中断，一般用于系统调用
    - 在 Linux/Android 平台常配合 `r7` 存储 syscall 编号，实现 `open`, `openat` 等系统调用。

---

## 4. Thumb 指令集简介

- Thumb 模式下，指令长度通常为 16 位（Thumb-2 为 16/32 位混合）。
- 与 ARM 模式相比，Thumb 模式指令更短、执行效率在某些场景更佳，但寄存器使用和寻址方式可能受限。
- 需要时可通过 `BX` 或 `BLX` 指令在 ARM / Thumb 模式之间切换；切换依据跳转地址最低位（1 → Thumb 模式，0 → ARM 模式）。

---

## 5. 常见寻址方式

- **立即数寻址（Immediate Addressing）**
  
    - 例如：`MOV r1, #1`
    - 指令中直接包含一个立即数。
- **寄存器寻址（Register Addressing）**
  
    - 例如：`MOV r0, r2`
    - 操作数来自寄存器。
- **寄存器间接寻址（Register Indirect Addressing）**
  
    - 例如：`LDR r0, [r1]`
    - 通过寄存器中存放的地址指向目标内存。
- **基址变址寻址（Base + Offset Addressing）**
  
    - 例如：`LDR r2, [r1, #4]`
    - 以 `r1` 的值为基址，外加偏移量 `#4` 访问内存。
- **多寄存器寻址**
  
    - 例如：`PUSH {r4, r5, r6}`
    - 一次性压栈多个寄存器的值。
- **相对寻址（PC-Relative Addressing）**
  
    - 例如：`B .LABEL_END`
    - 通过当前 `PC` 与偏移相加获得目标地址。

---

## 6. ARM32 寄存器与函数调用约定

- **通用寄存器**: `R0` ~ `R12`
- **`R13` (SP)**: 栈指针
- **`R14` (LR)**: 链接寄存器，用于存储返回地址
- **`R15` (PC)**: 程序计数器

### 6.1 参数传递与返回值

- **参数传递**
  
    - `R0, R1, R2, R3` 依次存放函数的前 4 个参数。
    - 超过 4 个参数会使用栈来传递。
- **返回值**
  
    - `R0` 用于返回值（若返回值需要更多存储空间，则会有更复杂的约定）。

---

## 7. 其他可补充知识点

- **条件执行**
  
    - ARM 模式下支持带条件后缀的指令（`EQ, NE, GT, LT, ...`），根据 APSR（CPSR）中的条件标志位来执行或跳过指令。
    - Thumb 模式多数情况下通过分支或 `IT` 指令进行条件执行。
- **CPSR & SPSR**
  
    - `CPSR`（Current Program Status Register）: 当前程序状态寄存器，包含条件标志（N, Z, C, V）、CPU 模式等信息。
    - `SPSR`（Saved Program Status Register）: 在异常或中断发生时用来保存先前的状态寄存器值。
- **模式切换**
  
    - ARM 处理器支持多种工作模式（User, FIQ, IRQ, Supervisor, Abort, Undefined, System）。
    - 异常或中断会触发模式切换；`BX` / `BLX` 会进行 ARM/Thumb 模式切换。

---

## 8. GDB 调试 ARM

### 8.1 工具安装

- **安装 `gdb-multiarch`**
  
    ```bash
    sudo apt-get install gdb-multiarch
    ```
    
    - 该版本 GDB 可以调试多种架构（包括 ARM）。
- **安装 GEF (GDB Enhanced Features)**
  
    ```bash
    bash -c "$(curl -fsSL https://gef.blah.cat/sh)"
    ```
    
    - 安装后会在 GDB 中增加许多实用调试功能（内存显示、寄存器高亮等）。

### 8.2 远程调试流程

1. **在目标设备（例如 Android）上找到并运行 `gdbserver`**
    - 查找命令：`find . -name gdbserver`
    - 启动方式与 `frida-server` 类似，可指定调试端口，如：
      
        ```bash
        ./gdbserver :<port> --attach <PID>
        ```
        
        或
        
        ```bash
        ./gdbserver :<port> ./your_app
        ```
    
2. **在本机使用 `gdb-multiarch` 通过 GEF 进行远程连接**
    - 例如：
      
        ```bash
        gdb-multiarch your_app
        gef-remote <device_ip>:<port>
        ```
        
    - 或者在 GEF 里使用 `target remote <device_ip>:<port>`。

### 8.3 常用 GDB 命令

- **断点**
    - `b main`：在 `main` 函数入口处下断点
    - `b *0x123456`：在地址 `0x123456` 处下断点
- **单步调试**
    - `n`：源码级单步执行（Next）
    - `ni`：汇编级单步执行（Next Instruction）
    - `s`：单步跟进（Step）
- **继续执行**
    - `c`：继续运行（Continue）
