var hasfocusLastValue = '__ko_hasfocusLastValue';
ko.bindingHandlers['hasfocus'] = {
    'flags': bindingFlags_twoWay,
    'init': function(element, valueAccessor, allBindingsAccessor) {
        var elemFocusObservable = ko.domEventObservable(element, ['focus', 'blur', 'focusin', 'focusout']),
            ownerDoc = element.ownerDocument;

        setUpTwoWayBinding(element, makeUnwrappedValueAccessor(valueAccessor), function(newValue) {
            newValue = !!newValue;  // force boolean to compare with last value
            if (element[hasfocusLastValue] !== newValue) {
                element[hasfocusLastValue] = newValue;
                newValue ? element.focus() : element.blur();
                // For IE, which doesn't reliably fire "focus" or "blur" events synchronously
                ko.utils.triggerEvent(element, newValue ? "focusin" : "focusout");
            }
        },
        function() {
            var eventName = elemFocusObservable();
            // Where possible, ignore which event was raised and determine focus state using activeElement,
            // as this avoids phantom focus/blur events raised when changing tabs in modern browsers.
            // However, not all KO-targeted browsers (Firefox 2) support activeElement.
            // Discussion at https://github.com/SteveSanderson/knockout/issues/352
            // Cache the latest value, so we can avoid unnecessarily calling focus/blur in the update function
            return element[hasfocusLastValue] = ("activeElement" in ownerDoc) ?
                (ownerDoc.activeElement === element) :
                (eventName === 'focus' || eventName === 'focusin');
        }, function(newValue) {
            ko.expressionRewriting.writeValueToProperty(valueAccessor(), allBindingsAccessor, 'hasfocus', newValue, true);
        });
    }
};

ko.bindingHandlers['hasFocus'] = ko.bindingHandlers['hasfocus']; // Make "hasFocus" an alias
