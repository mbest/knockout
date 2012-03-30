// For certain common events (currently just 'click'), allow a simplified data-binding syntax
// e.g. click:handler instead of the usual full-length event:{click:handler}
var eventHandlersWithShortcuts = ['click'];
ko.utils.arrayForEach(eventHandlersWithShortcuts, function(eventName) {
    ko.bindingHandlers[eventName] = {
        'preprocess': function(val) {
            return [['event.' + eventName, val]];
        },
        'flags': bindingFlags_eventHandler,
        'init': function(element, valueAccessor, allBindingsAccessor, viewModel) {
            var newValueAccessor = function () {
                var result = {};
                result[eventName] = valueAccessor();
                return result;
            };
            return ko.bindingHandlers['event']['init'].call(this, element, newValueAccessor, allBindingsAccessor, viewModel);
        }
    }	
});


ko.bindingHandlers['event'] = {
    'flags': bindingFlags_eventHandler | bindingFlags_twoLevel,
    'init' : function (element, valueAccessor, allBindingsAccessor, viewModel) {
        var eventsToHandle = valueAccessor() || {};
        for(var eventNameOutsideClosure in eventsToHandle) {
            (function() {
                var eventName = eventNameOutsideClosure; // Separate variable to be captured by event handler closure
                if (typeof eventName == "string") {
                    ko.utils.registerEventHandler(element, eventName, function (event) {
                        var handlerReturnValue;
                        var handlerFunction = valueAccessor()[eventName];
                        if (!handlerFunction)
                            return;

                        try { 
                            // Take all the event args, and prefix with the viewmodel
                            var argsForHandler = ko.utils.makeArray(arguments);
                            argsForHandler.unshift(viewModel);
                            handlerReturnValue = handlerFunction.apply(viewModel, argsForHandler);
                        } finally {
                            if (handlerReturnValue !== true) { // Normally we want to prevent default action. Developer can override this be explicitly returning true.
                                if (event.preventDefault)
                                    event.preventDefault();
                                else
                                    event.returnValue = false;
                            }
                        }
                        
                        var bubble = allBindingsAccessor(eventName + 'Bubble') !== false;
                        if (!bubble) {
                            event.cancelBubble = true;
                            if (event.stopPropagation)
                                event.stopPropagation();
                        }
                    });
                }
            })();
        }
    }
};

ko.bindingHandlers['submit'] = {
    'flags': bindingFlags_eventHandler,
    'init': function (element, valueAccessor, allBindingsAccessor, viewModel) {
        if (typeof valueAccessor() != "function")
            throw new Error("The value for a submit binding must be a function");
        ko.utils.registerEventHandler(element, "submit", function (event) {
            var handlerReturnValue;
            var value = valueAccessor();
            try { handlerReturnValue = value.call(viewModel, element); }
            finally {
                if (handlerReturnValue !== true) { // Normally we want to prevent default action. Developer can override this be explicitly returning true.
                    if (event.preventDefault)
                        event.preventDefault();
                    else
                        event.returnValue = false;
                }
            }
        });
    }
};

ko.bindingHandlers['visible'] = {
    'update': function (element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        var isCurrentlyVisible = !(element.style.display == "none");
        if (value && !isCurrentlyVisible)
            element.style.display = "";
        else if ((!value) && isCurrentlyVisible)
            element.style.display = "none";
    }
}

ko.bindingHandlers['enable'] = {
    'update': function (element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        if (value && element.disabled)
            element.removeAttribute("disabled");
        else if ((!value) && (!element.disabled))
            element.disabled = true;
    }
};

ko.bindingHandlers['disable'] = { 
    'update': function (element, valueAccessor) { 
        return ko.bindingHandlers['enable']['update'](element, function() { return !ko.utils.unwrapObservable(valueAccessor()) }); 		
    } 	
};

ko.bindingHandlers['value'] = {
    'flags': bindingFlags_twoWay | bindingFlags_contentUpdate,
    'init': function (element, valueAccessor, allBindingsAccessor) { 
        // Always catch "change" event; possibly other events too if asked
        var eventsToCatch = ["change"];
        var requestedEventsToCatch = allBindingsAccessor("valueUpdate");
        if (requestedEventsToCatch) {
            if (typeof requestedEventsToCatch == "string") // Allow both individual event names, and arrays of event names
                requestedEventsToCatch = [requestedEventsToCatch];
            ko.utils.arrayPushAll(eventsToCatch, requestedEventsToCatch);
            eventsToCatch = ko.utils.arrayGetDistinctValues(eventsToCatch);
        }

        var valueUpdateHandler = function() {
            var modelValue = valueAccessor();
            var elementValue = ko.selectExtensions.readValue(element);
            ko.bindingExpressionRewriting.writeValueToProperty(modelValue, allBindingsAccessor, 'value', elementValue, /* checkIfDifferent: */ true);
        }

        // Workaround for https://github.com/SteveSanderson/knockout/issues/122
        // IE doesn't fire "change" events on textboxes if the user selects a value from its autocomplete list
        var ieAutoCompleteHackNeeded = ko.utils.ieVersion && element.tagName.toLowerCase() == "input" && element.type == "text"
                                       && element.autocomplete != "off" && (!element.form || element.form.autocomplete != "off");
        if (ieAutoCompleteHackNeeded && ko.utils.arrayIndexOf(eventsToCatch, "propertychange") == -1) {
            var propertyChangedFired = false;
            ko.utils.registerEventHandler(element, "propertychange", function () { propertyChangedFired = true });
            ko.utils.registerEventHandler(element, "blur", function() {
                if (propertyChangedFired) {
                    propertyChangedFired = false;
                    valueUpdateHandler();
                }
            });
        }

        ko.utils.arrayForEach(eventsToCatch, function(eventName) {
            // The syntax "after<eventname>" means "run the handler asynchronously after the event"
            // This is useful, for example, to catch "keydown" events after the browser has updated the control
            // (otherwise, ko.selectExtensions.readValue(this) will receive the control's value *before* the key event)
            var handler = valueUpdateHandler;
            if (ko.utils.stringStartsWith(eventName, "after")) {
                handler = function() { setTimeout(valueUpdateHandler, 0) };
                eventName = eventName.substring("after".length);
            }
            ko.utils.registerEventHandler(element, eventName, handler);
        });
    },
    'update': function (element, valueAccessor) {
        var valueIsSelectOption = ko.utils.tagNameLower(element) === "select";
        var newValue = ko.utils.unwrapObservable(valueAccessor());
        var elementValue = ko.selectExtensions.readValue(element);
        var valueHasChanged = (newValue != elementValue);
        
        // JavaScript's 0 == "" behavious is unfortunate here as it prevents writing 0 to an empty text box (loose equality suggests the values are the same). 
        // We don't want to do a strict equality comparison as that is more confusing for developers in certain cases, so we specifically special case 0 != "" here.
        if ((newValue === 0) && (elementValue !== 0) && (elementValue !== "0"))
            valueHasChanged = true;
        
        if (valueHasChanged) {
            var applyValueAction = function () { ko.selectExtensions.writeValue(element, newValue); };
            applyValueAction();

            // Workaround for IE6 bug: It won't reliably apply values to SELECT nodes during the same execution thread
            // right after you've changed the set of OPTION nodes on it. So for that node type, we'll schedule a second thread
            // to apply the value as well.
            if (valueIsSelectOption) {
                // If you try to set a model value that can't be represented in an already-populated dropdown, reject that change,
                // because you're not allowed to have a model value that disagrees with a visible UI selection.
                if (newValue !== ko.selectExtensions.readValue(element))
                    ko.utils.triggerEvent(element, "change");
                else
                    setTimeout(applyValueAction);
            }
        }
    }
};

ko.bindingHandlers['options'] = {
    'flags': bindingFlags_contentBind | bindingFlags_contentSet,
    'update': function (element, valueAccessor, allBindingsAccessor) {
        if (ko.utils.tagNameLower(element) !== "select")
            throw new Error("options binding applies only to SELECT elements");

        var selectWasPreviouslyEmpty = element.length == 0;
        var previousSelectedValues = ko.utils.arrayMap(ko.utils.arrayFilter(element.childNodes, function (node) {
            return node.tagName && (ko.utils.tagNameLower(node) === "option") && node.selected;
        }), function (node) {
            return ko.selectExtensions.readValue(node) || node.innerText || node.textContent;
        });
        var previousScrollTop = element.scrollTop;

        var value = ko.utils.unwrapObservable(valueAccessor());
        var selectedValue = element.value;

        // Remove all existing <option>s. 
        // Need to use .remove() rather than .removeChild() for <option>s otherwise IE behaves oddly (https://github.com/SteveSanderson/knockout/issues/134)
        while (element.length > 0) {
            ko.cleanNode(element.options[0]);
            element.remove(0);
        }

        if (value) {
            var allBindings = allBindingsAccessor();
            if (typeof value.length != "number")
                value = [value];
            if (allBindings['optionsCaption']) {
                var option = document.createElement("option");
                ko.utils.setHtml(option, allBindings['optionsCaption']);
                ko.selectExtensions.writeValue(option, undefined);
                element.appendChild(option);
            }
            for (var i = 0, j = value.length; i < j; i++) {
                var option = document.createElement("option");
                
                // Apply a value to the option element
                var optionValue = typeof allBindings['optionsValue'] == "string" ? value[i][allBindings['optionsValue']] : value[i];
                optionValue = ko.utils.unwrapObservable(optionValue);
                ko.selectExtensions.writeValue(option, optionValue);
                
                // Apply some text to the option element
                var optionsTextValue = allBindings['optionsText'];
                var optionText;
                if (typeof optionsTextValue == "function")
                    optionText = optionsTextValue(value[i]); // Given a function; run it against the data value
                else if (typeof optionsTextValue == "string")
                    optionText = value[i][optionsTextValue]; // Given a string; treat it as a property name on the data value
                else
                    optionText = optionValue;				 // Given no optionsText arg; use the data value itself
                optionText = ko.utils.unwrapObservable(optionText);

                option.appendChild(document.createTextNode((optionText === null || optionText === undefined) ? "" : optionText));

                element.appendChild(option);
            }

            // IE6 doesn't like us to assign selection to OPTION nodes before they're added to the document.
            // That's why we first added them without selection. Now it's time to set the selection.
            var newOptions = element.getElementsByTagName("option");
            var countSelectionsRetained = 0;
            for (var i = 0, j = newOptions.length; i < j; i++) {
                if (ko.utils.arrayIndexOf(previousSelectedValues, ko.selectExtensions.readValue(newOptions[i])) >= 0) {
                    ko.utils.setOptionNodeSelectionState(newOptions[i], true);
                    countSelectionsRetained++;
                }
            }
            element.scrollTop = previousScrollTop;

            if (countSelectionsRetained < previousSelectedValues.length)
                ko.utils.triggerEvent(element, "change");

            // Workaround for IE9 bug
            ko.utils.ensureSelectElementIsRenderedCorrectly(element);
        }
    }
};
ko.bindingHandlers['options'].optionValueDomDataKey = ko.utils.domData.nextKey();

ko.bindingHandlers['selectedOptions'] = {
    'flags': bindingFlags_twoWay | bindingFlags_contentUpdate,
    getSelectedValuesFromSelectNode: function (selectNode) {
        var result = [];
        var nodes = selectNode.childNodes;
        for (var i = 0, j = nodes.length; i < j; i++) {
            var node = nodes[i], tagName = ko.utils.tagNameLower(node);
            if (tagName == "option" && node.selected)
                result.push(ko.selectExtensions.readValue(node));
            else if (tagName == "optgroup") {
                var selectedValuesFromOptGroup = ko.bindingHandlers['selectedOptions'].getSelectedValuesFromSelectNode(node);
                Array.prototype.splice.apply(result, [result.length, 0].concat(selectedValuesFromOptGroup)); // Add new entries to existing 'result' instance
            }
        }
        return result;
    },
    'init': function (element, valueAccessor, allBindingsAccessor) {
        ko.utils.registerEventHandler(element, "change", function () { 
            var value = valueAccessor();
            var valueToWrite = ko.bindingHandlers['selectedOptions'].getSelectedValuesFromSelectNode(this);
            ko.bindingExpressionRewriting.writeValueToProperty(value, allBindingsAccessor, 'value', valueToWrite);
        });    	
    },
    'update': function (element, valueAccessor) {
        if (ko.utils.tagNameLower(element) != "select")
            throw new Error("values binding applies only to SELECT elements");

        var newValue = ko.utils.unwrapObservable(valueAccessor());
        if (newValue && typeof newValue.length == "number") {
            var nodes = element.childNodes;
            for (var i = 0, j = nodes.length; i < j; i++) {
                var node = nodes[i];
                if (ko.utils.tagNameLower(node) === "option")
                    ko.utils.setOptionNodeSelectionState(node, ko.utils.arrayIndexOf(newValue, ko.selectExtensions.readValue(node)) >= 0);
            }
        }
    }
};

ko.bindingHandlers['text'] = {
    'flags': bindingFlags_contentBind | bindingFlags_contentSet | bindingFlags_canUseVirtual,
    'init': function(element) {
        ko.virtualElements.setDomNodeChildren(element, [document.createTextNode("")]);
    },
    'update': function (element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        ko.virtualElements.firstChild(element).data = (value === null || value === undefined) ? "" : value;
    }
};

ko.bindingHandlers['html'] = {
    'flags': bindingFlags_contentBind | bindingFlags_contentSet,
    'update': function (element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        ko.utils.setHtml(element, value);
    }
};

ko.bindingHandlers['css'] = {
    'flags': bindingFlags_twoLevel,
    'update': function (element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor() || {});
        for (var className in value) {
            if (typeof className == "string") {
                var shouldHaveClass = ko.utils.unwrapObservable(value[className]);
                ko.utils.toggleDomNodeCssClass(element, className, shouldHaveClass);
            }
        }
    }
};

ko.bindingHandlers['style'] = {
    'flags': bindingFlags_twoLevel,
    'update': function (element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor() || {});
        for (var styleName in value) {
            if (typeof styleName == "string") {
                var styleValue = ko.utils.unwrapObservable(value[styleName]);
                element.style[styleName] = styleValue || ""; // Empty string removes the value, whereas null/undefined have no effect
            }
        }
    }
};

ko.bindingHandlers['uniqueName'] = {
    'flags': bindingFlags_noValue,
    'init': function (element, valueAccessor) {
        if (valueAccessor()) {
            element.name = "ko_unique_" + (++ko.bindingHandlers['uniqueName'].currentIndex);

            // Workaround IE 6/7 issue
            // - https://github.com/SteveSanderson/knockout/issues/197
            // - http://www.matts411.com/post/setting_the_name_attribute_in_ie_dom/
            if (ko.utils.isIe6 || ko.utils.isIe7)
                element.mergeAttributes(document.createElement("<input name='" + element.name + "'/>"), false);
        }
    }
};
ko.bindingHandlers['uniqueName'].currentIndex = 0;

ko.bindingHandlers['checked'] = {
    'flags': bindingFlags_twoWay,
    'init': function (element, valueAccessor, allBindingsAccessor) {
        var updateHandler = function() {            
            var valueToWrite;
            if (element.type == "checkbox") {
                valueToWrite = element.checked;
            } else if ((element.type == "radio") && (element.checked)) {
                valueToWrite = element.value;
            } else {
                return; // "checked" binding only responds to checkboxes and selected radio buttons
            }
            
            var modelValue = valueAccessor();                 
            if ((element.type == "checkbox") && (ko.utils.unwrapObservable(modelValue) instanceof Array)) {
                // For checkboxes bound to an array, we add/remove the checkbox value to that array
                // This works for both observable and non-observable arrays
                var existingEntryIndex = ko.utils.arrayIndexOf(ko.utils.unwrapObservable(modelValue), element.value);
                if (element.checked && (existingEntryIndex < 0))
                    modelValue.push(element.value);
                else if ((!element.checked) && (existingEntryIndex >= 0))
                    modelValue.splice(existingEntryIndex, 1);
            } else {
                ko.bindingExpressionRewriting.writeValueToProperty(modelValue, allBindingsAccessor, 'checked', valueToWrite, true);
            }
        };
        ko.utils.registerEventHandler(element, "click", updateHandler);

        // IE 6 won't allow radio buttons to be selected unless they have a name
        if ((element.type == "radio") && !element.name)
            ko.bindingHandlers['uniqueName']['init'](element, function() { return true });
    },
    'update': function (element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        
        if (element.type == "checkbox") {        	
            if (value instanceof Array) {
                // When bound to an array, the checkbox being checked represents its value being present in that array
                element.checked = ko.utils.arrayIndexOf(value, element.value) >= 0;
            } else {
                // When bound to anything other value (not an array), the checkbox being checked represents the value being trueish
                element.checked = value;	
            }            
        } else if (element.type == "radio") {
            element.checked = (element.value == value);
        }
    }
};

var attrHtmlToJavascriptMap = { 'class': 'className', 'for': 'htmlFor' };
ko.bindingHandlers['attr'] = {
    'flags': bindingFlags_twoLevel,
    'update': function(element, valueAccessor, allBindingsAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor()) || {};
        for (var attrName in value) {
            if (typeof attrName == "string") {
                var attrValue = ko.utils.unwrapObservable(value[attrName]);

                // To cover cases like "attr: { checked:someProp }", we want to remove the attribute entirely 
                // when someProp is a "no value"-like value (strictly null, false, or undefined)
                // (because the absence of the "checked" attr is how to mark an element as not checked, etc.)                
                var toRemove = (attrValue === false) || (attrValue === null) || (attrValue === undefined);
                if (toRemove)
                    element.removeAttribute(attrName);

                // In IE <= 7 and IE8 Quirks Mode, you have to use the Javascript property name instead of the 
                // HTML attribute name for certain attributes. IE8 Standards Mode supports the correct behavior,
                // but instead of figuring out the mode, we'll just set the attribute through the Javascript 
                // property for IE <= 8.
                if (ko.utils.ieVersion <= 8 && attrName in attrHtmlToJavascriptMap) {
                    attrName = attrHtmlToJavascriptMap[attrName];
                    if (toRemove)
                        element.removeAttribute(attrName);
                    else
                        element[attrName] = attrValue;
                } else if (!toRemove) {
                    element.setAttribute(attrName, attrValue.toString());
                }
            }
        }
    }
};

ko.bindingHandlers['withlight'] = {
    'flags': bindingFlags_contentBind | bindingFlags_canUseVirtual,
    'preprocess': function(val, key) {
        var match = val.match(/^\s*([$\w]+)\s*=\s*([^=][\s\S]*)$/);
        return match ? [ [key, match[2]], ['withItemName', '"' + match[1] + '"'] ] : val;
    },
    'init': function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var innerContext = bindingContext['createChildContext'](function() {
                return ko.utils.unwrapObservable(valueAccessor());
            }, allBindingsAccessor('withItemName') );
        ko.applyBindingsToDescendants(innerContext, element, true);
    }
};

ko.bindingHandlers['hasfocus'] = {
    'flags': bindingFlags_twoWay,
    'init': function(element, valueAccessor, allBindingsAccessor) {
        var writeValue = function(valueToWrite) {
            var modelValue = valueAccessor();
            ko.bindingExpressionRewriting.writeValueToProperty(modelValue, allBindingsAccessor, 'hasfocus', valueToWrite, true);
        };
        ko.utils.registerEventHandler(element, "focus", function() { writeValue(true) });
        ko.utils.registerEventHandler(element, "focusin", function() { writeValue(true) }); // For IE
        ko.utils.registerEventHandler(element, "blur",  function() { writeValue(false) });
        ko.utils.registerEventHandler(element, "focusout",  function() { writeValue(false) }); // For IE
    },
    'update': function(element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        value ? element.focus() : element.blur();
        ko.utils.triggerEvent(element, value ? "focusin" : "focusout"); // For IE, which doesn't reliably fire "focus" or "blur" events synchronously
    }
};

/*var withDomDataKey = ko.utils.domData.nextKey();
ko.bindingHandlers['withbroken'] = {
    'flags': bindingFlags_contentBind | bindingFlags_canUseVirtual,
    'update': function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var withData = ko.domDataGet(element, withDomDataKey) || {},
            isBound = withData.isBound, container = withData.container,
            dataValue = ko.utils.unwrapObservable(valueAccessor());

        if (!isBound && dataValue) {
            if (container)
                ko.virtualElements.setDomNodeChildren(element, ko.utils.makeArray(container.childNodes));
            var innerContext = bindingContext['createChildContext'](function() {
                return ko.utils.unwrapObservable(valueAccessor());
            });
            ko.applyBindingsToDescendants(innerContext, element, true);
            ko.domDataSet(element, withDomDataKey, {isBound: true});
        }
        else if (!dataValue && !container) {
            var nodeArray = ko.virtualElements.childNodes(element);
            if (isBound)
                ko.utils.arrayForEach(nodeArray, ko.disposeNode);
            container = ko.utils.moveNodesToContainerElement(nodeArray);
            ko.domDataSet(element, withDomDataKey, {container: container});
        }
    }
};*/

function templateBasedBinding(makeOptionsFunction) {
    function makeTemplateValueAccessor(valueAccessor) {
        return function() {
            var options = {'templateEngine': ko.nativeTemplateEngine.instance};
            makeOptionsFunction(valueAccessor(), options);
            return options;
        };
    }
    return {
        'flags': bindingFlags_contentBind | bindingFlags_canUseVirtual,
        'init': function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            return ko.bindingHandlers['template']['init'](element, makeTemplateValueAccessor(valueAccessor));
        },
        'update': function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            return ko.bindingHandlers['template']['update'](element, makeTemplateValueAccessor(valueAccessor), allBindingsAccessor, viewModel, bindingContext);
        }
    };
}

// "with: someExpression" is equivalent to "template: { if: someExpression, data: someExpression }"
ko.bindingHandlers['with'] = templateBasedBinding( function(value, options) { options['if'] = value; options['data'] = value; });

// "if: someExpression" is equivalent to "template: { if: someExpression }"
ko.bindingHandlers['if'] = templateBasedBinding( function(value, options) { options['if'] = value; });

// "ifnot: someExpression" is equivalent to "template: { ifnot: someExpression }"
ko.bindingHandlers['ifnot'] = templateBasedBinding( function(value, options) { options['ifnot'] = value; });

// "foreach: someExpression" is equivalent to "template: { foreach: someExpression }"
// "foreach: { data: someExpression, afterAdd: myfn }" is equivalent to "template: { foreach: someExpression, afterAdd: myfn }"
ko.bindingHandlers['foreach'] = templateBasedBinding(
    function(value, options) {
        if ((!value) || typeof value.length == "number") {
            // If bindingValue is the array, just pass it on its own
            options['foreach'] = value;
        } else {
            // If bindingValue is a object with options, copy it and set foreach to the data value
            ko.utils.extendInternal(options, value);
            options['foreach'] = options['data'];
            delete options['name'];   // don't allow named templates
        }
    });
