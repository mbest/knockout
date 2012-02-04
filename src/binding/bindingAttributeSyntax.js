/** @const */ var bindingFlags_twoWay=01;
/** @const */ var bindingFlags_eventHandler=02;
/** @const */ var bindingFlags_contentBind=04;
/** @const */ var bindingFlags_contentSet=010;
/** @const */ var bindingFlags_contentUpdate=020;
/** @const */ var bindingFlags_noValue=040;
/** @const */ var bindingFlags_twoLevel=0100;
/** @const */ var bindingFlags_canUseVirtual=0200;

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

    ko.bindingHandlers = {};

    ko.bindingContext = function(dataItem, parent) {
        var self = this, isOb = ko.isObservable(dataItem) || typeof(dataItem) == "function";
        self._subscription = undefined;  // set so it isn't set by extend call below
        self._subscription = ko.utils.possiblyWrap(parent ?
            function() {
                if (parent._subscription)
                    ko.dependencyDetection.registerDependency(parent._subscription);
                // set our properties
                self['$parentContext'] = parent;
                self['$parents'] = (parent['$parents'] || []).slice(0);
                self['$parents'].unshift(self['$parent'] = parent['$data']);
                self['$data'] = isOb ? dataItem() : dataItem;
                // copy $root and any custom properties from parent binding context
                ko.utils.extend(self, parent, true);
            } :
            function() {
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

    ko.checkBindingFlags = function(binding, flagsSet, flagsUnset) {
        return (!flagsSet || (binding['flags'] & flagsSet)) && !(binding['flags'] & flagsUnset);
    };

    ko.getTwoLevelBindingData = function(bindingKey) {
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
        return ko.bindingHandlers[bindingKey] || ko.getTwoLevelBindingData(bindingKey).handler;
    }

    ko.bindingValueWrap = function(valueFunction) {
        valueFunction.__ko_proto__ = ko.bindingValueWrap;
        return valueFunction;
    };

    ko.unwrapBindingValue = function(value) {
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
            hasBindings = bindingsToApply || ko.bindingProvider['instance']['nodeHasBindings'](node);

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

        function callHandlers(binding) {
            if (binding.handler['init']) {
                // call init function; observables accessed in init functions are not tracked
                ko.dependencyDetection.ignore(function() {
                    var initResult = binding.handler['init'](node, binding.valueAccessor, parsedBindingsAccessor, viewModel, bindingContext);
                    if (initResult && initResult['controlsDescendantBindings'])
                        throw new Error(binding.key + " binding must be updated set contentBind flag");
                });
            }
            if (binding.handler['update']) {
                // call update function; observables accessed in update function are tracked
                ko.utils.possiblyWrap(function() {
                    if (bindingUpdater)
                        ko.dependencyDetection.registerDependency(bindingUpdater);
                    binding.handler['update'](node, binding.valueAccessor, parsedBindingsAccessor, viewModel, bindingContext);
                }, node);
            }
        }

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
        var bindings = [[], [], undefined, []], lastIndex=-1, lastKey, thisIndex, binding;
        for (var bindingKey in parsedBindings) {
            binding = (binding = ko.bindingHandlers[bindingKey])
                ? { handler: binding, key: bindingKey }
                : ko.getTwoLevelBindingData(bindingKey);
            if (binding.handler) {
                binding.flags = binding.handler['flags'];
                if (!isElement && !(binding.flags & bindingFlags_canUseVirtual))
                    throw new Error("The binding '" + binding.key + "' cannot be used with virtual elements");
                if (binding.flags & bindingFlags_contentBind) {
                    if (bindings[contentBindBinding])
                        throw new Error("Multiple bindings (" + bindings[contentBindBinding].key + " and " + binding.key + ") are trying to control descendant bindings of the same element. You cannot use these bindings together on the same element.");
                    bindings[thisIndex = contentBindBinding] = binding;
                } else {
                    thisIndex = (binding.flags & bindingFlags_contentSet)
                        ? contentSetBindings
                        : (binding.flags & bindingFlags_contentUpdate)
                            ? contentUpdateBindings
                            : mostBindings;
                    bindings[thisIndex].push(binding);
                }
                binding.valueAccessor = binding.subKey
                    ? makeSubKeyValueAccessor(bindingKey, binding.subKey)
                    : makeValueAccessor(bindingKey);
                // Warn if bindings will be run "out of order"; this may be because a custom binding hasn't been set up with the correct flags
                if (thisIndex < lastIndex) {
                    ko.logger.warn("Warning: bindings will be run in a different order than specified: " + binding.key + " will be run before " + lastKey);
                } else {
                    lastKey = binding.key;
                    lastIndex = thisIndex;
                }
            }
        }

        // Apply the bindings in the correct order
        applyListedBindings(bindings[mostBindings]);
        applyListedBindings(bindings[contentSetBindings]);

        if (bindings[contentBindBinding])
            callHandlers(bindings[contentBindBinding]);
        else if (!dontBindDescendants)
            applyBindingsToDescendantsInternal(bindingContext, node, /* bindingContextsMayDifferFromDomParentElement: */ !isElement);

        applyListedBindings(bindings[contentUpdateBindings]);
    };

    var storedBindingContextDomDataKey = "__ko_bindingContext__";
    ko.storedBindingContextForNode = function (node, bindingContext) {
        if (arguments.length == 2) {
            ko.utils.domData.set(node, storedBindingContextDomDataKey, bindingContext);
            if (bindingContext._subscription)
                bindingContext._subscription.addDisposalNodes(node);
        }
        else
            return ko.utils.domData.get(node, storedBindingContextDomDataKey);
    }

    function getBindingContext(viewModelOrBindingContext) {
        return viewModelOrBindingContext && (viewModelOrBindingContext instanceof ko.bindingContext)
            ? viewModelOrBindingContext
            : new ko.bindingContext(viewModelOrBindingContext);
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

    ko.applyBindings = function (viewModelOrBindingContext, rootNode) {
        if (rootNode && (rootNode.nodeType !== 1) && (rootNode.nodeType !== 8))
            throw new Error("ko.applyBindings: first parameter should be your view model; second parameter should be a DOM node");
        rootNode = rootNode || window.document.body; // Make "rootNode" parameter optional

        applyBindingsToNodeAndDescendantsInternal(getBindingContext(viewModelOrBindingContext), rootNode, true);
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