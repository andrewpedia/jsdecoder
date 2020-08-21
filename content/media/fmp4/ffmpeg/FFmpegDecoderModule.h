/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et cindent: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __FFmpegDecoderModule_h__
#define __FFmpegDecoderModule_h__

#include "PlatformDecoderModule.h"
#include "FFmpegAACDecoder.h"
#include "FFmpegH264Decoder.h"

namespace mozilla
{

template <int V>
class FFmpegDecoderModule : public PlatformDecoderModule
{
public:
  static PlatformDecoderModule* Create() { return new FFmpegDecoderModule(); }

  FFmpegDecoderModule() {}
  virtual ~FFmpegDecoderModule() {}

  virtual nsresult Shutdown() MOZ_OVERRIDE { return NS_OK; }

  virtual MediaDataDecoder* CreateH264Decoder(
    const mp4_demuxer::VideoDecoderConfig& aConfig,
    mozilla::layers::LayersBackend aLayersBackend,
    mozilla::layers::ImageContainer* aImageContainer,
    MediaTaskQueue* aVideoTaskQueue, MediaDataDecoderCallback* aCallback)
    MOZ_OVERRIDE
  {
    return new FFmpegH264Decoder<V>(aVideoTaskQueue, aCallback, aConfig,
                                    aImageContainer);
  }

  virtual MediaDataDecoder* CreateAACDecoder(
    const mp4_demuxer::AudioDecoderConfig& aConfig,
    MediaTaskQueue* aAudioTaskQueue, MediaDataDecoderCallback* aCallback)
    MOZ_OVERRIDE
  {
    return new FFmpegAACDecoder<V>(aAudioTaskQueue, aCallback, aConfig);
  }
};

} // namespace mozilla

#endif // __FFmpegDecoderModule_h__
