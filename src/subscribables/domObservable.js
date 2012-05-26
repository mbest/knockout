var domObservableDomDataKey = ko.utils.domData.nextKey();
var attrHtmlToJavascriptMap = { 'class': 'className', 'for': 'htmlFor' };

ko.domObservable = function(element, propertyName, eventsToWatch) {
    // convert certain attribute names to their property names
    if (propertyName in attrHtmlToJavascriptMap)
        propertyName = attrHtmlToJavascriptMap[propertyName];

    var cache = ko.domDataGetOrSet(element, domObservableDomDataKey, {});

    // Return cached value if set
    if (cache[propertyName])
        return cache[propertyName];

    var observable = ko.observable(element[propertyName]);

    // This subscription updates the element whenever the observable is updated;
    // the ignoreUpdate flag allows us to update the observable without updating the element
    var ignoreUpdate = false;
    var subscription = observable.subscribe(function(newValue) {
        if (!ignoreUpdate) {
            if (disposer.shouldDispose())
                disposer.dispose();
            else
                element[propertyName] = (newValue === undefined) ? null : newValue;
        }
    });

    // Set up event handlers to trigger updating the observable from the element
    if (eventsToWatch) {
        eventsToWatch = [].concat(eventsToWatch);   // make sure it's an array
        ko.utils.arrayForEach(eventsToWatch, function (eventType) {
            ko.utils.registerEventHandler(element, eventType, function(event) {
                try {
                    ignoreUpdate = true;
                    observable(element[propertyName]);
                } finally {
                    ignoreUpdate = false;
                }
            });
        });
    }

    // Set up a dispose handler that disposes all subscriptions to the observable
    // if the element is removed from the document
    var disposer = ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
        delete cache[propertyName];
        var subscriptions = observable._subscriptions;
        for (var eventName in subscriptions) {
            if (subscriptions.hasOwnProperty(eventName))
                ko.utils.arrayForEach(subscriptions[eventName], function (subscription) {
                    if (subscription.isDisposed !== true)
                        subscription.dispose();
                });
        }
    });

    return (cache[propertyName] = observable);
}
