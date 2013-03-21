ko.bindingHandlers['checked'] = {
    'flags': bindingFlags_twoWay,
    'init': function (element, valueAccessor, allBindingsAccessor) {
        var elemValue = ko.domObservable(element, 'value'),
            elemChecked = ko.domObservable(element, 'checked', 'click');

        function checkedValue() {
            return allBindingsAccessor.has('checkedValue')
                ? ko.utils.unwrapObservable(allBindingsAccessor('checkedValue'))
                : elemValue();
        }

        if (element.type == "checkbox") {
            if (ko.utils.peekObservable(valueAccessor()) instanceof Array) {
                var oldValue = checkedValue();
                // When bound to an array, the checkbox being checked represents its value being present in that array
                setUpTwoWayBinding(element,
                    function() {
                        return (ko.utils.arrayIndexOf(ko.utils.unwrapObservable(valueAccessor()), ko.ignoreDependencies(checkedValue)) >= 0);
                    }, elemChecked,
                    function() {
                        return { _value: checkedValue(), _checked: elemChecked() };  // dependent on both the value and checked state
                    }, function(options) {
                        var array = valueAccessor(),
                            newValue = options._value,
                            checkedValue = options._checked;
                        // For checkboxes bound to an array, we add/remove the checkbox value to that array
                        // This works for both observable and non-observable arrays
                        // Remove the old value if it's different
                        if (checkedValue && oldValue !== newValue)
                            ko.utils.addOrRemoveItem(array, oldValue, false);
                        ko.utils.addOrRemoveItem(array, newValue, checkedValue);
                        oldValue = newValue;
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
                    elemChecked(checkedValue() == newValue);
                },
                function() {
                    return elemChecked() ? checkedValue() : null;
                }, function(newValue) {
                    if (newValue !== null)
                        ko.expressionRewriting.writeValueToProperty(valueAccessor(), allBindingsAccessor, 'checked', newValue, true);
                });
        }
    }
};

ko.bindingHandlers['checkedValue'] = {
    'update': function (element, valueAccessor) {
        ko.domObservable(element, 'value')(ko.utils.unwrapObservable(valueAccessor()));
    }
};

})();
