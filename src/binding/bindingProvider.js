(function () {

    ko.bindingProvider = function (configuration) {
        this.configuration = setDefaultConfiguration(configuration);
        this.bindingCache = {};
        this['clearCache'] = function () {
            this.bindingCache = {};
        };
    };

    ko.utils.extendInternal(ko.bindingProvider.prototype, {
        'nodeHasBindings': function (node) {
            switch (node.nodeType) {
                case 1: return node.getAttribute(this.configuration.bindingAttribute) != null;   // Element
                case 8: return ko.virtualElements.virtualNodeBindingValue(node) != null; // Comment node
                default: return false;
            }
        },

        'getBindings': function (node, bindingContext) {
            var bindingsString = this['getBindingsString'](node, bindingContext);
            return bindingsString ? this['parseBindingsString'](bindingsString, bindingContext) : null;
        },

        // The following function is only used internally by this default provider.
        // It's not part of the interface definition for a general binding provider.
        'getBindingsString': function (node, bindingContext) {
            switch (node.nodeType) {
                case 1: return node.getAttribute(this.configuration.bindingAttribute);   // Element
                case 8: return ko.virtualElements.virtualNodeBindingValue(node); // Comment node
                default: return null;
            }
        },

        // The following function is only used internally by this default provider.
        // It's not part of the interface definition for a general binding provider.
        'parseBindingsString': function (bindingsString, bindingContext) {
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

    ko.bindingProvider.configuration = function (bindingProvider) {
        bindingProvider = bindingProvider ? bindingProvider : ko.bindingProvider["instance"];
        var configuration = bindingProvider.configuration ? bindingProvider.configuration : {};
        return setDefaultConfiguration(configuration);
    };

    function setDefaultConfiguration(configuration) {
        if (!configuration) configuration = {};
        configuration.name = configuration.name ? configuration.name : 'default';
        configuration.bindingAttribute = configuration.bindingAttribute ? configuration.bindingAttribute : 'data-bind';
        configuration.virtualElementTag = configuration.virtualElementTag ? configuration.virtualElementTag : "ko";
        return configuration;
    }

    function createBindingsStringEvaluatorViaCache(bindingsString, bindingOptions, scopesCount, cache) {
        var cacheKey = scopesCount + '_' + bindingsString;
        return cache[cacheKey]
            || (cache[cacheKey] = createBindingsStringEvaluator(bindingsString, bindingOptions, scopesCount));
    }

    function createBindingsStringEvaluator(bindingsString, bindingOptions, scopesCount) {
        var rewrittenBindings = " { " + ko.bindingExpressionRewriting.insertPropertyAccessors(bindingsString, bindingOptions) + " } ";
        return ko.utils.buildEvalWithinScopeFunction(rewrittenBindings, scopesCount);
    }
})();

ko.exportSymbol('bindingProvider', ko.bindingProvider);
