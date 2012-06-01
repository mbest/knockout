//var attrHtmlToJavascriptMap = { 'class': 'className', 'for': 'htmlFor' }; // already defined in defaultBindings.js

var domObservableDomDataKey = ko.utils.domData.nextKey();

ko.domObservable = function(element, propertyName, eventsToWatch) {
    // Convert certain attribute names to their property names
    if (attrHtmlToJavascriptMap[propertyName])
        propertyName = attrHtmlToJavascriptMap[propertyName];

    var elemType = typeof element[propertyName];
    if (!primitiveTypes[elemType])
        throw new Exception("domObservable only supports primitive types");

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
                // Set property and notify of change; for string properties, convert *null* and *undefined* to an empty string
                element[propertyName] = (elemType == "string" && newValue == null) ? "" : newValue;
                notifyChange();
            }
        }
        else {
            ko.dependencyDetection.registerDependency(observable);
            return element[propertyName];
        }
    }

    function notifyChange() {
        if (disposer.shouldDispose())
            disposer.dispose();
        else
            observable["notifySubscribers"](element[propertyName]);
    }

    var watchedEvents = {};
    function addEvent(eventType) {
        if (!watchedEvents[eventType]) {
            ko.utils.registerEventHandler(element, eventType, notifyChange);
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
