/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

MARIONETTE_TIMEOUT = 30000;
MARIONETTE_HEAD_JS = 'head.js';

let MANIFEST_URL = "app://system.gaiamobile.org/manifest.webapp";
let INCORRECT_MANIFEST_URL = "app://xyz.gaiamobile.org/manifest.webapp";

function peerReadyCb(evt) {
  log("peerReadyCb called");
  let peer = nfc.getNFCPeer(evt.detail);
  ok(peer instanceof MozNFCPeer, "Should get a NFCPeer object.");

  // reset callback.
  nfc.onpeerready = null;
  NCI.deactivate();
}

function peerLostCb() {
  log("peerLostCb called");
  ok(true);
  nfc.onpeerlost = null;
  toggleNFC(false).then(runNextTest);
}

function handleTechnologyDiscoveredRE0(msg) {
  log("Received \'nfc-manager-tech-discovered\'");
  is(msg.type, "techDiscovered", "check for correct message type");
  is(msg.techList[0], "P2P", "check for correct tech type");

  nfc.onpeerready = peerReadyCb;
  nfc.onpeerlost = peerLostCb;

  let request = nfc.checkP2PRegistration(MANIFEST_URL);
  request.onsuccess = function (evt) {
    is(request.result, true, "check for P2P registration result");
    nfc.notifyUserAcceptedP2P(MANIFEST_URL);
  }

  request.onerror = function () {
    ok(false, "checkP2PRegistration failed.");
    toggleNFC(false).then(runNextTest);
  }
}

function handleTechnologyDiscoveredRE0ForP2PRegFailure(msg) {
  log("Received \'nfc-manager-tech-discovered\'");
  is(msg.type, "techDiscovered", "check for correct message type");
  is(msg.techList[0], "P2P", "check for correct tech type");

  nfc.onpeerready = peerReadyCb;

  let request = nfc.checkP2PRegistration(INCORRECT_MANIFEST_URL);
  request.onsuccess = function (evt) {
    is(request.result, false, "check for P2P registration result");

    nfc.onpeerready = null;
    toggleNFC(false).then(runNextTest);
  }

  request.onerror = function () {
    ok(false, "checkP2PRegistration failed.");

    nfc.onpeerready = null;
    toggleNFC(false).then(runNextTest);
  }
}

function testPeerReady() {
  window.navigator.mozSetMessageHandler(
    "nfc-manager-tech-discovered", handleTechnologyDiscoveredRE0);

  toggleNFC(true).then(() => NCI.activateRE(emulator.P2P_RE_INDEX_0));
}

function testCheckP2PRegFailure() {
  window.navigator.mozSetMessageHandler(
    "nfc-manager-tech-discovered", handleTechnologyDiscoveredRE0ForP2PRegFailure);

  toggleNFC(true).then(() => NCI.activateRE(emulator.P2P_RE_INDEX_0));
}

function testCheckNfcPeerObjForInvalidToken() {
  try {
    // Use a'fakeSessionToken'
    let peer = nfc.getNFCPeer("fakeSessionToken");
    ok(false, "Should not get a NFCPeer object.");
  } catch (ex) {
    ok(true, "Exception expected");
  }

  toggleNFC(false).then(runNextTest);
}

let tests = [
  testPeerReady,
  testCheckP2PRegFailure,
  testCheckNfcPeerObjForInvalidToken
];

SpecialPowers.pushPermissions(
  [{"type": "nfc-manager", "allow": true, context: document},
   {"type": "nfc-write", "allow": true, context: document}], runTests);
