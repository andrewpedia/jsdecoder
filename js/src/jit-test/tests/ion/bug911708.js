if (typeof ParallelArray === "undefined")
  quit();

function x() {
    yield x
}
new(x)
ParallelArray([7247], function() {
    --x
    eval("")
})
