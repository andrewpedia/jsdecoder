/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */
"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});

// Disable logging for all the tests. Both the debugger server and frontend will
// be affected by this pref.
let gEnableLogging = Services.prefs.getBoolPref("devtools.debugger.log");
Services.prefs.setBoolPref("devtools.debugger.log", false);

let { Task } = Cu.import("resource://gre/modules/Task.jsm", {});
let { Promise: promise } = Cu.import("resource://gre/modules/Promise.jsm", {});
let { gDevTools } = Cu.import("resource:///modules/devtools/gDevTools.jsm", {});
let { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
let { DebuggerServer } = Cu.import("resource://gre/modules/devtools/dbg-server.jsm", {});
let { DebuggerClient } = Cu.import("resource://gre/modules/devtools/dbg-client.jsm", {});

let { CallWatcherFront } = devtools.require("devtools/server/actors/call-watcher");
let { CanvasFront } = devtools.require("devtools/server/actors/canvas");
let TiltGL = devtools.require("devtools/tilt/tilt-gl");
let TargetFactory = devtools.TargetFactory;
let Toolbox = devtools.Toolbox;

const EXAMPLE_URL = "http://example.com/browser/browser/devtools/canvasdebugger/test/";
const SIMPLE_CANVAS_URL = EXAMPLE_URL + "doc_simple-canvas.html";
const SIMPLE_BITMASKS_URL = EXAMPLE_URL + "doc_simple-canvas-bitmasks.html";
const SIMPLE_CANVAS_TRANSPARENT_URL = EXAMPLE_URL + "doc_simple-canvas-transparent.html";
const SIMPLE_CANVAS_DEEP_STACK_URL = EXAMPLE_URL + "doc_simple-canvas-deep-stack.html";
const WEBGL_ENUM_URL = EXAMPLE_URL + "doc_webgl-enum.html";

// All tests are asynchronous.
waitForExplicitFinish();

let gToolEnabled = Services.prefs.getBoolPref("devtools.canvasdebugger.enabled");

registerCleanupFunction(() => {
  info("finish() was called, cleaning up...");
  Services.prefs.setBoolPref("devtools.debugger.log", gEnableLogging);
  Services.prefs.setBoolPref("devtools.canvasdebugger.enabled", gToolEnabled);

  // Some of yhese tests use a lot of memory due to GL contexts, so force a GC
  // to help fragmentation.
  info("Forcing GC after canvas debugger test.");
  Cu.forceGC();
});

function addTab(aUrl, aWindow) {
  info("Adding tab: " + aUrl);

  let deferred = promise.defer();
  let targetWindow = aWindow || window;
  let targetBrowser = targetWindow.gBrowser;

  targetWindow.focus();
  let tab = targetBrowser.selectedTab = targetBrowser.addTab(aUrl);
  let linkedBrowser = tab.linkedBrowser;

  linkedBrowser.addEventListener("load", function onLoad() {
    linkedBrowser.removeEventListener("load", onLoad, true);
    info("Tab added and finished loading: " + aUrl);
    deferred.resolve(tab);
  }, true);

  return deferred.promise;
}

function removeTab(aTab, aWindow) {
  info("Removing tab.");

  let deferred = promise.defer();
  let targetWindow = aWindow || window;
  let targetBrowser = targetWindow.gBrowser;
  let tabContainer = targetBrowser.tabContainer;

  tabContainer.addEventListener("TabClose", function onClose(aEvent) {
    tabContainer.removeEventListener("TabClose", onClose, false);
    info("Tab removed and finished closing.");
    deferred.resolve();
  }, false);

  targetBrowser.removeTab(aTab);
  return deferred.promise;
}

function handleError(aError) {
  ok(false, "Got an error: " + aError.message + "\n" + aError.stack);
  finish();
}

let gRequiresWebGL = false;

function ifTestingSupported() {
  ok(false, "You need to define a 'ifTestingSupported' function.");
  finish();
}

function ifTestingUnsupported() {
  todo(false, "Skipping test because some required functionality isn't supported.");
  finish();
}

function test() {
  let generator = isTestingSupported() ? ifTestingSupported : ifTestingUnsupported;
  Task.spawn(generator).then(null, handleError);
}

function createCanvas() {
  return document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
}

function isTestingSupported() {
  if (!gRequiresWebGL) {
    info("This test does not require WebGL support.");
    return true;
  }

  let supported =
    !TiltGL.isWebGLForceEnabled() &&
     TiltGL.isWebGLSupported() &&
     TiltGL.create3DContext(createCanvas());

  info("This test requires WebGL support.");
  info("Apparently, WebGL is" + (supported ? "" : " not") + " supported.");
  return supported;
}

function once(aTarget, aEventName, aUseCapture = false) {
  info("Waiting for event: '" + aEventName + "' on " + aTarget + ".");

  let deferred = promise.defer();

  for (let [add, remove] of [
    ["on", "off"], // Use event emitter before DOM events for consistency
    ["addEventListener", "removeEventListener"],
    ["addListener", "removeListener"]
  ]) {
    if ((add in aTarget) && (remove in aTarget)) {
      aTarget[add](aEventName, function onEvent(...aArgs) {
        aTarget[remove](aEventName, onEvent, aUseCapture);
        deferred.resolve(...aArgs);
      }, aUseCapture);
      break;
    }
  }

  return deferred.promise;
}

function waitForTick() {
  let deferred = promise.defer();
  executeSoon(deferred.resolve);
  return deferred.promise;
}

function navigateInHistory(aTarget, aDirection, aWaitForTargetEvent = "navigate") {
  executeSoon(() => content.history[aDirection]());
  return once(aTarget, aWaitForTargetEvent);
}

function navigate(aTarget, aUrl, aWaitForTargetEvent = "navigate") {
  executeSoon(() => aTarget.activeTab.navigateTo(aUrl));
  return once(aTarget, aWaitForTargetEvent);
}

function reload(aTarget, aWaitForTargetEvent = "navigate") {
  executeSoon(() => aTarget.activeTab.reload());
  return once(aTarget, aWaitForTargetEvent);
}

function initServer() {
  if (!DebuggerServer.initialized) {
    DebuggerServer.init(() => true);
    DebuggerServer.addBrowserActors();
  }
}

function initCallWatcherBackend(aUrl) {
  info("Initializing a call watcher front.");
  initServer();

  return Task.spawn(function*() {
    let tab = yield addTab(aUrl);
    let target = TargetFactory.forTab(tab);
    let debuggee = target.window.wrappedJSObject;

    yield target.makeRemote();

    let front = new CallWatcherFront(target.client, target.form);
    return [target, debuggee, front];
  });
}

function initCanavsDebuggerBackend(aUrl) {
  info("Initializing a canvas debugger front.");
  initServer();

  return Task.spawn(function*() {
    let tab = yield addTab(aUrl);
    let target = TargetFactory.forTab(tab);
    let debuggee = target.window.wrappedJSObject;

    yield target.makeRemote();

    let front = new CanvasFront(target.client, target.form);
    return [target, debuggee, front];
  });
}

function initCanavsDebuggerFrontend(aUrl) {
  info("Initializing a canvas debugger pane.");

  return Task.spawn(function*() {
    let tab = yield addTab(aUrl);
    let target = TargetFactory.forTab(tab);
    let debuggee = target.window.wrappedJSObject;

    yield target.makeRemote();

    Services.prefs.setBoolPref("devtools.canvasdebugger.enabled", true);
    let toolbox = yield gDevTools.showToolbox(target, "canvasdebugger");
    let panel = toolbox.getCurrentPanel();
    return [target, debuggee, panel];
  });
}

function teardown(aPanel) {
  info("Destroying the specified canvas debugger.");

  return promise.all([
    once(aPanel, "destroyed"),
    removeTab(aPanel.target.tab)
  ]);
}
