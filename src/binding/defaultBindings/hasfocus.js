ko.bindingHandlers['hasfocus'] = {
    'flags': bindingFlags_twoWay,
    'init': function(element, valueAccessor, allBindingsAccessor) {
        var elemFocusObservable = ko.domEventObservable(element, ['focus', 'blur', 'focusin', 'focusout']),
            ownerDoc = element.ownerDocument;

        setUpTwoWayBinding(element, valueAccessor, function(newValue) {
            newValue ? element.focus() : element.blur();
            // For IE, which doesn't reliably fire "focus" or "blur" events synchronously
            ko.utils.triggerEvent(element, newValue ? "focusin" : "focusout");
        },
        function() {
            var eventName = elemFocusObservable();
            // Where possible, ignore which event was raised and determine focus state using activeElement,
            // as this avoids phantom focus/blur events raised when changing tabs in modern browsers.
            // However, not all KO-targeted browsers (Firefox 2) support activeElement.
            // Discussion at https://github.com/SteveSanderson/knockout/issues/352
            return ("activeElement" in ownerDoc) ?
                (ownerDoc.activeElement === element) :
                (eventName === 'focus' || eventName === 'focusin');
        }, function(newValue) {
            ko.expressionRewriting.writeValueToProperty(valueAccessor(), allBindingsAccessor, 'hasfocus', newValue, true);
        });
    }
};
