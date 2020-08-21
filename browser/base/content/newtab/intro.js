#ifdef 0
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
#endif

const PREF_INTRO_SHOWN = "browser.newtabpage.introShown";

let gIntro = {
  _introShown: Services.prefs.getBoolPref(PREF_INTRO_SHOWN),

  _nodeIDSuffixes: [
    "panel",
    "what",
  ],

  _nodes: {},

  init: function() {
    if (!DirectoryLinksProvider.enabled) {
      return;
    }

    for (let idSuffix of this._nodeIDSuffixes) {
      this._nodes[idSuffix] = document.getElementById("newtab-intro-" + idSuffix);
    }

    this._nodes.what.textContent = newTabString("customize.what");

    this._nodes.panel.addEventListener("popupshowing", e => this._setUpPanel());
    this._nodes.what.addEventListener("click", e => this.showPanel());
  },

  showIfNecessary: function() {
    if (!DirectoryLinksProvider.enabled) {
      return;
    }

    if (!this._introShown) {
      Services.prefs.setBoolPref(PREF_INTRO_SHOWN, true);
      this.showPanel();
    }
  },

  showPanel: function() {
    // Point the panel at the 'what' link
    this._nodes.panel.openPopup(this._nodes.what);
  },

  _setUpPanel: function() {
    // Build the panel if necessary
    if (this._nodes.panel.childNodes.length == 0) {
      let h1 = document.createElementNS(HTML_NAMESPACE, "h1");
      this._nodes.panel.appendChild(h1);
      h1.textContent = newTabString("intro.header");

      ['<a href="' + TILES_INTRO_LINK + '">' + newTabString("learn.link") + "</a>",
       '<a href="' + TILES_PRIVACY_LINK + '">' + newTabString("privacy.link") + "</a>",
       '<input type="button" class="newtab-customize"/>',
      ].forEach((arg, index) => {
        let paragraph = document.createElementNS(HTML_NAMESPACE, "p");
        this._nodes.panel.appendChild(paragraph);
        paragraph.innerHTML = newTabString("intro.paragraph" + (index + 1), [arg]);
      });
    }
  },
};
