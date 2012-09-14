var withDomDataKey = ko.utils.domData.nextKey();
ko.bindingHandlers['with'] = {
    'flags': bindingFlags_contentBind | bindingFlags_canUseVirtual,
    'preprocess': preprocessAs,
    'init': function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var dataValue = ko.utils.unwrapObservable(valueAccessor()),
            nodesArray = ko.virtualElements.childNodes(element),
            savedDataValue = ko.observable(dataValue);

        if (dataValue) {
            // When the data value is initially true, save a copy of the nodes (and bind to the originals)
            nodesArray = ko.utils.cloneNodes(nodesArray);
            ko.applyBindingsToDescendants(bindingContext['createChildContext'](savedDataValue, allBindingsAccessor('as')), element);
        }

        ko.domDataSet(element, withDomDataKey, {
            savedNodes: ko.utils.moveCleanedNodesToContainerElement(nodesArray),
            savedDataValue: savedDataValue});
    },
    'update': function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var withData = ko.domDataGet(element, withDomDataKey),
            savedDataValue = withData.savedDataValue,
            dataValue = ko.utils.unwrapObservable(valueAccessor());

        if (savedDataValue.peek()) {
            if (!dataValue) // When the data value becomes false, remove the nodes from the document
                ko.virtualElements.emptyNode(element);
            // If the data value simply changes, updating the observable will update all bindings
            savedDataValue(dataValue);
        } else if (dataValue) {
            // When the data value becomes non-false, copy the nodes into the document
            var nodesArray = ko.utils.cloneNodes(withData.savedNodes.childNodes);
            ko.virtualElements.setDomNodeChildren(element, nodesArray);
            savedDataValue(dataValue);
            ko.applyBindingsToDescendants(bindingContext['createChildContext'](savedDataValue, allBindingsAccessor('as')), element);
        }
    }
};
