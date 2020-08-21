// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

this.EXPORTED_SYMBOLS = ["RemoteAddonsParent"];

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import('resource://gre/modules/Services.jsm');

XPCOMUtils.defineLazyModuleGetter(this, "BrowserUtils",
                                  "resource://gre/modules/BrowserUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "NetUtil",
                                  "resource://gre/modules/NetUtil.jsm");

// Similar to Python. Returns dict[key] if it exists. Otherwise,
// sets dict[key] to default_ and returns default_.
function setDefault(dict, key, default_)
{
  if (key in dict) {
    return dict[key];
  }
  dict[key] = default_;
  return default_;
}

// This code keeps track of a set of paths of the form [component_1,
// ..., component_n]. The components can be strings or booleans. The
// child is notified whenever a path is added or removed, and new
// children can request the current set of paths. The purpose is to
// keep track of all the observers and events that the child should
// monitor for the parent.
let NotificationTracker = {
  // _paths is a multi-level dictionary. Let's add paths [A, B] and
  // [A, C]. Then _paths will look like this:
  //   { 'A': { 'B': { '_count': 1 }, 'C': { '_count': 1 } } }
  // Each component in a path will be a key in some dictionary. At the
  // end, the _count property keeps track of how many instances of the
  // given path are present in _paths.
  _paths: {},

  init: function() {
    let ppmm = Cc["@mozilla.org/parentprocessmessagemanager;1"]
               .getService(Ci.nsIMessageBroadcaster);
    ppmm.addMessageListener("Addons:GetNotifications", this);
  },

  add: function(path) {
    let tracked = this._paths;
    for (let component of path) {
      tracked = setDefault(tracked, component, {});
    }
    let count = tracked._count || 0;
    count++;
    tracked._count = count;

    let ppmm = Cc["@mozilla.org/parentprocessmessagemanager;1"]
               .getService(Ci.nsIMessageBroadcaster);
    ppmm.broadcastAsyncMessage("Addons:AddNotification", path);
  },

  remove: function(path) {
    let tracked = this._paths;
    for (let component of path) {
      tracked = setDefault(tracked, component, {});
    }
    tracked._count--;

    let ppmm = Cc["@mozilla.org/parentprocessmessagemanager;1"]
               .getService(Ci.nsIMessageBroadcaster);
    ppmm.broadcastAsyncMessage("Addons:RemoveNotification", path);
  },

  receiveMessage: function(msg) {
    if (msg.name == "Addons:GetNotifications") {
      return this._paths;
    }
  }
};
NotificationTracker.init();

// An interposition is an object with three properties: methods,
// getters, and setters. See multiprocessShims.js for an explanation
// of how these are used. The constructor here just allows one
// interposition to inherit members from another.
function Interposition(base)
{
  if (base) {
    this.methods = Object.create(base.methods);
    this.getters = Object.create(base.getters);
    this.setters = Object.create(base.setters);
  } else {
    this.methods = {};
    this.getters = {};
    this.setters = {};
  }
}

// This object is responsible for notifying the child when a new
// content policy is added or removed. It also runs all the registered
// add-on content policies when the child asks it to do so.
let ContentPolicyParent = {
  init: function() {
    let ppmm = Cc["@mozilla.org/parentprocessmessagemanager;1"]
               .getService(Ci.nsIMessageBroadcaster);
    ppmm.addMessageListener("Addons:ContentPolicy:Run", this);

    this._policies = [];
  },

  addContentPolicy: function(cid) {
    this._policies.push(cid);
    NotificationTracker.add(["content-policy"]);
  },

  removeContentPolicy: function(cid) {
    let index = this._policies.lastIndexOf(cid);
    if (index > -1) {
      this._policies.splice(index, 1);
    }

    NotificationTracker.remove(["content-policy"]);
  },

  receiveMessage: function (aMessage) {
    switch (aMessage.name) {
      case "Addons:ContentPolicy:Run":
        return this.shouldLoad(aMessage.data, aMessage.objects);
        break;
    }
  },

  shouldLoad: function(aData, aObjects) {
    for (let policyCID of this._policies) {
      let policy = Cc[policyCID].getService(Ci.nsIContentPolicy);
      try {
        let result = policy.shouldLoad(aObjects.contentType,
                                       aObjects.contentLocation,
                                       aObjects.requestOrigin,
                                       aObjects.node,
                                       aObjects.mimeTypeGuess,
                                       null);
        if (result != Ci.nsIContentPolicy.ACCEPT && result != 0)
          return result;
      } catch (e) {
        Cu.reportError(e);
      }
    }

    return Ci.nsIContentPolicy.ACCEPT;
  },
};
ContentPolicyParent.init();

// This interposition intercepts calls to add or remove new content
// policies and forwards these requests to ContentPolicyParent.
let CategoryManagerInterposition = new Interposition();

CategoryManagerInterposition.methods.addCategoryEntry =
  function(addon, target, category, entry, value, persist, replace) {
    if (category == "content-policy") {
      ContentPolicyParent.addContentPolicy(entry);
    }

    target.addCategoryEntry(category, entry, value, persist, replace);
  };

CategoryManagerInterposition.methods.deleteCategoryEntry =
  function(addon, target, category, entry, persist) {
    if (category == "content-policy") {
      ContentPolicyParent.remoteContentPolicy(entry);
    }

    target.deleteCategoryEntry(category, entry, persist);
  };

// This shim handles the case where an add-on registers an about:
// protocol handler in the parent and we want the child to be able to
// use it. This code is pretty specific to Adblock's usage.
let AboutProtocolParent = {
  init: function() {
    let ppmm = Cc["@mozilla.org/parentprocessmessagemanager;1"]
               .getService(Ci.nsIMessageBroadcaster);
    ppmm.addMessageListener("Addons:AboutProtocol:GetURIFlags", this);
    ppmm.addMessageListener("Addons:AboutProtocol:NewChannel", this);
    this._protocols = [];
  },

  registerFactory: function(class_, className, contractID, factory) {
    this._protocols.push({contractID: contractID, factory: factory});
    NotificationTracker.add(["about-protocol", contractID]);
  },

  unregisterFactory: function(class_, factory) {
    for (let i = 0; i < this._protocols.length; i++) {
      if (this._protocols[i].factory == factory) {
        NotificationTracker.remove(["about-protocol", this._protocols[i].contractID]);
        this._protocols.splice(i, 1);
        break;
      }
    }
  },

  receiveMessage: function (msg) {
    switch (msg.name) {
      case "Addons:AboutProtocol:GetURIFlags":
        return this.getURIFlags(msg);
      case "Addons:AboutProtocol:NewChannel":
        return this.newChannel(msg);
        break;
    }
  },

  getURIFlags: function(msg) {
    let uri = BrowserUtils.makeURI(msg.data.uri);
    let contractID = msg.data.contractID;
    let module = Cc[contractID].getService(Ci.nsIAboutModule);
    try {
      return module.getURIFlags(uri);
    } catch (e) {
      Cu.reportError(e);
    }
  },

  // We take some shortcuts here. Ideally, we would return a CPOW that
  // wraps the add-on's nsIChannel. However, many of the methods
  // related to nsIChannel are marked [noscript], so they're not
  // available to CPOWs. Consequently, we immediately read all the
  // data out of the channel here and pass it to the child. The child
  // then returns a shim channel that wraps an nsIStringInputStream
  // for the string we read.
  newChannel: function(msg) {
    let uri = BrowserUtils.makeURI(msg.data.uri);
    let contractID = msg.data.contractID;
    let module = Cc[contractID].getService(Ci.nsIAboutModule);
    try {
      let channel = module.newChannel(uri);
      let stream = channel.open();
      let data = NetUtil.readInputStreamToString(stream, stream.available(), {});
      return {
        data: data,
        uri: channel.URI.spec,
        originalURI: channel.originalURI.spec,
        contentType: channel.contentType
      };
    } catch (e) {
      Cu.reportError(e);
    }
  },
};
AboutProtocolParent.init();

let ComponentRegistrarInterposition = new Interposition();

ComponentRegistrarInterposition.methods.registerFactory =
  function(addon, target, class_, className, contractID, factory) {
    if (contractID.startsWith("@mozilla.org/network/protocol/about;1?")) {
      AboutProtocolParent.registerFactory(class_, className, contractID, factory);
    }

    target.registerFactory(class_, className, contractID, factory);
  };

ComponentRegistrarInterposition.methods.unregisterFactory =
  function(addon, target, class_, factory) {
    AboutProtocolParent.tryUnregisterFactory(class_, factory);
    target.unregisterFactory(class_, factory);
  };

// This object manages add-on observers that might fire in the child
// process. Rather than managing the observers itself, it uses the
// parent's observer service. When an add-on listens on topic T,
// ObserverParent asks the child process to listen on T. It also adds
// an observer in the parent for the topic e10s-T. When the T observer
// fires in the child, the parent fires all the e10s-T observers,
// passing them CPOWs for the subject and data. We don't want to use T
// in the parent because there might be non-add-on T observers that
// won't expect to get notified in this case.
let ObserverParent = {
  init: function() {
    let ppmm = Cc["@mozilla.org/parentprocessmessagemanager;1"]
               .getService(Ci.nsIMessageBroadcaster);
    ppmm.addMessageListener("Addons:Observer:Run", this);
  },

  addObserver: function(observer, topic, ownsWeak) {
    Services.obs.addObserver(observer, "e10s-" + topic, ownsWeak);
    NotificationTracker.add(["observer", topic]);
  },

  removeObserver: function(observer, topic) {
    Services.obs.removeObserver(observer, "e10s-" + topic);
    NotificationTracker.remove(["observer", topic]);
  },

  receiveMessage: function(msg) {
    switch (msg.name) {
      case "Addons:Observer:Run":
        this.notify(msg.objects.subject, msg.objects.topic, msg.objects.data);
        break;
    }
  },

  notify: function(subject, topic, data) {
    let e = Services.obs.enumerateObservers("e10s-" + topic);
    while (e.hasMoreElements()) {
      let obs = e.getNext().QueryInterface(Ci.nsIObserver);
      try {
        obs.observe(subject, topic, data);
      } catch (e) {
        Cu.reportError(e);
      }
    }
  }
};
ObserverParent.init();

// We only forward observers for these topics.
let TOPIC_WHITELIST = ["content-document-global-created",
                       "document-element-inserted",];

// This interposition listens for
// nsIObserverService.{add,remove}Observer.
let ObserverInterposition = new Interposition();

ObserverInterposition.methods.addObserver =
  function(addon, target, observer, topic, ownsWeak) {
    if (TOPIC_WHITELIST.indexOf(topic) >= 0) {
      ObserverParent.addObserver(observer, topic);
    }

    target.addObserver(observer, topic, ownsWeak);
  };

ObserverInterposition.methods.removeObserver =
  function(addon, target, observer, topic) {
    if (TOPIC_WHITELIST.indexOf(topic) >= 0) {
      ObserverParent.removeObserver(observer, topic);
    }

    target.removeObserver(observer, topic);
  };

// This object is responsible for forwarding events from the child to
// the parent.
let EventTargetParent = {
  init: function() {
    // The _listeners map goes from targets (either <browser> elements
    // or windows) to a dictionary from event types to listeners.
    this._listeners = new WeakMap();

    let mm = Cc["@mozilla.org/globalmessagemanager;1"].
      getService(Ci.nsIMessageListenerManager);
    mm.addMessageListener("Addons:Event:Run", this);
  },

  // If target is not on the path from a <browser> element to the
  // window root, then we return null here to ignore the
  // target. Otherwise, if the target is a browser-specific element
  // (the <browser> or <tab> elements), then we return the
  // <browser>. If it's some generic element, then we return the
  // window itself.
  redirectEventTarget: function(target) {
    if (Cu.isCrossProcessWrapper(target)) {
      return null;
    }

    if (target instanceof Ci.nsIDOMChromeWindow) {
      return target;
    }

    const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    if (target instanceof Ci.nsIDOMXULElement) {
      if (target.localName == "browser") {
        return target;
      } else if (target.localName == "tab") {
        return target.linkedBrowser;
      }

      // Check if |target| is somewhere on the patch from the
      // <tabbrowser> up to the root element.
      let window = target.ownerDocument.defaultView;
      if (target.contains(window.gBrowser)) {
        return window;
      }
    }

    return null;
  },

  // When a given event fires in the child, we fire it on the
  // <browser> element and the window since those are the two possible
  // results of redirectEventTarget.
  getTargets: function(browser) {
    let window = browser.ownerDocument.defaultView;
    return [browser, window];
  },

  addEventListener: function(target, type, listener, useCapture, wantsUntrusted) {
    let newTarget = this.redirectEventTarget(target);
    if (!newTarget) {
      return;
    }

    useCapture = useCapture || false;
    wantsUntrusted = wantsUntrusted || false;

    NotificationTracker.add(["event", type, useCapture]);

    let listeners = this._listeners.get(newTarget);
    if (!listeners) {
      listeners = {};
      this._listeners.set(newTarget, listeners);
    }
    let forType = setDefault(listeners, type, []);

    // If there's already an identical listener, don't do anything.
    for (let i = 0; i < forType.length; i++) {
      if (forType[i].listener === listener &&
          forType[i].useCapture === useCapture &&
          forType[i].wantsUntrusted === wantsUntrusted) {
        return;
      }
    }

    forType.push({listener: listener, wantsUntrusted: wantsUntrusted, useCapture: useCapture});
  },

  removeEventListener: function(target, type, listener, useCapture) {
    let newTarget = this.redirectEventTarget(target);
    if (!newTarget) {
      return;
    }

    useCapture = useCapture || false;

    let listeners = this._listeners.get(newTarget);
    if (!listeners) {
      return;
    }
    let forType = setDefault(listeners, type, []);

    for (let i = 0; i < forType.length; i++) {
      if (forType[i].listener === listener && forType[i].useCapture === useCapture) {
        forType.splice(i, 1);
        NotificationTracker.remove(["event", type, useCapture]);
        break;
      }
    }
  },

  receiveMessage: function(msg) {
    switch (msg.name) {
      case "Addons:Event:Run":
        this.dispatch(msg.target, msg.data.type, msg.data.isTrusted, msg.objects.event);
        break;
    }
  },

  dispatch: function(browser, type, isTrusted, event) {
    let targets = this.getTargets(browser);
    for (target of targets) {
      let listeners = this._listeners.get(target);
      if (!listeners) {
        continue;
      }
      let forType = setDefault(listeners, type, []);
      for (let {listener, wantsUntrusted} of forType) {
        if (wantsUntrusted || isTrusted) {
          try {
            if ("handleEvent" in listener) {
              listener.handleEvent(event);
            } else {
              listener.call(event.target, event);
            }
          } catch (e) {
            Cu.reportError(e);
          }
        }
      }
    }
  }
};
EventTargetParent.init();

// This interposition redirects addEventListener and
// removeEventListener to EventTargetParent.
let EventTargetInterposition = new Interposition();

EventTargetInterposition.methods.addEventListener =
  function(addon, target, type, listener, useCapture, wantsUntrusted) {
    EventTargetParent.addEventListener(target, type, listener, useCapture, wantsUntrusted);
    target.addEventListener(type, listener, useCapture, wantsUntrusted);
  };

EventTargetInterposition.methods.removeEventListener =
  function(addon, target, type, listener, useCapture) {
    EventTargetParent.removeEventListener(target, type, listener, useCapture);
    target.removeEventListener(type, listener, useCapture);
  };

// This interposition intercepts accesses to |rootTreeItem| on a child
// process docshell. In the child, each docshell is its own
// root. However, add-ons expect the root to be the chrome docshell,
// so we make that happen here.
let ContentDocShellTreeItemInterposition = new Interposition();

ContentDocShellTreeItemInterposition.getters.rootTreeItem =
  function(addon, target) {
    // The chrome global in the child.
    let chromeGlobal = target.rootTreeItem
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIContentFrameMessageManager);

    // Map it to a <browser> element and window.
    let browser = RemoteAddonsParent.globalToBrowser.get(chromeGlobal);
    if (!browser) {
      // Somehow we have a CPOW from the child, but it hasn't sent us
      // its global yet. That shouldn't happen, but return null just
      // in case.
      return null;
    }

    let chromeWin = browser.ownerDocument.defaultView;

    // Return that window's docshell.
    return chromeWin.QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIWebNavigation)
      .QueryInterface(Ci.nsIDocShellTreeItem);
  };

// This object manages sandboxes created with content principals in
// the parent. We actually create these sandboxes in the child process
// so that the code loaded into them runs there. The resulting sandbox
// object is a CPOW. This is primarly useful for Greasemonkey.
let SandboxParent = {
  componentsMap: new WeakMap(),

  makeContentSandbox: function(principal, ...rest) {
    // The chrome global in the content process.
    let chromeGlobal = principal
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIWebNavigation)
      .QueryInterface(Ci.nsIDocShellTreeItem)
      .rootTreeItem
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIContentFrameMessageManager);

    // Make a sandbox in the child.
    let cu = chromeGlobal.Components.utils;
    let sandbox = cu.Sandbox(principal, ...rest);

    // We need to save the sandbox in the child so it won't get
    // GCed. The child will drop this reference at the next
    // navigation.
    chromeGlobal.addSandbox(sandbox);

    // The sandbox CPOW will be kept alive by whomever we return it
    // to. Its lifetime is unrelated to that of the sandbox object in
    // the child.
    this.componentsMap.set(sandbox, cu);
    return sandbox;
  },

  evalInSandbox: function(code, sandbox, ...rest) {
    let cu = this.componentsMap.get(sandbox);
    return cu.evalInSandbox(code, sandbox, ...rest);
  }
};

// This interposition redirects calls to Cu.Sandbox and
// Cu.evalInSandbox to SandboxParent if the principals are content
// principals.
let ComponentsUtilsInterposition = new Interposition();

ComponentsUtilsInterposition.methods.Sandbox =
  function(addon, target, principal, ...rest) {
    if (principal &&
        typeof(principal) == "object" &&
        Cu.isCrossProcessWrapper(principal) &&
        principal instanceof Ci.nsIDOMWindow) {
      return SandboxParent.makeContentSandbox(principal, ...rest);
    } else {
      return Components.utils.Sandbox(principal, ...rest);
    }
  };

ComponentsUtilsInterposition.methods.evalInSandbox =
  function(addon, target, code, sandbox, ...rest) {
    if (sandbox && Cu.isCrossProcessWrapper(sandbox)) {
      return SandboxParent.evalInSandbox(code, sandbox, ...rest);
    } else {
      return Components.utils.evalInSandbox(code, sandbox, ...rest);
    }
  };

// This interposition handles cases where an add-on tries to import a
// chrome XUL node into a content document. It doesn't actually do the
// import, which we can't support. It just avoids throwing an
// exception.
let ContentDocumentInterposition = new Interposition();

ContentDocumentInterposition.methods.importNode =
  function(addon, target, node, deep) {
    if (!Cu.isCrossProcessWrapper(node)) {
      // Trying to import a node from the parent process into the
      // child process. We don't support this now. Video Download
      // Helper does this in domhook-service.js to add a XUL
      // popupmenu to content.
      Cu.reportError("Calling contentDocument.importNode on a XUL node is not allowed.");
      return node;
    }

    return target.importNode(node, deep);
  };

// This interposition ensures that calling browser.docShell from an
// add-on returns a CPOW around the dochell.
let RemoteBrowserElementInterposition = new Interposition(EventTargetInterposition);

RemoteBrowserElementInterposition.getters.docShell = function(addon, target) {
  let remoteChromeGlobal = RemoteAddonsParent.browserToGlobal.get(target);
  if (!remoteChromeGlobal) {
    // We may not have any messages from this tab yet.
    return null;
  }
  return remoteChromeGlobal.docShell;
};

let RemoteAddonsParent = {
  init: function() {
    let mm = Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIMessageListenerManager);
    mm.addMessageListener("Addons:RegisterGlobal", this);

    this.globalToBrowser = new WeakMap();
    this.browserToGlobal = new WeakMap();
  },

  getInterfaceInterpositions: function() {
    let result = {};

    function register(intf, interp) {
      result[intf.number] = interp;
    }

    register(Ci.nsICategoryManager, CategoryManagerInterposition);
    register(Ci.nsIComponentRegistrar, ComponentRegistrarInterposition);
    register(Ci.nsIObserverService, ObserverInterposition);
    register(Ci.nsIXPCComponents_Utils, ComponentsUtilsInterposition);

    return result;
  },

  getTaggedInterpositions: function() {
    let result = {};

    function register(tag, interp) {
      result[tag] = interp;
    }

    register("EventTarget", EventTargetInterposition);
    register("ContentDocShellTreeItem", ContentDocShellTreeItemInterposition);
    register("ContentDocument", ContentDocumentInterposition);
    register("RemoteBrowserElement", RemoteBrowserElementInterposition);

    return result;
  },

  receiveMessage: function(msg) {
    switch (msg.name) {
    case "Addons:RegisterGlobal":
      this.browserToGlobal.set(msg.target, msg.objects.global);
      this.globalToBrowser.set(msg.objects.global, msg.target);
      break;
    }
  }
};
