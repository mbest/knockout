ko.bindingHandlers['hasfocus'] = {
    'flags': bindingFlags_twoWay,
    'init': function(element, valueAccessor, allBindingsAccessor) {
        var elemFocusObservable = ko.domObservable(element, '__ko_focus', ['focus', 'blur', 'focusin', 'focusout']);

        setUpTwoWayBinding(element, valueAccessor, function(newValue) {
            newValue ? element.focus() : element.blur();
            // For IE, which doesn't reliably fire "focus" or "blur" events synchronously
            ko.utils.triggerEvent(element, newValue ? "focusin" : "focusout");
        },
        function() {
            // set up and access an unrelated property to get event updates
            elemFocusObservable();
            return element.ownerDocument.activeElement === element;
        }, function(newValue) {
            ko.expressionRewriting.writeValueToProperty(valueAccessor(), allBindingsAccessor, 'hasfocus', newValue, true);
        });
    }
};
