var attrHtmlToJavascriptMap = { 'class': 'className', 'for': 'htmlFor' };
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
        if (eventsToWatch)
            cachedObservable.addEvents(eventsToWatch);    // update observable with any new events
        return cachedObservable;
    }

    function observable(newValue) {
        if (arguments.length > 0) {
            // Ignore writes if the value hasn't changed
            if (isPropertyDifferent(newValue)) {
                // Set property and notify of change; for string properties, convert *null* and *undefined* to an empty string
                element[propertyName] = (elemType == "string" && newValue == null) ? "" : newValue;

                // Treat "name" specially - although you can think of it as an attribute, it also needs
                // special handling on older versions of IE (6/7).
                // Deliberately being case-sensitive here because XHTML would regard "Name" as a different thing
                // entirely, and there's no strong reason to allow for such casing in HTML.
                // - https://github.com/SteveSanderson/knockout/issues/197, https://github.com/SteveSanderson/knockout/issues/333
                // - http://www.matts411.com/post/setting_the_name_attribute_in_ie_dom/
                if (ko.utils.ieVersion <= 7 && propertyName == "name") {
                    try {
                        element.mergeAttributes(document.createElement("<input name='" + element.name + "'/>"), false);
                    }
                    catch(e) {} // For IE9 with doc mode "IE9 Standards" and browser mode "IE9 Compatibility View"
                }
                notifyChange();
            }
        }
        else {
            ko.dependencyDetection.registerDependency(observable);
            return element[propertyName];
        }
    }

    function isPropertyDifferent(testValue) {
        return (!observable['equalityComparer']) || !observable['equalityComparer'](element[propertyName], testValue);
    }

    function setAsAttribute(attrValue, attrName) {
        if (ko.utils.ieVersion <= 8 && attrName && attrName != propertyName) {
            // In IE <= 7 and IE8 Quirks Mode, you have to use the Javascript property name instead of the
            // HTML attribute name for certain attributes. IE8 Standards Mode supports the correct behavior,
            // but instead of figuring out the mode, we'll just set the attribute through the Javascript
            // property for IE <= 8.
            observable(attrValue);
        } else {
            var oldValue = element[propertyName];

            // Allow passing in alternate attribute name (for cases such as "class" and "for")
            attrName = attrName || propertyName;

            // To cover cases like "attr: { checked:someProp }", we want to remove the attribute entirely
            // when someProp is a "no value"-like value (strictly null, false, or undefined)
            // (because the absence of the "checked" attr is how to mark an element as not checked, etc.)
            if (attrValue === false || attrValue == null)
                element.removeAttribute(attrName);
            else
                element.setAttribute(attrName, "" + attrValue);

            // Notify if property has changed
            if (isPropertyDifferent(oldValue))
                notifyChange();
        }
    }

    function notifyChange() {
        if (!disposer.disposeIfShould())
            observable.notifySubscribers(element[propertyName]);
    }

    var watchedEvents = {};
    function addEvent(eventName) {
        if (!watchedEvents[eventName]) {
            watchedEvents[eventName] = true;
            var handler = notifyChange;
            if (ko.utils.stringStartsWith(eventName, "after")) {
                handler = function() { setTimeout(notifyChange) };
                eventName = eventName.substring("after".length);
            }
            ko.utils.registerEventHandler(element, eventName, handler);
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

    ko.subscribable.call(observable);   // make it subscribable
    ko.utils.extendInternal(observable, ko.observable['fn']);   // make it just like an observable

    // Set up event handlers to trigger updating the observable from the element
    addEvents(eventsToWatch);

    // Set up a dispose handler that clears the observable from the cache
    var disposer = ko.utils.domNodeDisposal.addDisposeCallback(element,
        function() {
            delete cache[propertyName];
        });

    ko.utils.extendInternal(observable, {
        peek: function() { return element[propertyName] },
        dispose: disposer.dispose,
        addEvents: addEvents,
        isEventWatched: function(eventName) { return watchedEvents[eventName] || false },
        notifyChange: notifyChange,
        setAsAttribute: setAsAttribute
    });

    return (cache[propertyName] = observable);
};
