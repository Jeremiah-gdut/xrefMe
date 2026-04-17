---
title: "GameSafety2021 Android方向初赛题目复现"
description: "根据其他大佬的Wp和指导一步步复现2021年的初赛题，记录其中遇到的一些问题"
pubDate: "2024-12-23"
draft: false
---

[gslab2021 初赛 - 安卓客户端安全 | Xhy's Blog](https://blog.xhyeax.com/2021/04/04/gslab2021-pre-android/)wp参考

Assembly CSharp.dll文件已加密，路径为`X:\GameSafety\Game2021\安卓客户端题目\初赛题目\RocketMouse\assets\bin\Data\Managed`

`mono`引擎的unity游戏，包名`com.personal.rocketmouse`

启动游戏会弹窗hacker detect并退出，在`com.tencent.games.sec2021.Sec2021MsgBox`下找到`onDismiss`方法调用系统函数exit

查找show的交叉引用找到`com.tencent.games.sec2021.Sec2021IPC`的onNativeEngineResponse方法，猜测调用了native层的函数使进程退出，在ida中找kill函数的交叉引用找到函数sub_1F788，继续查找函数调用链找到1FAA8，该函数被调用了5次

**用florida过掉了检测**

查看libmono.so发现libmono.so经过了加密，用`elf-dump-fix`在libmono.so加载之后从内存中dump并修复得到解密后的monodump.so

找到libmono.so的`mono_image_open_from_data_with_name`方法，此处用于加载`Assembly-CSharp.dll`文件，发现第一条指令用于跳转到libsec2021.so的`sub_1CEDC`函数，此函数用于对Assembly-CSharp.dll文件解密

![image-20241222155627410](/images/game-safety-2021-preliminary/001.png)

会先判断如果是MZ开头并且路径中没有Assembly-CSsharp.dll文件，就跳转到`0x1CF88`执行，否则就调用`0x1CF4C`解密函数，如图，此处会将sec2021.png的`0x410B`至末尾的数据解密，解密结果为真正加载的Assembly-CSharp.dll,查看函数调用可以看到解密函数为`0x1D2A0`![image-20241222161231517](/images/game-safety-2021-preliminary/002.png)![image-20241222162015071](/images/game-safety-2021-preliminary/003.png)

其中`sub_18CEC`为获取dll索引，crc32校验函数为`subF3B4`正常会返回0，直接把返回值patch成0即可过检测

过完检测之后因为`mono_image_open_from_data_with_name`函数的第一条指令会完成解密操作，所以可以hook下一条指令，当读取到真正的`Assembly-CSharp.dll`时在内存中dump出来
```javascript
 function hook_mono() {  
     var libbase = Module.findBaseAddress("libmono.so");  
     console.log("libbase", libbase);  
     var addr = Module.findExportByName("libmono.so", "mono_image_open_from_data_with_name");  
     console.log("mono_image_open_from_data_with_name", addr);  
   
     Interceptor.attach(addr.add(4), {  
         onEnter: function (args) {  
             var data = args[0];  
             var data_len = args[1];  
             console.log("data_length = ",data_len);  
             console.log('data = ',data);  
             if (data_len == 0x2800) {  
                 WriteMemToFile(data,data_len.toInt32(),'dump.bin');  
             }  
             console.log("mono_image_open_from_data_with_name_ori() called!", data, data_len);  
         },  
         onLeave: function (retval) {  
         }  
     });  
 }  
 function hook_dlopen(){  
     var dlopen = Module.findExportByName(null, "dlopen");  
     console.log(dlopen);  
     if(dlopen != null){  
         Interceptor.attach(dlopen,{  
             onEnter: function(args){  
                 var soName = args[0].readCString();  
                 console.log(soName);  
                 this.is_mono_loaded = false;  
                 this.is_sec2021_loaded = false;  
                 if(soName.indexOf("libsec2021.so") !== -1){  
                     //hook_initarray();  
                     this.is_sec2021_loaded = true;  
                 }  
                 if(soName.indexOf("libmono.so") !== -1){  
                     this.is_mono_loaded = true;  
                 }  
             },  
             onLeave: function(retval){  
                 if(this.is_mono_loaded){  
                     //hook_getString();  
                     hook_mono();  
                 }  
             }  
         });  
     }  
   
     var android_dlopen_ext = Module.findExportByName(null, "android_dlopen_ext");  
     console.log(android_dlopen_ext);  
     if(android_dlopen_ext != null){  
         Interceptor.attach(android_dlopen_ext,{  
             onEnter: function(args){  
                 var soName = args[0].readCString();  
                 console.log(soName);  
                 this.is_mono_loaded = false;  
                 if(soName.indexOf("libmono.so") !== -1){  
                     this.is_mono_loaded = true;  
                 }  
                 this.is_sec2021_loaded = soName.indexOf("libsec2021.so") !== -1;  
             },  
             onLeave: function(retval){  
                 if(this.is_mono_loaded){  
                     //hook_getString();  
                     hook_mono();  
                 }  
             }  
         });  
     }  
   
 }  
 hook_dlopen();  
   
 function WriteMemToFile(addr, size, file_path) {  
     Java.perform(function() {  
         // let prefix: string = '/data/data/com.tencent.mf.uam/files/' # 路径  
         let prefix = '/data/data/com.personal.rocketmouse/files/';  
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
         }  
         call_fclose(fp);  
     });  
 }
```
dump完成之后分析dll文件，因为目标为实现`无敌`，所以只需要修改游戏逻辑中对碰撞的检测即可，定位到`MouseController`类的`OnTriggerEnter2D`函数

![image-20241222164122627](/images/game-safety-2021-preliminary/004.png)

如果不是金币就会调用`HitByLaser`函数，所以只要把相应的Dead属性改为false即可，在ida中静态patch，原来为4.1，改为4.0即可

![image-20241222164324561](/images/game-safety-2021-preliminary/005.png)

最后只需要把0x1CF88处的跳转指令改成B ，使非`MZ`开头的dll才执行解密函数，并把原本的dll替换成破解版即可

---

### 复现中遇到的问题

- 打开APP就会退出并弹窗"`hacker detect:xxx`"，后面发现是app检测了tmp目录下是否存在`frida/ida`相关的东西，更改名称即可过检测
  
- 使用frida启动APP仍然会退出，是对frida的一些行为进行检测。使用`florida`过了检测
  
- 尝试hook libsec2021.so中的`sub_1F120`(字符串解密函数)时,会出现`opcode crack`的情况,原因**未查明**，但是通过patch掉退出函数的调用也能过，缺点是只能hook出部分字符串
  
- 在dump内存的时候，会出现dump不出来的情况，后面检查发现是libmono.so是动态加载的，于是要先hook `dlopen`函数，在libmono.so加载之后再进行hook，并执行内存dump
  
- dump Assembly-CSharp.dll的时候，是根据dll的大小来判断的，目前**不清楚**具体原因是什么，但是在hook `mono_image_open_from_data_with_name`函数的时候发现他加载的文件大小差异比较大，目前猜测是比较所有被加载的dll的大小之后才判断要dump大小为`0x2800`的dll文件
