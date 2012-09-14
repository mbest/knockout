// "foreach: someExpression" is equivalent to "template: { foreach: someExpression }"
// "foreach: { data: someExpression, afterAdd: myfn }" is equivalent to "template: { foreach: someExpression, afterAdd: myfn }"
ko.bindingHandlers['foreach'] = templateBasedBinding(
    function(value, options, allBindingsAccessor) {
        if ((!value) || typeof value.length == "number") {
            // If bindingValue is the array, just pass it on its own
            options['foreach'] = value;
            options['as'] = allBindingsAccessor('as');
        } else {
            // If bindingValue is a object with options, copy it and set foreach to the data value
            ko.utils.extendInternal(options, value);
            options['foreach'] = options['data'];
            delete options['name'];   // don't allow named templates
        }
    }, preprocessAs);
