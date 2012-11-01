ko.bindingHandlers['value'] = {
    'flags': bindingFlags_twoWay | bindingFlags_contentUpdate,
    'init': function (element, valueAccessor, allBindingsAccessor) {
        var elementIsSelect = ko.utils.tagNameLower(element) == "select";
        var elemProperty = elementIsSelect ? "selectedIndex" : "value";

        function modelUpdater(newValue) {
            ko.expressionRewriting.writeValueToProperty(valueAccessor(), allBindingsAccessor, 'value', newValue, /* checkIfDifferent: */ true);
        };

        var elemValue = ko.domObservable(element, elemProperty, 'change');  // Always catch "change" event
        // And possibly other events too if asked
        elemValue.addEvents(allBindingsAccessor("valueUpdate"));

        // Workaround for https://github.com/SteveSanderson/knockout/issues/122
        // IE doesn't fire "change" events on textboxes if the user selects a value from its autocomplete list
        var ieAutoCompleteHackNeeded = ko.utils.ieVersion && element.tagName.toLowerCase() == "input" && element.type == "text"
                                       && element.autocomplete != "off" && (!element.form || element.form.autocomplete != "off");
        if (ieAutoCompleteHackNeeded && !elemValue.isEventWatched("propertychange")) {
            var propertyChangedFired = false;
            ko.utils.registerEventHandler(element, "propertychange", function () { propertyChangedFired = true });
            ko.utils.registerEventHandler(element, "blur", function() {
                if (propertyChangedFired) {
                    propertyChangedFired = false;
                    elemValue.notifyChange();
                }
            });
        }

        // Workaround for IE6 bug: It won't reliably apply values to SELECT nodes during the same execution thread
        // right after you've changed the set of OPTION nodes on it. So for that node type, we'll schedule a second thread
        // to apply the value as well.
        var modelUpdaterWrapped = elementIsSelect && ko.utils.isIe6
            ? function(newValue) {
                modelUpdater(newValue);
                setTimeout(function() { modelUpdater(newValue) });
            }
            : modelUpdater;

        setUpTwoWayBinding(element,
            makeUnwrappedValueAccessor(valueAccessor), function(newValue) {
                ko.selectExtensions.writeValue(element, newValue);

                // If you try to set a model value that can't be represented in an already-populated dropdown, reject that change,
                // because you're not allowed to have a model value that disagrees with a visible UI selection.
                if (elementIsSelect) {
                    var newSelectValue = ko.selectExtensions.readValue(element);
                    if (newSelectValue !== newValue)
                        modelUpdaterWrapped(newSelectValue);
                }
            },
            function() {
                return ko.selectExtensions.readValue(element);
            }, modelUpdaterWrapped);
    }
};
