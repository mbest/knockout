
ko.dependencyDetection = ko.computedContext = (function () {
    var frames = [],
        frame,
        nonce = 0;

    // Return a unique ID that can be assigned to an observable for dependency tracking.
    // Theoretically, you could eventually overflow the number storage size, resulting
    // in duplicate IDs. But in JavaScript, the largest exact integral value is 2^53
    // or 9,007,199,254,740,992. If you created 1,000,000 IDs per second, it would
    // take over 285 years to reach that number.
    // See http://blog.vjeux.com/2010/javascript/javascript-max_int-number-limits.html
    function getId() {
        return ++nonce;
    }

    function begin(options) {
        frames.push(frame = options);
    }

    function end() {
        frames.pop();
        frame = frames.length ? frames[frames.length - 1] : undefined;
    }

    return {
        _begin: begin,

        _end: end,

        registerDependency: function (subscribable) {
            if (frame) {
                if (!ko.isSubscribable(subscribable))
                    throw new Error("Only subscribable things can act as dependencies");
                frame.callback(subscribable, subscribable._id || (subscribable._id = getId()));
            }
        },

        ignore: function (callback, callbackTarget, callbackArgs) {
            try {
                begin();
                return callback.apply(callbackTarget, callbackArgs || []);
            } finally {
                end();
            }
        },

        getDependenciesCount: function () {
            if (frame)
                return frame.target.getDependenciesCount();
        },

        hasDependency: function(subscribable) {
            if (frame)
                return frame.target.hasDependency(subscribable);
        },

        isInitial: function() {
            if (frame)
                return frame.isInitial;
        },

        computed: function() {
            if (frame)
                return frame.target;
        }

    };
})();

ko.exportSymbol('computedContext', ko.computedContext);
ko.exportSymbol('computedContext.getDependenciesCount', ko.computedContext.getDependenciesCount);
ko.exportSymbol('computedContext.hasDependency', ko.computedContext.hasDependency);
ko.exportSymbol('computedContext.isInitial', ko.computedContext.isInitial);
ko.exportSymbol('computedContext.computed', ko.computedContext.computed);
