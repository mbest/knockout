(function() {
    var defaultBindingAttributeName = "data-bind";

    ko.bindingProvider = function() {
        this.bindingCache = {};
        this['clearCache'] = function() {
            this.bindingCache = {};
        };
    };

    ko.utils.extendInternal(ko.bindingProvider.prototype, {
        'nodeHasBindings': function(node) {
            return !!this['getBindingsString'](node);
        },

        'getBindings': function(node, bindingContext) {
            var bindingsString = this['getBindingsString'](node);
            return bindingsString ? this['parseBindingsString'](bindingsString, bindingContext, node) : null;
        },

        // The following function is only used internally by this default provider.
        // It's not part of the interface definition for a general binding provider.
        'getBindingsString': function(node) {
            switch (node.nodeType) {
                case 1: return node.getAttribute(defaultBindingAttributeName);   // Element
                case 8: return ko.virtualElements.virtualNodeBindingValue(node); // Comment node
                default: return null;
            }
        },

        // The following function is only used internally by this default provider.
        // It's not part of the interface definition for a general binding provider.
        'parseBindingsString': function(bindingsString, bindingContext, node) {
            try {
                var viewModel = bindingContext['$data'] || {},
                    bindingFunction = createBindingsStringEvaluatorViaCache(bindingsString, bindingContext['$options'], this.bindingCache);
                return bindingFunction(viewModel, bindingContext, node);
            } catch (ex) {
                throw new Error("Unable to parse bindings.\nMessage: " + ex + ";\nBindings value: " + bindingsString);
            }
        }
    });

    ko.bindingProvider['instance'] = new ko.bindingProvider();

    function createBindingsStringEvaluatorViaCache(bindingsString, bindingOptions, cache) {
        var cacheKey = bindingsString;
        return cache[cacheKey]
            || (cache[cacheKey] = createBindingsStringEvaluator(bindingsString, bindingOptions));
    }

    function createBindingsStringEvaluator(bindingsString, bindingOptions) {
        // Build the source for a function that evaluates "expression"
        // For each scope variable, add an extra level of "with" nesting
        // Example result: with(sc1) { with(sc0) { return (expression) } }
        var rewrittenBindings = ko.expressionRewriting.preProcessBindings(bindingsString, bindingOptions),
            functionBody = "with(sc1){with(sc0){return{" + rewrittenBindings + "} } }";
        return new Function("sc0", "sc1", "$element", functionBody);
    }
})();

ko.exportSymbol('bindingProvider', ko.bindingProvider);
