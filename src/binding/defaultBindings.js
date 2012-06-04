function setUpTwoWayBinding(element, modelValue, elemUpdater, elemValue, modelUpdater) {
    var isUpdating = false,
        shouldSet = false;

    function updateOnChange(source, callback) {
        ko.utils.possiblyWrap(function() {
            var value = ko.isObservable(source) ? source() : ko.utils.unwrapObservable(source());
            if (shouldSet && !isUpdating) {
                isUpdating = true;
                ko.ignoreDependencies(callback, null, [value]);
                isUpdating = false;
            }
        }, element);
    };

    // Update model from view when changed (but not updated initially)
    updateOnChange(elemValue, modelUpdater);

    // Update view from model initially and when changed
    shouldSet = true;
    updateOnChange(modelValue, elemUpdater);
}


// For certain common events (currently just 'click'), allow a simplified data-binding syntax
// e.g. click:handler instead of the usual full-length event:{click:handler}
var eventHandlersWithShortcuts = ['click'];
ko.utils.arrayForEach(eventHandlersWithShortcuts, function(eventName) {
    ko.bindingHandlers[eventName] = {
        'preprocess': function(val, key, addBinding) {
            addBinding('event.' + eventName, val);
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
        ko.domObservable(element, 'disabled').setAsAttribute(!value);
    }
};

ko.bindingHandlers['disable'] = {
    'update': function (element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        ko.domObservable(element, 'disabled').setAsAttribute(value);
    }
};

ko.bindingHandlers['value'] = {
    'flags': bindingFlags_twoWay | bindingFlags_contentUpdate,
    'init': function (element, valueAccessor, allBindingsAccessor) {
        var elementIsSelect = ko.utils.tagNameLower(element) == "select";
        var elemProperty = elementIsSelect ? "selectedIndex" : "value";

        function modelUpdater(newValue) {
            ko.bindingExpressionRewriting.writeValueToProperty(valueAccessor(), allBindingsAccessor, 'value', newValue, /* checkIfDifferent: */ true);
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
            valueAccessor, function(newValue) {
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

var classesWrittenByBindingKey = '__ko__cssValue';
ko.bindingHandlers['css'] = {
    'flags': bindingFlags_twoLevel,
    'update': function (element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        if (typeof value == "object") {
            for (var className in value) {
                var shouldHaveClass = ko.utils.unwrapObservable(value[className]);
                ko.utils.toggleDomNodeCssClass(element, className, shouldHaveClass);
            }
        } else {
            value = String(value || ''); // Make sure we don't try to store or set a non-string value
            ko.utils.toggleDomNodeCssClass(element, element[classesWrittenByBindingKey], false);
            element[classesWrittenByBindingKey] = value;
            ko.utils.toggleDomNodeCssClass(element, value, true);
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
            ko.domObservable(element, 'name')("ko_unique_" + (++ko.bindingHandlers['uniqueName'].currentIndex));
        }
    }
};
ko.bindingHandlers['uniqueName'].currentIndex = 0;

ko.bindingHandlers['checked'] = {
    'flags': bindingFlags_twoWay,
    'init': function (element, valueAccessor, allBindingsAccessor) {
        var elemValue = ko.domObservable(element, 'value'),
            elemChecked = ko.domObservable(element, 'checked', 'click');
        switch (element.type) {
            case "checkbox":
                if (ko.utils.unwrapObservable(valueAccessor()) instanceof Array) {
                    // When bound to an array, the checkbox being checked represents its value being present in that array
                    setUpTwoWayBinding(element,
                        function() {
                            return (ko.utils.arrayIndexOf(ko.utils.unwrapObservable(valueAccessor()), elemValue()) >= 0);
                        }, elemChecked,
                        elemChecked, function(checkedValue) {
                            // For checkboxes bound to an array, we add/remove the checkbox value to that array
                            // This works for both observable and non-observable arrays
                            ko.utils.addOrRemoveItem(valueAccessor(), elemValue(), checkedValue);
                        });
                } else {
                    // When bound to anything other value (not an array), the checkbox being checked represents the value being trueish
                    setUpTwoWayBinding(element,
                        valueAccessor, elemChecked,
                        elemChecked, function(checkedValue) {
                            ko.bindingExpressionRewriting.writeValueToProperty(valueAccessor(), allBindingsAccessor, 'checked', checkedValue, true);
                        });
                }
                break;
            case "radio":
                // IE 6 won't allow radio buttons to be selected unless they have a name
                if (!element.name)
                    ko.bindingHandlers['uniqueName']['init'](element, function() { return true });
                setUpTwoWayBinding(element,
                    valueAccessor, function(newValue) {
                        elemChecked(elemValue() == newValue);
                    },
                    function() {
                        return elemChecked() ? elemValue : null;
                    }, function(newValue) {
                        if (newValue !== null)
                            ko.bindingExpressionRewriting.writeValueToProperty(valueAccessor(), allBindingsAccessor, 'checked', newValue, true);
                    });
                break;
        }
    }
};

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

ko.bindingHandlers['withlight'] = {
    'flags': bindingFlags_contentBind | bindingFlags_canUseVirtual,
    'preprocess': function(val, key, addBinding) {
        var match = val.match(/^\s*([$\w]+)\s*=\s*([^=][\s\S]*)$/);
        if (match)
            addBinding('withItemName', '"' + match[1] + '"');
        return match ? match[2] : val;
    },
    'init': function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var innerContext = bindingContext['createChildContext'](function() {
                return ko.utils.unwrapObservable(valueAccessor());
            }, allBindingsAccessor('withItemName') );
        ko.applyBindingsToDescendants(innerContext, element);
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

var withDomDataKey = ko.utils.domData.nextKey();
ko.bindingHandlers['with'] = {
    'flags': bindingFlags_contentBind | bindingFlags_canUseVirtual,
    'init': function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var dataValue = ko.utils.unwrapObservable(valueAccessor()),
            nodesArray = ko.virtualElements.childNodes(element),
            savedDataValue = ko.observable(dataValue);

        if (dataValue) {
            // When the data value is initially true, save a copy of the nodes (and bind to the originals)
            nodesArray = ko.utils.cloneNodes(nodesArray);
            ko.applyBindingsToDescendants(bindingContext['createChildContext'](savedDataValue), element);
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
            nodesArray = ko.utils.cloneNodes(withData.savedNodes.childNodes);
            ko.virtualElements.setDomNodeChildren(element, nodesArray);
            savedDataValue(dataValue);
            ko.applyBindingsToDescendants(bindingContext['createChildContext'](savedDataValue), element);
        }
    }
};

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
//ko.bindingHandlers['with'] = templateBasedBinding( function(value, options) { options['if'] = value; options['data'] = value; });

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
