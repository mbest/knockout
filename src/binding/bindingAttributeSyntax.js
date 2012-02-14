/** @const */ var bindingFlags_twoWay=01;
/** @const */ var bindingFlags_eventHandler=02;
/** @const */ var bindingFlags_twoLevel=04;
/** @const */ var bindingFlags_contentSet=010;
/** @const */ var bindingFlags_contentBind=020;
/** @const */ var bindingFlags_contentUpdate=040;
/** @const */ var bindingFlags_canUseVirtual=0100;
/** @const */ var bindingFlags_noValue=0200;

// Internal flag for bindings used by the binding system itself
/** @const */ var bindingFlags_builtIn=01000;

(function () {
    ko.bindingFlags = {
        'twoWay': bindingFlags_twoWay,
            // Two-way bindings initialliy write to the DOM from the model,
            // but also will update the model property if the DOM changes
        'eventHandler': bindingFlags_eventHandler,
            // Event handler bindings call the given function in response to an event
        'contentBind': bindingFlags_contentBind,
            // Content-bind bindings are responsible for binding (or not) their contents
        'contentSet': bindingFlags_contentSet,
            // Content-set bindings erase or set their contents
        'contentUpdate': bindingFlags_contentUpdate,
            // Content-update bindings modify their contents after the content nodes bindings have run
        'noValue': bindingFlags_noValue,
            // No-value bindings don't require a value (default value is true)
        'twoLevel': bindingFlags_twoLevel,
            // Two-level bindings are like {attr.href: value} or {attr: {href: value}}
        'canUseVirtual': bindingFlags_canUseVirtual
            // Virtual element bindings can be used in comments: <!-- ko if: value --><!-- /ko -->
    };

    ko.checkBindingFlags = function(binding, flagsSet, flagsUnset) {
        return (!flagsSet || (binding['flags'] & flagsSet)) && !(binding['flags'] & flagsUnset);
    };

    ko.bindingHandlers = {};

    // Accepts either a data value or a value accessor function; note that an observable qualifies as a value accessor function
    ko.bindingContext = function(dataItemOrValueAccessor, parent, options) {
        var self = this, isFunc = typeof(dataItemOrValueAccessor) == "function";
        self._subscribable = ko.utils.possiblyWrap(parent ?
            function() {
                var oldSubscribable = self._subscribable;   // save previous subscribable value
                // copy $root, $options, and any custom properties from parent binding context
                ko.utils.extendInternal(self, parent);
                self._subscribable = oldSubscribable;       // restore subscribable value
                if (parent._subscribable)
                    ko.dependencyDetection.registerDependency(parent._subscribable);
                // set our properties
                ko.utils.extendInternal(self['$options'], options);
                self['$parentContext'] = parent;
                self['$parents'] = parent['$parents'].slice(0);
                self['$parents'].unshift(self['$parent'] = parent['$data']);
                self['$data'] = isFunc ? dataItemOrValueAccessor() : dataItemOrValueAccessor;
            } :
            function() {
                self['$options'] = options || {};
                self['$parents'] = [];
                self['$root'] = self['$data'] = isFunc ? dataItemOrValueAccessor() : dataItemOrValueAccessor;
            }
        );
    }
    ko.bindingContext.prototype['createChildContext'] = function (dataItemOrValueAccessor) {
        return new ko.bindingContext(dataItemOrValueAccessor, this);
    };
    ko.bindingContext.prototype['extend'] = function(properties) {
        var clone = new ko.bindingContext(this['$data'], this);
        return ko.utils.extendInternal(clone, properties);
    };

    function getTwoLevelBindingData(bindingKey) {
        var dotPos = bindingKey.indexOf(".");
        if (dotPos > 0) {
            var realKey = bindingKey.substring(0, dotPos), binding = ko.bindingHandlers[realKey];
            if (binding) {
                if (!(binding['flags'] & bindingFlags_twoLevel))
                    throw new Error(realKey + " does not support two-level binding");
                return {
                    key: realKey,
                    subKey: bindingKey.substring(dotPos + 1),
                    handler: binding
                };
            }
        }
        return {};
    }
    
    ko.getBindingHandler = function(bindingKey) {
        return ko.bindingHandlers[bindingKey] || getTwoLevelBindingData(bindingKey).handler;
    };

    ko.bindingValueWrap = function(valueFunction) {
        valueFunction.__ko_wraptest = ko.bindingValueWrap;
        return valueFunction;
    };

    function unwrapBindingValue(value) { 
        return (value && value.__ko_wraptest && value.__ko_wraptest === ko.bindingValueWrap) ? value() : value;
    };

    function applyBindingsToDescendantsInternal (bindingContext, elementOrVirtualElement, bindingContextsMayDifferFromDomParentElement) {
        var currentChild, nextInQueue = ko.virtualElements.firstChild(elementOrVirtualElement);
        while (currentChild = nextInQueue) {
            // Keep a record of the next child *before* applying bindings, in case the binding removes the current child from its position
            nextInQueue = ko.virtualElements.nextSibling(currentChild);
            applyBindingsToNodeAndDescendantsInternal(bindingContext, currentChild, bindingContextsMayDifferFromDomParentElement);
        }
    }

    var dependenciesName = 'dependencies', dependenciesBinding = { 'flags': bindingFlags_builtIn };
    function applyBindingsToNodeAndDescendantsInternal (bindingContext, node, bindingContextsMayDifferFromDomParentElement, bindingsToApply, dontBindDescendants) {
        var isElement = (node.nodeType === 1),
            hasBindings = bindingsToApply || ko.bindingProvider['instance']['nodeHasBindings'](node),
            independentBindings = bindingContext['$options']['independentBindings'],
            asynchronousUpdates = bindingContext['$options']['asynchronousUpdates'];

        if (isElement) // Workaround IE <= 8 HTML parsing weirdness
            ko.virtualElements.normaliseVirtualElementDomStructure(node);

        // We only need to store the bindingContext at the root of the subtree where it applies
        // as all descendants will be able to find it by scanning up their ancestry
        if (bindingContextsMayDifferFromDomParentElement && (isElement || hasBindings))
            ko.storedBindingContextForNode(node, bindingContext);

        if (!hasBindings) {
            if (!dontBindDescendants) {
                // We're recursing automatically into (real or virtual) child nodes without changing binding contexts. So,
                //  * For children of a *real* element, the binding context is certainly the same as on their DOM .parentNode,
                //    hence bindingContextsMayDifferFromDomParentElement is false
                //  * For children of a *virtual* element, we can't be sure. Evaluating .parentNode on those children may
                //    skip over any number of intermediate virtual elements, any of which might define a custom binding context,
                //    hence bindingContextsMayDifferFromDomParentElement is true
                applyBindingsToDescendantsInternal(bindingContext, node, /* bindingContextsMayDifferFromDomParentElement: */ !isElement);
            }
            return;
        }

        // Parse bindings; track observables so that the bindng are reparsed if needed
        var parsedBindings, extraBindings, viewModel = bindingContext['$data'];
        var bindingUpdater = ko.utils.possiblyWrap(function() {
            // Make sure dependencies binding is set correctly
            ko.bindingHandlers[dependenciesName] = dependenciesBinding;
            // Use evaluatedBindings if given, otherwise fall back on asking the bindings provider to give us some bindings
            var evaluatedBindings = (typeof bindingsToApply == "function") ? bindingsToApply() : bindingsToApply;
            parsedBindings = evaluatedBindings || ko.bindingProvider['instance']['getBindings'](node, bindingContext);
            extraBindings = {};

            if (parsedBindings && bindingContext._subscribable)
                ko.dependencyDetection.registerDependency(bindingContext._subscribable);
        }, node);

        // These functions make values accessible to bindings.
        function makeValueAccessor(fullKey, subKey) {
            return subKey
            ? function() {
                var _z = {}; _z[subKey] = unwrapBindingValue(parsedBindings[fullKey]); return _z;
            } : function () {
                return unwrapBindingValue(parsedBindings[fullKey]);
            };
        }
        function allBindingsAccessorIndependent(key) {
            return key ? unwrapBindingValue(parsedBindings[key]) : ko.utils.objectMap(extraBindings, unwrapBindingValue);
        }
        function allBindingsAccessorDependent(key) {
            return key ? parsedBindings[key] : parsedBindings;
        }

        // These functions let the user know something is wrong
        function validateThatBindingIsAllowedForVirtualElements(binding) {
            if (!isElement && !ko.virtualElements.allowedBindings[binding.key] && !(binding.flags & bindingFlags_canUseVirtual))
                throw new Error("The binding '" + binding.key + "' cannot be used with virtual elements");
        }
        function multiContentBindError(key1, key2) {
            throw new Error("Multiple bindings (" + key1 + " and " + key2 + ") are trying to control descendant bindings of the same element. You cannot use these bindings together on the same element.");
        }

        // These functions call the binding handler functions
        function initCaller(binding) {
            return function() {
                var handlerInitFn = binding.handler['init']; 
                var initResult = handlerInitFn(node, binding.valueAccessor, allBindingsAccessor, viewModel, bindingContext);
                // throw an error if binding handler is only using the old method of indicating that it controls binding descendants
                if (initResult && !(binding.flags & bindingFlags_contentBind) && initResult['controlsDescendantBindings']) {
                    if (independentBindings)
                        throw new Error(binding.key + " binding handler must be updated to use contentBind flag");
                    else if (bindings[contentBindBinding])
                        multiContentBindError(bindings[contentBindBinding].key, binding.key);
                    else
                        bindings[binding.order = contentBindBinding] = binding;
                }
                return (initResult && initResult['subscribable']);
            };
        }
        function updateCaller(binding) {
            return function() {
                if (bindingUpdater)
                    ko.dependencyDetection.registerDependency(bindingUpdater);
                // dependentBindings is set if we're running in independent mode. Go through each
                // and create a dependency on it's subscribable.
                if (binding.dependentBindings)
                    ko.utils.arrayForEach(binding.dependentBindings, function(dependentBinding) {
                        if (dependentBinding.subscribable)
                            ko.dependencyDetection.registerDependency(dependentBinding.subscribable);
                    });
                var handlerUpdateFn = binding.handler['update'];
                return handlerUpdateFn(node, binding.valueAccessor, allBindingsAccessor, viewModel, bindingContext);
            };
        }
        function callHandlersIndependent(binding) {
            // Observables accessed in init functions are not tracked
            if (runInits && binding.handler['init'])
                binding.subscribable = ko.dependencyDetection.ignore(initCaller(binding));
            // Observables accessed in update function are tracked
            if (binding.handler['update'])
                binding.subscribable = ko.utils.possiblyWrap(updateCaller(binding), node) || binding.subscribable;
            if (asynchronousUpdates && binding.subscribable)
                binding.subscribable['throttleEvaluation'] = 1;
        }
        function callHandlersDependent(binding) {
            if (binding.handler['update'])
                updateCaller(binding)();
        }
        function applyListedBindings(bindings) {
            ko.utils.arrayForEach(bindings, callHandlers);
        }

        var allBindingsAccessor = independentBindings ? allBindingsAccessorIndependent : allBindingsAccessorDependent,
            callHandlers = independentBindings ? callHandlersIndependent : callHandlersDependent,
            runInits = true,
            allBindings = [],
            bindings = [[], [], undefined, []];
        /** @const */ var unorderedBindings = 0;
        /** @const */ var contentSetBindings = 1;
        /** @const */ var contentBindBinding = 2;
        /** @const */ var contentUpdateBindings = 3;

        var allBindingsUpdater = ko.utils.possiblyWrap(function() {
            if (runInits) {
                var bindingIndexes = {}, dependencies = parsedBindings[dependenciesName] || {}, 
                    lastIndex = unorderedBindings, thisIndex;

                // Get binding handlers, call init function if not in independent mode, and determine run order
                function pushBinding(bindingKey) {
                    if (bindingKey in bindingIndexes)
                        return allBindings[bindingIndexes[bindingKey]];

                    var handler = ko.bindingHandlers[bindingKey],
                        binding = handler ? { handler: handler, key: bindingKey } : getTwoLevelBindingData(bindingKey);

                    if (handler = binding.handler) {
                        binding.flags = handler['flags'];
                        validateThatBindingIsAllowedForVirtualElements(binding);
                        binding.valueAccessor = makeValueAccessor(bindingKey, binding.subKey);
                        binding.dependencies = [].concat(handler[dependenciesName] || [], dependencies[bindingKey] || []);

                        if (!independentBindings && handler['init'])
                            initCaller(binding)();

                        if (binding.flags & bindingFlags_contentBind) {
                            if (bindings[contentBindBinding])
                                multiContentBindError(bindings[contentBindBinding].key, binding.key);
                            bindings[binding.order = contentBindBinding] = binding;
                        } else {
                            binding.order = 
                                (binding.flags & bindingFlags_contentSet)
                                    ? contentSetBindings
                                : (binding.flags & bindingFlags_contentUpdate)
                                    ? contentUpdateBindings
                                    : unorderedBindings;
                        }

                        bindingIndexes[bindingKey] = -1;    // Allows for recursive dependencies check
                        var dependentBindings = [];
                        ko.utils.arrayForEach(binding.dependencies, function(dependencyKey) {
                            var dependentBinding,
                                dependencyError = "Binding " + bindingKey + " cannot depend on " + dependencyKey + ": ";
                            if (!(dependencyKey in parsedBindings) || !(dependentBinding = pushBinding(dependencyKey)))
                                throw new Error(dependencyError + "missing or recursive");
                            if (binding.order) {
                                if (dependentBinding.order > binding.order) {
                                    throw new Error(dependencyError + "conflicting ordering");
                                } else {
                                    var dependentOrder = binding.order == contentBindBinding ? contentBindBinding-1 : binding.order;
                                    dependentBinding.dependentOrder = dependentBinding.dependentOrder ? Math.min(dependentBinding.dependentOrder, dependentOrder) : dependentOrder;
                                }
                            } else if (dependentBinding.order) {
                                binding.order = dependentBinding.order;
                            }
                            dependentBindings.push(dependentBinding);
                        });
                        // Save the dependent bindings if we're running in independent mode.
                        if (independentBindings && dependentBindings[0])
                            binding.dependentBindings = dependentBindings;

                        bindingIndexes[bindingKey] = allBindings.length;
                        allBindings.push(binding);
                        return binding;
                    }
                    if (independentBindings)
                        extraBindings[bindingKey] = parsedBindings[bindingKey];
                }

                for (var bindingKey in parsedBindings) {
                    pushBinding(bindingKey);
                }

                // Organize bindings by run order
                for (var i=0, binding; binding = allBindings[i]; i++) {
                    if (binding.order == contentBindBinding) {
                        thisIndex = contentBindBinding + 1;
                    } else {
                        thisIndex = binding.order || binding.dependentOrder || lastIndex;
                        bindings[thisIndex].push(binding);
                    }
                    if (thisIndex > lastIndex)
                        lastIndex = thisIndex;
                }
            }

            // Apply the bindings in the correct order
            applyListedBindings(bindings[unorderedBindings]);
            applyListedBindings(bindings[contentSetBindings]);
    
            if (bindings[contentBindBinding])
                callHandlers(bindings[contentBindBinding]);
            else if (!dontBindDescendants)
                applyBindingsToDescendantsInternal(bindingContext, node, /* bindingContextsMayDifferFromDomParentElement: */ !isElement);
    
            applyListedBindings(bindings[contentUpdateBindings]);
        }, node);

        if (asynchronousUpdates && allBindingsUpdater)
            allBindingsUpdater['throttleEvaluation'] = 1;

        // Don't want to call init function or bind descendents twice
        runInits = dontBindDescendants = false;        
    };

    var storedBindingContextDomDataKey = ko.utils.domData.nextKey();
    ko.storedBindingContextForNode = function (node, bindingContext) {
        if (arguments.length == 2) {
            ko.domDataSet(node, storedBindingContextDomDataKey, bindingContext);
            if (bindingContext._subscribable)
                bindingContext._subscribable.addDisposalNodes(node);
        }
        else
            return ko.domDataGet(node, storedBindingContextDomDataKey);
    }

    function getBindingContext(viewModelOrBindingContext, options) {
        return viewModelOrBindingContext && (viewModelOrBindingContext instanceof ko.bindingContext)
            ? viewModelOrBindingContext
            : new ko.bindingContext(viewModelOrBindingContext, null, options);
    }

    ko.applyBindingsToNode = function (node, bindings, viewModelOrBindingContext, shouldBindDescendants) {
        if (node.nodeType === 1) // If it's an element, workaround IE <= 8 HTML parsing weirdness
            ko.virtualElements.normaliseVirtualElementDomStructure(node);
        applyBindingsToNodeAndDescendantsInternal(getBindingContext(viewModelOrBindingContext), node, true, bindings, !shouldBindDescendants);
    };

    ko.applyBindingsToDescendants = function(viewModelOrBindingContext, rootNode) {
        if (rootNode.nodeType === 1 || rootNode.nodeType === 8)
            applyBindingsToDescendantsInternal(getBindingContext(viewModelOrBindingContext), rootNode, true);
    };

    ko.applyBindings = function (viewModelOrBindingContext, rootNode, options) {
        if (rootNode && (rootNode.nodeType !== 1) && (rootNode.nodeType !== 8))
            throw new Error("ko.applyBindings: first parameter should be your view model; second parameter should be a DOM node");
        rootNode = rootNode || window.document.body; // Make "rootNode" parameter optional

        applyBindingsToNodeAndDescendantsInternal(getBindingContext(viewModelOrBindingContext, options), rootNode, true);
    };

    // Retrieving binding context from arbitrary nodes
    ko.contextFor = function(node) {
        // We can only do something meaningful for elements and comment nodes (in particular, not text nodes, as IE can't store domdata for them)
        switch (node.nodeType) {
            case 1:
            case 8:
                var context = ko.storedBindingContextForNode(node);
                if (context) return context;
                if (node.parentNode) return ko.contextFor(node.parentNode);
                break;
        }
        return undefined;
    };
    ko.dataFor = function(node) {
        var context = ko.contextFor(node);
        return context ? context['$data'] : undefined;
    };

    ko.exportSymbol('bindingHandlers', ko.bindingHandlers);
    ko.exportSymbol('bindingFlags', ko.bindingFlags);
    ko.exportSymbol('bindingValueWrap', ko.bindingValueWrap);       // must be exported because it's used in binding parser (which uses eval)
    ko.exportSymbol('applyBindings', ko.applyBindings);
    ko.exportSymbol('applyBindingsToDescendants', ko.applyBindingsToDescendants);
    ko.exportSymbol('applyBindingsToNode', ko.applyBindingsToNode);
    ko.exportSymbol('contextFor', ko.contextFor);
    ko.exportSymbol('dataFor', ko.dataFor);
})();