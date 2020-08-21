/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* ES6 20121122 draft 15.16.4.6. */

function SetForEach(callbackfn, thisArg = undefined) {
    /* Step 1-2. */
    var S = this;
    if (!IsObject(S))
        ThrowError(JSMSG_BAD_TYPE, typeof S);

    /* Step 3-4. */
    try {
        callFunction(std_Set_has, S);
    } catch (e) {
        ThrowError(JSMSG_BAD_TYPE, typeof S);
    }

    /* Step 5-6. */
    if (!IsCallable(callbackfn))
        ThrowError(JSMSG_NOT_FUNCTION, DecompileArg(0, callbackfn));

    /* Step 7-8. */
    var values = callFunction(std_Set_iterator, S);
    while (true) {
        var result = callFunction(std_Set_iterator_next, values);
        if (result.done)
            break;
        var value = result.value;
        callFunction(callbackfn, thisArg, value, value, S);
    }
}
