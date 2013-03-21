ko.selectExtensions = (function () {
    var hasDomDataExpandoProperty = '__ko__hasDomDataOptionValue__';

    // Normally, SELECT elements and their OPTIONs can only take value of type 'string' (because the values
    // are stored on DOM attributes). ko.selectExtensions provides a way for SELECTs/OPTIONs to have values
    // that are arbitrary objects. This is very convenient when implementing things like cascading dropdowns.
    var selectExtensions = {
        readValue : function(element) {
            switch (ko.utils.tagNameLower(element)) {
                case 'option':
                    if (element[hasDomDataExpandoProperty] === true)
                        return ko.domDataGet(element, ko.bindingHandlers.options.optionValueDomDataKey);
                    var elemValue = ko.domObservable(element, 'value')();
                    return ko.utils.ieVersion <= 7
                        ? (element.getAttributeNode('value') && element.getAttributeNode('value').specified ? elemValue : element.text)
                        : elemValue;
                case 'select':
                    var elemSelIndex = ko.domObservable(element, 'selectedIndex')();
                    return elemSelIndex >= 0 ? selectExtensions.readValue(element.options[elemSelIndex]) : undefined;
                default:
                    return ko.domObservable(element, 'value')();
            }
        },

        writeValue: function(element, value) {
            switch (ko.utils.tagNameLower(element)) {
                case 'option':
                    switch(typeof value) {
                        case "string":
                            ko.domDataSet(element, ko.bindingHandlers.options.optionValueDomDataKey, undefined);
                            if (hasDomDataExpandoProperty in element) { // IE <= 8 throws errors if you delete non-existent properties from a DOM node
                                delete element[hasDomDataExpandoProperty];
                            }
                            ko.domObservable(element, 'value')(value);
                            break;
                        default:
                            // Store arbitrary object using DomData
                            ko.domDataSet(element, ko.bindingHandlers.options.optionValueDomDataKey, value);
                            element[hasDomDataExpandoProperty] = true;

                            // Special treatment of numbers is just for backward compatibility. KO 1.2.1 wrote numerical values to element.value.
                            element.value = typeof value === "number" ? value : "";
                            break;
                    }
                    break;
                case 'select':
                    if (value === "")
                        value = undefined;
                    if (value === null || value === undefined)
                        element.selectedIndex = -1;
                    for (var i = element.options.length - 1; i >= 0; i--) {
                        if (selectExtensions.readValue(element.options[i]) == value) {
                            ko.domObservable(element, 'selectedIndex')(i);
                            break;
                        }
                    }
                    // for drop-down select, ensure first is selected
                    if (!(element.size > 1) && element.selectedIndex === -1) {
                        element.selectedIndex = 0;
                    }
                    break;
                default:
                    if (value == null)
                        value = "";
                    ko.domObservable(element, 'value')(value);
                    break;
            }
        }
    };

    return ko.exportProperties(selectExtensions,
        'readValue', selectExtensions.readValue,
        'writeValue', selectExtensions.writeValue
    );
})();

ko.exportSymbol('selectExtensions', ko.selectExtensions);
