var domObservableDomDataKey = ko.utils.domData.nextKey();
var attrHtmlToJavascriptMap = { 'class': 'className', 'for': 'htmlFor' };

ko.domObservable = function(element, propertyName, eventsToWatch) {
    // convert certain attribute names to their property names
    if (propertyName in attrHtmlToJavascriptMap)
        propertyName = attrHtmlToJavascriptMap[propertyName];

    var cache = ko.domDataGetOrSet(element, domObservableDomDataKey, {});

    // Return cached value if set
    if (cache[propertyName]) {
        var cachedObservable = cache[propertyName];
        cachedObservable.addEvents(eventsToWatch);    // update observable with any new events
        return cachedObservable;
    }

    function observable(newValue) {
        if (arguments.length > 0) {
            // Ignore writes if the value hasn't changed
            if ((!observable['equalityComparer']) || !observable['equalityComparer'](element[propertyName], newValue)) {
                // set property and notify of change; if new value is *undefined*, make it *null* instead
                observable["notifySubscribers"](element[propertyName] = (newValue === undefined ? null : newValue));
            }
        }
        else {
            ko.dependencyDetection.registerDependency(observable);
            return element[propertyName];
        }
    }

    var watchedEvents = {};
    function addEvent(eventType) {
        if (!watchedEvents[eventType]) {
            ko.utils.registerEventHandler(element, eventType, function(event) {
                observable["notifySubscribers"](element[propertyName]);
            });
            watchedEvents[eventType] = true;
        }
    }
    function addEvents(eventsToWatch) {
        if (eventsToWatch && eventsToWatch.length) {
            if (typeof eventsToWatch == "string")
                addEvent(eventsToWatch);
            else
                ko.utils.arrayForEach(eventsToWatch, addEvent);
        }
    };

    function dispose() {
        delete cache[propertyName];
        var subscriptions = observable._subscriptions;
        for (var eventName in subscriptions) {
            if (subscriptions.hasOwnProperty(eventName))
                ko.utils.arrayForEach(subscriptions[eventName], function (subscription) {
                    if (subscription.isDisposed !== true)
                        subscription.dispose();
                });
        }
    };

    ko.subscribable.call(observable);   // make it subscribable
    ko.utils.extendInternal(observable, ko.observable['fn']);   // make it just like an observable

    // Set up event handlers to trigger updating the observable from the element
    addEvents(eventsToWatch);

    // Set up a dispose handler that disposes all subscriptions to the observable
    // if the element is removed from the document
    var disposer = ko.utils.domNodeDisposal.addDisposeCallback(element, dispose);

    observable.peek = function() { return element[propertyName] };
    observable.dispose = disposer.dispose;
    observable.addEvents = addEvents;

    return (cache[propertyName] = observable);
}
