---
title: "VNCTF"
description: "旅途的起点"
pubDate: "2025-02-08"
draft: false
---

# VNCTF WP

## `抽奖转盘`

一道harmony逆向题，用abc-decompiler反编译abc文件
![](/images/vnctf-2025-writeup/001.png)
![](/images/vnctf-2025-writeup/002.png)
![](/images/vnctf-2025-writeup/003.png)
![](/images/vnctf-2025-writeup/004.png)

虽然反编译的代码实在是非常难看，经过一番仔细的搜索还是能定位到一些关键的逻辑
最后一个函数会调用`libHello.so`中的`MyCry`方法,并传入用户的输入，前面几张图片则是密文数组和验证逻辑的一些函数，接下来要去libHello.so寻找其他的加密逻辑
搜索"MyCry"字符串可以定位到MyCry函数的位置
![](/images/vnctf-2025-writeup/005.png)
如图，关键函数的位置已圈出来，其中掺杂着很多的函数，查看之后发现是一些简单的运算被封装成函数了而已
关键在于`sub_i111iIl1i`和`sub_i111iIlii`函数，这两个函数看起来很像但是不一样
![](/images/vnctf-2025-writeup/006.png)
![](/images/vnctf-2025-writeup/007.png)
其实就是魔改的RC4，至于执行哪一个，都试一下就行，大概加密流程就这样，直接贴exp
```python
import base64

global_key = b''
global_ciphertext = b''

# RC4解密算法
def rc4_decrypt(data: bytes, key: bytes) -> bytes:
    S = list(range(256))
    j = 0
    
    # KSA阶段
    for i in range(256):
        j = (j + S[i] + key[i % len(key)]) % 256
        S[i], S[j] = S[j], S[i]
    
    # PRGA阶段
    i = j = 0
    plaintext = []
    for byte in data:
        i = (i + 1) % 256
        j = (j + S[i]) % 256
        S[i], S[j] = S[j], S[i]
        k = S[(S[i] + S[j]) % 256]
        plaintext.append(byte ^ k ^ 0x28)
    
    return bytes(plaintext)

# Base64解码
def base64_decode(data: bytes) -> bytes:
    return base64.b64decode(data)

# 字节减3操作
def bytes_minus_3(data: bytes) -> bytes:
    return bytes((b - 3) % 256 for b in data)

# 异或7后减1操作
def bytes_xor7_minus1(data: bytes) -> bytes:
    return bytes(((b ^ 7) - 1) % 256 for b in data)

if __name__ == "__main__":
    global_key = b'Take_it_easy'
    global_ciphertext = bytes([101, 74, 76, 49, 101, 76, 117, 87, 55, 69, 118, 68, 118, 69, 55, 67, 61, 83, 62, 111, 81, 77, 115, 101, 53, 73, 83, 66, 68, 114, 109, 108, 75, 66, 97, 117, 93, 127, 115, 124, 109, 82, 93, 115])
    step1 = bytes_xor7_minus1(global_ciphertext)
    step2 = base64_decode(step1)
    step3 = rc4_decrypt(step2, global_key)
    result = bytes_minus_3(step3)
    
    print(result.decode('utf-8'))
    
#VNCTF{JUst_$ne_Iast_dance_2025!}
```
---
## `kotlindroid`
这是一个Jetpack Compose框架开发的app，在Java层有大量与解题无关的函数，一开始不知道，导致我也在这浪费了很多时间
实际的验证逻辑在`SearchActivityKt`和`SearchActivityKt$sec$1`这两个类下面，直接看验证逻辑
![](/images/vnctf-2025-writeup/008.png)
这里绑定了button，点击会调用check方法并传入用户输入和一个拼接出来的key
![](/images/vnctf-2025-writeup/009.png)
这里可以看到`check`方法的逻辑，和一些`AES`相关的信息，是个`GCM`模式的加密，iv向量直接给了`114514`
![](/images/vnctf-2025-writeup/010.png)
接着找到AES加密的具体过程，发现最后在base64编码的时候会把iv向量和密文一起编码，解码的时候记得去掉
AES-GCM模式可以参考文章
>[AES-GCM模式详解](https://blog.csdn.net/armlinuxww/article/details/115478717)

这里我找key和aad信息直接用fridahook了，找到key:`atrikeyssyekirta` aad:`mysecretadd`
![](/images/vnctf-2025-writeup/011.png)
```javascript
Java.perform(function(){  
    var searchActivityKt = Java.use("com.atri.ezcompose.SearchActivityKt")  
    searchActivityKt.check.implementation = function(str, context, key){  
        console.log("check is called");  
        console.log("str:", JSON.stringify(str));  
        console.log("context:", JSON.stringify(context));  
        console.log("key:", JSON.stringify(key));  
        this.check(str, context, key);  
    }  
    var Cipher = Java.use('javax.crypto.Cipher');  
    // Hooking the updateAAD method  
    Cipher.updateAAD.overload('[B').implementation = function(bytes) {  
        console.log('updateAAD called with: ' + bytes);  // You can inspect the bytes here  
        // Optionally call the original method        return this.updateAAD(bytes);  
    };    var ArraysKt___ArraysJvmKt = Java.use("kotlin.collections.ArraysKt___ArraysJvmKt")  
    ArraysKt___ArraysJvmKt.plus.overload('[B', '[B').implementation = function(plus, elements){  
        console.log("plus is called");  
        console.log("plus:", JSON.stringify(plus));  
        console.log("elements:", JSON.stringify(elements));  
        return this.plus(plus, elements);  
    }  
});
```
最后还需要tag，查阅资料了解到tag一般嵌入在密文的尾部，长度为16字节，那么直接写exp即可
```python
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
from Crypto.Random import get_random_bytes
import base64


encoded_ciphertext = "HMuJKLOW1BqCAi2MxpHYjGjpPq82XXQ/jgx5WYrZ2MV53a9xjQVbRaVdRiXFrSn6EcQPzA=="
ciphertext_with_tag = base64.b64decode(encoded_ciphertext)
ciphertext = ciphertext_with_tag[:-16] 
tag = ciphertext_with_tag[-16:] 
key = b'atrikeyssyekirta'  
iv = b'114514' 
aad = b'mysecretadd'  
cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
cipher.update(aad)
decrypted_data = cipher.decrypt_and_verify(ciphertext, tag) 
print("Decrypted data:", decrypted_data.decode())
#VNCTF{Y0U_@re_th3_Ma5t3r_0f_C0mp0s3}
```
---
## `Hook Fish`
![](/images/vnctf-2025-writeup/012.png)
![](/images/vnctf-2025-writeup/013.png)
mainactivity中就能看到大部分的验证逻辑，最后的`check`和`encode`方法在下载的`hook_fish.dex`中,从代码中可以看出dex是从url中下载的，那么直接去resource目录找`string.xml`
![](/images/vnctf-2025-writeup/014.png)
直接访问这个网址就可以下载dex文件分析
```java
package fish;

import java.util.HashMap;

public class hook_fish {
    private HashMap fish_dcode;
    private HashMap fish_ecode;
    private String strr;

    public hook_fish() {
        this.strr = "jjjliijijjjjjijiiiiijijiijjiijijjjiiiiijjjjliiijijjjjljjiilijijiiiiiljiijjiiliiiiiiiiiiiljiijijiliiiijjijijjijijijijiilijiijiiiiiijiljijiilijijiiiijjljjjljiliiijjjijiiiljijjijiiiiiiijjliiiljjijiiiliiiiiiljjiijiijiijijijjiijjiijjjijjjljiliiijijiiiijjliijiijiiliiliiiiiiljiijjiiliiijjjliiijjljjiijiiiijiijjiijijjjiiliiliiijiijijijiijijiiijjjiijjijiiiljiijiijilji";
        this.encode_map();
        this.decode_map();
    }

    public boolean check(String s) {
        return s.equals(this.strr);
    }

    public String decode(String s) {
        StringBuilder stringBuilder0 = new StringBuilder();
        int v1 = 0;
        for(int v = 0; v1 < s.length() / 5; v += 5) {
            stringBuilder0.append(this.fish_dcode.get(s.substring(v, v + 5)));
            ++v1;
        }

        return stringBuilder0.toString();
    }

    public void decode_map() {
        HashMap hashMap0 = new HashMap();
        this.fish_dcode = hashMap0;
        hashMap0.put("iiijj", Character.valueOf('a'));
        this.fish_dcode.put("jjjii", Character.valueOf('b'));
        this.fish_dcode.put("jijij", Character.valueOf('c'));
        this.fish_dcode.put("jjijj", Character.valueOf('d'));
        this.fish_dcode.put("jjjjj", Character.valueOf('e'));
        this.fish_dcode.put("ijjjj", Character.valueOf('f'));
        this.fish_dcode.put("jjjji", Character.valueOf('g'));
        this.fish_dcode.put("iijii", Character.valueOf('h'));
        this.fish_dcode.put("ijiji", Character.valueOf('i'));
        this.fish_dcode.put("iiiji", Character.valueOf('j'));
        this.fish_dcode.put("jjjij", Character.valueOf('k'));
        this.fish_dcode.put("jijji", Character.valueOf('l'));
        this.fish_dcode.put("ijiij", Character.valueOf('m'));
        this.fish_dcode.put("iijji", Character.valueOf('n'));
        this.fish_dcode.put("ijjij", Character.valueOf('o'));
        this.fish_dcode.put("jiiji", Character.valueOf('p'));
        this.fish_dcode.put("ijijj", Character.valueOf('q'));
        this.fish_dcode.put("jijii", Character.valueOf('r'));
        this.fish_dcode.put("iiiii", Character.valueOf('s'));
        this.fish_dcode.put("jjiij", Character.valueOf('t'));
        this.fish_dcode.put("ijjji", Character.valueOf('u'));
        this.fish_dcode.put("jiiij", Character.valueOf('v'));
        this.fish_dcode.put("iiiij", Character.valueOf('w'));
        this.fish_dcode.put("iijij", Character.valueOf('x'));
        this.fish_dcode.put("jjiji", Character.valueOf('y'));
        this.fish_dcode.put("jijjj", Character.valueOf('z'));
        this.fish_dcode.put("iijjl", Character.valueOf('1'));
        this.fish_dcode.put("iiilj", Character.valueOf('2'));
        this.fish_dcode.put("iliii", Character.valueOf('3'));
        this.fish_dcode.put("jiili", Character.valueOf('4'));
        this.fish_dcode.put("jilji", Character.valueOf('5'));
        this.fish_dcode.put("iliji", Character.valueOf('6'));
        this.fish_dcode.put("jjjlj", Character.valueOf('7'));
        this.fish_dcode.put("ijljj", Character.valueOf('8'));
        this.fish_dcode.put("iljji", Character.valueOf('9'));
        this.fish_dcode.put("jjjli", Character.valueOf('0'));
    }

    public String encode(String s) {
        StringBuilder stringBuilder0 = new StringBuilder();
        for(int v = 0; v < s.length(); ++v) {
            stringBuilder0.append(((String)this.fish_ecode.get(Character.valueOf(s.charAt(v)))));
        }

        return stringBuilder0.toString();
    }

    public void encode_map() {
        HashMap hashMap0 = new HashMap();
        this.fish_ecode = hashMap0;
        hashMap0.put(Character.valueOf('a'), "iiijj");
        this.fish_ecode.put(Character.valueOf('b'), "jjjii");
        this.fish_ecode.put(Character.valueOf('c'), "jijij");
        this.fish_ecode.put(Character.valueOf('d'), "jjijj");
        this.fish_ecode.put(Character.valueOf('e'), "jjjjj");
        this.fish_ecode.put(Character.valueOf('f'), "ijjjj");
        this.fish_ecode.put(Character.valueOf('g'), "jjjji");
        this.fish_ecode.put(Character.valueOf('h'), "iijii");
        this.fish_ecode.put(Character.valueOf('i'), "ijiji");
        this.fish_ecode.put(Character.valueOf('j'), "iiiji");
        this.fish_ecode.put(Character.valueOf('k'), "jjjij");
        this.fish_ecode.put(Character.valueOf('l'), "jijji");
        this.fish_ecode.put(Character.valueOf('m'), "ijiij");
        this.fish_ecode.put(Character.valueOf('n'), "iijji");
        this.fish_ecode.put(Character.valueOf('o'), "ijjij");
        this.fish_ecode.put(Character.valueOf('p'), "jiiji");
        this.fish_ecode.put(Character.valueOf('q'), "ijijj");
        this.fish_ecode.put(Character.valueOf('r'), "jijii");
        this.fish_ecode.put(Character.valueOf('s'), "iiiii");
        this.fish_ecode.put(Character.valueOf('t'), "jjiij");
        this.fish_ecode.put(Character.valueOf('u'), "ijjji");
        this.fish_ecode.put(Character.valueOf('v'), "jiiij");
        this.fish_ecode.put(Character.valueOf('w'), "iiiij");
        this.fish_ecode.put(Character.valueOf('x'), "iijij");
        this.fish_ecode.put(Character.valueOf('y'), "jjiji");
        this.fish_ecode.put(Character.valueOf('z'), "jijjj");
        this.fish_ecode.put(Character.valueOf('1'), "iijjl");
        this.fish_ecode.put(Character.valueOf('2'), "iiilj");
        this.fish_ecode.put(Character.valueOf('3'), "iliii");
        this.fish_ecode.put(Character.valueOf('4'), "jiili");
        this.fish_ecode.put(Character.valueOf('5'), "jilji");
        this.fish_ecode.put(Character.valueOf('6'), "iliji");
        this.fish_ecode.put(Character.valueOf('7'), "jjjlj");
        this.fish_ecode.put(Character.valueOf('8'), "ijljj");
        this.fish_ecode.put(Character.valueOf('9'), "iljji");
        this.fish_ecode.put(Character.valueOf('0'), "jjjli");
    }
}


```
encode方法实际就是一个自己写的编码，照着码表就可以decode
```python

decode_map = {
    "iiijj": 'a', "jjjii": 'b', "jijij": 'c', "jjijj": 'd', "jjjjj": 'e',
    "ijjjj": 'f', "jjjji": 'g', "iijii": 'h', "ijiji": 'i', "iiiji": 'j',
    "jjjij": 'k', "jijji": 'l', "ijiij": 'm', "iijji": 'n', "ijjij": 'o',
    "jiiji": 'p', "ijijj": 'q', "jijii": 'r', "iiiii": 's', "jjiij": 't',
    "ijjji": 'u', "jiiij": 'v', "iiiij": 'w', "iijij": 'x', "jjiji": 'y',
    "jijjj": 'z', "iijjl": '1', "iiilj": '2', "iliii": '3', "jiili": '4',
    "jilji": '5', "iliji": '6', "jjjlj": '7', "ijljj": '8', "iljji": '9',
    "jjjli": '0'
}
def decode(encoded_str):
    decoded_str = ""
    for i in range(0, len(encoded_str), 5):
        block = encoded_str[i:i+5]
        if block in decode_map:
            decoded_str += decode_map[block]
        else:
            decoded_str += '?' 
    return decoded_str

encoded_string = "jjjliijijjjjjijiiiiijijiijjiijijjjiiiiijjjjliiijijjjjljjiilijijiiiiiljiijjiiliiiiiiiiiiiljiijijiliiiijjijijjijijijijiilijiijiiiiiijiljijiilijijiiiijjljjjljiliiijjjijiiiljijjijiiiiiiijjliiiljjijiiiliiiiiiljjiijiijiijijijjiijjiijjjijjjljiliiijijiiiijjliijiijiiliiliiiiiiljiijjiiliiijjjliiijjljjiijiiiijiijjiijijjjiiliiliiijiijijijiijijiiijjjiijjijiiiljiijiijilji"  # 替换为需要解码的字符串
decoded_string = decode(encoded_string)
print("Decoded string:", decoded_string)
#0qksrtuw0x74r2n3s2x3ooi4ps54r173k2os12r32pmqnu73r1h432n301twnq43prruo2h5
```
有了这个密文直接逆Java层的encrypt方法就好了，纯算法没什么好分析
```python
def decrypt(encrypted_str):
    s = list(encrypted_str)
    for i in range(len(s)):
        s[i] = chr(decode_char(s[i], i))
    reverse_code(s)
    hex_str = ''.join(s)
    bytes_data = bytes.fromhex(hex_str)
    decrypted = bytes([b - 68 for b in bytes_data])
    return decrypted.decode()

def decode_char(ch, i):
    if 'a' <= decode_a2f(ch, i) <= 'f':
        return (ord(ch) - (i % 4)) + ord('1')
    else:
        return ord(ch) - ord('7') - (i % 10)

def decode_a2f(ch, i):
    return chr((ord(ch) - (i % 4)) + ord('1'))

def reverse_code(arr):
    for i in range(0, len(arr) - 1, 2):
        arr[i], arr[i + 1] = arr[i + 1], arr[i]
        
encrypted_str = "0qksrtuw0x74r2n3s2x3ooi4ps54r173k2os12r32pmqnu73r1h432n301twnq43prruo2h5"
decrypted_str = decrypt(encrypted_str)
print(decrypted_str)
#VNCTF{u_re4l1y_kn0w_H0Ok_my_f1Sh!1l}
```
---
## `AndroidLux`
![](/images/vnctf-2025-writeup/015.png)
mainactivity主要的方法就是`connectAndSendLocalSocketServer`，这个方法会判断当前有没有创建线程，有的话就直接与本地的`mahoshojo`进程通信，将用户的输入传给这个进程处理
![](/images/vnctf-2025-writeup/016.png)
然后会接收从线程传回来的消息，关键逻辑还是在busybox执行的文件中，有关busybox的信息可以看下面这篇文章
>[BusyBox - 维基百科，自由的百科全书](https://zh.wikipedia.org/wiki/BusyBox)

在asset目录下有busybox的可执行文件和env这个压缩包，在Java中可以看到app第一次运行时会解压env并初始化环境
![](/images/vnctf-2025-writeup/017.png)
![](/images/vnctf-2025-writeup/018.png)
初始化会调用到这两个类，实现了一个命令行执行器，接下来就去解压的env里面找有没有可疑的文件
在`root/`目录下发现一个env可执行文件，BN打开发现是进行了一个自定义的魔改Base64编码，并且会和密文进行对比
![](/images/vnctf-2025-writeup/019.png)
编写了一个解码脚本发现不对，锤了一下出题人提示还有其他地方有修改，继续在env中找可疑文件
发现`/usr/libexec`目录下有一个`libexec.so`,打开一看发现重写了`read`函数和`strncmp`函数，难怪解码不对
![](/images/vnctf-2025-writeup/020.png)
![](/images/vnctf-2025-writeup/021.png)
read函数会`异或0x1`,strncmp则是实现了一个`ROT13`,exp如下
```python

def decode_base64(ciphertext,码表):
    inverse_table = {char: idx for idx, char in enumerate(码表)}
    stripped = ciphertext.rstrip('=')
    missing_padding = len(stripped) % 4
    if missing_padding:
        stripped += '=' * (4 - missing_padding)

    data = []
    for char in stripped:
        if char == '=':
            data.append(0)
        else:
            data.append(inverse_table[char])
    
    decoded = bytearray()
    for i in range(0, len(data), 4):
        chunk = data[i:i+4]
        if len(chunk) < 4:
            chunk += [0] * (4 - len(chunk))
        c1, c2, c3, c4 = chunk
        b1 = (c1 << 2) | (c2 & 0x3)            #魔改点
        b2 = ((c2 & 0x3C) << 2) | (c3 & 0x0F)  #魔改点
        b3 = (c3 >> 4) << 6 | c4
        decoded.extend([b1, b2, b3])

    padding = ciphertext.count('=')
    if padding:
        decoded = decoded[:-padding] if padding else decoded
    for i in range(len(decoded)):
        decoded[i] ^= 1
    return bytes(decoded)

table = "TUVWXYZabcdefghijABCDEF456789GHIJKLMNOPQRSklmnopqrstuvwxyz0123+/"
data = "ECIVEA40E9CH67hr6EHU88Etf65Oc8gq8IDz4FCNG8Xw97DtIT=="
flag = decode_base64(data,table)
print(flag)
#VNCTF{Ur_go0d_@ndr0id&l1nux_Reve7ser}
```
---
## `VN_Lang`
![](/images/vnctf-2025-writeup/022.png)
IDA打开直接搜到了
