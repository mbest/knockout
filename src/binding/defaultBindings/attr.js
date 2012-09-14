ko.bindingHandlers['attr'] = {
    'flags': bindingFlags_twoLevel,
    'update': function(element, valueAccessor, allBindingsAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor()) || {};
        for (var attrName in value) {
            var attrValue = ko.utils.unwrapObservable(value[attrName]);
            ko.domObservable(element, attrName).setAsAttribute(attrValue, attrName);
        }
    }
};
