---
title: "Frida Hook实现APP关键代码快速定位(Java层)(Frida 17+)"
description: "保留旧笔记风格，补充 Frida 17+ 下 Java Hook 的常用写法和注意事项"
pubDate: "2026-04-20"
draft: false
---

# Frida Hook实现APP关键代码快速定位(Java层)(Frida 17+)

> 这篇主要是补充 **Frida 17+** 下 Java 层常用写法。  
> 原来那些 `Java.use`、`implementation`、`overload` 这些核心思路并没有变，**变化最大的其实是 bridge 的使用方式**。

## 先记一条最重要的

Frida 17 开始，`Java` bridge 不再默认打包进 GumJS runtime。

### 1. 直接用 REPL / frida-trace / `frida -l xxx.js`

这种最常见的脚本方式，**大多数旧代码还是能直接跑**。

```bash
frida -U -f com.xxx.app -l hook.js
```

### 2. 自己写 agent / TypeScript / frida-compile

这种就要显式导入：

```javascript
import Java from "frida-java-bridge";
```

如果是 TypeScript/自定义 agent，一般流程是：

```bash
frida-create -t agent
npm install
npm install frida-java-bridge
```

然后脚本里再 `import Java from "frida-java-bridge"`。

## 模板

### REPL / 直接加载 js

```javascript
Java.perform(function () {
    console.log("Java.available =", Java.available);
});
```

### 自定义 agent / frida-compile

```javascript
import Java from "frida-java-bridge";

Java.perform(function () {
    console.log("Java.available =", Java.available);
});
```

## 打印函数调用栈

这个思路和以前一样

```javascript
function showStacks() {
    Java.perform(function () {
        const Log = Java.use("android.util.Log");
        const Throwable = Java.use("java.lang.Throwable");
        console.log(Log.getStackTraceString(Throwable.$new()));
    });
}
```

## 静态方法和实例方法的 Hook

```javascript
Java.perform(function () {
    const Money = Java.use("com.xxx.xxx");

    Money.getInfo.implementation = function () {
        const result = this.getInfo();
        console.log("Money.getInfo result:", result);
        return result;
    };

    Money.setFlag.implementation = function (a) {
        console.log("Money.setFlag param:", a);
        return this.setFlag(a);
    };
});
```

> Java 层这里和旧版本基本没有区别，仍然不需要专门区分静态方法和实例方法的 Hook 写法。

## 修改参数和返回值

```javascript
Java.perform(function () {
    const Money = Java.use("com.xxx.xxx");

    Money.getInfo.implementation = function () {
        const result = this.getInfo();
        console.log("Money.getInfo result:", result);
        return "Jeremiah";
    };

    Money.setFlag.implementation = function (a) {
        console.log("Money.setFlag param:", a);
        return this.setFlag("Jeremiah");
    };
});
```

如果确实想手动构造 Java String，也还是可以：

```javascript
Java.perform(function () {
    const JString = Java.use("java.lang.String");
    const Money = Java.use("com.xxx.xxx");

    Money.getInfo.implementation = function () {
        return JString.$new("Jeremiah");
    };
});
```

## Hook 构造方法 `$init`

```javascript
Java.perform(function () {
    const Money = Java.use("com.Jeremiah.hook.Money");

    Money.$init.implementation = function (a, b) {
        console.log("Money.$init param:", a, b);
        return this.$init("dollar", 200);
    };
});
```

## 对象参数的构造与修改 `$new`

```javascript
Java.perform(function () {
    const Wallet = Java.use("com.Jeremiah.hook.Wallet");
    const Money = Java.use("com.Jeremiah.hook.Money");

    Wallet.deposit.implementation = function (a) {
        console.log("Wallet.deposit param:", a.getInfo());
        return this.deposit(Money.$new("dollar", 200));
    };
});
```

或者直接改传进来的对象：

```javascript
Java.perform(function () {
    const Wallet = Java.use("com.Jeremiah.hook.Wallet");

    Wallet.deposit.implementation = function (a) {
        a.setAmount(2000);
        console.log("Wallet.deposit param:", a.getInfo());
        return this.deposit(a);
    };
});
```

## 重载方法的 Hook

```javascript
Java.perform(function () {
    const Utils = Java.use("com.Jeremiah.hook.Utils");

    Utils.getCalc.overload("int", "int").implementation = function (a, b) {
        console.log("getCalc(int, int):", a, b);
        return this.getCalc(a, b);
    };

    Utils.getCalc.overload("int", "int", "int").implementation = function (a, b, c) {
        console.log("getCalc(int, int, int):", a, b, c);
        return this.getCalc(a, b, c);
    };
});
```

## Hook 方法的所有重载

```javascript
Java.perform(function () {
    const Utils = Java.use("com.Jeremiah.hook.Utils");
    const overloads = Utils.getCalc.overloads;

    for (let i = 0; i < overloads.length; i++) {
        const method = overloads[i];

        method.implementation = function () {
            let params = "";
            for (let j = 0; j < arguments.length; j++) {
                params += arguments[j] + " ";
            }

            showStacks();
            console.log("Utils.getCalc params:", params);
            return method.apply(this, arguments);
        };
    }
});
```

## HashMap / ArrayList 打印

### HashMap

```javascript
Java.perform(function () {
    const Utils = Java.use("com.Jeremiah.hook.Utils");
    const StringBuilder = Java.use("java.lang.StringBuilder");

    Utils.shufferMap.implementation = function (a) {
        const keySet = a.keySet();
        const it = keySet.iterator();
        const result = StringBuilder.$new();

        while (it.hasNext()) {
            const key = it.next();
            const value = a.get(key);
            result.append(key).append("=").append(value).append(" ");
        }

        console.log("map param:", result.toString());
        return this.shufferMap(a);
    };
});
```

### ArrayList

```javascript
Java.perform(function () {
    const ArrayList = Java.use("java.util.ArrayList");

    ArrayList.add.overload("java.lang.Object").implementation = function (a) {
        console.log("ArrayList.add:", a);
        return this.add(a);
    };
});
```

## 枚举类和方法

### 1. 枚举所有已加载类

```javascript
Java.perform(function () {
    const classes = Java.enumerateLoadedClassesSync();
    for (let i = 0; i < classes.length; i++) {
        if (classes[i].indexOf("okhttp") !== -1) {
            console.log(classes[i]);
        }
    }
});
```

### 2. 按关键字枚举方法

这个在现在的版本里非常实用，比单纯枚举类更方便。

```javascript
Java.perform(function () {
    const groups = Java.enumerateMethods("*okhttp*!*header*/su");
    console.log(JSON.stringify(groups, null, 2));
});
```

> `s` 表示带签名，`u` 表示只看用户类。

## ClassLoader 问题

有时候 `Java.use("xxx")` 找不到类，不一定是类名错了，而是类不在默认 ClassLoader 里。

### 枚举 ClassLoader

```javascript
Java.perform(function () {
    const loaders = Java.enumerateClassLoadersSync();
    for (let i = 0; i < loaders.length; i++) {
        console.log(loaders[i].toString());
    }
});
```

### 用指定 ClassLoader 去 use 类

```javascript
Java.perform(function () {
    const loaders = Java.enumerateClassLoadersSync();

    for (let i = 0; i < loaders.length; i++) {
        try {
            const factory = Java.ClassFactory.get(loaders[i]);
            const Target = factory.use("com.xxx.TargetClass");
            console.log("found class in loader:", loaders[i].toString());
            console.log(Target);
            break;
        } catch (e) {
        }
    }
});
```

> 现在很多壳、插件化、动态加载 dex 的场景里，这个比盲目 `Java.use()` 更重要。

## String 的一些常见点

### `getBytes`

```javascript
Java.perform(function () {
    const JString = Java.use("java.lang.String");

    JString.getBytes.overload().implementation = function () {
        const result = this.getBytes();
        console.log("String.getBytes() called");
        return result;
    };

    JString.getBytes.overload("java.lang.String").implementation = function (a) {
        const result = this.getBytes(a);
        const newStr = JString.$new(result, a);
        console.log("String.getBytes(", a, ") =>", newStr);
        return result;
    };
});
```

### String 构造函数

## StringBuilder / StringBuffer

```javascript
Java.perform(function () {
    const StringBuilder = Java.use("java.lang.StringBuilder");
    const StringBuffer = Java.use("java.lang.StringBuffer");

    StringBuilder.toString.implementation = function () {
        const retval = this.toString();
        if (retval.indexOf("Encrypt") !== -1) {
            showStacks();
        }
        console.log("StringBuilder.toString:", retval);
        return retval;
    };

    StringBuffer.toString.implementation = function () {
        const retval = this.toString();
        if (retval.indexOf("username") !== -1) {
            showStacks();
        }
        console.log("StringBuffer.toString:", retval);
        return retval;
    };
});
```

## findViewById 找控件

```javascript
Java.perform(function () {
    const btnLoginId = Java.use("com.dodonew.online.R$id").btn_login.value;
    console.log("btn_login_id:", btnLoginId);

    const Activity = Java.use("androidx.appcompat.app.AppCompatActivity");
    Activity.findViewById.implementation = function (a) {
        if (a === btnLoginId) {
            showStacks();
            console.log("findViewById:", a);
        }
        return this.findViewById(a);
    };
});
```


## setOnClickListener

```javascript
Java.perform(function () {
    const btnLoginId = Java.use("com.dodonew.online.R$id").btn_login.value;
    const View = Java.use("android.view.View");

    View.setOnClickListener.implementation = function (a) {
        if (this.getId() === btnLoginId) {
            showStacks();
            console.log("view.id:", this.getId());
            console.log("setOnClickListener is called");
        }
        return this.setOnClickListener(a);
    };
});
```

## OkHttp 的 addHeader

```javascript
Java.perform(function () {
    const RequestBuilder = Java.use("okhttp3.Request$Builder");

    RequestBuilder.addHeader.implementation = function (a, b) {
        showStacks();
        console.log("addHeader:", a, b);
        return this.addHeader(a, b);
    };
});
```

## 一个更常用的模板

```javascript
Java.perform(function () {
    const Target = Java.use("com.xxx.Target");

    Target.someMethod.overload("java.lang.String", "int").implementation = function (a, b) {
        showStacks();
        console.log("someMethod called:", a, b);

        const result = this.someMethod(a, b);
        console.log("someMethod result:", result);
        return result;
    };
});
```

## 结论

Frida 17+ 下 Java Hook 真正要更新的地方主要就两条：

1. **如果是自定义 agent，要显式引入 `frida-java-bridge`**

除此之外，`Java.use`、`implementation`、`overload`、`$init`、`$new` 这些写法，和以前并没有本质区别。
