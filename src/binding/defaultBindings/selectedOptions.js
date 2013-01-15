ko.bindingHandlers['selectedOptions'] = {
    'flags': bindingFlags_twoWay | bindingFlags_contentUpdate,
    'init': function (element, valueAccessor, allBindingsAccessor) {
        if (ko.utils.tagNameLower(element) != "select")
            throw new Error("values binding applies only to SELECT elements");

        var options = element.getElementsByTagName("option");

        function elementUpdater(newValue) {
            ko.utils.arrayForEach(options, function(option) {
                var isSelected = ko.utils.arrayIndexOf(newValue, ko.selectExtensions.readValue(option)) >= 0;
                ko.utils.setOptionNodeSelectionState(option, isSelected);
            });
        }

        function isOptionSelected(option) {
            return ko.domObservable(option, 'selected')();
        }

        var elemChangeObservable = ko.domEventObservable(element, ['change']);
        function getSelectedValuesFromSelectNode() {
            elemChangeObservable();   // update on change events
            return ko.utils.arrayMap(ko.utils.arrayFilter(options, isOptionSelected), ko.selectExtensions.readValue);
        }

        function modelUpdater(newValue) {
            ko.expressionRewriting.writeValueToProperty(valueAccessor(), allBindingsAccessor, 'value', newValue);
        };

        setUpTwoWayBinding(element,
            makeUnwrappedValueAccessor(valueAccessor), elementUpdater,
            getSelectedValuesFromSelectNode, modelUpdater);
    }
};
