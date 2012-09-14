ko.bindingHandlers['let'] = {
    'flags': bindingFlags_contentBind | bindingFlags_canUseVirtual,
    'init': function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        // Make a modified binding context, with extra properties, and apply it to descendant elements
        var innerContext = bindingContext['extend'](valueAccessor);
        ko.applyBindingsToDescendants(innerContext, element);
    }
};
