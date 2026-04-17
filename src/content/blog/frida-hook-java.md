---
title: "Frida Hook实现APP关键代码快速定位(Java层)"
description: "通过FridaHook来快速定位APP中的一些关键代码"
pubDate: "2024-11-28"
draft: false
---

# Frida Hook实现APP关键代码快速定位(Java层)

## HashMap的put方法

```javascript
var hashMap = Java.use("java.util.HashMap");    //获取HashMap类
hashMap.put.implementation = function(a,b){     //hook HashMap的put方法
    if(a.equals("username")){
        showStacks();     //打印函数调用栈信息
        console.log("hashMap.put: ", a, b);
    }
    return this.put(a,b); //执行原函数
}
```

## 打印函数调用关系栈

```javascript
function showStacks(){
    console.log(
        Java.use("android.util.Log").getStackTraceString(    //调用Android系统提供的类的方法
            Java.use("java.lang.Throwable").$new()    //创建对象
        )
    );
}
```

## ArrayList的add、addAll、set方法等

```javascript
var arrayList = Java.use("java.util.ArrayList");
arrayList.add.overload('java.lang.Object').implementation = function(a){ 	//方法如有重载需指定为具体的重载方法
    if(a.equals("username = 19002040031")){
        showStacks();
        console.log("arrayList.add: ",a);
    }
    //console.log("arrayList.add: ",a);
    return this.add(a);
}
```

## TextUtils的isEmpty方法

```javascript
var textUtils = Java.use("android.text.TextUtils");
textUtils.isEmpty.implementation = function (a) {
    if(a == "2v+DC2gq7RuAC8PE5GZz5wH3/y9ZVcWhFwhDY9L19g9iEd075+Q7xwewvfIN0g0ec/NaaF43/S0="){
        showStacks();
        console.log("textUtils.isEmpty: ", a);
    }
    //console.log("textUtils.isEmpty: ", a);
    return this.isEmpty(a);
}

```

## Log

```javascript
var log = Java.use("android.util.Log");
log.w.overload('java.lang.String', 'java.lang.String').implementation = function (tag, message) {
    showStacks();
    console.log("log.w: ", tag, message);
    return this.w(tag, message);
}

```

## Collections的sort方法

```javascript
var collections = Java.use("java.util.Collections");
//上层函数
collections.sort.overload('java.util.List').implementation = function (a) {     
    showStacks();
    var result = Java.cast(a, Java.use("java.util.ArrayList"));
    console.log("collections.sort List: ", result.toString());
    return this.sort(a);
}
//偏底层的sort
collections.sort.overload('java.util.List', 'java.util.Comparator').implementation = function (a, b) { 
    showStacks();
    var result = Java.cast(a, Java.use("java.util.ArrayList"));
    console.log("collections.sort List Comparator: ", result.toString());
    return this.sort(a, b);
}

///java.util.Arrays sort toString

```

## JSONObject的put、getString方法等(现在更多用GSON)

```javascript
var jSONObject = Java.use("org.json.JSONObject");
//put方法
jSONObject.put.overload('java.lang.String', 'java.lang.Object').implementation = function (a, b) {
    showStacks();
    //var result = Java.cast(a, Java.use("java.util.ArrayList"));
    console.log("jSONObject.put: ", a, b);
    return this.put(a, b);
}
//getString方法
jSONObject.getString.implementation = function (a) {
    //showStacks();
    //var result = Java.cast(a, Java.use("java.util.ArrayList"));
    console.log("jSONObject.getString: ", a);
    var result = this.getString(a);
    console.log("jSONObject.getString result: ", result);
    return result;
}
```

## Toast的show方法

```javascript
var toast = Java.use("android.widget.Toast");
toast.show.implementation = function(){
    showStacks():
    console.log("toast.show: ");
    return this.show();
}
```

## Base64

```javascript
var base64 = Java.use("android.util.Base64");
base64.encodeToString.overload('[B', 'int').implementation = function (a, b) {   //[B为字节数组类型
    showStacks();
    console.log("base64.encodeToString: ", JSON.stringify(a));    //把JSON对象解析成文本(Str等)
    var result = this.encodeToString(a, b);
    console.log("base64.encodeToString result: ", result)
    return result;
}

//java.net.URLEncoder
//java.util.Base64
//okio.Base64
//okio.ByteString

```

## String的getBytes,isEmpty方法

```javascript
var str = Java.use("java.lang.String");
str.getBytes.overload().implementation = function(){
    var result = this.getBytes();
    var newStr = str.$new(result);
    console.log("sre.getBytes result: ",newStr);
    return result;
}
str.getBytes.overload('java.lang.String').implementation = function (a) {
    showStacks();
    var result = this.getBytes(a);
    var newStr = str.$new(result, a);
    console.log("str.getBytes result: ", newStr);
    return result;
}

```

## String构造函数的Hook

```javascript
var stringFactory = Java.use("java.lang.StringFactory");  //注意要HookStringFactory类而不是String类
stringFactory.newStringFromString.implementation = function (a) {
    showStacks();
    var retval = this.newStringFromString(a);
    console.log("stringFactory.newStringFromString: ", retval);
    return retval;
}
stringFactory.newStringFromChars.overload('[C').implementation = function (a) {
    showStacks();
    var retval = this.newStringFromChars(a);
    console.log("stringFactory.newStringFromChars: ", retval);
    return retval;
}

//newStringFromBytes、newStringFromChars
//newStringFromString、newStringFromStringBuffer、newStringFromStringBuilder

```

## StringBuilder、StringBuffer的Hook

```javascript
var sb = Java.use("java.lang.StringBuilder");
sb.toString.implementation = function(){
    var retval = this.toString();
    if(retval.indexOf("Encrypt") != -1){
        showStacks();
    }
    console.log("StringBuilder.toString: ", retval);
    return retval; 
}
var sb = Java.use("java.lang.StringBuffer");
sb.toString.implementation = function () {
    var retval = this.toString();
    if (retval.indexOf("username") != -1) {
        showStacks();
    }
    console.log("StringBuffer.toString: ", retval);
    return retval;
}
```

## findViewById找控件id(打印R$id的属性)(不建议优先使用)

- `Java.enumerateLoadedClassesSync`枚举所有已加载的类

  	如果不知道类路径，可以用这个方法，然后过滤一下类名

- `frida -U -f com.dodonew.online -l HookDemo.js -o log.txt --no-pause`

​	`-f`代码让frida帮我们重新启动app，一开始就注入js

​	`--no-pause` 直接运行主线程，中途不暂停

- `R$id` 内部类的访问

- `R$id.btn_login.value` 类的属性

```javascript
var btn_login_id = Java.use("com.dodonew.online.R$id").btn_login.value; //id为R的内部类，写法略有不同
console.log("btn_login_id", btn_login_id);
var appCompatActivity = Java.use("android.support.v7.app.AppCompatActivity");
appCompatActivity.findViewById.implementation = function (a) {
    if(a == btn_login_id){
        showStacks();
        console.log("appCompatActivity.findViewById: ", a);
    }
    return this.findViewById(a);
}
```

## setOnClickListener

`hook这个函数，比对控件id，打印函数栈`

```javascript
var btn_login_id = Java.use("com.dodonew.online.R$id").btn_login.value;
console.log("btn_login_id", btn_login_id);

var view = Java.use("android.view.View");
view.setOnClickListener.implementation = function (a) {
    if(this.getId() == btn_login_id){
        showStacks();
        console.log("view.id: " + this.getId());
        console.log("view.setOnClickListener is called");
    }
    return this.setOnClickListener(a);
}

```

## 快速定位协议头加密okhttp3的addHeader方法

```javascript
var okhttp_Builder = Java.use('okhttp3.Request$Builder');

okhttp_Builder.addHeader.implementation = function (a, b) {

    showStacks();

    return this.addHeader(a, b);

}
```

## Other

> `加密库`相关的hook(自吐算法)
>
> `SSL`相关的hook
>
> `socket`相关的hook
>
> `SocketOutputStream`
>
> `SocketInputStream`
>
> 读写文件相关的 `java.io.File`
>
> 证书双向验证 `Keystore.load` 通常有证书和密码
>
> 安卓退出进程的方式
>

