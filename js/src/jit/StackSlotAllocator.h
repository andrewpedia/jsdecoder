/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set ts=8 sts=4 et sw=4 tw=99:
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef jit_StackSlotAllocator_h
#define jit_StackSlotAllocator_h

#include "jit/Registers.h"

namespace js {
namespace jit {

class StackSlotAllocator
{
    js::Vector<uint32_t, 4, SystemAllocPolicy> normalSlots;
    js::Vector<uint32_t, 4, SystemAllocPolicy> doubleSlots;
    uint32_t height_;

    void freeSlot(uint32_t index) {
        normalSlots.append(index);
    }
    void freeDoubleSlot(uint32_t index) {
        doubleSlots.append(index);
    }

    uint32_t allocateDoubleSlot() {
        if (!doubleSlots.empty())
            return doubleSlots.popCopy();
        if (height_ % 8 != 0)
            normalSlots.append(height_ += 4);
        return height_ += 8;
    }
    uint32_t allocateSlot() {
        if (!normalSlots.empty())
            return normalSlots.popCopy();
        if (!doubleSlots.empty()) {
            uint32_t index = doubleSlots.popCopy();
            normalSlots.append(index - 4);
            return index;
        }
        return height_ += 4;
    }

  public:
    StackSlotAllocator() : height_(0)
    { }

    void freeSlot(LDefinition::Type type, uint32_t index) {
        switch (type) {
#if JS_BITS_PER_WORD == 32
          case LDefinition::GENERAL:
          case LDefinition::OBJECT:
          case LDefinition::SLOTS:
#endif
          case LDefinition::INT32:
          case LDefinition::FLOAT32: return freeSlot(index);
#if JS_BITS_PER_WORD == 64
          case LDefinition::GENERAL:
          case LDefinition::OBJECT:
          case LDefinition::SLOTS:
#endif
#ifdef JS_PUNBOX64
          case LDefinition::BOX:
#endif
#ifdef JS_NUNBOX32
          case LDefinition::TYPE:
          case LDefinition::PAYLOAD:
#endif
          case LDefinition::DOUBLE:  return freeDoubleSlot(index);
          default: MOZ_ASSUME_UNREACHABLE("Unknown slot type");
        }
    }

    uint32_t allocateSlot(LDefinition::Type type) {
        switch (type) {
#if JS_BITS_PER_WORD == 32
          case LDefinition::GENERAL:
          case LDefinition::OBJECT:
          case LDefinition::SLOTS:
#endif
          case LDefinition::INT32:
          case LDefinition::FLOAT32: return allocateSlot();
#if JS_BITS_PER_WORD == 64
          case LDefinition::GENERAL:
          case LDefinition::OBJECT:
          case LDefinition::SLOTS:
#endif
#ifdef JS_PUNBOX64
          case LDefinition::BOX:
#endif
#ifdef JS_NUNBOX32
          case LDefinition::TYPE:
          case LDefinition::PAYLOAD:
#endif
          case LDefinition::DOUBLE:  return allocateDoubleSlot();
          default: MOZ_ASSUME_UNREACHABLE("Unknown slot type");
        }
    }

    uint32_t stackHeight() const {
        return height_;
    }
};

} // namespace jit
} // namespace js

#endif /* jit_StackSlotAllocator_h */
