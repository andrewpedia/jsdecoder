#ifndef mozilla__ipdltest_TestActorPunning_h
#define mozilla__ipdltest_TestActorPunning_h 1

#include "mozilla/_ipdltest/IPDLUnitTests.h"

#include "mozilla/_ipdltest/PTestActorPunningParent.h"
#include "mozilla/_ipdltest/PTestActorPunningPunnedParent.h"
#include "mozilla/_ipdltest/PTestActorPunningSubParent.h"
#include "mozilla/_ipdltest/PTestActorPunningChild.h"
#include "mozilla/_ipdltest/PTestActorPunningPunnedChild.h"
#include "mozilla/_ipdltest/PTestActorPunningSubChild.h"

namespace mozilla {
namespace _ipdltest {


class TestActorPunningParent :
    public PTestActorPunningParent
{
public:
    static bool RunTestInProcesses() { return true; }
    static bool RunTestInThreads() { return false; }

    void Main();

protected:
    PTestActorPunningPunnedParent* AllocPTestActorPunningPunnedParent() MOZ_OVERRIDE;
    bool DeallocPTestActorPunningPunnedParent(PTestActorPunningPunnedParent* a) MOZ_OVERRIDE;

    PTestActorPunningSubParent* AllocPTestActorPunningSubParent() MOZ_OVERRIDE;
    bool DeallocPTestActorPunningSubParent(PTestActorPunningSubParent* a) MOZ_OVERRIDE;

    virtual bool RecvPun(PTestActorPunningSubParent* a, const Bad& bad) MOZ_OVERRIDE;

    virtual void ActorDestroy(ActorDestroyReason why) MOZ_OVERRIDE
    {
        if (NormalShutdown == why)
            fail("should have died from error!");  
        passed("ok");
        QuitParent();
    }
};

class TestActorPunningPunnedParent :
    public PTestActorPunningPunnedParent
{
public:
    TestActorPunningPunnedParent() {}
    virtual ~TestActorPunningPunnedParent() {}
protected:
    virtual void ActorDestroy(ActorDestroyReason why) MOZ_OVERRIDE {}
};

class TestActorPunningSubParent :
    public PTestActorPunningSubParent
{
public:
    TestActorPunningSubParent() {}
    virtual ~TestActorPunningSubParent() {}
protected:
    virtual void ActorDestroy(ActorDestroyReason why) MOZ_OVERRIDE {}
};


class TestActorPunningChild :
    public PTestActorPunningChild
{
public:
    TestActorPunningChild() {}
    virtual ~TestActorPunningChild() {}

protected:
    PTestActorPunningPunnedChild* AllocPTestActorPunningPunnedChild() MOZ_OVERRIDE;
    bool DeallocPTestActorPunningPunnedChild(PTestActorPunningPunnedChild* a) MOZ_OVERRIDE;

    PTestActorPunningSubChild* AllocPTestActorPunningSubChild() MOZ_OVERRIDE;
    bool DeallocPTestActorPunningSubChild(PTestActorPunningSubChild* a) MOZ_OVERRIDE;

    virtual bool RecvStart() MOZ_OVERRIDE;

    virtual void ActorDestroy(ActorDestroyReason why) MOZ_OVERRIDE
    {
        fail("should have been killed off!");
    }
};

class TestActorPunningPunnedChild :
    public PTestActorPunningPunnedChild
{
public:
    TestActorPunningPunnedChild() {}
    virtual ~TestActorPunningPunnedChild() {}
};

class TestActorPunningSubChild :
    public PTestActorPunningSubChild
{
public:
    TestActorPunningSubChild() {}
    virtual ~TestActorPunningSubChild() {}

    virtual bool RecvBad() MOZ_OVERRIDE;
};


} // namespace _ipdltest
} // namespace mozilla


#endif // ifndef mozilla__ipdltest_TestActorPunning_h
