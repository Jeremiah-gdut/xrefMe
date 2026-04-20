---
title: "Frida常用API记录"
description: "记录一下FridaHookSo函数和Java函数的API使用"
pubDate: "2024-12-16"
draft: false
---

# Frida相关api

> 本文主要保留旧笔记中的常用写法，其中部分 native/so 相关示例基于 **Frida 16 及更早时期** 的 API 习惯。  
> 如果你现在使用的是 **Frida 17+**，建议结合这篇新笔记一起看：[Frida常用API记录(Frida 17+)](/blog/frida-api-notes-frida17/)。

## Java层

### 静态方法和实例方法的Hook

```javascript
var money = Java.use("com.Jeremiah.hook.money");
//不需要区分修饰符，也不需要区分静态和实例方法，hook代码的写法都是一样的
//hook实例方法
money.getInfo.implementation = function () {
    var result = this.getInfo();
    console.log("result: ", result)
    return result;
}
//hook静态方法
money.setFlag.implementation = function (a) {
    console.log("param: ", a);
    return this.setFlag(a);
}
```

### 函数参数和返回值的修改

```javascript
var money = Java.use("com.Jeremiah.hook.Money");
var str = Java.use("java.lang.String");
money.getInfo.implementation = function () {
    var result = this.getInfo();
    console.log("money.getInfo result: ", result);
    return str.$new("Jeremiah");
    //上述字符串"Jeremiah"是JS的string，而被hook的Java方法返回值是Java的String
    //因此，可以主动调用Java方法转成Java的String
    //但是为了方便起见，通常会直接直接返回JS的string，这时frida会自动处理，代码类似如下
    //return "Jeremiah";
    //Java的类型可以调用Java的方法，JS的类型可以调用JS的方法
    //区分清楚何时是Java的类型，何时是JS的类型，有助于代码的编写
    //frida在参数传递的处理上也类似
}
money.setFlag.implementation = function (a) {
    console.log("money.setFlag param: ", a);
    return this.setFlag("Jeremiah");
}
```

### 构造方法的Hook $init

```javascript
var money = Java.use("com.Jeremiah.hook.Money");
money.$init.implementation = function(a,b){
    console.log("money.$init param: ",a, b);
    return this.$init("dollar",200);
}
```

> String类的构造函数要Hook `StringFactory`类下的某一些方法

### 对象参数的构造与修改 $new

```javascript
var wallet = Java.use("com.Jeremiah.hook.Wallet");
var money = Java.use("com.Jeremiah.hook.Money");
wallet.deposit.implementation = function (a) {
    console.log("wallet.deposit param: ", a.getInfo());
    return this.deposit(money.$new("dollar", 200));
}

var wallet = Java.use("com.Jeremiah.hook.Wallet");
wallet.deposit.implementation = function (a) {
    a.setAmount(2000);
    console.log("wallet.deposit param: ", a.getInfo());
    return this.deposit(a);
}
```

### HashMap的打印

```javascript
var utils = Java.use("com.Jeremiah.hook.Utils");
var stringBuilder = Java.use("java.lang.StringBuilder");
utils.shufferMap.implementation = function (a) {
    var key = a.keySet();     //得到所有的key
    var it = key.iterator();  
    var result = stringBuilder.$new();
    while(it.hasNext()){
        var keystr = it.next();
        var valuestr = a.get(keystr);
        result.append(valuestr);
    }
    console.log("utils.shufferMap param: ", result.toString());
    var result = this.shufferMap(a);
    console.log("utils.shufferMap result: ", result);
    return result;
}

```

### 重载方法的Hook

```javascript
var utils = Java.use("com.Jeremiah.hook.Utils");
utils.getCalc.overload('int', 'int').implementation = function (a, b) {
    console.log("utils.getCalc param: ", a, b);
    return this.getCalc(a, b);
}
utils.getCalc.overload('int', 'int', 'int').implementation = function (a, b, c) {
    console.log("utils.getCalc param: ", a, b, c);
    return this.getCalc(a, b, c);
}
utils.getCalc.overload('int', 'int', 'int', 'int').implementation = function (a, b, c, d) {
    console.log("utils.getCalc param: ", a, b, c, d);
    return this.getCalc(a, b, c, d);
}

```

### Hook方法的所有重载

```javascript
var utils = Java.use("com.Jeremiah.hook.Utils");
var overloadsArr = utils.getCalc.overloads;  //包含该方法的所有重载函数，overloads返回重载函数的数组
for (var i = 0; i < overloadsArr.length; i++) {
    overloadsArr[i].implementation = function () {
        showStacks();
        var params = "";
        for (var j = 0; j < arguments.length; j++) {   //arguments存储所有传进函数的参数
            params += arguments[j] + " ";
        }
        console.log("utils.getCalc is called! params is: ", params);
        // if(arguments.length == 2){
        //     return this.getCalc(arguments[0], arguments[1]);
        // }else if(arguments.length == 3){
        //     return this.getCalc(arguments[0], arguments[1], arguments[2]);
        // }else if(arguments.length == 4){
        //     return this.getCalc(arguments[0], arguments[1], arguments[2], arguments[3]);
        // }
        console.log(this);
        return this.getCalc.apply(this, arguments); //第一个参数为当前的Java对象实例，第二个参数为一个数组或类数组对象，这里包含了传进函数的参数，此处apply用于调用原来的getCalc方法
    }
}
```
