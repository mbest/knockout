ko.asynchronousUpdater = (function() {
    var updaterHandler, updaterCallbacks = [];

    function processUpdates() {
        // New items might be added to updaterCallbacks during this loop
        // So always check updaterCallbacks.length
        for (var i = 0; i < updaterCallbacks.length; i++) {
            updaterCallbacks[i]();
        }
        updaterCallbacks = [];
        updaterHandler = undefined;
    }

    function addUpdater(callback) {
        // only add each callback if it's not already there
        if (ko.utils.arrayIndexOf(updaterCallbacks, callback) >= 0)
            return;
        updaterCallbacks.push(callback);
        if (!updaterHandler)
            updaterHandler = ko.setImmediate(processUpdates);
    }

    return {
        add: addUpdater
    };
})();
