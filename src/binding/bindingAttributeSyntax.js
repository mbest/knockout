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
        function bindingValueWrap() {
            return valueFunction();
        }
        bindingValueWrap.__ko_proto__ = ko.bindingValueWrap;
        return bindingValueWrap;
    };

    ko.unwrapBindingValue = function(value) {
        return (value && value.__ko_proto__ && value.__ko_proto__ === ko.bindingValueWrap) ? value() : value;
    };

    function applyBindingsToDescendantsInternal (bindingContext, elementVerified, areRootNodesForBindingContext) {
        var currentChild, nextInQueue = ko.virtualElements.firstChild(elementVerified);
        while (currentChild = nextInQueue) {
            // Keep a record of the next child *before* applying bindings, in case the binding removes the current child from its position
            nextInQueue = ko.virtualElements.nextSibling(currentChild);
            applyBindingsToNodeAndDescendantsInternal(bindingContext, currentChild, areRootNodesForBindingContext);

        }
    }

    function applyBindingsToNodeAndDescendantsInternal (bindingContext, node, isRootNodeForBindingContext, bindingsToApply) {
        var isElement = (node.nodeType === 1);
        if (isElement) // Workaround IE <= 8 HTML parsing weirdness
            ko.virtualElements.normaliseVirtualElementDomStructure(node);

        // Perf optimisation: Apply bindings only if...
        // (1) It's a root element for this binding context, as we will need to store the binding context on this node
        //     Note that we can't store binding contexts on non-elements (e.g., text nodes), as IE doesn't allow expando properties for those
        // (2) It might have bindings (e.g., it has a data-bind attribute, or it's a marker for a containerless template)
        var shouldApplyBindings = bindingsToApply ||                        // Case (2)
            (isElement && isRootNodeForBindingContext) ||                   // Case (1)
            ko.bindingProvider['instance']['nodeHasBindings'](node);        // Case (2)

        if (!shouldApplyBindings) {
            if (!bindingsToApply)
                applyBindingsToDescendantsInternal(bindingContext, node, (!isElement && isRootNodeForBindingContext));
            return;
        }

        // Each time the dependentObservable is evaluated (after data changes),
        // the binding attribute is reparsed so that it can pick out the correct
        // model properties in the context of the changed data.
        // DOM event callbacks need to be able to access this changed data,
        // so we need a single parsedBindings variable (shared by all callbacks
        // associated with this node's bindings) that all the closures can access.
        var parsedBindings;
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
        function getBindingHandlerAndValueAccessor(bindingKey) {
            var binding = ko.bindingHandlers[bindingKey];
            binding = binding ? { handler: binding, key: bindingKey } : ko.getTwoLevelBindingData(bindingKey);
            if (binding.handler) {
                binding.valueAccessor = binding.subKey
                    ? makeSubKeyValueAccessor(bindingKey, binding.subKey)
                    : makeValueAccessor(bindingKey);
                binding.flags = binding.handler['flags'];
                return binding;
            }
        }

        function callHandlers(binding) {
            if (binding.handler['init']) {
                // call init function; observables accessed in init functions are not tracked
                ko.dependencyDetection.ignore(function() {
                    binding.handler['init'](node, binding.valueAccessor, parsedBindingsAccessor, viewModel, bindingContext);
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

        // We only need to store the bindingContext at the root of the subtree where it applies
        // as all descendants will be able to find it by scanning up their ancestry
        if (isRootNodeForBindingContext)
            ko.storedBindingContextForNode(node, bindingContext);

        var viewModel = bindingContext['$data'];

        // parse bindings; track observables so that the bindng are reparsed if needed
        var bindingUpdater = ko.utils.possiblyWrap(function() {
            // Use evaluatedBindings if given, otherwise fall back on asking the bindings provider to give us some bindings
            var evaluatedBindings = (typeof bindingsToApply == "function") ? bindingsToApply() : bindingsToApply;
            parsedBindings = evaluatedBindings || ko.bindingProvider['instance']['getBindings'](node, bindingContext);

            if (parsedBindings && bindingContext._subscription)
                ko.dependencyDetection.registerDependency(bindingContext._subscription);
        }, node);

        // Get binding handlers and organize bindings by run order:
        // 1. Most bindings
        // 2. Content-set bindings
        // 3. Content-bind bindings
        // 4. Content-update bindings
        var contentBindBinding, mostBindings=[], contentSetBindings=[], contentUpdateBindings=[];
        for (var bindingKey in parsedBindings) {
            var binding = getBindingHandlerAndValueAccessor(bindingKey);
            if (binding) {
                if (!isElement && !(binding.flags & bindingFlags_canUseVirtual))
                    throw new Error("The binding '" + binding.key + "' cannot be used with virtual elements");
                if (binding.flags & bindingFlags_contentBind) {
                    if (contentBindBinding)
                        throw new Error("Multiple bindings (" + contentBindBinding.key + " and " + binding.key + ") are trying to control descendant bindings of the same element. You cannot use these bindings together on the same element.");
                    contentBindBinding = binding;
                } else {
                    var list = (binding.flags & bindingFlags_contentSet)
                        ? contentSetBindings
                        : (binding.flags & bindingFlags_contentUpdate)
                            ? contentUpdateBindings
                            : mostBindings;
                    list.push(binding);
                }
            }
        }

        // Apply the bindings in the correct order
        applyListedBindings(mostBindings);
        applyListedBindings(contentSetBindings);

        if (contentBindBinding)
            callHandlers(contentBindBinding);
        else if (!bindingsToApply)
            applyBindingsToDescendantsInternal(bindingContext, node, (!isElement && isRootNodeForBindingContext));

        applyListedBindings(contentUpdateBindings);
    };

    var storedBindingContextDomDataKey = "__ko_bindingContext__";
    ko.storedBindingContextForNode = function (node, bindingContext) {
        if (arguments.length == 2) {
            ko.utils.domData.set(node, storedBindingContextDomDataKey, bindingContext);
            if (bindingContext._subscription)
                bindingContext._subscription.addDisposeWhenNodesAreRemoved(node);
        }
        else
            return ko.utils.domData.get(node, storedBindingContextDomDataKey);
    }

    function getBindingContext(viewModelOrBindingContext) {
        return viewModelOrBindingContext && (viewModelOrBindingContext instanceof ko.bindingContext)
            ? viewModelOrBindingContext
            : new ko.bindingContext(viewModelOrBindingContext);
    }

    ko.applyBindingsToNode = function (node, bindings, viewModelOrBindingContext) {
        if (node.nodeType === 1) // If it's an element, workaround IE <= 8 HTML parsing weirdness
            ko.virtualElements.normaliseVirtualElementDomStructure(node);
        applyBindingsToNodeAndDescendantsInternal(getBindingContext(viewModelOrBindingContext), node, true, bindings);
    };

    ko.applyBindingsToDescendants = function(viewModelOrBindingContext, rootNode, areRootNodesForBindingContext) {
        if (rootNode.nodeType === 1 || rootNode.nodeType === 8)
            applyBindingsToDescendantsInternal(getBindingContext(viewModelOrBindingContext), rootNode, areRootNodesForBindingContext);
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
    ko.exportSymbol('bindingContext', ko.bindingContext);
    ko.exportSymbol('bindingFlags', ko.bindingFlags);
    ko.exportSymbol('bindingValueWrap', ko.bindingValueWrap);       // must be exported because it's used in binding parser (which uses eval)
    ko.exportSymbol('applyBindings', ko.applyBindings);
    ko.exportSymbol('applyBindingsToDescendants', ko.applyBindingsToDescendants);
    ko.exportSymbol('applyBindingsToNode', ko.applyBindingsToNode);
    ko.exportSymbol('contextFor', ko.contextFor);
    ko.exportSymbol('dataFor', ko.dataFor);
})();