/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

XPCOMUtils.defineLazyModuleGetter(this, "Promise",
  "resource://gre/modules/Promise.jsm");

function whenNewWindowLoaded(aOptions, aCallback) {
  let win = OpenBrowserWindow(aOptions);
  let gotLoad = false;
  let gotActivate = Services.focus.activeWindow == win;

  function maybeRunCallback() {
    if (gotLoad && gotActivate) {
      executeSoon(function() { aCallback(win); });
    }
  }

  if (!gotActivate) {
    win.addEventListener("activate", function onActivate() {
      info("Got activate.");
      win.removeEventListener("activate", onActivate, false);
      gotActivate = true;
      maybeRunCallback();
    }, false);
  } else {
    info("Was activated.");
  }

  Services.obs.addObserver(function observer(aSubject, aTopic) {
    if (win == aSubject) {
      info("Delayed startup finished");
      Services.obs.removeObserver(observer, aTopic);
      gotLoad = true;
      maybeRunCallback();
    }
  }, "browser-delayed-startup-finished", false);

  return win;
}

/**
 * Recursively compare two objects and check that every property of expectedObj has the same value
 * on actualObj.
 */
function isSubObjectOf(expectedObj, actualObj, name) {
  for (let prop in expectedObj) {
    if (typeof expectedObj[prop] == 'function')
      continue;
    if (expectedObj[prop] instanceof Object) {
      is(actualObj[prop].length, expectedObj[prop].length, name + "[" + prop + "]");
      isSubObjectOf(expectedObj[prop], actualObj[prop], name + "[" + prop + "]");
    } else {
      is(actualObj[prop], expectedObj[prop], name + "[" + prop + "]");
    }
  }
}

function getLocale() {
  const localePref = "general.useragent.locale";
  return getLocalizedPref(localePref, Services.prefs.getCharPref(localePref));
}

/**
 * Wrapper for nsIPrefBranch::getComplexValue.
 * @param aPrefName
 *        The name of the pref to get.
 * @returns aDefault if the requested pref doesn't exist.
 */
function getLocalizedPref(aPrefName, aDefault) {
  try {
    return Services.prefs.getComplexValue(aPrefName, Ci.nsIPrefLocalizedString).data;
  } catch (ex) {
    return aDefault;
  }

  return aDefault;
}

function waitForPopupShown(aPopupId, aCallback) {
  let popup = document.getElementById(aPopupId);
  info("waitForPopupShown: got popup: " + popup.id);
  function onPopupShown() {
    info("onPopupShown");
    removePopupShownListener();
    SimpleTest.executeSoon(aCallback);
  }
  function removePopupShownListener() {
    popup.removeEventListener("popupshown", onPopupShown);
  }
  popup.addEventListener("popupshown", onPopupShown);
  registerCleanupFunction(removePopupShownListener);
}

function* promiseEvent(aTarget, aEventName, aPreventDefault) {
  let deferred = Promise.defer();
  aTarget.addEventListener(aEventName, function onEvent(aEvent) {
    aTarget.removeEventListener(aEventName, onEvent, true);
    if (aPreventDefault) {
      aEvent.preventDefault();
    }
    deferred.resolve();
  }, true);
  return deferred.promise;
}

function waitForBrowserContextMenu(aCallback) {
  waitForPopupShown(gBrowser.selectedBrowser.contextMenu, aCallback);
}

function doOnloadOnce(aCallback) {
  function doOnloadOnceListener(aEvent) {
    info("doOnloadOnce: " + aEvent.originalTarget.location);
    removeDoOnloadOnceListener();
    SimpleTest.executeSoon(function doOnloadOnceCallback() {
      aCallback(aEvent);
    });
  }
  function removeDoOnloadOnceListener() {
    gBrowser.removeEventListener("load", doOnloadOnceListener, true);
  }
  gBrowser.addEventListener("load", doOnloadOnceListener, true);
  registerCleanupFunction(removeDoOnloadOnceListener);
}

function* promiseOnLoad() {
  let deferred = Promise.defer();

  gBrowser.addEventListener("load", function onLoadListener(aEvent) {
    info("onLoadListener: " + aEvent.originalTarget.location);
    gBrowser.removeEventListener("load", onLoadListener, true);
    deferred.resolve(aEvent);
  }, true);

  return deferred.promise;
}

