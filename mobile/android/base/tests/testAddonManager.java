package org.mozilla.gecko.tests;

import org.json.JSONObject;
import org.mozilla.gecko.Actions;

import android.util.DisplayMetrics;

public class testAddonManager extends PixelTest  {
    /* This test will check the behavior of the Addons Manager:
    First the test will open the Addons Manager from the Menu and then close it
    Then the test will open the Addons Manager by visiting about:addons
    The test will tap/click on the addons.mozilla.org icon to open the AMO page in a new tab
    With the Addons Manager open the test will verify that when it is opened again from the menu no new tab will be opened*/

    public void testAddonManager() {
        Actions.EventExpecter tabEventExpecter;
        Actions.EventExpecter contentEventExpecter;
        String url = "about:addons";

        blockForGeckoReady();

        // Use the menu to open the Addon Manger
        selectMenuItem("Add-ons");

        // Set up listeners to catch the page load we're about to do
        tabEventExpecter = mActions.expectGeckoEvent("Tab:Added");
        contentEventExpecter = mActions.expectGeckoEvent("DOMContentLoaded");

        // Wait for the new tab and page to load
        tabEventExpecter.blockForEvent();
        contentEventExpecter.blockForEvent();

        tabEventExpecter.unregisterListener();
        contentEventExpecter.unregisterListener();

        // Verify the url
        verifyPageTitle("Add-ons");

        // Close the Add-on Manager
        mActions.sendSpecialKey(Actions.SpecialKey.BACK);

        // Load the about:addons page and verify it was loaded
        loadAndPaint(url);
        verifyPageTitle("Add-ons");

        // Change the AMO URL so we do not try to navigate to a live webpage
        JSONObject jsonPref = new JSONObject();
        try {
            jsonPref.put("name", "extensions.getAddons.browseAddons");
            jsonPref.put("type", "string");
            jsonPref.put("value", getAbsoluteUrl("/robocop/robocop_blank_01.html"));
            setPreferenceAndWaitForChange(jsonPref);

        } catch (Exception ex) { 
            mAsserter.ok(false, "exception in testAddonManager", ex.toString());
        }

        // Load AMO page by clicking the AMO icon
        DisplayMetrics dm = new DisplayMetrics();
        getActivity().getWindowManager().getDefaultDisplay().getMetrics(dm);

        /* Setup the tap to top value + 25px and right value - 25px.
        Since the AMO icon is 50x50px this values should set the tap
        in the middle of the icon */
        float top = mDriver.getGeckoTop() + 25 * dm.density;;
        float right = mDriver.getGeckoLeft() + mDriver.getGeckoWidth() - 25 * dm.density;;

        // Setup wait for tab to spawn and load
        tabEventExpecter = mActions.expectGeckoEvent("Tab:Added");
        contentEventExpecter = mActions.expectGeckoEvent("DOMContentLoaded");

        // Tap on the AMO icon
        mSolo.clickOnScreen(right, top);

        // Wait for the new tab and page to load
        tabEventExpecter.blockForEvent();
        contentEventExpecter.blockForEvent();

        tabEventExpecter.unregisterListener();
        contentEventExpecter.unregisterListener();

        // Verify tab count has increased
        verifyTabCount(2);

        // Verify the page was opened
        verifyPageTitle("Browser Blank Page 01");

        // Addons Manager is not opened 2 separate times when opened from the menu
        selectMenuItem("Add-ons");        

        // Verify tab count not increased
        verifyTabCount(2);
    }
}
