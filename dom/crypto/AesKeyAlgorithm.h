/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et cindent: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_dom_AesKeyAlgorithm_h
#define mozilla_dom_AesKeyAlgorithm_h

#include "mozilla/dom/BasicSymmetricKeyAlgorithm.h"
#include "js/TypeDecls.h"

namespace mozilla {
namespace dom {

class AesKeyAlgorithm MOZ_FINAL : public BasicSymmetricKeyAlgorithm
{
public:
  AesKeyAlgorithm(nsIGlobalObject* aGlobal, const nsString& aName, uint16_t aLength)
    : BasicSymmetricKeyAlgorithm(aGlobal, aName, aLength)
  {}

  ~AesKeyAlgorithm()
  {}

  virtual JSObject* WrapObject(JSContext* aCx) MOZ_OVERRIDE;

  virtual nsString ToJwkAlg() const MOZ_OVERRIDE;

  virtual bool WriteStructuredClone(JSStructuredCloneWriter* aWriter) const MOZ_OVERRIDE;
  static KeyAlgorithm* Create(nsIGlobalObject* aGlobal,
                              JSStructuredCloneReader* aReader);
};

} // namespace dom
} // namespace mozilla

#endif // mozilla_dom_AesKeyAlgorithm_h
