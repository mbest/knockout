ko.bindingHandlers['checked'] = {
    'flags': bindingFlags_twoWay,
    'init': function (element, valueAccessor, allBindingsAccessor) {
        var elemValue = ko.domObservable(element, 'value'),
            elemChecked = ko.domObservable(element, 'checked', 'click');
        if (element.type == "checkbox") {
            if (ko.utils.peekObservable(valueAccessor()) instanceof Array) {
                // When bound to an array, the checkbox being checked represents its value being present in that array
                setUpTwoWayBinding(element,
                    function() {
                        return (ko.utils.arrayIndexOf(ko.utils.unwrapObservable(valueAccessor()), elemValue()) >= 0);
                    }, elemChecked,
                    elemChecked, function(checkedValue) {
                        // For checkboxes bound to an array, we add/remove the checkbox value to that array
                        // This works for both observable and non-observable arrays
                        ko.utils.addOrRemoveItem(valueAccessor(), elemValue(), checkedValue);
                    });
            } else {
                // When bound to any other value (not an array), the checkbox being checked represents the value being trueish
                setUpTwoWayBinding(element,
                    makeUnwrappedValueAccessor(valueAccessor), elemChecked,
                    elemChecked, function(checkedValue) {
                        ko.expressionRewriting.writeValueToProperty(valueAccessor(), allBindingsAccessor, 'checked', checkedValue, true);
                    });
            }
        } else if (element.type == "radio") {
            // IE 6 won't allow radio buttons to be selected unless they have a name
            if (!element.name)
                ko.bindingHandlers['uniqueName']['init'](element, function() { return true });
            setUpTwoWayBinding(element,
                makeUnwrappedValueAccessor(valueAccessor), function(newValue) {
                    elemChecked(elemValue() == newValue);
                },
                function() {
                    return elemChecked() ? elemValue() : null;
                }, function(newValue) {
                    if (newValue !== null)
                        ko.expressionRewriting.writeValueToProperty(valueAccessor(), allBindingsAccessor, 'checked', newValue, true);
                });
        }
    }
};
