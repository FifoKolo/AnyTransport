(function (global) {
    'use strict';

    var rafId = null;
    var startTime = null;
    var SPIN_MS = 800;

    function getRing() {
        var root = document.getElementById('anytransport-global-loader');
        return root ? root.querySelector('.anytransport-loader-ring') : null;
    }

    function tick(now) {
        var ring = getRing();
        if (!ring) {
            rafId = null;
            return;
        }
        if (startTime === null) {
            startTime = now;
        }
        var deg = ((now - startTime) / SPIN_MS) * 360 % 360;
        ring.style.transform = 'rotate(' + deg + 'deg)';
        rafId = global.requestAnimationFrame(tick);
    }

    function start() {
        if (rafId !== null) {
            return;
        }
        startTime = null;
        rafId = global.requestAnimationFrame(tick);
    }

    function stop() {
        if (rafId !== null) {
            global.cancelAnimationFrame(rafId);
            rafId = null;
        }
        startTime = null;
        var ring = getRing();
        if (ring) {
            ring.style.transform = '';
        }
    }

    global.anytransportLoaderSpin = {
        start: start,
        stop: stop
    };

    start();
})(window);
