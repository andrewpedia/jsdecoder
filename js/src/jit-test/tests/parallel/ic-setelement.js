load(libdir + "parallelarray-helpers.js");

function set(a, n) {
  // Padding to prevent inlining.
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  for (var i = 0; i < n; i++)
    a[i] = i;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
  var foo = 0;
}
set({}, 256);
function Foo() { }
set(new Foo, 256);

function testSetDense() {
  assertArraySeqParResultsEq(
    range(0, minItemsTestingThreshold),
    "map",
    function (i) {
      var a1 = [];
      // Defines .foo
      set(a1, 32);
      return a1[i];
    });
}

if (getBuildConfiguration().parallelJS) {
  testSetDense();
}
