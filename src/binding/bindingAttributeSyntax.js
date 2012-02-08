/** @const */ var bindingFlags_builtIn=01;
/** @const */ var bindingFlags_twoWay=02;
/** @const */ var bindingFlags_eventHandler=04;
/** @const */ var bindingFlags_twoLevel=010;
/** @const */ var bindingFlags_contentSet=020;
/** @const */ var bindingFlags_contentBind=040;
/** @const */ var bindingFlags_contentUpdate=0100;
/** @const */ var bindingFlags_canUseVirtual=0200;
/** @const */ var bindingFlags_noValue=0400;

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

    ko.bindingContext = function(dataItem, parent, options) {
        var self = this, isOb = ko.isObservable(dataItem) || typeof(dataItem) == "function";
        self._subscription = ko.utils.possiblyWrap(parent ?
            function() {
                var oldSubscription = self._subscription;   // save previous subscription value 
                // copy $root, $options, and any custom properties from parent binding context
                ko.utils.extend(self, parent);
                self._subscription = oldSubscription;       // restore subscription value
                if (parent._subscription)
                    ko.dependencyDetection.registerDependency(parent._subscription);
                // set our properties
                ko.utils.extend(self['$options'], options);
                self['$parentContext'] = parent;
                self['$parents'] = parent['$parents'].slice(0);
                self['$parents'].unshift(self['$parent'] = parent['$data']);
                self['$data'] = isOb ? dataItem() : dataItem;
            } :
            function() {
                self['$options'] = options || {};
                self['$parents'] = [];
                self['$root'] = self['$data'] = isOb ? dataItem() : dataItem;
            }
        );
    }
    ko.bindingContext.prototype['createChildContext'] = function (dataItem) {
        return new ko.bindingContext(dataItem, this);
    };
    ko.bindingContext.prototype['extend'] = function(properties) {
        var clone = new ko.bindingContext(this.$data, this);
        return ko.utils.extend(clone, properties);
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
        valueFunction.__ko_proto__ = ko.bindingValueWrap;
        return valueFunction;
    };

    ko.unwrapBindingValue = function(value) {   // store this function in ko so the compiler doesn't inline it 
        return (value && value.__ko_proto__ && value.__ko_proto__ === ko.bindingValueWrap) ? value() : value;
    };

    function applyBindingsToDescendantsInternal (bindingContext, elementOrVirtualElement, bindingContextsMayDifferFromDomParentElement) {
        var currentChild, nextInQueue = ko.virtualElements.firstChild(elementOrVirtualElement);
        while (currentChild = nextInQueue) {
            // Keep a record of the next child *before* applying bindings, in case the binding removes the current child from its position
            nextInQueue = ko.virtualElements.nextSibling(currentChild);
            applyBindingsToNodeAndDescendantsInternal(bindingContext, currentChild, bindingContextsMayDifferFromDomParentElement);
        }
    }

    function applyBindingsToNodeAndDescendantsInternal (bindingContext, node, bindingContextsMayDifferFromDomParentElement, bindingsToApply, dontBindDescendants) {
        var isElement = (node.nodeType === 1),
            hasBindings = bindingsToApply || ko.bindingProvider['instance']['nodeHasBindings'](node),
            independentBindings = bindingContext['$options']['independentBindings'];

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

        // Each time the dependentObservable is evaluated (after data changes),
        // the binding attribute is reparsed so that it can pick out the correct
        // model properties in the context of the changed data.
        // DOM event callbacks need to be able to access this changed data,
        // so we need a single parsedBindings variable (shared by all callbacks
        // associated with this node's bindings) that all the closures can access.
        var parsedBindings, viewModel = bindingContext['$data'];
        function makeValueAccessor(key) {
            return function () {
                return ko.unwrapBindingValue(parsedBindings[key]);
            };
        }
        function makeSubKeyValueAccessor(fullKey, subKey) {
            var _z = {};
            return function() {
                _z[subKey] = ko.unwrapBindingValue(parsedBindings[fullKey]); return _z;
            };
        }
        function parsedBindingsAccessor() {
            return parsedBindings;
        }

        function initCaller(binding) {
            return function() {
                var initResult = binding.handler['init'](node, binding.valueAccessor, parsedBindingsAccessor, viewModel, bindingContext);
                // throw an error if binding handler is only using the old method of indicating that it controls binding descendants
                if (initResult && !(binding.flags & bindingFlags_contentBind) && initResult['controlsDescendantBindings'])
                    throw new Error(binding.key + " binding handler must be updated to use contentBind flag");
            };
        }

        function updateCaller(binding) {
            return function() {
                if (bindingUpdater)
                    ko.dependencyDetection.registerDependency(bindingUpdater);
                binding.handler['update'](node, binding.valueAccessor, parsedBindingsAccessor, viewModel, bindingContext);
            };
        }

        var runInits = true;
        function callHandlersIndependent(binding) {
            // call init function; observables accessed in init functions are not tracked
            if (runInits && binding.handler['init'])
                ko.dependencyDetection.ignore(initCaller(binding));
            // call update function; observables accessed in update function are tracked
            if (binding.handler['update'])
                ko.utils.possiblyWrap(updateCaller(binding), node);
        }

        function callHandlersDependent(binding) {
            if (runInits && binding.handler['init'])
                initCaller(binding)();
            if (binding.handler['update'])
                updateCaller(binding)();
        }
        
        var callHandlers = independentBindings ? callHandlersIndependent : callHandlersDependent;
        function applyListedBindings(bindings) {
            ko.utils.arrayForEach(bindings, callHandlers);
        }

        // parse bindings; track observables so that the bindng are reparsed if needed
        var bindingUpdater = ko.utils.possiblyWrap(function() {
            // Use evaluatedBindings if given, otherwise fall back on asking the bindings provider to give us some bindings
            var evaluatedBindings = (typeof bindingsToApply == "function") ? bindingsToApply() : bindingsToApply;
            parsedBindings = evaluatedBindings || ko.bindingProvider['instance']['getBindings'](node, bindingContext);

            if (parsedBindings && bindingContext._subscription)
                ko.dependencyDetection.registerDependency(bindingContext._subscription);
        }, node);

        // Get binding handlers and organize bindings by run order:
        /** @const */ var mostBindings = 0;
        /** @const */ var contentSetBindings = 1;
        /** @const */ var contentBindBinding = 2;
        /** @const */ var contentUpdateBindings = 3;
        var bindings = [[], [], undefined, []], lastIndex=mostBindings, thisIndex, binding;
        for (var bindingKey in parsedBindings) {
            binding = (binding = ko.bindingHandlers[bindingKey])
                ? { handler: binding, key: bindingKey }
                : getTwoLevelBindingData(bindingKey);
            if (binding.handler) {
                binding.flags = binding.handler['flags'];
                if (!isElement && !(binding.flags & bindingFlags_canUseVirtual))
                    throw new Error("The binding '" + binding.key + "' cannot be used with virtual elements");
                if (binding.flags & bindingFlags_contentBind) {
                    if (bindings[contentBindBinding])
                        throw new Error("Multiple bindings (" + bindings[contentBindBinding].key + " and " + binding.key + ") are trying to control descendant bindings of the same element. You cannot use these bindings together on the same element.");
                    bindings[contentBindBinding] = binding;
                    thisIndex = contentBindBinding + 1;
                } else {
                    thisIndex = 
                        (binding.flags & bindingFlags_contentSet)
                            ? contentSetBindings
                        : (binding.flags & bindingFlags_contentUpdate)
                            ? contentUpdateBindings
                            : lastIndex;
                    bindings[thisIndex].push(binding);
                }
                binding.valueAccessor = binding.subKey
                    ? makeSubKeyValueAccessor(bindingKey, binding.subKey)
                    : makeValueAccessor(bindingKey);
                if (thisIndex > lastIndex)
                    lastIndex = thisIndex;
            }
        }

        // Apply the bindings in the correct order
        ko.utils.possiblyWrap(function() {
            applyListedBindings(bindings[mostBindings]);
            applyListedBindings(bindings[contentSetBindings]);
    
            if (bindings[contentBindBinding])
                callHandlers(bindings[contentBindBinding]);
            else if (!dontBindDescendants)
                applyBindingsToDescendantsInternal(bindingContext, node, /* bindingContextsMayDifferFromDomParentElement: */ !isElement);
    
            applyListedBindings(bindings[contentUpdateBindings]);
        }, node);

        // don't want to call init function or bind descendents twice
        runInits = dontBindDescendants = false;        
    };

    var storedBindingContextDomDataKey = ko.utils.domData.nextKey();
    ko.storedBindingContextForNode = function (node, bindingContext) {
        if (arguments.length == 2) {
            ko.utils.domData.set(node, storedBindingContextDomDataKey, bindingContext);
            if (bindingContext._subscription)
                bindingContext._subscription.addDisposalNodes(node);
        }
        else
            return ko.utils.domData.get(node, storedBindingContextDomDataKey);
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