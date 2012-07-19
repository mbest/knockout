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
            return bindingsString ? this['parseBindingsString'](bindingsString, bindingContext) : null;
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
        'parseBindingsString': function(bindingsString, bindingContext) {
            try {
                var viewModel = bindingContext['$data'],
                    scopes = (typeof viewModel == 'object' && viewModel != null) ? [viewModel, bindingContext] : [bindingContext],
                    bindingFunction = createBindingsStringEvaluatorViaCache(bindingsString, bindingContext['$options'], scopes.length, this.bindingCache);
                return bindingFunction(scopes);
            } catch (ex) {
                throw new Error("Unable to parse bindings.\nMessage: " + ex + ";\nBindings value: " + bindingsString);
            }
        }
    });

    ko.bindingProvider['instance'] = new ko.bindingProvider();

    function createBindingsStringEvaluatorViaCache(bindingsString, bindingOptions, scopesCount, cache) {
        var cacheKey = scopesCount + '_' + bindingsString;
        return cache[cacheKey]
            || (cache[cacheKey] = createBindingsStringEvaluator(bindingsString, bindingOptions, scopesCount));
    }

    function createBindingsStringEvaluator(bindingsString, bindingOptions, scopesCount) {
        var rewrittenBindings = " { " + ko.expressionRewriting.preProcessBindings(bindingsString, bindingOptions) + " } ";
        return ko.utils.buildEvalWithinScopeFunction(rewrittenBindings, scopesCount);
    }
})();

ko.exportSymbol('bindingProvider', ko.bindingProvider);
