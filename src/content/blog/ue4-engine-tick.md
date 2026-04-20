---
title: "UE4引擎学习-Tick"
description: "UE4引擎中 Tick 机制学习笔记"
pubDate: "2025-05-04"
draft: false
---

## 前言

对于一个游戏引擎来说，游戏循环是不可或缺的一部分，本文接下来的内容主要讲解Android平台的UE4引擎，其他平台的内容也大同小异。在UE4引擎中，"Tick"指的是以**规则间隔**（常为每帧一次）在一个 actor 或组件上**运行一段代码或蓝图脚本**。也可以认为是服务器的一次滴答；时钟的滴答是一秒滴答一次，但服务器一秒会滴答很多次。**每秒的tick数越多，一般来说代表了服务器对客户端的响应可以更及时**，一般意味着服务器的性能也就更高。

和Tick非常相关的一个概念是帧（Frame）。帧，最开始是衡量画面的刷新频率的；后面在[帧同步](https://zhida.zhihu.com/search?content_id=192005928&content_type=Article&match_order=1&q=%E5%B8%A7%E5%90%8C%E6%AD%A5&zhida_source=entity)的技术中，用于逻辑同步，一个逻辑帧是游戏逻辑执行的最小时间单位。在Unreal Engine的`Dedicated Server`中，由于和客户端共用了代码（比如Tick的计数器变量被命名为`GFrameCounter`），所以每次Tick执行，很多时候也被称为一帧。但为了突显Unreal原生使用的状态同步方式，我们用每秒128 tick，会比每秒128帧更准确。

## Tick前的准备阶段

在Android平台，我们可以查阅UE4的源码，找到`Androidmain`函数，这个函数是UE4引擎启动的入口点

```cpp
int32 AndroidMain(struct android_app* state)
{
	GetEnv();
	InitIO();
	SetUpWindow()
	// initialize the engine
	int32 PreInitResult = GEngineLoop.PreInit(0, NULL, FCommandLine::Get());
	GEngineLoop.Init();
	
	BootTimingPoint("Tick loop starting");
	DumpBootTiming();
	// tick until done
	while (!IsEngineExitRequested())
	{
		FAndroidStats::UpdateAndroidStats();
		FAppEventManager::GetInstance()->Tick();
		if(!FAppEventManager::GetInstance()->IsGamePaused())
		{
			GEngineLoop.Tick();
		}
		else
		{
			// use less CPU when paused
			FPlatformProcess::Sleep(0.10f);
		}

#if !UE_BUILD_SHIPPING
		// show console window on next game tick
		if (GShowConsoleWindowNextTick)
		{
			GShowConsoleWindowNextTick = false;
			AndroidThunkCpp_ShowConsoleWindow();
		}
#endif
	}
	
	FAppEventManager::GetInstance()->TriggerEmptyQueue();
	UE_LOG(LogAndroid, Log, TEXT("Exiting"));
	// exit out!
	GEngineLoop.Exit();
	UE_LOG(LogAndroid, Log, TEXT("Exiting is over"));
	FPlatformMisc::RequestExit(1);
	return 0;
}
```

大致的整体流程就是如上面代码所示，**GEngineLoop**是一个`FEngineLoop`类型的全局变量，FEngineLoop是负责管理引擎循环的一个结构体在执行`FEngineLoop::Tick()`之前，UE4引擎会处理一些游戏运行所需要的准备工作，例如初始化JNIEnv、获取IO、设置窗口等。

## EngineTick

完成Tick前的准备之后会执行引擎的初始化，等到这些操作都完成之后，就会进入游戏循环直到游戏退出，在这个过程中，游戏会一直调用`GEngineLoop.Tick()`。EngineTick执行的调用层级如下

```cpp
AndroidMain(struct android_app* state)
	FEngineLoop::Tick()
	    UGameEngine::Tick(float DeltaSeconds, bool bIdleMode)
		    UWorld::Tick(ELevelTick TickType, float DeltaSeconds)
			    AActor::Tick() or AActorComponent::Tick()
```

需要注意的是，FEngineLoop::Tick()调用的是UEngine中的Tick函数，而不是直接调用`UGameEngine::Tick(float DeltaSeconds, bool bIdleMode)`函数，因为UEngine中的Tick函数是**纯虚函数**，具体实现由其子类完成(UGameEngine)

![](/images/ue4-engine-tick/001.png)

这里可以看到`UGameEngine::Tick`会**遍历所有的世界上下文**，并将GWorld指向需要更新的World，然后调用`UWorld::Tick()`，下面的代码是`UWorld::Tick()`函数中比较关键的部分

```cpp
for (int32 i = 0; i < LevelCollections.Num(); ++i)
{
    TArray<ULevel*> LevelsToTick = …;
    FScopedLevelCollectionContextSwitch LevelContext(i, this);

    if (bDoingActorTicks)
    {
        SetupPhysicsTickFunctions(DeltaSeconds);
        FTickTaskManagerInterface::Get().StartFrame(this, DeltaSeconds, TickType, LevelsToTick);

        RunTickGroup(TG_PrePhysics);
        RunTickGroup(TG_StartPhysics);
        RunTickGroup(TG_DuringPhysics, /*bBlock=*/false);
        RunTickGroup(TG_EndPhysics);
        RunTickGroup(TG_PostPhysics);

        FTickTaskManagerInterface::Get().EndFrame();
    }
    else if (bIsPaused)
    {
        FTickTaskManagerInterface::Get().RunPauseFrame(this, DeltaSeconds, LEVELTICK_PauseTick, LevelsToTick);
    }

    if (LevelCollections[i].GetType() == ELevelCollectionType::DynamicSourceLevels)
    {
        CurrentLatentActionManager.ProcessLatentActions(nullptr, DeltaSeconds);
        GetTimerManager().Tick(DeltaSeconds);
        FTickableGameObject::TickObjects(this, TickType, bIsPaused, DeltaSeconds);
        // 摄像机 & 流式关卡体积
        for (auto PC : GetPlayerControllerIterator())
            PC->UpdateCameraManager(DeltaSeconds);
        ProcessLevelStreamingVolumes();
    }
}
```

这段函数的大致流程可以总结成如下:
- 遍历 `LevelCollections`。
- 筛选出当前需要 Tick 的关卡列表 (`LevelsToTick`)。
- 如果 `bDoingActorTicks` 为真:
- 启动 `FTickTaskManager` 处理当前帧。
- 按定义的组 (`RunTickGroup`) 执行 Actor 和 Component 的 Tick 函数：
- `TG_PrePhysics` （物理模拟前）
- `TG_StartPhysics` （物理模拟开始）
- `TG_DuringPhysics` （物理模拟期间，可能并行）
- `TG_EndPhysics` （物理模拟结束）
- `TG_PostPhysics` （物理模拟后）
- 如果 `bIsPaused` 为真:
- 通过 `FTickTaskManager` 执行简化的暂停 Tick (`RunPauseFrame`)。
- 每帧一次 (通常在处理 "Source Levels" Collection 时):
- 处理剩余的延迟动作 (`ProcessLatentActions`)。
- Tick `TimerManager`。
- Tick `FTickableGameObject` 对象。
- 更新摄像机 (`UpdateCameraManager`)。
- 更新关卡流送和 World Composition。

## Tick组

**Actors 和组件可设为每帧 tick，也可设为以最低时间间隔 tick，或完全不 tick**。此外，它们可在引擎每帧更新循环中的不同阶段被合并为**组**；也可接受单独指令，等待特定 tick 完成后再开始。

```cpp
/** 确定 tick 函数属于哪个 tick 组 */
UENUM(BlueprintType)
enum ETickingGroup
{
	/** 物理模拟开始之前需要执行的任何项目 */
	TG_PrePhysics UMETA(DisplayName="Pre Physics"),

	/** 启动物理模拟的特殊Tick组。 */							
	TG_StartPhysics UMETA(Hidden, DisplayName="Start Physics"),

	/** 任何可以与物理模拟工作并行运行的项目 */
	TG_DuringPhysics UMETA(DisplayName="During Physics"),

	/** 终止物理模拟的特殊Tick组 */
	TG_EndPhysics UMETA(Hidden, DisplayName="End Physics"),

	/** 物理模拟完成之后执行的逻辑 */
	TG_PostPhysics UMETA(DisplayName="Post Physics"),

	/** 任何需要刚体和布料模拟才能执行的项目 */
	TG_PostUpdateWork UMETA(DisplayName="Post Update Work"),

	/** 最后可以延迟执行的逻辑 */
	TG_LastDemotable UMETA(Hidden, DisplayName = "Last Demotable"),

	/** 特殊的 tick 组，实际上并非 tick 组。每个 tick 组结束后，都会重复运行此命令，直到没有新生成的项目可供运行 */
	TG_NewlySpawned UMETA(Hidden, DisplayName="Newly Spawned"),

	TG_MAX,
};
```

上面是`ETickingGroup`枚举类型的定义，包含了所有的Tick类型  
对于Tick分组(`RunTickGroup`)，他们的执行顺序十分重要，通过不同的Tick排序可以实现不同的游戏玩法

![](/images/ue4-engine-tick/002.png)

### TG_PrePhysics

- Actor 将与物理对象（包括基于物理的附着物）进行交互时使用的 tick 组。如此，actor 的运动便完成，并可被纳入物理模拟因素。
- 此 tick 中的物理模拟数据属于上一帧 — 也就是上一帧渲染到屏幕上的数据。

### TG_DuringPhysics

- 因它在物理模拟的同时运行，无法确定此 tick 中的物理数据来自上一帧或当前帧。物理模拟可在此 tick 组中的任意时候完成，且不会显示信息来表达此结果。
- 因为物理模拟数据可能来自当前帧或上一帧，此 tick 组只推荐用于无视物理数据或允许一帧偏差的逻辑。常见用途为更新物品栏画面或小地图显示。此处物理数据完全无关，或显示要求不精确，一帧延迟不会造成问题。

### TG_PostPhysics

- 此 tick 组运行时，此帧的物理模拟结果已完成。
- 此组可用于武器或运动追踪。渲染此帧时所有物理对象将位于它们的最终位置。这尤其适用于射击游戏中的激光瞄准器。在此情况中激光束必须从枪的最终位置发出，即便出现一帧延迟也会十分明显。

### TG_PostUpdateWork

- 这在 `TG_PostPhysics` 之后运行。从以往来看，它的基函数是将最靠后的信息送入粒子系统。
- TG_PostUpdateWork 在摄像机更新后发生。如特效必须知晓摄像机朝向的准确位置，可将控制这些特效的 actor 放置于此。
- 这也可用于在帧中绝对最靠后运行的游戏逻辑，如解决格斗游戏中两个角色在同一帧中尝试抓住对方的情况。

## 总结

FEngineLoop::Tick()是整个UE4循环中最为关键的一次Tick，在这个Tick中会调用许多子Tick函数来完成不同的分工，如更新角色位置、摄像机视角等操作，
