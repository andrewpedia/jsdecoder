/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "webrtc/modules/desktop_capture/mac/desktop_device_info_mac.h"
#include <Cocoa/Cocoa.h>

namespace webrtc {

#define MULTI_MONITOR_NO_SUPPORT 1

DesktopDeviceInfo * DesktopDeviceInfoImpl::Create() {
  DesktopDeviceInfoMac * pDesktopDeviceInfo = new DesktopDeviceInfoMac();
  if (pDesktopDeviceInfo && pDesktopDeviceInfo->Init() != 0){
    delete pDesktopDeviceInfo;
    pDesktopDeviceInfo = NULL;
  }
  return pDesktopDeviceInfo;
}

DesktopDeviceInfoMac::DesktopDeviceInfoMac() {
}

DesktopDeviceInfoMac::~DesktopDeviceInfoMac() {
}

#if !defined(MULTI_MONITOR_SCREENSHARE)
int32_t DesktopDeviceInfoMac::MultiMonitorScreenshare()
{
  DesktopDisplayDevice *pDesktopDeviceInfo = new DesktopDisplayDevice;
  if (pDesktopDeviceInfo) {
    pDesktopDeviceInfo->setScreenId(CGMainDisplayID());
    pDesktopDeviceInfo->setDeviceName("Primary Monitor");

    char idStr[64];
    snprintf(idStr, sizeof(idStr), "%ld", pDesktopDeviceInfo->getScreenId());
    pDesktopDeviceInfo->setUniqueIdName(idStr);
    desktop_display_list_[pDesktopDeviceInfo->getScreenId()] = pDesktopDeviceInfo;
  }
  return 0;
}
#endif

int32_t DesktopDeviceInfoMac::Init() {
#if !defined(MULTI_MONITOR_SCREENSHARE)
  MultiMonitorScreenshare();
#endif

  initializeWindowList();

  return 0;
}

int32_t DesktopDeviceInfoMac::Refresh() {
#if !defined(MULTI_MONITOR_SCREENSHARE)
  desktop_display_list_.clear();
  MultiMonitorScreenshare();
#endif

  RefreshWindowList();

  return 0;
}

} //namespace webrtc
