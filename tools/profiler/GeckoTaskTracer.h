/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et cindent: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef GECKO_TASK_TRACER_H
#define GECKO_TASK_TRACER_H

#include "nsCOMPtr.h"

/**
 * TaskTracer provides a way to trace the correlation between different tasks
 * across threads and processes. Unlike sampling based profilers, TaskTracer can
 * tell you where a task is dispatched from, what its original source was, how
 * long it waited in the event queue, and how long it took to execute.
 *
 * Source Events are usually some kinds of I/O events we're interested in, such
 * as touch events, timer events, network events, etc. When a source event is
 * created, TaskTracer records the entire chain of Tasks and nsRunnables as they
 * are dispatched to different threads and processes. It records latency,
 * execution time, etc. for each Task and nsRunnable that chains back to the
 * original source event.
 */

class Task;
class nsIRunnable;

namespace mozilla {
namespace tasktracer {

class FakeTracedTask;

enum SourceEventType {
  UNKNOWN = 0,
  TOUCH,
  MOUSE,
  KEY,
  BLUETOOTH,
  UNIXSOCKET,
  WIFI
};

class AutoSourceEvent
{
public:
  AutoSourceEvent(SourceEventType aType);
  ~AutoSourceEvent();
};

// Add a label to the currently running task, aFormat is the message to log,
// followed by corresponding parameters.
void AddLabel(const char* aFormat, ...);

/**
 * Internal functions.
 */

Task* CreateTracedTask(Task* aTask);

already_AddRefed<nsIRunnable> CreateTracedRunnable(nsIRunnable* aRunnable);

FakeTracedTask* CreateFakeTracedTask(int* aVptr);

// Free the TraceInfo allocated on a thread's TLS. Currently we are wrapping
// tasks running on nsThreads and base::thread, so FreeTraceInfo is called at
// where nsThread and base::thread release themselves.
void FreeTraceInfo();

} // namespace tasktracer
} // namespace mozilla.

#endif
