/*
 *  Copyright (c) 2012 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree. An additional intellectual property rights grant can be found
 *  in the file PATENTS.  All contributing project authors may
 *  be found in the AUTHORS file in the root of the source tree.
 */

#include "webrtc/modules/rtp_rtcp/source/rtp_receiver_video.h"

#include <assert.h>
#include <string.h>

#ifdef WIN32
#include <winsock2.h>
#else
#include <arpa/inet.h>
#endif

#include "webrtc/modules/rtp_rtcp/interface/rtp_payload_registry.h"
#include "webrtc/modules/rtp_rtcp/source/rtp_format_video_generic.h"
#include "webrtc/modules/rtp_rtcp/source/rtp_format_h264.h"
#include "webrtc/modules/rtp_rtcp/source/rtp_utility.h"
#include "webrtc/system_wrappers/interface/critical_section_wrapper.h"
#include "webrtc/system_wrappers/interface/trace.h"
#include "webrtc/system_wrappers/interface/trace_event.h"

namespace webrtc {

RTPReceiverStrategy* RTPReceiverStrategy::CreateVideoStrategy(
    int32_t id, RtpData* data_callback) {
  return new RTPReceiverVideo(id, data_callback);
}

RTPReceiverVideo::RTPReceiverVideo(int32_t id, RtpData* data_callback)
    : RTPReceiverStrategy(data_callback),
      id_(id) {}

RTPReceiverVideo::~RTPReceiverVideo() {
}

bool RTPReceiverVideo::ShouldReportCsrcChanges(
    uint8_t payload_type) const {
  // Always do this for video packets.
  return true;
}

int32_t RTPReceiverVideo::OnNewPayloadTypeCreated(
    const char payload_name[RTP_PAYLOAD_NAME_SIZE],
    int8_t payload_type,
    uint32_t frequency) {
  return 0;
}

int32_t RTPReceiverVideo::ParseRtpPacket(
    WebRtcRTPHeader* rtp_header,
    const PayloadUnion& specific_payload,
    bool is_red,
    const uint8_t* payload,
    uint16_t payload_length,
    int64_t timestamp_ms,
    bool is_first_packet) {
  TRACE_EVENT2("webrtc_rtp", "Video::ParseRtp",
               "seqnum", rtp_header->header.sequenceNumber,
               "timestamp", rtp_header->header.timestamp);
  rtp_header->type.Video.codec = specific_payload.Video.videoCodecType;

  const uint16_t payload_data_length =
      payload_length - rtp_header->header.paddingLength;

  if (payload_data_length == 0)
    return data_callback_->OnReceivedPayloadData(NULL, 0, rtp_header) == 0 ? 0
                                                                           : -1;

  return ParseVideoCodecSpecific(rtp_header,
                                 payload,
                                 payload_data_length,
                                 specific_payload.Video.videoCodecType,
                                 timestamp_ms,
                                 is_first_packet);
}

int RTPReceiverVideo::GetPayloadTypeFrequency() const {
  return kVideoPayloadTypeFrequency;
}

RTPAliveType RTPReceiverVideo::ProcessDeadOrAlive(
    uint16_t last_payload_length) const {
  return kRtpDead;
}

int32_t RTPReceiverVideo::InvokeOnInitializeDecoder(
    RtpFeedback* callback,
    int32_t id,
    int8_t payload_type,
    const char payload_name[RTP_PAYLOAD_NAME_SIZE],
    const PayloadUnion& specific_payload) const {
  // For video we just go with default values.
  if (-1 == callback->OnInitializeDecoder(
      id, payload_type, payload_name, kVideoPayloadTypeFrequency, 1, 0)) {
    WEBRTC_TRACE(kTraceError,
                 kTraceRtpRtcp,
                 id,
                 "Failed to create video decoder for payload type:%d",
                 payload_type);
    return -1;
  }
  return 0;
}

// We are not allowed to hold a critical section when calling this function.
int32_t RTPReceiverVideo::ParseVideoCodecSpecific(
    WebRtcRTPHeader* rtp_header,
    const uint8_t* payload_data,
    uint16_t payload_data_length,
    RtpVideoCodecTypes video_type,
    int64_t now_ms,
    bool is_first_packet) {
  WEBRTC_TRACE(kTraceStream,
               kTraceRtpRtcp,
               id_,
               "%s(timestamp:%u)",
               __FUNCTION__,
               rtp_header->header.timestamp);

  rtp_header->type.Video.isFirstPacket = is_first_packet;
  switch (rtp_header->type.Video.codec) {
    case kRtpVideoGeneric:
      return ReceiveGenericCodec(rtp_header, payload_data, payload_data_length);
    case kRtpVideoVp8:
      return ReceiveVp8Codec(rtp_header, payload_data, payload_data_length);
    case kRtpVideoH264:
      return ReceiveH264Codec(rtp_header, payload_data, payload_data_length);
    case kRtpVideoNone:
      break;
  }
  return -1;
}

int32_t RTPReceiverVideo::BuildRTPheader(
    const WebRtcRTPHeader* rtp_header,
    uint8_t* data_buffer) const {
  data_buffer[0] = static_cast<uint8_t>(0x80);  // version 2
  data_buffer[1] = static_cast<uint8_t>(rtp_header->header.payloadType);
  if (rtp_header->header.markerBit) {
    data_buffer[1] |= kRtpMarkerBitMask;  // MarkerBit is 1
  }
  ModuleRTPUtility::AssignUWord16ToBuffer(data_buffer + 2,
                                          rtp_header->header.sequenceNumber);
  ModuleRTPUtility::AssignUWord32ToBuffer(data_buffer + 4,
                                          rtp_header->header.timestamp);
  ModuleRTPUtility::AssignUWord32ToBuffer(data_buffer + 8,
                                          rtp_header->header.ssrc);

  int32_t rtp_header_length = 12;

  // Add the CSRCs if any
  if (rtp_header->header.numCSRCs > 0) {
    if (rtp_header->header.numCSRCs > 16) {
      // error
      assert(false);
    }
    uint8_t* ptr = &data_buffer[rtp_header_length];
    for (uint32_t i = 0; i < rtp_header->header.numCSRCs; ++i) {
      ModuleRTPUtility::AssignUWord32ToBuffer(ptr,
                                              rtp_header->header.arrOfCSRCs[i]);
      ptr += 4;
    }
    data_buffer[0] = (data_buffer[0] & 0xf0) | rtp_header->header.numCSRCs;
    // Update length of header
    rtp_header_length += sizeof(uint32_t) * rtp_header->header.numCSRCs;
  }
  return rtp_header_length;
}

int32_t RTPReceiverVideo::ReceiveVp8Codec(WebRtcRTPHeader* rtp_header,
                                          const uint8_t* payload_data,
                                          uint16_t payload_data_length) {
  ModuleRTPUtility::RTPPayload parsed_packet;
  uint32_t id;
  {
    CriticalSectionScoped cs(crit_sect_.get());
    id = id_;
  }
  ModuleRTPUtility::RTPPayloadParser rtp_payload_parser(
      kRtpVideoVp8, payload_data, payload_data_length, id);

  if (!rtp_payload_parser.Parse(parsed_packet))
    return -1;

  if (parsed_packet.info.VP8.dataLength == 0)
    return 0;

  rtp_header->frameType = (parsed_packet.frameType == ModuleRTPUtility::kIFrame)
      ? kVideoFrameKey : kVideoFrameDelta;

  RTPVideoHeaderVP8* to_header = &rtp_header->type.Video.codecHeader.VP8;
  ModuleRTPUtility::RTPPayloadVP8* from_header = &parsed_packet.info.VP8;

  rtp_header->type.Video.isFirstPacket =
      from_header->beginningOfPartition && (from_header->partitionID == 0);
  to_header->nonReference = from_header->nonReferenceFrame;
  to_header->pictureId =
      from_header->hasPictureID ? from_header->pictureID : kNoPictureId;
  to_header->tl0PicIdx =
      from_header->hasTl0PicIdx ? from_header->tl0PicIdx : kNoTl0PicIdx;
  if (from_header->hasTID) {
    to_header->temporalIdx = from_header->tID;
    to_header->layerSync = from_header->layerSync;
  } else {
    to_header->temporalIdx = kNoTemporalIdx;
    to_header->layerSync = false;
  }
  to_header->keyIdx = from_header->hasKeyIdx ? from_header->keyIdx : kNoKeyIdx;

  rtp_header->type.Video.width = from_header->frameWidth;
  rtp_header->type.Video.height = from_header->frameHeight;

  to_header->partitionId = from_header->partitionID;
  to_header->beginningOfPartition = from_header->beginningOfPartition;

  if (data_callback_->OnReceivedPayloadData(parsed_packet.info.VP8.data,
                                            parsed_packet.info.VP8.dataLength,
                                            rtp_header) != 0) {
    return -1;
  }
  return 0;
}

int32_t RTPReceiverVideo::ReceiveH264Codec(WebRtcRTPHeader* rtp_header,
                                          const uint8_t* payload_data,
                                          uint16_t payload_data_length) {
  size_t offset = RtpFormatH264::kNalHeaderOffset;
  uint8_t nal_type = payload_data[offset] & RtpFormatH264::kTypeMask;
  rtp_header->type.Video.codecHeader.H264.nalu_header = nal_type;
  // For H.264, isFirstPacket means first in NAL unit, not first in the
  // timestamp, which elsewhere is referred to as a 'frame' or 'session'
  rtp_header->type.Video.isFirstPacket = true;
  // get original NAL type if FU-A or STAP-A
  switch (nal_type) {
    case RtpFormatH264::kFuA:
      offset = RtpFormatH264::kFuAHeaderOffset;
      if (offset >= payload_data_length) {
        return -1; // malformed
      }
      nal_type = payload_data[offset] & RtpFormatH264::kTypeMask;
      if (!(payload_data[offset] & RtpFormatH264::kFragStartBit)) {
        rtp_header->type.Video.isFirstPacket = false;
      }
      break;
    case RtpFormatH264::kStapA:
      offset = RtpFormatH264::kStapAHeaderOffset +
               RtpFormatH264::kAggUnitLengthSize;
      if (offset >= payload_data_length) {
        return -1; // malformed
      }
      nal_type = payload_data[offset] & RtpFormatH264::kTypeMask;
      break;
    default:
      break;
  }
  // key frames start with SPS, PPS, IDR, or Recovery Point SEI
  // Recovery Point SEI's are used in AIR and GDR refreshes, which don't
  // send large iframes, and instead use forms of incremental/continuous refresh.
  rtp_header->frameType = kVideoFrameDelta;
  switch (nal_type) {
    case RtpFormatH264::kSei: // check if it is a Recovery Point SEI (aka GDR)
      if (offset+1 >= payload_data_length) {
        return -1; // malformed
      }
      if (payload_data[offset+1] != RtpFormatH264::kSeiRecPt) {
        break; // some other form of SEI - not a keyframe
      }
      // else fall through since GDR is like IDR
    case RtpFormatH264::kSps:
    case RtpFormatH264::kPps:
    case RtpFormatH264::kIdr:
      rtp_header->frameType = kVideoFrameKey;
      break;
    default:
      break;
  }
#if 0
  // XXX This check (which is complex to implement) would verify if a NAL
  // codes the first MB in the frame ("access unit").  See 7.4.1.2.4 in the
  // 2003 draft H.264 spec for an algorithm for this, which requires
  // considerable parsing of the stream.  Even simpler variants are
  // complex. Since mis-identification of complete KeyFrames doesn't have
  // to be 100% correct for "fast-forward" in error recovery, we can let it
  // consider *any* NAL that's not a non-start FU-A packet to be a possible
  // first-in-frame/session/"access unit" with minimal impact.  In some
  // cases of leading loss, it might try to fast-forward to a "session"
  // that's missing an SPS/PPS or missing the first NAL of a Mode 0 frame.
  // This should be ok, even though the decode *might* fail.

  // Check if this NAL codes for pixels *and* is the first NAL of a frame
  // Would fail for FMO/ASO, which aren't allowed in baseline
  if (nal_type == RtpFormatH264::kIdr || nal_type == RtpFormatH264::kIpb) {
    // TODO; see 7.4.1.2.4  Detection of the first VCL NAL unit of a primary coded picture
  }
#endif
  // receive payloads as-is, depacketize later when moving to frame buffer
  if (data_callback_->OnReceivedPayloadData(
      payload_data, payload_data_length, rtp_header) != 0) {
    return -1;
  }
  return 0;
}

int32_t RTPReceiverVideo::ReceiveGenericCodec(
    WebRtcRTPHeader* rtp_header,
    const uint8_t* payload_data,
    uint16_t payload_data_length) {
  uint8_t generic_header = *payload_data++;
  --payload_data_length;

  rtp_header->frameType =
      ((generic_header & RtpFormatVideoGeneric::kKeyFrameBit) != 0) ?
      kVideoFrameKey : kVideoFrameDelta;
  rtp_header->type.Video.isFirstPacket =
      (generic_header & RtpFormatVideoGeneric::kFirstPacketBit) != 0;

  if (data_callback_->OnReceivedPayloadData(
          payload_data, payload_data_length, rtp_header) != 0) {
    return -1;
  }
  return 0;
}
}  // namespace webrtc
