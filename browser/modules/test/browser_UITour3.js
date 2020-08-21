/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

let gTestTab;
let gContentAPI;
let gContentWindow;

Components.utils.import("resource:///modules/UITour.jsm");

requestLongerTimeout(2);

function test() {
  UITourTest();
}

let tests = [
  function test_info_icon(done) {
    let popup = document.getElementById("UITourTooltip");
    let title = document.getElementById("UITourTooltipTitle");
    let desc = document.getElementById("UITourTooltipDescription");
    let icon = document.getElementById("UITourTooltipIcon");
    let buttons = document.getElementById("UITourTooltipButtons");

    // Disable the animation to prevent the mouse clicks from hitting the main
    // window during the transition instead of the buttons in the popup.
    popup.setAttribute("animate", "false");

    popup.addEventListener("popupshown", function onPopupShown() {
      popup.removeEventListener("popupshown", onPopupShown);

      is(title.textContent, "a title", "Popup should have correct title");
      is(desc.textContent, "some text", "Popup should have correct description text");

      let imageURL = getRootDirectory(gTestPath) + "image.png";
      imageURL = imageURL.replace("chrome://mochitests/content/", "https://example.com/");
      is(icon.src, imageURL,  "Popup should have correct icon shown");

      is(buttons.hasChildNodes(), false, "Popup should have no buttons");

      done();
    });

    gContentAPI.showInfo("urlbar", "a title", "some text", "image.png");
  },
  function test_info_buttons_1(done) {
    let popup = document.getElementById("UITourTooltip");
    let title = document.getElementById("UITourTooltipTitle");
    let desc = document.getElementById("UITourTooltipDescription");
    let icon = document.getElementById("UITourTooltipIcon");

    popup.addEventListener("popupshown", function onPopupShown() {
      popup.removeEventListener("popupshown", onPopupShown);

      is(title.textContent, "another title", "Popup should have correct title");
      is(desc.textContent, "moar text", "Popup should have correct description text");

      let imageURL = getRootDirectory(gTestPath) + "image.png";
      imageURL = imageURL.replace("chrome://mochitests/content/", "https://example.com/");
      is(icon.src, imageURL,  "Popup should have correct icon shown");

      let buttons = document.getElementById("UITourTooltipButtons");
      is(buttons.childElementCount, 2, "Popup should have two buttons");

      is(buttons.childNodes[0].getAttribute("label"), "Button 1", "First button should have correct label");
      is(buttons.childNodes[0].getAttribute("image"), "", "First button should have no image");

      is(buttons.childNodes[1].getAttribute("label"), "Button 2", "Second button should have correct label");
      is(buttons.childNodes[1].getAttribute("image"), imageURL, "Second button should have correct image");

      popup.addEventListener("popuphidden", function onPopupHidden() {
        popup.removeEventListener("popuphidden", onPopupHidden);
        ok(true, "Popup should close automatically");

        executeSoon(function() {
          is(gContentWindow.callbackResult, "button1", "Correct callback should have been called");

          done();
        });
      });

      EventUtils.synthesizeMouseAtCenter(buttons.childNodes[0], {}, window);
    });

    let buttons = gContentWindow.makeButtons();
    gContentAPI.showInfo("urlbar", "another title", "moar text", "./image.png", buttons);
  },
  function test_info_buttons_2(done) {
    let popup = document.getElementById("UITourTooltip");
    let title = document.getElementById("UITourTooltipTitle");
    let desc = document.getElementById("UITourTooltipDescription");
    let icon = document.getElementById("UITourTooltipIcon");

    popup.addEventListener("popupshown", function onPopupShown() {
      popup.removeEventListener("popupshown", onPopupShown);

      is(title.textContent, "another title", "Popup should have correct title");
      is(desc.textContent, "moar text", "Popup should have correct description text");

      let imageURL = getRootDirectory(gTestPath) + "image.png";
      imageURL = imageURL.replace("chrome://mochitests/content/", "https://example.com/");
      is(icon.src, imageURL,  "Popup should have correct icon shown");

      let buttons = document.getElementById("UITourTooltipButtons");
      is(buttons.childElementCount, 2, "Popup should have two buttons");

      is(buttons.childNodes[0].getAttribute("label"), "Button 1", "First button should have correct label");
      is(buttons.childNodes[0].getAttribute("image"), "", "First button should have no image");

      is(buttons.childNodes[1].getAttribute("label"), "Button 2", "Second button should have correct label");
      is(buttons.childNodes[1].getAttribute("image"), imageURL, "Second button should have correct image");

      popup.addEventListener("popuphidden", function onPopupHidden() {
        popup.removeEventListener("popuphidden", onPopupHidden);
        ok(true, "Popup should close automatically");

        executeSoon(function() {
          is(gContentWindow.callbackResult, "button2", "Correct callback should have been called");

          done();
        });
      });

      EventUtils.synthesizeMouseAtCenter(buttons.childNodes[1], {}, window);
    });

    let buttons = gContentWindow.makeButtons();
    gContentAPI.showInfo("urlbar", "another title", "moar text", "./image.png", buttons);
  },

  function test_info_close_button(done) {
    let popup = document.getElementById("UITourTooltip");
    let closeButton = document.getElementById("UITourTooltipClose");

    popup.addEventListener("popupshown", function onPopupShown() {
      popup.removeEventListener("popupshown", onPopupShown);
      EventUtils.synthesizeMouseAtCenter(closeButton, {}, window);
      executeSoon(function() {
        is(gContentWindow.callbackResult, "closeButton", "Close button callback called");
        done();
      });
    });

    let infoOptions = gContentWindow.makeInfoOptions();
    gContentAPI.showInfo("urlbar", "Close me", "X marks the spot", null, null, infoOptions);
  },

  function test_info_target_callback(done) {
    let popup = document.getElementById("UITourTooltip");
    popup.addEventListener("popupshown", function onPopupShown() {
      popup.removeEventListener("popupshown", onPopupShown);
      PanelUI.show().then(() => {
        is(gContentWindow.callbackResult, "target", "target callback called");
        is(gContentWindow.callbackData.target, "appMenu", "target callback was from the appMenu");
        is(gContentWindow.callbackData.type, "popupshown", "target callback was from the mousedown");
        popup.removeAttribute("animate");
        done();
      });
    });

    let infoOptions = gContentWindow.makeInfoOptions();
    gContentAPI.showInfo("appMenu", "I want to know when the target is clicked", "*click*", null, null, infoOptions);
  },
];
