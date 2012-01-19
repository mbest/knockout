(function () {
    ko.bindingHandlers = {};

    ko.bindingContext = function(dataItem, parentBindingContext) {
        this['$data'] = dataItem;
        if (parentBindingContext) {
            this['$parent'] = parentBindingContext['$data'];
            this['$parents'] = (parentBindingContext['$parents'] || []).slice(0);
            this['$parents'].unshift(this['$parent']);
            this['$root'] = parentBindingContext['$root'];
        } else {
            this['$parents'] = [];
            this['$root'] = dataItem;
        }
    }
    ko.bindingContext.prototype['createChildContext'] = function (dataItem) {
        return new ko.bindingContext(dataItem, this);
    };

    function validateThatBindingIsAllowedForVirtualElements(bindingName) {
        var validator = ko.virtualElements.allowedBindings[bindingName];
        if (!validator)
            throw new Error("The binding '" + bindingName + "' cannot be used with virtual elements")
    }

    function applyBindingsToDescendantsInternal (viewModel, elementVerified) {
        var currentChild, nextInQueue = elementVerified.childNodes[0];
        while (currentChild = nextInQueue) {
            // Keep a record of the next child *before* applying bindings, in case the binding removes the current child from its position
            nextInQueue = ko.virtualElements.nextSibling(currentChild);
            applyBindingsToNodeAndDescendantsInternal(viewModel, currentChild, false);
        }
    }

    function applyBindingsToNodeAndDescendantsInternal (viewModel, nodeVerified, isRootNodeForBindingContext) {
        var shouldBindDescendants = true;

        // Perf optimisation: Apply bindings only if...
        // (1) It's a root element for this binding context, as we will need to store the binding context on this node
        //     Note that we can't store binding contexts on non-elements (e.g., text nodes), as IE doesn't allow expando properties for those
        // (2) It might have bindings (e.g., it has a data-bind attribute, or it's a marker for a containerless template)
        var isElement = (nodeVerified.nodeType == 1);
        if (isElement) // Workaround IE <= 8 HTML parsing weirdness
            ko.virtualElements.normaliseVirtualElementDomStructure(nodeVerified);

        var shouldApplyBindings = (isElement && isRootNodeForBindingContext)                             // Case (1)
                               || ko.bindingProvider['instance']['nodeHasBindings'](nodeVerified);       // Case (2)
        if (shouldApplyBindings)
            shouldBindDescendants = applyBindingsToNodeInternal(nodeVerified, null, viewModel, isRootNodeForBindingContext).shouldBindDescendants;

        if (isElement && shouldBindDescendants)
            applyBindingsToDescendantsInternal(viewModel, nodeVerified);
    }

    function outputBindings(bindings) {
        if (typeof bindings == "object") {
            var ret = '';
            for (var bindingKey in bindings) {
                if (ret.length > 0) ret += ', ';
                ret += bindingKey;
            }
            return ret;
        } else {
            return bindings;
        }
    }

    function applyBindingsToNodeInternal (node, bindings, viewModelOrBindingContext, isRootNodeForBindingContext) {
        // The data for each binding is wrapped in a function so that it is
        // re-evaluated on each access. parsedBindings itself doesn't change
        // once it's been initialized, but it's still shared by all the bindings.
        var parsedBindings;
        function makeValueAccessor(bindingKey) {
            return function () { return parsedBindingsAccessor(bindingKey); }
        }
        function parsedBindingsAccessor(bindingKey) {
            if (bindingKey === undefined) {
                // backwards compatible support
                var bindingValues = {};
                for (var bindingKey in parsedBindings)
                    bindingValues[bindingKey] = parsedBindingsAccessor(bindingKey);
                return bindingValues;
            } else {
                var val = parsedBindings[bindingKey];
                return val && typeof val == 'function' ? val() : val;
            }
        }

        // The binding update functions are wrapped in a dependentObservable so
        // that any update to value of the binding will triiger a call to the
        // binding's update function. Normally these observables are initialized
        // (and the update function run) in the order they appear in parsedBindings,
        // but the order can be altered if a binding handler references another
        // binding through it's allBindingsAccessor function (see below).
        var bindingUpdateObservables = {};
        function initializeBindingUpdateObservable(bindingKey) {
            if (!(bindingKey in bindingUpdateObservables)) {
                var binding = ko.bindingHandlers[bindingKey];
                if (binding && typeof binding["update"] == "function") {
                    bindingUpdateObservables[bindingKey] = ko.dependentObservable(function () {
//console.log('ns e=' + node.nodeName + '.' + node.id + '.' + node.className + '; update: ' + bindingKey);
                        binding["update"](node, makeValueAccessor(bindingKey), parsedBindingsObservableAccessor, viewModel, bindingContextInstance);
                    }, null, {'disposeWhenNodeIsRemoved': node});
                }
            }
        }
        // This function (instead of parsedBindingsAccessor, above) is passed to
        // binding handlers' update functions. In addition to returning the value
        // of the specified binding, it will also make sure the binding's update
        // observable has been initialized. Thus if one binding is dependent on
        // another, the order they are specified in the binding list doesn't matter.
        function parsedBindingsObservableAccessor(bindingKey) {
            if (bindingKey !== undefined && bindingKey in parsedBindings) {
                initializeBindingUpdateObservable(bindingKey);
                if (bindingKey in bindingUpdateObservables)
                    bindingUpdateObservables[bindingKey]();
            }
            return parsedBindingsAccessor(bindingKey);
        }

        try {
            // ignore all dependencies in this block
            ko.dependencyDetection.begin(function(){});

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
//console.log('e=' + node.nodeName + '.' + node.id + '.' + node.className + '; apply: ' + outputBindings(parsedBindings));

            var bindingHandlerThatControlsDescendantBindings;
            if (parsedBindings) {
                // First run all the inits, so bindings can register for notification on changes
                for (var bindingKey in parsedBindings) {
                    var binding = ko.bindingHandlers[bindingKey];
                    if (binding && node.nodeType === 8)
                        validateThatBindingIsAllowedForVirtualElements(bindingKey);

                    if (binding && typeof binding["init"] == "function") {
//console.log('ns e=' + node.nodeName + '.' + node.id + '.' + node.className + '; init: ' + bindingKey);
                        var initResult = binding["init"](node, makeValueAccessor(bindingKey), parsedBindingsAccessor, viewModel, bindingContextInstance);

                        // If this binding handler claims to control descendant bindings, make a note of this
                        if (initResult && initResult['controlsDescendantBindings']) {
                            if (bindingHandlerThatControlsDescendantBindings !== undefined)
                                throw new Error("Multiple bindings (" + bindingHandlerThatControlsDescendantBindings + " and " + bindingKey + ") are trying to control descendant bindings of the same element. You cannot use these bindings together on the same element.");
                            bindingHandlerThatControlsDescendantBindings = bindingKey;
                        }
                    }
                }

                // ... then run all the updates, which might trigger changes even on the first evaluation
                for (var bindingKey in parsedBindings) {
                    initializeBindingUpdateObservable(bindingKey);
                }
            }
        } finally {
            ko.dependencyDetection.end();
        }

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

    ko.applyBindingsToDescendants = function(viewModel, rootNode) {
        if (rootNode.nodeType === 1)
            applyBindingsToDescendantsInternal(viewModel, rootNode);
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
    ko.exportSymbol('applyBindings', ko.applyBindings);
    ko.exportSymbol('applyBindingsToDescendants', ko.applyBindingsToDescendants);
    ko.exportSymbol('applyBindingsToNode', ko.applyBindingsToNode);
    ko.exportSymbol('contextFor', ko.contextFor);
    ko.exportSymbol('dataFor', ko.dataFor);
})();