
ko.subscription = function (target, callback, disposeCallback) {
    this.target = target;
    this.callback = callback;
    this.disposeCallback = disposeCallback;
    ko.exportProperty(this, 'dispose', this.dispose);
};
ko.subscription.prototype.dispose = function () {
    this.isDisposed = true;
    this.disposeCallback();
};

ko.subscribable = function () {
    this._subscriptions = {};

    ko.utils.makePrototypeOf(this, ko.subscribable['fn']);
}

var defaultEvent = "change";

ko.subscribable['fn'] = (function() {
    var fn = {
        subscribe: function (callback, callbackTarget, event) {
            event = event || defaultEvent;
            var self = this, boundCallback = callbackTarget ? callback.bind(callbackTarget) : callback;

            var subscription = new ko.subscription(self, boundCallback, function () {
                ko.utils.arrayRemoveItem(self._subscriptions[event], subscription);
            });

            if (!self._subscriptions[event])
                self._subscriptions[event] = [];
            self._subscriptions[event].push(subscription);
            return subscription;
        },

        notifySubscribers: function(valueToNotify, event) {
            this['notifySubscribers'](valueToNotify, event);
        },

        "notifySubscribers": function (valueToNotify, event) {
            event = event || defaultEvent;
            if (this._subscriptions[event]) {
                ko.dependencyDetection.ignore(function() {
                    ko.utils.arrayForEach(this._subscriptions[event].slice(0), function (subscription) {
                        // In case a subscription was disposed during the arrayForEach cycle, check
                        // for isDisposed on each subscription before invoking its callback
                        if (subscription && (subscription.isDisposed !== true))
                            subscription.callback(valueToNotify);
                    });
                }, this);
            }
        },

        getSubscriptionsCount: function () {
            var total = 0;
            ko.utils.objectForEach(this._subscriptions, function(eventName, subscriptions) {
                total += subscriptions.length;
            });
            return total;
        },

        extend: applyExtenders
    };
    return ko.exportProperties(fn,
        'subscribe', fn.subscribe,
        'extend', fn.extend,
        'getSubscriptionsCount', fn.getSubscriptionsCount
    );
})();

ko.isSubscribable = function (instance) {
    return instance != null && typeof instance.subscribe == "function" && typeof instance["notifySubscribers"] == "function";
};

ko.exportSymbol('subscribable', ko.subscribable);
ko.exportSymbol('isSubscribable', ko.isSubscribable);
