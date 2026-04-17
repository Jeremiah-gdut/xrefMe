---
title: "GameSafety2021 Android Final"
description: "根据其他大佬的Wp和指导一步步复现2021年的决赛题，记录其中遇到的一些问题"
pubDate: "2025-01-08"
draft: false
---

>wp参考链接如下：  
> - [2021腾讯游戏安全大赛安卓方向决赛题解 - EPs blog](https://linkleyping.top/gslab2021-final/)  
> - [腾讯游戏安全技术竞赛-2021 Android Final 参赛纪录 - Mezone's Blog](https://mez.one/2021/04/15/2021-04-15-Tencent-GameSafe-2021/)  
> - [gslab2021 决赛 - 安卓客户端安全 | Xhy's Blog](https://blog.xhyeax.com/2021/04/10/gslab2021-final-android/)  
> - [看雪中的一篇关于il2cpp编译方式的逆向文章，值得学习](https://bbs.kanxue.com/thread-282821.htm)

> - **Question1**:尝试使用`Zygisk-il2cppdumper`dump，但是程序会卡死，dump不出文件  
> - **Question2**:用`elf-dump-fix`dump下来的il2cpp.so缺少符号，未知原因，但是可以搜字符串`global-metadata.dat`定位到加载函数  
> - **Question3**:追踪加载`global-metadata.dat`函数的调用链，发现被hook到sec2021的函数中了，追踪到最后发现是个看不懂的地方（？）  
> - **Question4**:实现无敌之后未成功绕过app的crc校验，导致重打包的apk无法运行  
## 问题解决情况
- [ ] Question1
- [x] Question2
- [ ] Question3
- [ ] Question4
## 待办事项
- [ ] 分析libsec2021.so的解密函数
- [ ] 分析il2cpp.so的代码段校验并绕过
- [x] dump解密后的il2cpp.so
- [x] 编译一份flappybird游戏
- [x] bindiff恢复符号
- [x] 实现无敌功能
- [ ] 封包成破解版apk
## 解题流程
- 解包APK，lib目录下有`libil2cpp.so`，`\assets\bin\Data\Managed\Metadata`路径下有`global-metadata.dat`,可以知道这是il2cpp引擎的游戏
- `libil2cpp.so`和`global-metadata.dat`都是被加密的，打开`libsec2021.so`发现IDA无法正确识别ELF文件,发现是文件头的`e_phentsize`有问题，把23改成32即可正确识别,`libil2cpp.so`也是同样的处理方式
- 用`elf-dump-fix`把内存中的libil2cpp.so dump下来并修复了
- 写了一个脚本，成功把`global-metadata.dat` dump下来了
```javascript
function WriteMemToFile(addr, size, file_path) {  
    Java.perform(function() {  
        let prefix = '/data/data/com.personal.flappybird/files/';  
        let mkdir =  
            Module.findExportByName('libc.so', 'mkdir');  
        let chmod =  
            Module.findExportByName('libc.so', 'chmod');  
        let fopen =  
            Module.findExportByName('libc.so', 'fopen');  
        let fwrite =  
            Module.findExportByName('libc.so', 'fwrite');  
        let fclose =  
            Module.findExportByName('libc.so', 'fclose');  
  
        let call_mkdir = new NativeFunction(mkdir, 'int', ['pointer', 'int']);  
        let call_chmod = new NativeFunction(chmod, 'int', ['pointer', 'int']);  
        let call_fopen =  
            new NativeFunction(fopen, 'pointer', ['pointer', 'pointer']);  
        let call_fwrite =  
            new NativeFunction(fwrite, 'int', ['pointer', 'int', 'int', 'pointer']);  
        let call_fclose = new NativeFunction(fclose, 'int', ['pointer']);  
  
        call_mkdir(Memory.allocUtf8String(prefix), 0x1FF);  
        call_chmod(Memory.allocUtf8String(prefix), 0x1FF);  
        let fp = call_fopen(  
            Memory.allocUtf8String(prefix + file_path),  
            Memory.allocUtf8String('wb'));  
        if (call_fwrite(addr, 1, size, fp)) {  
            console.log('[+] Write file success, file path: ' + prefix + file_path);  
        } else {  
            console.log('[x] Write file failed');  
        }        call_fclose(fp);  
    });
}  
  
function hook_dlopen(addr, soName, callback) {  
    Interceptor.attach(addr, {  
        onEnter: function(args){  
            var name = args[0].readCString();  
            //console.log('openlib:', name);  
            if (name.indexOf(soName) !== -1) this.hook = true;  
        },        
        onLeave: function(retval){  
            if (this.hook) callback();  
        }    
    });
}  
  
var dlopen = Module.findExportByName(null, "dlopen");  
var android_dlopen_ext = Module.findExportByName(null, "android_dlopen_ext");  
hook_dlopen(dlopen, "libil2cpp.so", hook_il2cpp);  
hook_dlopen(android_dlopen_ext, "libil2cpp.so", hook_il2cpp);  
  
  
function hook_il2cpp(){  
    var il2cpp = Process.findModuleByName('libil2cpp.so');  
    console.log('il2cpp:', il2cpp.base);  
  
    Interceptor.attach(il2cpp.base.add(0x5B9238), {  
        onEnter: function(args){  
            console.log("sub_0x5B9238 called!!!");  
            console.log("args[0] = ", args[0].readCString());  
        },        
        onLeave: function(retval){  
            console.log("sub_0x5B9238 return!!!");  
            console.log("retval = ", retval);  
            var metadataSize = retval.add(0x108).readInt() + retval.add(0x10C).readInt();  
            console.log("offset = ", retval.add(0x108).readInt());  
            console.log("size = ", retval.add(0x10C).readInt());  
            console.log("MetadataSize = ", metadataSize);  
            var file_path = "global-metadata.dat";  
            //console.log("[+]Metadata is dumping!!");  
            WriteMemToFile(retval, metadataSize, file_path);  
            //console.log("[+]Metadata dump success!!");  
        }  
    });
}  
//frida -H 127.0.0.1:12345 -f com.personal.flappybird -l hook.js
```
![](/images/game-safety-2021-final/001.png)
- dump下来的文件放到il2cppdumper中仍然无用，在github上找到flappybird的源码([FlappyBirdStyleGame](https://github.com/dgkanatsios/FlappyBirdStyleGame?tab=readme-ov-file))，打算自己编译一份，结果踩坑了。。。原因是版本太新，于是用下了个版本低一点unity

![](/images/game-safety-2021-final/002.png)

废了很大力才编译出来(选了好几个unity版本都不符合预期。。。)
- 用il2cppdumper分析自己编译的libil2cpp.so，成功恢复符号并通过字符串的搜索找到对应的和实现无敌的函数`PlayerController__OnCollisionEnter2D`
![](/images/game-safety-2021-final/003.png)
- 在该函数内部找到判定角色死亡的关键逻辑，但是现在目的是要在题目的so中找到对应游戏逻辑所在的位置，于是在`UnityEngine_Component__CompareTag`函数中发现有字符串信息
![](/images/game-safety-2021-final/004.png)
- 在dump下来的so中通过`bindiff`恢复了部分符号之后，也是成功定位到题目的so的关键逻辑
![](/images/game-safety-2021-final/005.png)
- 只需要把`0x540E60`处指令的`BNE`修改成`B`即可实现无敌
![](/images/game-safety-2021-final/006.png)
- 经过`Frida`的验证确实可以实现无敌
```javascript
function patch(){  
    var module = Process.findModuleByName("libil2cpp.so");  
    var il2cppAddr = module.base;  
    console.log("il2cppAddr:", il2cppAddr);  
    var PatchPosition = 0x540E60;  
    var PatchCode = [0xE2, 0x00, 0x00, 0xEA];  
    console.log("[+]Patching...");  
    Memory.protect(il2cppAddr.add(PatchPosition), 4, 'rwx');  
    Memory.writeByteArray(il2cppAddr.add(PatchPosition), PatchCode);  
    console.log("[+]Patched success!!");  
}
```
## Question2:dump下来的il2cpp.so缺少符号(已解决)
请看下面两个对比图，符号是有一些恢复的，但是关键代码符号没有恢复
- 在别人wp中看到的
![](/images/game-safety-2021-final/007.png)
- 我dump下来的libil2cpp.so在IDA中看到的
![](/images/game-safety-2021-final/008.png)
- 下面是我dump il2cpp的过程(不知道是不是dump的时候地址范围选错了)
![](/images/game-safety-2021-final/009.png)
![](/images/game-safety-2021-final/010.png)

> 我目前的猜测wp中看到的是大佬编译了一份il2cpp.so然后恢复的符号，但是不确定是不是，打算自己编译一份看看的，但是不会，待办(确实是)

## Question3:加载global-metadata.dat函数的调用链
如图，不明白这个加载函数为什么调用到这里了
![](/images/game-safety-2021-final/011.png)
## Question4:实现无敌之后未成功绕过app的crc校验，导致重打包的apk无法运行
因为没有分析libil2cpp.so的解密函数和其他的一些代码段校验函数，所以无法实现破解版apk可以直接运行😭