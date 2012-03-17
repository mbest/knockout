
ko.templateRewriting = (function () {
    var memoizeDataBindingAttributeSyntaxRegex = function (bindingProvider) {
        return new RegExp("(<[a-z]+\\d*(\\s+(?!" + ko.bindingProvider.configuration(bindingProvider).bindingAttribute + "=)[a-z0-9\\-]+(=(\\\"[^\\\"]*\\\"|\\'[^\\']*\\'))?)*\\s+)" + ko.bindingProvider.configuration(bindingProvider).bindingAttribute + "=([\"'])([\\s\\S]*?)\\5", "gi");
    };
    var memoizeVirtualContainerBindingSyntaxRegex = function (bindingProvider) {
        return new RegExp("<!--\\s*" + ko.bindingProvider.configuration(bindingProvider).virtualElementTag + "\\b\\s*([\\s\\S]*?)\\s*-->", "g");
    }

    function validateDataBindValuesForRewriting(keyValueArray) {
        var allValidators = ko.templateRewriting.bindingRewriteValidators;
        for (var i = 0; i < keyValueArray.length; i++) {
            var key = keyValueArray[i]['key'];
            if (allValidators.hasOwnProperty(key)) {
                var possibleErrorMessage = allValidators[key](keyValueArray[i]['value']);
                if (possibleErrorMessage)
                    throw new Error(possibleErrorMessage);
            } else {
                var binding = ko.getBindingHandler(key);
                // Don't rewrite bindings that bind their contents unless they also set their contents
                if (binding && ko.checkBindingFlags(binding, bindingFlags_contentBind, bindingFlags_contentSet))
                    throw new Error("This template engine does not support the '" + key + "' binding within its templates");
            }
        }
    }

    function constructMemoizedTagReplacement(dataBindAttributeValue, tagToRetain, templateEngine) {
        var dataBindKeyValueArray = ko.bindingExpressionRewriting.parseObjectLiteral(dataBindAttributeValue);
        validateDataBindValuesForRewriting(dataBindKeyValueArray);
        var rewrittenDataBindAttributeValue = ko.bindingExpressionRewriting.insertPropertyAccessors(dataBindKeyValueArray);

        // For no obvious reason, Opera fails to evaluate rewrittenDataBindAttributeValue unless it's wrapped in an additional 
        // anonymous function, even though Opera's built-in debugger can evaluate it anyway. No other browser requires this 
        // extra indirection.
        var applyBindingsToNextSiblingScript =
            "ko.__tr_ambtns(function(){return(function(){return{" + rewrittenDataBindAttributeValue + "}})()})";
        return templateEngine['createJavaScriptEvaluatorBlock'](applyBindingsToNextSiblingScript) + tagToRetain;
    }

    return {
        bindingRewriteValidators: {},

        ensureTemplateIsRewritten: function (template, templateEngine) {
            if (!templateEngine['isTemplateRewritten'](template))
                templateEngine['rewriteTemplate'](template, function (htmlString) {
                    return ko.templateRewriting.memoizeBindingAttributeSyntax(htmlString, templateEngine);
                });
        },

        memoizeBindingAttributeSyntax: function (htmlString, templateEngine) {
            return htmlString.replace(memoizeDataBindingAttributeSyntaxRegex(), function () {
                return constructMemoizedTagReplacement(/* dataBindAttributeValue: */arguments[6], /* tagToRetain: */arguments[1], templateEngine);
            }).replace(memoizeVirtualContainerBindingSyntaxRegex(), function () {
                return constructMemoizedTagReplacement(/* dataBindAttributeValue: */arguments[1], /* tagToRetain: */"<!-- ko -->", templateEngine);
            });
        },

        applyMemoizedBindingsToNextSibling: function (bindings) {
            return ko.memoization.memoize(function (domNode, bindingContext) {
                if (domNode.nextSibling)
                    ko.applyBindingsToNode(domNode.nextSibling, bindings, bindingContext);
            });
        }
    }
})();

ko.exportSymbol('bindingRewriteValidators', ko.templateRewriting.bindingRewriteValidators);

// Exported only because it has to be referenced by string lookup from within rewritten template
ko.exportSymbol('__tr_ambtns', ko.templateRewriting.applyMemoizedBindingsToNextSibling);
