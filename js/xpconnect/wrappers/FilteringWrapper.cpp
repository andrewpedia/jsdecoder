/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* vim: set ts=8 sts=4 et sw=4 tw=99: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "FilteringWrapper.h"
#include "AccessCheck.h"
#include "ChromeObjectWrapper.h"
#include "XrayWrapper.h"

#include "jsapi.h"

using namespace JS;
using namespace js;

namespace xpc {

template <typename Base, typename Policy>
FilteringWrapper<Base, Policy>::FilteringWrapper(unsigned flags) : Base(flags)
{
}

template <typename Base, typename Policy>
FilteringWrapper<Base, Policy>::~FilteringWrapper()
{
}

template <typename Policy>
static bool
Filter(JSContext *cx, HandleObject wrapper, AutoIdVector &props)
{
    size_t w = 0;
    RootedId id(cx);
    for (size_t n = 0; n < props.length(); ++n) {
        id = props[n];
        if (Policy::check(cx, wrapper, id, Wrapper::GET))
            props[w++].set(id);
        else if (JS_IsExceptionPending(cx))
            return false;
    }
    props.resize(w);
    return true;
}

template <typename Policy>
static bool
FilterSetter(JSContext *cx, JSObject *wrapper, jsid id, JS::MutableHandle<JSPropertyDescriptor> desc)
{
    bool setAllowed = Policy::check(cx, wrapper, id, Wrapper::SET);
    if (!setAllowed) {
        if (JS_IsExceptionPending(cx))
            return false;
        desc.setSetter(nullptr);
    }
    return true;
}

template <typename Base, typename Policy>
bool
FilteringWrapper<Base, Policy>::getPropertyDescriptor(JSContext *cx, HandleObject wrapper,
                                                      HandleId id,
                                                      JS::MutableHandle<JSPropertyDescriptor> desc) const
{
    assertEnteredPolicy(cx, wrapper, id, BaseProxyHandler::GET | BaseProxyHandler::SET);
    if (!Base::getPropertyDescriptor(cx, wrapper, id, desc))
        return false;
    return FilterSetter<Policy>(cx, wrapper, id, desc);
}

template <typename Base, typename Policy>
bool
FilteringWrapper<Base, Policy>::getOwnPropertyDescriptor(JSContext *cx, HandleObject wrapper,
                                                         HandleId id,
                                                         JS::MutableHandle<JSPropertyDescriptor> desc) const
{
    assertEnteredPolicy(cx, wrapper, id, BaseProxyHandler::GET | BaseProxyHandler::SET);
    if (!Base::getOwnPropertyDescriptor(cx, wrapper, id, desc))
        return false;
    return FilterSetter<Policy>(cx, wrapper, id, desc);
}

template <typename Base, typename Policy>
bool
FilteringWrapper<Base, Policy>::getOwnPropertyNames(JSContext *cx, HandleObject wrapper,
                                                    AutoIdVector &props) const
{
    assertEnteredPolicy(cx, wrapper, JSID_VOID, BaseProxyHandler::ENUMERATE);
    return Base::getOwnPropertyNames(cx, wrapper, props) &&
           Filter<Policy>(cx, wrapper, props);
}

template <typename Base, typename Policy>
bool
FilteringWrapper<Base, Policy>::enumerate(JSContext *cx, HandleObject wrapper,
                                          AutoIdVector &props) const
{
    assertEnteredPolicy(cx, wrapper, JSID_VOID, BaseProxyHandler::ENUMERATE);
    return Base::enumerate(cx, wrapper, props) &&
           Filter<Policy>(cx, wrapper, props);
}

template <typename Base, typename Policy>
bool
FilteringWrapper<Base, Policy>::keys(JSContext *cx, HandleObject wrapper,
                                     AutoIdVector &props) const
{
    assertEnteredPolicy(cx, wrapper, JSID_VOID, BaseProxyHandler::ENUMERATE);
    return Base::keys(cx, wrapper, props) &&
           Filter<Policy>(cx, wrapper, props);
}

template <typename Base, typename Policy>
bool
FilteringWrapper<Base, Policy>::iterate(JSContext *cx, HandleObject wrapper,
                                        unsigned flags, MutableHandleValue vp) const
{
    assertEnteredPolicy(cx, wrapper, JSID_VOID, BaseProxyHandler::ENUMERATE);
    // We refuse to trigger the iterator hook across chrome wrappers because
    // we don't know how to censor custom iterator objects. Instead we trigger
    // the default proxy iterate trap, which will ask enumerate() for the list
    // of (censored) ids.
    return js::BaseProxyHandler::iterate(cx, wrapper, flags, vp);
}

template <typename Base, typename Policy>
bool
FilteringWrapper<Base, Policy>::nativeCall(JSContext *cx, JS::IsAcceptableThis test,
                                           JS::NativeImpl impl, JS::CallArgs args) const
{
    if (Policy::allowNativeCall(cx, test, impl))
        return Base::Permissive::nativeCall(cx, test, impl, args);
    return Base::Restrictive::nativeCall(cx, test, impl, args);
}

template <typename Base, typename Policy>
bool
FilteringWrapper<Base, Policy>::defaultValue(JSContext *cx, HandleObject obj,
                                             JSType hint, MutableHandleValue vp) const
{
    return Base::defaultValue(cx, obj, hint, vp);
}

template <typename Base, typename Policy>
bool
FilteringWrapper<Base, Policy>::enter(JSContext *cx, HandleObject wrapper,
                                      HandleId id, Wrapper::Action act, bool *bp) const
{
    // This is a super ugly hacky to get around Xray Resolve wonkiness.
    //
    // Basically, XPCWN Xrays sometimes call into the Resolve hook of the
    // scriptable helper, and pass the wrapper itself as the object upon which
    // the resolve is happening. Then, special handling happens in
    // XrayWrapper::defineProperty to detect the resolve and redefine the
    // property on the holder. Really, we should just pass the holder itself to
    // NewResolve, but there's too much code in nsDOMClassInfo that assumes this
    // isn't the case (in particular, code expects to be able to look up
    // properties on the object, which doesn't work for the holder). Given that
    // these hooks are going away eventually with the new DOM bindings, let's
    // just hack around this for now.
    if (XrayUtils::IsXrayResolving(cx, wrapper, id)) {
        *bp = true;
        return true;
    }
    if (!Policy::check(cx, wrapper, id, act)) {
        *bp = JS_IsExceptionPending(cx) ? false : Policy::deny(act, id);
        return false;
    }
    *bp = true;
    return true;
}

#define XOW FilteringWrapper<SecurityXrayXPCWN, CrossOriginAccessiblePropertiesOnly>
#define DXOW   FilteringWrapper<SecurityXrayDOM, CrossOriginAccessiblePropertiesOnly>
#define NNXOW FilteringWrapper<CrossCompartmentSecurityWrapper, Opaque>
#define NNXOWC FilteringWrapper<CrossCompartmentSecurityWrapper, OpaqueWithCall>

template<> const XOW XOW::singleton(0);
template<> const DXOW DXOW::singleton(0);
template<> const NNXOW NNXOW::singleton(0);
template<> const NNXOWC NNXOWC::singleton(0);

template class XOW;
template class DXOW;
template class NNXOW;
template class NNXOWC;
template class ChromeObjectWrapperBase;
}
