---
title: "Android So相关知识"
description: "在学习Android逆向的时候总结的一些so层的相关知识"
pubDate: "2024-12-30"
draft: false
---

# So相关知识学习

## JNI函数的静态注册

- 必须遵循一定的命名规则，**一般是 `Java_包名_类名_方法名`**
    
- 系统会通过 **`dlopen`** 加载对应的 SO，通过 **`dlsym`** 来获取指定名字的函数地址，然后调用静态注册的 JNI 函数，**必然在导出表里**
    
- 编译 SO 的时候不会给对应 JNI 函数具体地址，在 **第一次调用** 的时候才会有具体地址
    

## JNI函数的动态注册

- 通过 **`env->RegisterNatives`** 注册函数，通常在 **`JNI_OnLoad`** 中注册 **`JNINativeMethod`**
    
- 函数签名
    
- 可以给同一个 Java 函数注册多个 native 函数，以最后一次为准
    

```c
jclass MainActivityClazz = env->FindClass("com/Jeremiah/ndk/NDKMain");

/*
typedef struct { // JNINativeMethod 结构体的实现
    const char* name;         // Java层对应方法名
    const char* signature;    // 函数签名
    void* fnptr;              // 函数指针（即SO中函数的地址）
} JNINativeMethod;
*/

JNINativeMethod methods[] = {
    {"encode", "(ILjava/lang/String;[B)Ljava/lang/String;", (void *)encodeFromC},
};

env->RegisterNatives(MainActivityClazz, methods, sizeof(methods)/sizeof(JNINativeMethod));
```

## JNI_Onload定义

```c
JNIEXPORT jint JNI_OnLoad(JavaVM *vm, void *reserved) {
    JNIEnv *env = nullptr;
    if (vm->GetEnv((void **) &env, JNI_VERSION_1_6) != JNI_OK) {
        LOGD("GetEnv failed");
        return -1;
    }
    return JNI_VERSION_1_6;
}
// 一个 SO 中可以不定义 JNI_OnLoad
// 一旦定义了 JNI_OnLoad，在 SO 被加载的时候会自动执行
// 必须返回 JNI 版本 JNI_VERSION_1_6
```

## SO之间的相互调用

- 使用 **`dlopen`**, **`dlsym`**, **`dlclose`** 获取函数地址，然后调用。需要导入 **`dlfcn.h`**
    
- `dlopen` 第一个参数为要加载的 SO 的 **绝对路径**，第二个参数为 **符号解析的时机**，返回值为该 SO 的一个 **句柄**
    
- `dlsym` 第一个参数为 `dlopen` 返回的 **库句柄**，第二个参数为要查找的 **符号的名字**，返回值为 **该符号的指针**
    
- **`reinterpret_cast<void (*)(char *)`** 为 C++ 中的一个方法，用于两个不同类型指针的强制转换
    

```c
void *soinfo = dlopen(nativePath, RTLD_NOW);
void (*def)(char* str) = nullptr;
def = reinterpret_cast<void (*)(char *)>(dlsym(soinfo, "_Z7fromSoBPc"));
def("Jeremiah");
```

- **extern** 函数声明

## SO路径的动态获取

- 32 和 64 的 SO 存放路径不一样，为了更加通用，**可以用代码动态获取 SO 路径**

```java
public String getPath(Context cxt){
    PackageManager pm = cxt.getPackageManager();
    List<PackageInfo> pkgList = pm.getInstalledPackages(0);
    if (pkgList == null || pkgList.size() == 0) return null;
    for (PackageInfo pi : pkgList) {
        if (pi.applicationInfo.nativeLibraryDir.startsWith("/data/app/") // 路径
            && pi.packageName.startsWith("com.Jeremiah.test")) {        // 包名
            // Log.e("Jeremiah", pi.applicationInfo.nativeLibraryDir);
            return pi.applicationInfo.nativeLibraryDir;
        }
    }
    return null;
}
```

## 通过JNI创建Java对象

1. **`NewObject`** 创建对象
    
    ```c
    jclass clazz = env->FindClass("com/Jeremiah/ndk/NDKDemo");
    jmethodID methodID = env->GetMethodID(clazz, "<init>", "()V");
    jobject ReflectDemoObj = env->NewObject(clazz, methodID);
    LOGD("ReflectDemoObj %p", ReflectDemoObj);
    ```
    
2. **`AllocObject`** 创建对象
    
    ```c
    jclass clazz = env->FindClass("com/Jeremiah/ndk/NDKDemo");
    jmethodID methodID2 = env->GetMethodID(clazz, "<init>", "(Ljava/lang/String;I)V");
    jobject ReflectDemoObj2 = env->AllocObject(clazz);
    jstring jstr = env->NewStringUTF("from jni str");
    env->CallNonvirtualVoidMethod(ReflectDemoObj2, clazz, methodID2, jstr, 100);
    ```
    

## 通过JNI访问Java属性

1. **获取静态字段**
    
    ```c
    jfieldID privateStaticStringField = 
        env->GetStaticFieldID(clazz, "privateStaticStringField", "Ljava/lang/String;");
    jstring privateStaticString = 
        static_cast<jstring>(env->GetStaticObjectField(clazz, privateStaticStringField));
    const char* privatecstr = 
        env->GetStringUTFChars(privateStaticString, nullptr);
    LOGD("privateStaticString: %s", privatecstr);
    env->ReleaseStringUTFChars(privateStaticString, privatecstr);
    ```
    
2. **获取对象字段**
    
    ```c
    jfieldID publicStringField = 
        env->GetFieldID(clazz, "publicStringField", "Ljava/lang/String;");
    jstring publicString = 
        static_cast<jstring>(env->GetObjectField(ReflectDemoObj, publicStringField));
    const char* publiccstr = 
        env->GetStringUTFChars(publicString, nullptr);
    LOGD("publicStringField: %s", publiccstr);
    ```
    
3. **设置字段**
    
    ```c
    env->SetObjectField(ndkobj, privateStringFieldID, env->NewStringUTF("Jeremiah"));
    ```
    

## 通过JNI访问Java数组

1. **获取数组字段ID**
    
    ```c
    jfieldID byteArrayID = env->GetFieldID(clazz, "byteArray", "[B");
    jbyteArray byteArray = 
        static_cast<jbyteArray>(env->GetObjectField(ReflectDemoObj, byteArrayID));
    int _byteArrayLength = env->GetArrayLength(byteArray); // 得到数组长度
    ```
    
2. **修改数组字段**
    
    ```c
    char javaByte[10];
    for(int i = 0; i < 10; i++){
        javaByte[i] = static_cast<char>(100 - i);
    }
    const jbyte *java_array = reinterpret_cast<const jbyte *>(javaByte);
    env->SetByteArrayRegion(byteArray, 0, _byteArrayLength, java_array); 
    ```
    
3. **获取数组字段**
    
    ```c
    byteArray = static_cast<jbyteArray>(env->GetObjectField(ReflectDemoObj, byteArrayID));
    _byteArrayLength = env->GetArrayLength(byteArray);
    char* str = reinterpret_cast<char *>(env->GetByteArrayElements(byteArray, nullptr));
    for(int i = 0; i < _byteArrayLength; i++){
        LOGD("str[%d]=%d", i, str[i]);
    }
    env->ReleaseByteArrayElements(jbyteArray, reinterpret_cast<jbyte *>(cbyteArray), 0);
    ```

   
