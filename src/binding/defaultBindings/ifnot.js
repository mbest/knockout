// Support a short-hand syntax of "key.subkey: value". The "key.subkey" binding
// handler will be created as needed (through ko.getBindingHandler) but can also be
// created initially (as event.click is).
var keySubkeyMatch = /([^\.]+)\.(.+)/, keySubkeyBindingDivider = '.';
function makeKeySubkeyBinding(bindingKey) {
    var match = bindingKey.match(keySubkeyMatch);
    if (match) {
        var baseKey = match[1],
            baseHandler = ko.bindingHandlers[baseKey];
        if (baseHandler) {
            var subKey = match[2],
                makeSubHandler = baseHandler['makeSubkeyHandler'] || makeDefaultKeySubkeyHandler,
                subHandler = makeSubHandler.call(baseHandler, baseKey, subKey, bindingKey);
            ko.virtualElements.allowedBindings[bindingKey] = ko.virtualElements.allowedBindings[baseKey];
            return (ko.bindingHandlers[bindingKey] = subHandler);
        }
    }
}

// Create a binding handler that translates a binding of "binding: value" to
// "basekey: {subkey: value}". Compatible with these default bindings: event, attr, css, style.
function makeDefaultKeySubkeyHandler(baseKey, subKey) {
    var subHandler = ko.utils.extendInternal({}, this);
    subHandler['flags'] ^= bindingFlags_twoLevel;   // remove two-level flag if it exists
    function setHandlerFunction(funcName) {
        if (subHandler[funcName]) {
            subHandler[funcName] = function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                function subValueAccessor() {
                    var result = {};
                    result[subKey] = valueAccessor();
                    return result;
                }
                return ko.bindingHandlers[baseKey][funcName](element, subValueAccessor, allBindingsAccessor, viewModel, bindingContext);
            };
        }
    }
    ko.utils.arrayForEach(['init', 'update'], setHandlerFunction);
    return subHandler;
}

function setUpTwoWayBinding(element, modelValue, elemUpdater, elemValue, modelUpdater) {
    var isUpdating = false,
        shouldSet = false;

    function updateOnChange(source, callback) {
        ko.utils.possiblyWrap(function() {
            var value = ko.utils.unwrapObservable(source());
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

// For certain common events (currently just 'click'), allow a simplified data-binding syntax
// e.g. click:handler instead of the usual full-length event:{click:handler}
ko.bindingHandlers['click'] = makeKeySubkeyBinding('event' + keySubkeyBindingDivider + 'click');

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
    'update': function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        if (ko.utils.tagNameLower(element) !== "select")
            throw new Error("options binding applies only to SELECT elements");

        var selectWasPreviouslyEmpty = element.length == 0;
        var countSelectionsRetained = 0;
        var previousSelectedIndex = element.selectedIndex;
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
            var allBindings = allBindingsAccessor(),
                includeDestroyed = allBindings['optionsIncludeDestroyed'];

            if (typeof value.length != "number")
                value = [value];
            var optionsBind = allBindings['optionsBind'];
            if (allBindings['optionsCaption']) {
                var option = document.createElement("option");
                ko.utils.setHtml(option, allBindings['optionsCaption']);
                ko.selectExtensions.writeValue(option, undefined);
                element.appendChild(option);
            }

            for (var i = 0, j = value.length; i < j; i++) {
                // Skip destroyed items
                var arrayEntry = value[i];
                if (arrayEntry && arrayEntry['_destroy'] && !includeDestroyed)
                    continue;

                var option = document.createElement("option");

                function applyToObject(object, predicate, defaultValue) {
                    var predicateType = typeof predicate;
                    if (predicateType == "function")    // Given a function; run it against the data value
                        return predicate(object);
                    else if (predicateType == "string") // Given a string; treat it as a property name on the data value
                        return object[predicate];
                    else                                // Given no optionsText arg; use the data value itself
                        return defaultValue;
                }

                // Apply a value to the option element
                var optionValue = applyToObject(arrayEntry, allBindings['optionsValue'], arrayEntry);
                ko.selectExtensions.writeValue(option, ko.utils.unwrapObservable(optionValue));

                // Apply some text to the option element
                var optionText = applyToObject(arrayEntry, allBindings['optionsText'], optionValue);
                optionText = ko.utils.unwrapObservable(optionText);
                option.appendChild(document.createTextNode((optionText == null) ? "" : optionText));

                element.appendChild(option);

                if (optionsBind) {
                    var optionContext = bindingContext['createChildContext'](value[i]),
                        optionsParseBindings = function() {
                            return ko.bindingProvider['instance']['parseBindingsString'](optionsBind, optionContext) };
                    ko.applyBindingsToNode(option, optionsParseBindings, optionContext);
                }
            }

            // IE6 doesn't like us to assign selection to OPTION nodes before they're added to the document.
            // That's why we first added them without selection. Now it's time to set the selection.
            var newOptions = element.getElementsByTagName("option");
            for (var i = 0, j = newOptions.length; i < j; i++) {
                if (ko.utils.arrayIndexOf(previousSelectedValues, ko.selectExtensions.readValue(newOptions[i])) >= 0) {
                    ko.utils.setOptionNodeSelectionState(newOptions[i], true);
                    countSelectionsRetained++;
                }
            }
            element.scrollTop = previousScrollTop;

            // Workaround for IE9 bug
            ko.utils.ensureSelectElementIsRenderedCorrectly(element);
        }

        if (countSelectionsRetained < previousSelectedValues.length || (previousSelectedIndex === -1 && element.selectedIndex === 0))
            ko.utils.triggerEvent(element, "change");
    }
};
ko.bindingHandlers['options'].optionValueDomDataKey = ko.utils.domData.nextKey();

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

        var elemChangeObservable = ko.domObservable(element, '__ko_options', 'change');
        function getSelectedValuesFromSelectNode() {
            elemChangeObservable();   // update on change events
            return ko.utils.arrayMap(ko.utils.arrayFilter(options, isOptionSelected), ko.selectExtensions.readValue);
        }

        function modelUpdater(newValue) {
            ko.expressionRewriting.writeValueToProperty(valueAccessor(), allBindingsAccessor, 'value', newValue);
        };

        setUpTwoWayBinding(element,
            valueAccessor, elementUpdater,
            getSelectedValuesFromSelectNode, modelUpdater);
    }
};

ko.bindingHandlers['text'] = {
    'flags': bindingFlags_contentBind | bindingFlags_contentSet | bindingFlags_canUseVirtual,
    'init': function(element) {
        ko.virtualElements.setDomNodeChildren(element, [document.createTextNode("")]);
    },
    'update': function (element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        ko.virtualElements.firstChild(element).data = (value == null) ? "" : value;

        // Workaround for an IE9 rendering bug - https://github.com/SteveSanderson/knockout/issues/209
        if (ko.utils.ieVersion >= 9) {
            // For text nodes and comment nodes (most likely virtual elements), we will have to refresh the container
            var node = element.nodeType == 1 ? element : element.parentNode;
            if (node.style)
                node.style.zoom = node.style.zoom;
        }
    }
};

ko.bindingHandlers['html'] = {
    'flags': bindingFlags_contentBind | bindingFlags_contentSet,
    'update': function (element, valueAccessor) {
        // setHtml will unwrap the value if needed
        ko.utils.setHtml(element, valueAccessor());
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
        if (element.type == "checkbox") {
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
                        ko.expressionRewriting.writeValueToProperty(valueAccessor(), allBindingsAccessor, 'checked', checkedValue, true);
                    });
            }
        } else if (element.type == "radio") {
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
                        ko.expressionRewriting.writeValueToProperty(valueAccessor(), allBindingsAccessor, 'checked', newValue, true);
                });
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

function preprocessAs(val, key, addBinding) {
    var match = val.match(/^([\s\S]+)\s+as\s+([$\w]+)\s*$/);
    if (match)
        addBinding('as', '"' + match[2] + '"');
    return match ? match[1] : val;
};

ko.bindingHandlers['withlight'] = {
    'flags': bindingFlags_contentBind | bindingFlags_canUseVirtual,
    'preprocess': preprocessAs,
    'init': function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var innerContext = bindingContext['createChildContext'](function() {
                return ko.utils.unwrapObservable(valueAccessor());
            }, allBindingsAccessor('as') );
        ko.applyBindingsToDescendants(innerContext, element);
    }
};

ko.bindingHandlers['let'] = {
    'flags': bindingFlags_contentBind | bindingFlags_canUseVirtual,
    'init': function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        // Make a modified binding context, with extra properties, and apply it to descendant elements
        var innerContext = bindingContext['extend'](valueAccessor);
        ko.applyBindingsToDescendants(innerContext, element);
    }
};

ko.bindingHandlers['hasfocus'] = {
    'flags': bindingFlags_twoWay,
    'init': function(element, valueAccessor, allBindingsAccessor) {
        var elemFocusObservable = ko.domObservable(element, '__ko_focus', ['focus', 'blur', 'focusin', 'focusout']);

        setUpTwoWayBinding(element, valueAccessor, function(newValue) {
            newValue ? element.focus() : element.blur();
            // For IE, which doesn't reliably fire "focus" or "blur" events synchronously
            ko.utils.triggerEvent(element, newValue ? "focusin" : "focusout");
        },
        function() {
            // set up and access an unrelated property to get event updates
            elemFocusObservable();
            return element.ownerDocument.activeElement === element;
        }, function(newValue) {
            ko.expressionRewriting.writeValueToProperty(valueAccessor(), allBindingsAccessor, 'hasfocus', newValue, true);
        });
    }
};

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

function templateBasedBinding(makeOptionsFunction, preprocess) {
    function makeTemplateValueAccessor(valueAccessor, allBindingsAccessor) {
        return function() {
            var options = {'templateEngine': ko.nativeTemplateEngine.instance};
            makeOptionsFunction(valueAccessor(), options, allBindingsAccessor);
            return options;
        };
    }
    return {
        'flags': bindingFlags_contentBind | bindingFlags_canUseVirtual,
        'preprocess': preprocess,
        'init': function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            return ko.bindingHandlers['template']['init'](element, makeTemplateValueAccessor(valueAccessor, allBindingsAccessor));
        },
        'update': function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            return ko.bindingHandlers['template']['update'](element, makeTemplateValueAccessor(valueAccessor, allBindingsAccessor), allBindingsAccessor, viewModel, bindingContext);
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
    function(value, options, allBindingsAccessor) {
        if ((!value) || typeof value.length == "number") {
            // If bindingValue is the array, just pass it on its own
            options['foreach'] = value;
            options['as'] = allBindingsAccessor('as');
        } else {
            // If bindingValue is a object with options, copy it and set foreach to the data value
            ko.utils.extendInternal(options, value);
            options['foreach'] = options['data'];
            delete options['name'];   // don't allow named templates
        }
    }, preprocessAs);
