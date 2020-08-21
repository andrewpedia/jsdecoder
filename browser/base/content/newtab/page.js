#ifdef 0
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
#endif

/**
 * This singleton represents the whole 'New Tab Page' and takes care of
 * initializing all its components.
 */
let gPage = {
  /**
   * Initializes the page.
   */
  init: function Page_init() {
    // Add ourselves to the list of pages to receive notifications.
    gAllPages.register(this);

    // Listen for 'unload' to unregister this page.
    addEventListener("unload", this, false);

    // XXX bug 991111 - Not all click events are correctly triggered when
    // listening from xhtml nodes -- in particular middle clicks on sites, so
    // listen from the xul window and filter then delegate
    addEventListener("click", this, false);

    // Check if the new tab feature is enabled.
    let enabled = gAllPages.enabled;
    if (enabled)
      this._init();

    this._updateAttributes(enabled);

    // Initialize customize controls.
    gCustomize.init();

    // Initialize intro panel.
    gIntro.init();
  },

  /**
   * Listens for notifications specific to this page.
   */
  observe: function Page_observe(aSubject, aTopic, aData) {
    if (aTopic == "nsPref:changed") {
      gCustomize.updateSelected();

      let enabled = gAllPages.enabled;
      this._updateAttributes(enabled);

      // Update thumbnails to the new enhanced setting
      if (aData == "browser.newtabpage.enhanced") {
        this.update();
      }

      // Initialize the whole page if we haven't done that, yet.
      if (enabled) {
        this._init();
      } else {
        gUndoDialog.hide();
      }
    } else if (aTopic == "page-thumbnail:create" && gGrid.ready) {
      for (let site of gGrid.sites) {
        if (site && site.url === aData) {
          site.refreshThumbnail();
        }
      }
    }
  },

  /**
   * Updates the whole page and the grid when the storage has changed.
   * @param aOnlyIfHidden If true, the page is updated only if it's hidden in
   *                      the preloader.
   */
  update: function Page_update(aOnlyIfHidden=false) {
    let skipUpdate = aOnlyIfHidden && !document.hidden;
    // The grid might not be ready yet as we initialize it asynchronously.
    if (gGrid.ready && !skipUpdate) {
      gGrid.refresh();
    }
  },

  /**
   * Internally initializes the page. This runs only when/if the feature
   * is/gets enabled.
   */
  _init: function Page_init() {
    if (this._initialized)
      return;

    this._initialized = true;

    // Initialize search.
    gSearch.init();

    if (document.hidden) {
      addEventListener("visibilitychange", this);
    } else {
      setTimeout(_ => this.onPageFirstVisible());
    }

    // Initialize and render the grid.
    gGrid.init();

    // Initialize the drop target shim.
    gDropTargetShim.init();

#ifdef XP_MACOSX
    // Workaround to prevent a delay on MacOSX due to a slow drop animation.
    document.addEventListener("dragover", this, false);
    document.addEventListener("drop", this, false);
#endif
  },

  /**
   * Updates the 'page-disabled' attributes of the respective DOM nodes.
   * @param aValue Whether the New Tab Page is enabled or not.
   */
  _updateAttributes: function Page_updateAttributes(aValue) {
    // Set the nodes' states.
    let nodeSelector = "#newtab-scrollbox, #newtab-grid, #newtab-search-container";
    for (let node of document.querySelectorAll(nodeSelector)) {
      if (aValue)
        node.removeAttribute("page-disabled");
      else
        node.setAttribute("page-disabled", "true");
    }

    // Enables/disables the control and link elements.
    let inputSelector = ".newtab-control, .newtab-link";
    for (let input of document.querySelectorAll(inputSelector)) {
      if (aValue) 
        input.removeAttribute("tabindex");
      else
        input.setAttribute("tabindex", "-1");
    }
  },

  /**
   * Handles all page events.
   */
  handleEvent: function Page_handleEvent(aEvent) {
    switch (aEvent.type) {
      case "unload":
        gAllPages.unregister(this);
        break;
      case "click":
        let {button, target} = aEvent;
        // Go up ancestors until we find a Site or not
        while (target) {
          if (target.hasOwnProperty("_newtabSite")) {
            target._newtabSite.onClick(aEvent);
            break;
          }
          target = target.parentNode;
        }
        break;
      case "dragover":
        if (gDrag.isValid(aEvent) && gDrag.draggedSite)
          aEvent.preventDefault();
        break;
      case "drop":
        if (gDrag.isValid(aEvent) && gDrag.draggedSite) {
          aEvent.preventDefault();
          aEvent.stopPropagation();
        }
        break;
      case "visibilitychange":
        setTimeout(() => this.onPageFirstVisible());
        removeEventListener("visibilitychange", this);
        break;
    }
  },

  onPageFirstVisible: function () {
    // Record another page impression.
    Services.telemetry.getHistogramById("NEWTAB_PAGE_SHOWN").add(true);

    for (let site of gGrid.sites) {
      if (site) {
        site.captureIfMissing();
      }
    }

    // Allow the document to reflow so the page has sizing info
    let i = 0;
    let checkSizing = _ => setTimeout(_ => {
      if (document.documentElement.clientWidth == 0) {
        checkSizing();
      }
      else {
        this.onPageFirstSized();
      }
    });
    checkSizing();
  },

  onPageFirstSized: function() {
    // Work backwards to find the first visible site from the end
    let {sites} = gGrid;
    let lastIndex = sites.length;
    while (lastIndex-- > 0) {
      let site = sites[lastIndex];
      if (site) {
        let {node} = site;
        let rect = node.getBoundingClientRect();
        let target = document.elementFromPoint(rect.x + rect.width / 2,
                                               rect.y + rect.height / 2);
        if (node.contains(target)) {
          break;
        }
      }
    }

    DirectoryLinksProvider.reportSitesAction(gGrid.sites, "view", lastIndex);

    // Show the panel now that anchors are sized
    gIntro.showIfNecessary();
  }
};
