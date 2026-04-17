---
title: "NewStarCTF2024 WriteUp"
description: "NewStarCTF2024的一些个人wp和其他师傅的wp汇总"
pubDate: "2024-11-03"
draft: false
---

# NewStarCTF Re

## Week 1

### Base64

先放IDA中打开

![](/images/newstar-ctf-2024-re-writeup/001.png)

可以看到先让我们输入了flag，很显然str就是我们的输入，长度为112.下面进行了判断，跟一串奇怪的字符串进行了判断，这串字符串就是加密过后的密文。

下一步的思路就是去看看是哪个函数对str进行操作，分析后发现是sub_1400014E0函数对str操作，sub_1400014E0的内容如图

![](/images/newstar-ctf-2024-re-writeup/002.png)

在里面可以看到str以aWhyDo3sthis7ab字符表为基础进行映射得到了密文,跟进可以得到字符表的具体内容**WHydo3sThiS7ABLElO0k5trange+CZfVIGRvup81NKQbjmPzU4MDc9Y6q2XwFxJ/**

顺便把密文也贴出来**g84Gg6m2ATtVeYqUZ9xRnaBpBvOVZYtj+Tc=**

下面给出exp

```python
import base64

# 给定的密文和映射表
cipher_text = "g84Gg6m2ATtVeYqUZ9xRnaBpBvOVZYtj+Tc="
custom_table = "WHydo3sThiS7ABLElO0k5trange+CZfVIGRvup81NKQbjmPzU4MDc9Y6q2XwFxJ/"

# 将映射表转化为标准Base64字符表顺序
standard_table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

# 创建解码表：将映射表字符转换到标准Base64字符
decode_table = str.maketrans(custom_table, standard_table)

# 使用映射表对密文进行字符替换
translated_cipher = cipher_text.translate(decode_table)

# 解码Base64
decoded_data = base64.b64decode(translated_cipher)

print("解码后的数据:", decoded_data)
```

得到flag：**flag{y0u_kn0w_base64_well}**

------

### Simple_encryption

通过DIE查壳知道无壳，64位架构，f5进入main函数

![](/images/newstar-ctf-2024-re-writeup/003.png)

首先是scanf输入一段字符串到input（其实就是你得到的flag），接着for循环对我们的输入进行了三个操作，很明显看到是对input的第j个元素进行操作，当j%3 = 0,1,2的时候，进行不同的操作，循环结束将input数组与buffer数组进行比较，即密文。提取出密文之后即可解密，exp如下

```c
#include<stdio.h>

int main() {
        char buffer[] = { 71,149,52,72,164,28,53,136,100,22,136,7,20,106,57,18,162,10,55,92,7,90,86,96,18,118,37,18,142,40,2 };
        for (int i = 0; i < 30; i++ ) {
                if (!(i % 3))
                        buffer[i] += 31;
                if (i % 3 == 1)
                        buffer[i] -= 41;
                if (i % 3 == 2)
                        buffer[i] ^= 0x55;

        }
        printf("%s", buffer);

        return 0;
}
```

**flag{IT_15_R3Al1y_V3Ry-51Mp1e}**

------

### ez_debug

如题，显然是告诉我们要通过动调得到flag，先分析反编译的代码

![](/images/newstar-ctf-2024-re-writeup/004.png)

反编译之后能看到这是c++代码编写的文件，读起来非常吃力，但是在最后会对用户输入进行一个比较，考虑在比较的if语句位置设下断点看能不能直接查看到flag，用xdbg打开

![](/images/newstar-ctf-2024-re-writeup/005.png)

可以看到在right语句执行前先对al进行了判断（je），值为真则跳转到wrong语句。关键点在于right语句后面有个jmp操作（无条件跳转），意思就是只要我们输入了正确的flag，就一定会跳转到某个语句，而输入错误则不会跳转，接着往跳转的位置往下看，发现了一串字符串“decrypted flag：”，显然这个right跳转的语句会执行一系列操作将解密过后的flag打印出来，到这里我们的思路就很清晰了，只需要nop掉判断我们输入的语句，让程序一定会执行到right语句，接着跳转到解密函数的位置让程序来帮我们解密即可。

![](/images/newstar-ctf-2024-re-writeup/006.png)

如图，nop掉判断操作，并在Decrypted flag的位置打断点（解密结束才会运行到断点处），剩下的只需要运行程序知道命中我们的断点即可。

![](/images/newstar-ctf-2024-re-writeup/007.png)

可以看到，命中断点之后，解密之后的flag也显现出来了**flag{y0u_ar3_g0od_@_Debu9}**

------

## Week 2

### UPX

DIE查壳，发现是**upx**壳

![](/images/newstar-ctf-2024-re-writeup/008.png)

用upx脱壳就行了，命令：upx -d yourflie.exe

![](/images/newstar-ctf-2024-re-writeup/009.png)

脱壳后IDA反编译即可

![](/images/newstar-ctf-2024-re-writeup/010.png)

f5之后可以看到进行了RC4加密，data是密文，RC4是个对称加密算法，其加解密过程是一样的，exp如下

```c
#include<stdio.h>
#include<string.h>
#include<stdlib.h>
#include <stdint.h>

void swap(char* a1,char* a2) {
        char temp;
        temp = *a1;
        *a1 = *a2;
        *a2 = temp;
}
void RC4_Decode(char* data, unsigned char* sbox) {
        unsigned char a = 0;
        unsigned char b = 0;
        int length = 22;
        for (int i = 0; i < length; i++) {
                b += sbox[++a];
                swap((char*)&sbox[a], (char*)&sbox[b]);
                data[i] ^= sbox[(sbox[a] + sbox[b])%256];
        }
        for (int i = 0; i < length; i++) {
                printf("%c", data[i]);
        }
}
unsigned char* Initial_sbox(char* key) {
        unsigned char sbox[256] = { 0 };
        for (int i = 0; i < 256; i++) {
                sbox[i] = i;
        }
        int length = strlen(key);
        unsigned char kbox[256] = { 0 };
        for (int i = 0; i < 256; i++) {
                kbox[i] = key[i % length];
        }
        int j = 0;
        for (int i = 0; i < 256; i++) {
                j = (j + sbox[i] + kbox[i]) % 256;
                swap((char*) & sbox[i], (char*) & sbox[j]);
        }
        return sbox;
}
int main() {
        char data[23] = { -60,96,-81,-71,-29,-1,46,-101,-11,16,86,81,110,-18,95,125,125,110,43,-100,117,-75,'\0'};
        char key[] = "NewStar";
        unsigned char* sbox = (unsigned char*)malloc(sizeof(char) * 256);
        sbox = Initial_sbox(key);
        RC4_Decode(data, sbox);
        

        return 0;
}

```

得到答案**flag{Do_you_know_UPX?}**

------

### drink_TEA

![](/images/newstar-ctf-2024-re-writeup/011.png)

main函数内容如图，已经经过了一些修改。由memcmp函数可以判断出EncodeAnswer是加密过后的密文，由TEA加密算法的特征可以判断出aWelcometonewst是一个类似于密钥的字符串，for循环每次取input的八个字节传入TEA加密函数，在TEA函数里分成两个四字节进行加密。在这里不多赘述TEA算法的细节，密文在EncodeAnswer里面找到，TEA加密的具体内容如下图

![](/images/newstar-ctf-2024-re-writeup/012.png)

解密出来的结果是十六进制数，需要转换成可读的字符串

![](/images/newstar-ctf-2024-re-writeup/013.png)

这里有个大小端序的问题，其实这里传入解密函数的方式不是很对，正常是可以得到按顺序的flag的，下面给出exp

```c
#include<stdio.h>

void Decode(unsigned int* a1, unsigned int* a2 ,unsigned int* key, unsigned int Delta) {
        unsigned int sum = -32*Delta;
        for (int i = 0; i < 32; ++i)
        {
                *a2 -= (key[3] + ((*a1) >> 5)) ^ (sum + (*a1)) ^ (key[2] + ((*a1) << 4));
                *a1 -= (key[1] + ((*a2) >> 5)) ^ (sum + (*a2)) ^ (key[0] + ((*a2) << 4));
                sum += Delta;
        }
}


int main() {
        unsigned int Delta = 0x61C88647;
        unsigned int input[8];
        unsigned int sum = 0;
        input[0] = 0xB3F72078;
        input[1] = 0xDACE42C5;
        input[2] = 0x1A215985;
        input[3] = 0x595A5626;
        input[4] = 0xED0D0229;
        input[5] = 0xEEB9A807;
        input[6] = 0x87115936;
        input[7] = 0x24235CFD;


        char key[17] = "WelcomeToNewStar";
        for (int i = 0; i < 8 ; i+=2) {
                Decode(&input[i], &input[i+1], (unsigned int*)key, Delta);
        }
        for (int i = 0; i < 8; i++) {
                printf("%x", input[i]);
        }
        return 0;
}
```

得到flag的16进制形式：**67616c666568547b525f65724145545f4554585f6e615f4158585f647d414554**

------

### Ptrace

题目给了两个elf文件，PIE查了无壳

![](/images/newstar-ctf-2024-re-writeup/014.png)

这是这是father文件反编译后的内容，出现了一些没见过的函数经过查询可知

![](/images/newstar-ctf-2024-re-writeup/015.png)

![](/images/newstar-ctf-2024-re-writeup/016.png)

所以可以知道ptrace函数往子进程的addr内存地址写入了一个整数3,查看IDA可以看到addr代表地址0x60004040

![](/images/newstar-ctf-2024-re-writeup/017.png)

打开子进程可以看到时进行了一个简单的加密操作，不难看出byte_60004020是密文数组，现在未知的只有

num_4这个变量，其实这个num_4就是前面addr的地址，所以他的值是3,接下来只要写exp就行了

```c
#include<stdio.h>

int main() {
	int input[32] = { 204,141,44,236,111,136,237,235,47,237,174,235,78,172,44,141,141,47,235,109,205,237,238,235,14,142,78,44,108,172,231,175 };
	for (int i = 0; i < 32; i++) {

		input[i] = (input[i] << 3) | (input[i] >> 5);
		printf("%c", input[i]);
	}

	return 0;
}
```

**flag{Do_you_really_know_ptrace?}**

------

### ezencrypt

![](/images/newstar-ctf-2024-re-writeup/018.png)

jadx打开，进入mainactivity，有用的信息只有开头的key数组，还有最下面读取了我们的输入并进行了判断

![](/images/newstar-ctf-2024-re-writeup/019.png)

enc是作者实现的一个类，估计就是加密函数了，check是enc类下的一个函数

![](/images/newstar-ctf-2024-re-writeup/020.png)

点进来能看到enc类的具体实现，可以看到第一个是总加密函数，第二个check函数实际上是调用的native方法中的一个so文件实现的，具体内容需要将apk解压之后用IDA打开so文件进行分析。第三个函数stringtokey是对我们前面找到的key密钥进行加密，用的是AES的加密算法。encrypt函数是对我们输入的加密函数，用的**AES**加密，**ECB**模式，**PKCS5Padding**模式。下面的decrypt函数则是解密函数，最后声明了ezencrypt.so文件。

![](/images/newstar-ctf-2024-re-writeup/021.png)

在IDA里我们能看到doEncCheck函数的具体实现，Java通过*JNI*传递我们的输入到c语言的函数中，不难看出mm数组是最终加密完成的密文，下面点进enc函数进行查看他对我们的输入进行了什么操作

![](/images/newstar-ctf-2024-re-writeup/022.png)

![](/images/newstar-ctf-2024-re-writeup/023.png)

点进来看到它显示对我们的输入和key数组进行了异或操作，接着再对input和key数组通过rc4算法进行加密，所以我们相应的解密过程就是先rc4解密在和key数组异或就能得到明文，下面给出key数组和mm数组的具体内容

![](/images/newstar-ctf-2024-re-writeup/024.png)

exp如下

```c
#include<stdio.h>
#include<string.h>
#include<stdlib.h>
#include <stdint.h>

void swap(char* a1, char* a2) {
        char temp;
        temp = *a1;
        *a1 = *a2;
        *a2 = temp;
}
void RC4_Decode(char* data, unsigned char* sbox) {
        unsigned char a = 0;
        unsigned char b = 0;
        int length = 44;
        for (int i = 0; i < 44; i++) {
                b += sbox[++a];
                swap((char*)&sbox[a], (char*)&sbox[b]);
                data[i] ^= sbox[(sbox[a] + sbox[b]) % 256];
        }
        
}
unsigned char* Initial_sbox(char* key) {
        unsigned char sbox[256] = { 0 };
        for (int i = 0; i < 256; i++) {
                sbox[i] = i;
        }
        int length = strlen(key);
        unsigned char kbox[256] = { 0 };
        for (int i = 0; i < 256; i++) {
                kbox[i] = key[i % length];
        }
        int j = 0;
        for (int i = 0; i < 256; i++) {
                j = (j + sbox[i] + kbox[i]) % 256;
                swap((char*)&sbox[i], (char*)&sbox[j]);
        }
        return sbox;
}
int main() {
        char data[45] = { 194,108,115,244,58,69,14,186,71,129,42,38,246,121,96,120,179,100,109,220,201,4,50,59,159,50,149,96,238,130,151,231,202,61,170,149,118,197,155,29,137,219,152,93,'\0'};
        char key[] = "meow";
        unsigned char* sbox = (unsigned char*)malloc(sizeof(char) * 256);
        sbox = Initial_sbox(key);
        RC4_Decode(data, sbox);
        for (int i = 0; i < 44; i++) {
                data[i] ^= key[i % strlen(key)];
        }
        for (int i = 0; i < 44; i++) {
                printf("%c", data[i]);
        }
        printf("\n");
        printf("以上结果为AES加密后转base64编码的结果\n");
        printf("剩余结果请使用在线工具AES解密，选择ECB模式，pkcs7填充，密钥为\"IamEzEncryptGame\"");
        return 0;
}

```

so层解密结果：**2BB+GQampKmsrfDG85+0A7n18M+kT2zBDiZSO28Ich4=**

这是so层面的解密过程，别忘了还有Java层的加密，由于对Java语言还没那么熟悉，无法手搓解密代码，所以借用一下在线网站的解密工具，根据相应的模式可以得到**flag{Ohh_U_knOw_7h15_5ki11}**

------

### PangBai 泰拉记（1）

![](/images/newstar-ctf-2024-re-writeup/025.png)

IDA打开之后看到这样的界面，最显眼的就是粉色的isdebuggerpresent函数，这个函数是用来检测当前程序是否在被调试，如果调试则值为1反之为0，阅读程序逻辑可以发现程序有两段加密过程，经过尝试第一段加密过程得到的不是正确的flag，那么就尝试对第二段加密过程进行解密

![](/images/newstar-ctf-2024-re-writeup/026.png)

key数组的内容是这样的

直接编写解密代码

```c
#include<stdio.h>
#include<string.h>
int main() {
        char temp[23] = "nhvviguMI?u\",o/fWivoM;";
        temp[22] = 127;
        char temp1[] = "Homy2.l#{";
        
        char flag[] = "can you find me can you find me?";
        char key[] = "key1key2key3key4key6key7key8key9";
        for (int i = 0; i < 32; i++) {
                if (i < 23)
                        key[i] ^= temp[i];
                else key[i] ^= temp1[i - 23];
                
        }
        
        for (int i = 0; i < 32; i++) {
                flag[i] ^= key[i];
                printf("%c", flag[i]);
        }
        
        
        return 0;
}
```

**flag{my_D3bugg3r_may_1s_banned?}**

------

### Dirty_flowers

![](/images/newstar-ctf-2024-re-writeup/027.png)

打开IDA是这样的，由题目的名字可以猜测代码被花指令干扰过了，根据提示我们可以找到汇编代码中的相应的retn指令和call $ + 5指令

![](/images/newstar-ctf-2024-re-writeup/028.png)

![](/images/newstar-ctf-2024-re-writeup/029.png)

![](/images/newstar-ctf-2024-re-writeup/030.png)

![](/images/newstar-ctf-2024-re-writeup/031.png)

由于不太会用IDA的重定义，所以选择打开xdbg来nop掉这些花指令再打补丁

![](/images/newstar-ctf-2024-re-writeup/032.png)

![](/images/newstar-ctf-2024-re-writeup/033.png)

找到相应花指令的位置，nop掉

![](/images/newstar-ctf-2024-re-writeup/034.png)

![](/images/newstar-ctf-2024-re-writeup/035.png)

![](/images/newstar-ctf-2024-re-writeup/036.png)

![](/images/newstar-ctf-2024-re-writeup/037.png)

然后得到我们修补过后的main函数，可以看到就一个加密过程

![](/images/newstar-ctf-2024-re-writeup/038.png)

exp如下

```c
#include<stdio.h>
#include<string.h>
int main() {
        char encrypted[36];
        encrypted[0] = 2;
        encrypted[1] = 5;
        encrypted[2] = 19;
        encrypted[3] = 19;
        encrypted[4] = 2;
        encrypted[5] = 30;
        encrypted[6] = 83;
        encrypted[7] = 31;
        encrypted[8] = 92;
        encrypted[9] = 26;
        encrypted[10] = 39;
        encrypted[11] = 67;
        encrypted[12] = 29;
        encrypted[13] = 54;
        encrypted[14] = 67;
        encrypted[15] = 7;
        encrypted[16] = 38;
        encrypted[17] = 45;
        encrypted[18] = 85;
        encrypted[19] = 13;
        encrypted[20] = 3;
        encrypted[21] = 27;
        encrypted[22] = 28;
        encrypted[23] = 45;
        encrypted[24] = 2;
        encrypted[25] = 28;
        encrypted[26] = 28;
        encrypted[27] = 48;
        encrypted[28] = 56;
        encrypted[29] = 50;
        encrypted[30] = 85;
        encrypted[31] = 2;
        encrypted[32] = 27;
        encrypted[33] = 22;
        encrypted[34] = 84;
        encrypted[35] = 15;
        char key[] = "dirty_flower";
        int length = strlen(key);
        for (int i = 0; i < 36; i++) {
                encrypted[i] ^= key[i % length];
                printf("%c", encrypted[i]);
        }

        return 0;
}
```

**flag{A5s3mB1y_1s_r3ally_funDAm3nta1}**

------

## Week 3

### SMc_math

![](/images/newstar-ctf-2024-re-writeup/039.png)

进来对main函数f5反编译一下，发现了有个循环对函数encrypt的地址和0x3E位与，并且调用了mprotect函数，查资料了解到这可能进行了smc混淆，并且直接点进enpcrypt函数会爆红

![](/images/newstar-ctf-2024-re-writeup/040.png)

更具特征的就是这一大段的数据块无法被读取，在网上学习别的大佬如何解smc混淆后，自己写了个idc脚本

![](/images/newstar-ctf-2024-re-writeup/041.png)

运行之后encrypt函数的汇编代码就出来了，接下来只要按U重定义一下再按C转换为代码，最后在函数头的位置按P就能得到到解混淆后的encrypt函数如下

![](/images/newstar-ctf-2024-re-writeup/042.png)

这是一个7元非线性方程组，要解的话需要用到z3约束求解器，由于没学过z3只能寻求ai的帮助，以下是exp

```python
from z3 import *

# 创建Z3求解器
solver = Solver()

# 声明变量v2到v8
v2 = BitVec('v2', 64)
v3 = BitVec('v3', 64)
v4 = BitVec('v4', 64)
v5 = BitVec('v5', 64)
v6 = BitVec('v6', 64)
v7 = BitVec('v7', 64)
v8 = BitVec('v8', 64)

# 添加方程约束
solver.add(5 * (v3 + v2) + 4 * v4 + 6 * v5 + v6 + 9 * v8 + 2 * v7 == 0xD5CC7D4FF)
solver.add(4 * v8 + 3 * v5 + 6 * v4 + 10 * v3 + 9 * v2 + 9 * v7 + 3 * v6 == 0x102335844B)
solver.add(9 * v6 + 4 * (v5 + v4) + 5 * v3 + 4 * v2 + 3 * v8 + 10 * v7 == 0xD55AEABB9)
solver.add(9 * v3 + 5 * v2 + 9 * v8 + 2 * (v4 + 2 * v5 + 5 * v6 + v7) == 0xF89F6B7FA)
solver.add(5 * v6 + 9 * v5 + 7 * v2 + 2 * v3 + v4 + 3 * v8 + 9 * v7 == 0xD5230B80B)
solver.add(8 * v8 + 6 * v5 + 10 * v4 + 5 * v3 + 6 * v2 + 3 * v7 + 9 * v6 == 0x11E28ED873)
solver.add(v2 + 4 * (v4 + v3 + 2 * v5) + 9 * v6 + v7 + 3 * v8 == 0xB353C03E1)

# 检查是否有解
if solver.check() == sat:
    model = solver.model()
    # 提取变量的解，并将其转换为16进制数输出
    result = [model[v2].as_long(), model[v3].as_long(), model[v4].as_long(), 
              model[v5].as_long(), model[v6].as_long(), model[v7].as_long(), 
              model[v8].as_long()]
    # 将解转换为16进制数并输出
    print([hex(r) for r in result])
else:
    print("No solution found")
```

![](/images/newstar-ctf-2024-re-writeup/043.png)

**flag{D0_Y0u_Kn0w_sMC_4nD_Z3}**

------

### 取啥名好呢？

![](/images/newstar-ctf-2024-re-writeup/028.png)

IDA打开发现无法f5反编译，是被加花过的

![](/images/newstar-ctf-2024-re-writeup/044.png)

定位到花指令的位置，看操作码原来应该是EB 2C跳转到某个地方，所以把这两个操作码放到一起即可

![](/images/newstar-ctf-2024-re-writeup/045.png)

修改后进到main函数，可以看到基本逻辑是通过setjmp函数的返回值来选择执行哪条语句

![](/images/newstar-ctf-2024-re-writeup/046.png)

这里贴出对应信号发生的返回值

![](/images/newstar-ctf-2024-re-writeup/047.png)

![](/images/newstar-ctf-2024-re-writeup/048.png)

![](/images/newstar-ctf-2024-re-writeup/049.png)

![](/images/newstar-ctf-2024-re-writeup/050.png)

![](/images/newstar-ctf-2024-re-writeup/051.png)

![](/images/newstar-ctf-2024-re-writeup/052.png)

左边的函数列表还有个mian函数，里面定义了几个signal函数用来处理程序运行时出现错误的处理函数，基本看到这里就无法静态分析了，所以考虑用dbg来动态分析，由于是elf文件，所以用虚拟机远程调试。

![](/images/newstar-ctf-2024-re-writeup/053.png)

以下是调试结果，可以清楚的看到程序调用函数的顺序，后面会执行23次handle_func1就不截图了。

通过调试＋分析可以得出程序运行的顺序：先运行发生报错SIGSEGV，接着运行handle_func2

![](/images/newstar-ctf-2024-re-writeup/054.png)

把dword_4068的地址赋值给qword_4060再在main函数中给qword_4060赋值233，其实就是给dword_4068赋值233，然后触发了SIGILL信号，是前面的花指令导致的信号，调用了handler函数，使main函数的Switch控制流跳转到case1

![](/images/newstar-ctf-2024-re-writeup/055.png)

![](/images/newstar-ctf-2024-re-writeup/056.png)

接着触发了SIGFPE，其信号触发的根源在main函数的汇编代码中

![](/images/newstar-ctf-2024-re-writeup/057.png)

请看这段汇编代码，先用move指令把ecx寄存器的值改为0，然后再除以ecx的值，一个除法运算的除数不可以是0，而这却是0，所以触发了SIGFPE（浮点异常），并且可以注意到是在printf前面，说明main函数最下面那段for循环是可以执行到的，由于main函数每次运行到这里都会触发SIGFPE信号，所以会一直调用handle_func1函数直到dword_4168=22

![](/images/newstar-ctf-2024-re-writeup/058.png)

不难理解就是执行22次input[i] ^= i,sub_12E9函数是对我们的输入和密文进行比较

![](/images/newstar-ctf-2024-re-writeup/059.png)

逻辑分析到这里就结束了，下面贴出exp

```c
#include<stdio.h>

int main() {
        char input[] = { 79,84,72,83,96,69,55,26,40,65,38,22,59,69,20,71,14,12,112,59,60,61,112,'\0'};
        
        for (int i = 0; i <23; i++) { 
                
                input[i] ^= i; 
        }
        for (int i = 0; i < 23; i++) {
                input[i] -= 233;
        }
        
        for (int i = 0; i < 23; i++) {
                printf("%c", input[i]);
        }
        return 0;
}
```

**flag{WH47_C4N_1_54y???}**

------

### simpleAndroid

![](/images/newstar-ctf-2024-re-writeup/060.png)

jadx打开找到mainactivity，有几个关键信息：1.调用了simpleandroid这个so文件，并且调用了native方法showData。2.调用了Checkactivity方法里面的checkData函数，用来判断用户的输入。3.先对用户的输入调用native方法再调用check函数验证

![](/images/newstar-ctf-2024-re-writeup/061.png)

点进checkactivity类，可以看到调用了checkdata对我们的输入进行判断，所以接下来IDA打开so文件看checkdata函数的逻辑。

![](/images/newstar-ctf-2024-re-writeup/062.png)

找到checkdata函数，注意上面几个JNIenv的函数，是调用了com/example/simpleandroid/UseLess路径下的useless类，并且进行了一个base64的换表，经过仔细的分析和改名改类型能得到下面的代码

![](/images/newstar-ctf-2024-re-writeup/063.png)

整个加密过程的逻辑就是先把输入的数据以中间为对称轴前后交换，接着再对每个数据进行移位和位运算，最后得到密文data_1解密逻辑很简单直接给出exp

```c
#include<stdio.h>
#include<string.h>
int main() {
        unsigned char input[] = { 178,116,69,22,71,52,149,54,23,244,67,149,3,214,51,149,198,214,51,54,167,53,230,54,150,87,67,22,150,151,230,22 };
        for (int i = 0; i < 32; i++) {
                input[i] = ((int)input[i] >> 4) | (16 * input[i]);
        }
        unsigned char* temp_0;
        unsigned char temp;
        for (int i = 0; ; i++) {
                if (i >= 16)
                        break;
                temp_0 = input;
                temp = input[i];
                input[i] = input[32 - i - 1];
                temp_0[32 - i - 1] = temp;
        }
        printf("%s", input);
        return 0;
}
```

![](/images/newstar-ctf-2024-re-writeup/064.png)

运行得到如下结果，把结果用base64解码就能得到flag（别忘了换表）

![](/images/newstar-ctf-2024-re-writeup/065.png)

**flag{android_is_simple!}**

------

### o11vm

步入main函数，发现函数流程图长这样

![]()

![011vm_1.DbqJKLyx](/images/newstar-ctf-2024-re-writeup/066.png)

反编译以后

![](/images/newstar-ctf-2024-re-writeup/067.png)

发现有控制流平坦化特征，用 d810 去控制流平坦化

![](/images/newstar-ctf-2024-re-writeup/068.png)

变正常多了，进入函数，发现可疑数组

![](/images/newstar-ctf-2024-re-writeup/069.png)

可以用 IDA 插件，IDA 8.3 自带一个插件 findcrypt（或者一个个函数搜查）

![](/images/newstar-ctf-2024-re-writeup/070.png)

直接发现有 tea 特征

![](/images/newstar-ctf-2024-re-writeup/071.png)

找到 tea 特征，发现未魔改，字符串也提供了，找个脚本解密得 flag

```c++
#include <iostream>
#include <string>
#include <cstdint>

using namespace std;


void TEA_decrypt(uint32_t v[2], const uint32_t key[4]) {
    uint32_t v0 = v[0], v1 = v[1], sum = 0xC6EF3720, delta = 0x9e3779b9;
    for (int i = 0; i < 32; i++) {
        v1 -= ((v0 << 4) + key[2]) ^ (v0 + sum) ^ ((v0 >> 5) + key[3]);
        v0 -= ((v1 << 4) + key[0]) ^ (v1 + sum) ^ ((v1 >> 5) + key[1]);
        sum -= delta;
    }
    v[0] = v0;
    v[1] = v1;
}

string uint32_to_string(const uint32_t decrypted[8]) {
    string result;
    result.reserve(32);
    for (int i = 0; i < 8; ++i) {
        for (int j = 0; j < 4; ++j) {
            char byte = (decrypted[i] >> (8 * j)) & 0xFF;  // 逐字节提取
            result.push_back(byte);
        }
    }
    return result;
}

int main() {
    uint32_t key[4] = {0x11121314, 0x22232425, 0x33343536, 0x41424344};


    uint32_t encrypted_flag[8] = {0x38b97e28, 0xb7e510c1, 0xb4b29fae, 0x5593bbd7,
                                  0x3c2e9b9e, 0x1671c637, 0x8f3a8cb5, 0x5116e515};


    for (int i = 0; i < 8; i += 2) {
        TEA_decrypt(&encrypted_flag[i], key);
    }


    string decrypted_flag = uint32_to_string(encrypted_flag);
    cout << "Decrypted flag: " << decrypted_flag << endl;

    return 0;
}
```

**flag{011vm_1s_eZ_But_C0MP1EX_!!}** 注：**本篇wp转自NewStarCTF官方wp，本文仅做转载记录**

------

### flowering-shrubs

使用 IDA 可以看到程序完全无法分析。

再仔细看汇编可以发现，题目似乎在随机位置处添加了同一个花指令。

因此我们要使用 IDAPython 自动去除花指令。

```python
# remove_flower.py
import idc
import idaapi
startaddr=0x1100
endaddr=0x15FF
lis=[0x50, 0x51, 0x52, 0x53, 0xE8, 0x00, 0x00, 0x00, 0x00, 0x5B, 0x48, 0x81, 0xC3, 0x12, 0x00, 0x00, 0x00, 0x48, 0x89, 0x5C, 0x24, 0x18, 0x48, 0x83, 0xC4, 0x18,0xC3]
#这个for循环是关键点，检测以当前地址开始的27个字节是否符合lis列表的内容。
for i in range(startaddr,endaddr):
    flag=True
    for j in range(i,i+27):
        if idc.get_wide_byte(j)!=lis[j-i]:
            flag=False
    if flag==True:
        for addr in range(i,i+27):
            idc.patch_byte(addr,0x90) # 将这部分内容全部nop掉

for i in range(startaddr,endaddr):# 取消函数定义
    idc.del_items(i)
for i in range(startaddr,endaddr):       # 添加函数定义
    if idc.get_wide_dword(i)==0xFA1E0FF3: #endbr64
        idaapi.add_func(i)
```

`lis` 列表中的内容就是花指令的全部内容。

在 IDA 中选择 **File » Script file**，选择该 Python 文件即可。

或者在 **File » Script command** 中将上面的代码粘贴进来。

之后再按下 F5 即可看到清晰的伪代码。

部分函数我进行了重命名。在函数名位置处按下 N 即可重命名

![](/images/newstar-ctf-2024-re-writeup/072.png)

关键内容就是`encrypt`函数。

![]()![flowering-shrubs_2.DqaQk9dj](/images/newstar-ctf-2024-re-writeup/073.png)

这里是用了递归，一共 40 个字节，每四个字节为 1 组，一共 10 组，通过 `get_next_rand` 函数得到下一组加密字节。仔细分析一下即可写出脚本。

```python
#solve.py
lis=[0x54,0xf4,0x20,0x47,0xfc,0xc4,0x93,0xe6,0x39,0xe0,
     0x6e,0x00,0xa5,0x6e,0xaa,0x9f,0x7a,0xa1,0x66,0x39,
     0x76,0xb7,0x67,0x57,0x3d,0x95,0x61,0x22,0x55,0xc9,
     0x3b,0x4e,0x4f,0xe8,0x66,0x08,0x3d,0x50,0x43,0x3e]
str="uarefirst."
offset_buf=[0,4,32,12,8,24,16,20,28,36]
#offset_buf就是通过动态调试提取出每一轮get_next_rand函数的返回值得到的
truekey=[]
for i in str:
    truekey.append(ord(i))
def decrypt(offset,key):
    a=lis[offset]
    b=lis[offset+1]
    c=lis[offset+2]
    d=lis[offset+3]
    flagc=((c+key)&0xff)^b
    flagd=c^d
    flaga=a^d^key
    flagb=((b-key)&0xff)^flaga^key
    lis[offset]=flaga
    lis[offset+1]=flagb
    lis[offset+2]=flagc
    lis[offset+3]=flagd
for i in range(10):
    decrypt(offset_buf[i],truekey[i])
print(bytes(lis).decode('utf-8'))
# flag{y0u_C4n_3a51ly_Rem0v3_CoNfu510n-!!}
```

**flag{y0u_C4n_3a51ly_Rem0v3_CoNfu510n-!!}** 注：**本篇wp转自NewStarCTF官方wp，本文仅做转载记录**

------

### SecretOfKawaii

程序在 Java 层有混淆，用 Jeb 可以简单去除，也可以通过断点调试弄清代码执行流程

![](/images/newstar-ctf-2024-re-writeup/074.png)

Java 层只有一个 RC4，`key`是 `rc4k4y`，加密后 Base64 一下传到 so 层，值在 so 层检查

IDA 打开发现有 upx 的字符串，猜测是 upx 壳

![](/images/newstar-ctf-2024-re-writeup/075.png)

脱壳后

![](/images/newstar-ctf-2024-re-writeup/076.png)

一个 xxtea，密钥是 `meow~meow~tea~~~`

![](/images/newstar-ctf-2024-re-writeup/077.png)

写出对应的解密脚本：

```c
#include "stdio.h"
#include "string.h"
#include "stdlib.h"
typedef unsigned int uint32_t;

#define size 256

unsigned char sbox[257] = {0};

// 初始化s表
void init_sbox(char *key)
{
    unsigned int i, j, k;
    int tmp;

    for (i = 0; i < size; i++)
    {
        sbox[i] = i;
    }

    j = k = 0;
    for (i = 0; i < size; i++)
    {
        tmp = sbox[i];
        j = (j + tmp + key[k]) % size;
        sbox[i] = sbox[j];
        sbox[j] = tmp;
        if (++k >= strlen((char *)key))
            k = 0;
    }
}

// 加解密函数
void rc4(char *key, char *data)
{
    int i, j, k, R, tmp;

    init_sbox(key);

    j = k = 0;
    for (i = 0; i < strlen((char *)data); i++)
    {
        j = (j + 1) % size;
        k = (k + sbox[j]) % size;

        tmp = sbox[j];
        sbox[j] = sbox[k];
        sbox[k] = tmp;

        R = sbox[(sbox[j] + sbox[k]) % size];

        data[i] ^= R;
    }
}

#define DELTA 0xdeadbeef
#define MX (((z >> 5 ^ y << 3) + (y >> 3 ^ z << 2)) ^ ((sum ^ y) + (key[(p & 3) ^ e] ^ z)))
void btea(uint32_t *v, int n, uint32_t const key[4])
{
    uint32_t y, z, sum;
    unsigned p, rounds, e;
    if (n > 1) /* Coding Part */
    {
        rounds = 6 + 52 / n;
        sum = 0;
        z = v[n - 1];
        do
        {
            sum += DELTA;
            e = (sum >> 2) & 3;
            for (p = 0; p < n - 1; p++)
            {
                y = v[p + 1];
                z = v[p] += MX;
            }
            y = v[0];
            z = v[n - 1] += MX;
        } while (--rounds);
    }
    else if (n < -1)
    {
        n = -n;
        rounds = 6 + 52 / n;
        sum = rounds * DELTA;
        y = v[0];
        do
        {
            e = (sum >> 2) & 3;
            for (p = n - 1; p > 0; p--)
            {
                z = v[p - 1];
                y = v[p] -= MX;
            }
            z = v[n - 1];
            y = v[0] -= MX;
            sum -= DELTA;
        } while (--rounds);
    }
}

char base64[65] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
void decodeBase64(char *str, int len, char **in)
{

    char ascill[129];
    int k = 0;
    for (int i = 0; i < 64; i++)
    {
        ascill[base64[i]] = k++;
    }
    int decodeStrlen = len / 4 * 3 + 1;
    char *decodeStr = (char *)malloc(sizeof(char) * decodeStrlen);
    k = 0;
    for (int i = 0; i < len; i++)
    {
        decodeStr[k++] = (ascill[str[i]] << 2) | (ascill[str[++i]] >> 4);
        if (str[i + 1] == '=')
        {
            break;
        }
        decodeStr[k++] = (ascill[str[i]] << 4) | (ascill[str[++i]] >> 2);
        if (str[i + 1] == '=')
        {
            break;
        }
        decodeStr[k++] = (ascill[str[i]] << 6) | (ascill[str[++i]]);
    }
    decodeStr[k] = '\0';
    *in = decodeStr;
}

int main()
{
    // upx -d 解包libmeow1.so，加密只有一个xxtea，但是被魔改过，对照网上的代码修改可以解密
    // 密文为64位数组，熟悉数据处理的话，直接指针传参就行了
   long long secrets[6] = {
        6866935238662214623LL,
        3247821795433987330LL,
        -3346872833356453065LL,
        1628153154909259154LL,
        -346581578535637655LL,
        3322447116203995091LL
    };
    // 不同编译器 long 的大小可能不同，用 long long 表示 64 位数据
    // 为什么是 12？12 代表有 12 段 32 位数据（也就是6个long long类型数据)，负数时进行解密操作所以传 -12

    btea((unsigned int *)secrets, -12, ( unsigned int *)"meow~meow~tea~~~");

    char *flag;
    // 解 base64
    decodeBase64((char *)secrets, strlen((char *)secrets), &flag);

    // 解 rc4
    rc4("rc4k4y", (char *)flag);

    // 这里为了方便理解这么些，想方便可以直接 puts(flag);
    char *tmp = (char *)flag;
    for (size_t i = 0; i < 48; i++)
    {
        putchar(tmp[i]);
    }
    puts("");
}
```

**flag{U_D0_Kn0w_Kawa11_P@n9_B@1}**  注：**本篇wp转自NewStarCTF官方wp，本文仅做转载记录**

------

### PangBai过家家(3)

如果你用了 DIE，那应该会看到 PyInstaller 字样，这是一个 Python 库，能把 `.py` 脚本打包成 `.exe`. 如果你用 IDA 直接分析，里面大量的 Python 字样也是它的显著特征。当然，直接用 IDA 是难以分析 Python 脚本逻辑的。

对于此种程序，解包方法很多，大家可以上网查关键词 PyInstaller 解包，资料也很多。我使用的是 PyInstaller Extractor.

解包后得到一个目录。

![](/images/newstar-ctf-2024-re-writeup/078.png)

对于这个题，我们没有加密，也没有魔改 magic，也没有在库里面藏东西，所以说我们只关心和程序同名的 `NotNormalExe.pyc`. 反编译他看逻辑即可。

反编译方法也有很多，如在线网站，或各种脚本，如 [tool.lu/pyc](https://tool.lu/pyc/).

此处由于字节码的版本较高，前面会反编译出错，此时大家可以直接猜这是异或，或者用另一款工具 pycdas 去看机器码，然后找到关键的异或逻辑。

![](/images/newstar-ctf-2024-re-writeup/079.png)

本题其实对于没接触过的人来说主打一个猜，还有查询资料的能力。

如果上面的东西没看懂，[这篇文章](https://blog.csdn.net/qq_51116518/article/details/138270490)可能会帮助你。 

注：**本篇wp转自NewStarCTF官方wp，本文仅做转载记录**

------

