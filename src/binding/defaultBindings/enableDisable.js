ko.bindingHandlers['enable'] = {
    'update': function (element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        ko.domObservable(element, 'disabled').setAsAttribute(!value);
    }
};

ko.bindingHandlers['disable'] = {
    'update': function (element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        ko.domObservable(element, 'disabled').setAsAttribute(value);
    }
};
