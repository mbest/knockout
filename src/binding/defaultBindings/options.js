ko.bindingHandlers['options'] = {
    'flags': bindingFlags_contentBind | bindingFlags_contentSet,
    'init': function(element) {
        if (ko.utils.tagNameLower(element) !== "select")
            throw new Error("options binding applies only to SELECT elements");

        // Remove all existing <option>s.
        while (element.length > 0) {
            element.remove(0);
        }
    },
    'update': function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        function selectedOption() {
            if (element.multiple) {
                if (element.selectedOptions) {
                    return element.selectedOptions.length;
                } else {
                    return ko.utils.arrayReduce(element.options, 0, function(count, option) {
                        return option.selected ? count + 1 : count;
                    });
                }
            } else {
                return element.selectedIndex === -1 ? null : element.options[element.selectedIndex];
            }
        }

        var previousSelection = selectedOption();
        var previousScrollTop = element.scrollTop;

        var unwrappedArray = ko.utils.unwrapObservable(valueAccessor()) || [];
        var allBindings = allBindingsAccessor();
        var includeDestroyed = allBindings['optionsIncludeDestroyed'];
        var optionsBind = allBindings['optionsBind'];
        var caption = {};

        if (typeof unwrappedArray.length == "undefined") // Coerce single value into array
            unwrappedArray = [unwrappedArray];

        // Filter out any entries marked as destroyed
        var filteredArray = ko.utils.arrayFilter(unwrappedArray, function(item) {
            return includeDestroyed || item === undefined || item === null || !ko.utils.unwrapObservable(item['_destroy']);
        });

        // If caption is included, add it to the copied array
        if (allBindings['optionsCaption']) {
            filteredArray.unshift(caption);
        }

        if (optionsBind) {
            var activateBindingsCallback = function(arrayEntry, addedNodesArray, index) {
                if (arrayEntry !== caption) {
                    var optionContext = bindingContext['createChildContext'](arrayEntry),
                        optionsParseBindings = function() {
                            return ko.bindingProvider['instance']['parseBindingsString'](optionsBind, optionContext) };
                    ko.applyBindingsToNode(addedNodesArray[0], optionsParseBindings, optionContext);
                }
            };
        }

        function applyToObject(object, predicate, defaultValue) {
            var predicateType = typeof predicate;
            if (predicateType == "function")    // Given a function; run it against the data value
                return predicate(object);
            else if (predicateType == "string") // Given a string; treat it as a property name on the data value
                return object[predicate];
            else                                // Given no optionsText arg; use the data value itself
                return defaultValue;
        }

        function optionForArrayItem(arrayEntry, index) {
            var option = document.createElement("option");
            if (arrayEntry === caption) {
                ko.utils.setHtml(option, allBindings['optionsCaption']);
                ko.selectExtensions.writeValue(option, undefined);
            } else {
                // Apply a value to the option element
                var optionValue = applyToObject(arrayEntry, allBindings['optionsValue'], arrayEntry);
                ko.selectExtensions.writeValue(option, ko.utils.unwrapObservable(optionValue));

                // Apply some text to the option element
                var optionText = applyToObject(arrayEntry, allBindings['optionsText'], optionValue);
                optionText = ko.utils.unwrapObservable(optionText);
                option.appendChild(document.createTextNode((optionText == null) ? "" : optionText));
            }
            return [option];
        }

        ko.utils.setDomNodeChildrenFromArrayMapping(element, filteredArray, optionForArrayItem, {'dontLimitMoves':true}, activateBindingsCallback);

        // Workaround for IE9 bug
        ko.utils.ensureSelectElementIsRenderedCorrectly(element);

        if (Math.abs(previousScrollTop - element.scrollTop) > 20)
            element.scrollTop = previousScrollTop;

        if (selectedOption() !== previousSelection)
            ko.utils.triggerEvent(element, "change");
    }
};
ko.bindingHandlers['options'].optionValueDomDataKey = ko.utils.domData.nextKey();
