(function () {
    ko.bindingHandlers = {};

    // Binding handlers can include a "type" option that specifies one of these binding types.
    // If unset, the default binding type is one-way (so it's not necessary to specify that type).
    ko.bindingTypes = {
        // one-way bindings set a DOM node's property from the given value
        oneWay: 'one-way',
        // two-way bindings also update the model value if the DOM property changes
        twoWay: 'two-way',
        // content bindings modify a DOM node's contents based on the model
        // importantly, content bindings are responsible for binding their contents
        contentOneWay: 'content',
        // event bindings call the given function in response to a DOM event
        eventHandler: 'event'
    };
    var defaultBindingType = ko.bindingTypes.oneWay;

    // Binding handlers can include "flags" option with an array of flags.
    ko.bindingFlags = {
        // binding can be included without a value (will use true as the value)
        noValue: 'no-value',
        // two-level bindings are like {attr.href: value} or {attr: {href: value}}
        twoLevel: 'two-level',
        // can use comment-based bindings like <!-- ko if: value --><!-- /ko -->
        canUseVirtual: 'container-less',
        // prevent the binding from being used withing a template that uses rewriting
        dontRewrite: 'dont-rewrite'
    };

    ko.getBindingHandler = function(bindingName) {
        var binding = ko.bindingHandlers[bindingName];
        if (binding && !binding.bindingOptions) {
            var options = binding['options'] || {};
            binding.bindingOptions = {
                bindingType: options['type'] || defaultBindingType,
                bindingFlags: options['flags'] || []
            };
        }
        return binding;
    }

    ko.getBindingType = function(binding) {
        return binding.bindingOptions.bindingType;
    };

    ko.checkBindingFlag = function(binding, flag) {
        return ko.utils.arrayIndexOf(binding.bindingOptions.bindingFlags, flag) !== -1;
    };

    ko.bindingContext = function(dataItem, parentBindingContext) {
        if (parentBindingContext) {
            // copy all properties from parent binding context
            ko.utils.extend(this, parentBindingContext);
            this['$parent'] = parentBindingContext['$data'];
            this['$parents'] = (this['$parents'] || []).slice(0);
            this['$parents'].unshift(this['$parent']);
        } else {
            this['$parents'] = [];
            this['$root'] = dataItem;
        }
        this['$data'] = dataItem;
    }
    ko.bindingContext.prototype['createChildContext'] = function (dataItem) {
        return new ko.bindingContext(dataItem, this);
    };

    function applyBindingsToDescendantsInternal (viewModel, elementVerified, areRootNodesForBindingContext) {
        var currentChild, nextInQueue = ko.virtualElements.firstChild(elementVerified);
        while (currentChild = nextInQueue) {
            // Keep a record of the next child *before* applying bindings, in case the binding removes the current child from its position
            nextInQueue = ko.virtualElements.nextSibling(currentChild);
            applyBindingsToNodeAndDescendantsInternal(viewModel, currentChild, areRootNodesForBindingContext);
        }
    }

    function applyBindingsToNodeAndDescendantsInternal (viewModel, nodeVerified, isRootNodeForBindingContext) {
        var shouldBindDescendants = true;

        // Perf optimisation: Apply bindings only if...
        // (1) It's a root element for this binding context, as we will need to store the binding context on this node
        //     Note that we can't store binding contexts on non-elements (e.g., text nodes), as IE doesn't allow expando properties for those
        // (2) It might have bindings (e.g., it has a data-bind attribute, or it's a marker for a containerless template)
        var isElement = (nodeVerified.nodeType === 1);
        if (isElement) // Workaround IE <= 8 HTML parsing weirdness
            ko.virtualElements.normaliseVirtualElementDomStructure(nodeVerified);

        var shouldApplyBindings = (isElement && isRootNodeForBindingContext)                             // Case (1)
                               || ko.bindingProvider['instance']['nodeHasBindings'](nodeVerified);       // Case (2)
        if (shouldApplyBindings)
            shouldBindDescendants = applyBindingsToNodeInternal(nodeVerified, null, viewModel, isRootNodeForBindingContext).shouldBindDescendants;

        if (shouldBindDescendants)
            applyBindingsToDescendantsInternal(viewModel, nodeVerified, (!isElement && isRootNodeForBindingContext));
    }

    function applyBindingsToNodeInternal (node, bindings, viewModelOrBindingContext, isRootNodeForBindingContext) {
        // Need to be sure that inits are only run once, and updates never run until all the inits have been run
        var initPhase = 0; // 0 = before all inits, 1 = during inits, 2 = after all inits

        // Each time the dependentObservable is evaluated (after data changes),
        // the binding attribute is reparsed so that it can pick out the correct
        // model properties in the context of the changed data.
        // DOM event callbacks need to be able to access this changed data,
        // so we need a single parsedBindings variable (shared by all callbacks
        // associated with this node's bindings) that all the closures can access.
        var parsedBindings;
        function makeValueAccessor(bindingKey) {
            return function () { return parsedBindings[bindingKey] }
        }
        function parsedBindingsAccessor() {
            return parsedBindings;
        }

        var bindingHandlerThatControlsDescendantBindings;
        new ko.dependentObservable(
            function () {
                // Ensure we have a nonnull binding context to work with
                var bindingContextInstance = viewModelOrBindingContext && (viewModelOrBindingContext instanceof ko.bindingContext)
                    ? viewModelOrBindingContext
                    : new ko.bindingContext(ko.utils.unwrapObservable(viewModelOrBindingContext));
                var viewModel = bindingContextInstance['$data'];

                // We only need to store the bindingContext at the root of the subtree where it applies
                // as all descendants will be able to find it by scanning up their ancestry
                if (isRootNodeForBindingContext)
                    ko.storedBindingContextForNode(node, bindingContextInstance);

                // Use evaluatedBindings if given, otherwise fall back on asking the bindings provider to give us some bindings
                var evaluatedBindings = (typeof bindings == "function") ? bindings() : bindings;
                parsedBindings = evaluatedBindings || ko.bindingProvider['instance']['getBindings'](node, bindingContextInstance);

                if (parsedBindings) {
                    // First run all the inits, so bindings can register for notification on changes
                    if (initPhase === 0) {
                        initPhase = 1;
                        for (var bindingKey in parsedBindings) {
                            var binding = ko.getBindingHandler(bindingKey);
                            if (!binding)
                                continue;
                            if (node.nodeType === 8 && (ko.getBindingType(binding) !== ko.bindingTypes.contentOneWay || !ko.checkBindingFlag(binding, ko.bindingFlags.canUseVirtual)))
                                throw new Error("The binding '" + bindingKey + "' cannot be used with virtual elements")

                            if (typeof binding["init"] == "function") {
                                binding["init"](node, makeValueAccessor(bindingKey), parsedBindingsAccessor, viewModel, bindingContextInstance);
                            }
                            if (ko.getBindingType(binding) == ko.bindingTypes.contentOneWay) {
                                // If this binding handler claims to control descendant bindings, make a note of this
                                if (bindingHandlerThatControlsDescendantBindings !== undefined)
                                    throw new Error("Multiple bindings (" + bindingHandlerThatControlsDescendantBindings + " and " + bindingKey + ") are trying to control descendant bindings of the same element. You cannot use these bindings together on the same element.");
                                bindingHandlerThatControlsDescendantBindings = bindingKey;
                            }
                        }
                        initPhase = 2;
                    }

                    // ... then run all the updates, which might trigger changes even on the first evaluation
                    if (initPhase === 2) {
                        for (var bindingKey in parsedBindings) {
                            var binding = ko.getBindingHandler(bindingKey);
                            if (binding && typeof binding["update"] == "function") {
                                binding["update"](node, makeValueAccessor(bindingKey), parsedBindingsAccessor, viewModel, bindingContextInstance);
                            }
                        }
                    }
                }
            },
            null,
            { 'disposeWhenNodeIsRemoved' : node }
        );

        return {
            shouldBindDescendants: bindingHandlerThatControlsDescendantBindings === undefined
        };
    };

    var storedBindingContextDomDataKey = "__ko_bindingContext__";
    ko.storedBindingContextForNode = function (node, bindingContext) {
        if (arguments.length == 2)
            ko.utils.domData.set(node, storedBindingContextDomDataKey, bindingContext);
        else
            return ko.utils.domData.get(node, storedBindingContextDomDataKey);
    }

    ko.applyBindingsToNode = function (node, bindings, viewModel) {
        if (node.nodeType === 1) // If it's an element, workaround IE <= 8 HTML parsing weirdness
            ko.virtualElements.normaliseVirtualElementDomStructure(node);
        return applyBindingsToNodeInternal(node, bindings, viewModel, true);
    };

    ko.applyBindingsToDescendants = function(viewModel, rootNode, areRootNodesForBindingContext) {
        if (rootNode.nodeType === 1 || rootNode.nodeType === 8)
            applyBindingsToDescendantsInternal(viewModel, rootNode, areRootNodesForBindingContext);
    };

    ko.applyBindings = function (viewModel, rootNode) {
        if (rootNode && (rootNode.nodeType !== 1) && (rootNode.nodeType !== 8))
            throw new Error("ko.applyBindings: first parameter should be your view model; second parameter should be a DOM node");
        rootNode = rootNode || window.document.body; // Make "rootNode" parameter optional

        applyBindingsToNodeAndDescendantsInternal(viewModel, rootNode, true);
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
    ko.exportSymbol('applyBindings', ko.applyBindings);
    ko.exportSymbol('applyBindingsToDescendants', ko.applyBindingsToDescendants);
    ko.exportSymbol('applyBindingsToNode', ko.applyBindingsToNode);
    ko.exportSymbol('contextFor', ko.contextFor);
    ko.exportSymbol('dataFor', ko.dataFor);
})();