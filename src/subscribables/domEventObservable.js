ko.domEventObservable = function(element, eventsToWatch) {
    var lastEventTriggered;

    function observable() {
        ko.dependencyDetection.registerDependency(observable);
        return lastEventTriggered;
    }

    ko.subscribable.call(observable);   // make it subscribable
    ko.utils.extendInternal(observable, ko.observable['fn']);   // make it just like an observable

    ko.utils.arrayForEach(eventsToWatch, function(eventName) {
        ko.utils.registerEventHandler(element, eventName, function() {
            lastEventTriggered = eventName;
            observable.notifySubscribers(eventName);
        });
    });

    return observable;
};
