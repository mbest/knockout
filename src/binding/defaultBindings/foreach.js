// "foreach: someExpression" is equivalent to "template: { foreach: someExpression }"
// "foreach: { data: someExpression, afterAdd: myfn }" is equivalent to "template: { foreach: someExpression, afterAdd: myfn }"
ko.bindingHandlers['foreach'] = templateBasedBinding(
    function(value, options, allBindingsAccessor) {
        var unwrappedValue = ko.utils.peekObservable(value);    // Unwrap without setting a dependency here
        if ((!unwrappedValue) || typeof unwrappedValue.length == "number") {
            // If bindingValue is the array, just pass it on its own
            options['foreach'] = value;
            options['as'] = allBindingsAccessor('as');
        } else {
            // If bindingValue is an object with options, copy it and set foreach to the data value
            value = ko.utils.unwrapObservable(value);
            ko.utils.arrayForEach(['as', 'includeDestroyed', 'afterAdd', 'beforeRemove', 'afterRender', 'beforeMove' ,'afterMove'], function(option) {
                options[option] = value[option];
            });
            options['foreach'] = value['data'];
        }
    }, preprocessAs);
