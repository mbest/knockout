(function () {
    var _templateEngine;
    ko.setTemplateEngine = function (templateEngine) {
        if ((templateEngine != undefined) && !(templateEngine instanceof ko.templateEngine))
            throw new Error("templateEngine must inherit from ko.templateEngine");
        _templateEngine = templateEngine;
    }

    function invokeForEachNodeOrCommentInContinuousRange(firstNode, lastNode, action) {
        var node, nextInQueue = firstNode, firstOutOfRangeNode = ko.virtualElements.nextSibling(lastNode);
        while (nextInQueue && ((node = nextInQueue) !== firstOutOfRangeNode)) {
            nextInQueue = ko.virtualElements.nextSibling(node);
            if (node.nodeType === 1 || node.nodeType === 8)
                action(node);
        }
    }

    function activateBindingsOnContinuousNodeArray(continuousNodeArray, bindingContext, subscription) {
        // To be used on any nodes that have been rendered by a template and have been inserted into some parent element
        // Walks through continuousNodeArray (which *must* be continuous, i.e., an uninterrupted sequence of sibling nodes, because
        // the algorithm for walking them relies on this), and for each top-level item in the virtual-element sense,
        // (1) Does a regular "applyBindings" to associate bindingContext with this node and to activate any non-memoized bindings
        // (2) Unmemoizes any memos in the DOM subtree (e.g., to activate bindings that had been memoized during template rewriting)
        
        if (continuousNodeArray.length) {
            var firstNode = continuousNodeArray[0], lastNode = continuousNodeArray[continuousNodeArray.length - 1];

            // Need to applyBindings *before* unmemoziation, because unmemoization might introduce extra nodes (that we don't want to re-bind)
            // whereas a regular applyBindings won't introduce new memoized nodes
            invokeForEachNodeOrCommentInContinuousRange(firstNode, lastNode, function(node) {
                ko.applyBindings(bindingContext, node);
                if (subscription)
                    subscription.addDisposalNodes(node);
            });
            invokeForEachNodeOrCommentInContinuousRange(firstNode, lastNode, function(node) {
                ko.memoization.unmemoizeDomNodeAndDescendants(node, [bindingContext]);
            });
        }
    }

    function executeTemplate(targetNodeOrNodeArray, renderMode, template, bindingContext, options) {
        options = options || {};
        var templateEngineToUse = (options['templateEngine'] || _templateEngine);
        ko.templateRewriting.ensureTemplateIsRewritten(template, templateEngineToUse);
        var renderedNodesArray = templateEngineToUse['renderTemplate'](template, bindingContext, options);

        // Loosely check result is an array of DOM nodes
        if ((typeof renderedNodesArray.length != "number") || (renderedNodesArray.length > 0 && typeof renderedNodesArray[0].nodeType != "number"))
            throw new Error("Template engine must return an array of DOM nodes");

        var haveAddedNodesToParent = false;
        switch (renderMode) {
            case "replaceChildren": 
                ko.virtualElements.setDomNodeChildren(targetNodeOrNodeArray, renderedNodesArray); 
                haveAddedNodesToParent = true;
                break;
            case "replaceNode": 
                ko.utils.replaceDomNodes(targetNodeOrNodeArray, renderedNodesArray); 
                haveAddedNodesToParent = true;
                break;
            case "ignoreTargetNode": break;
            default: 
                throw new Error("Unknown renderMode: " + renderMode);
        }

        if (haveAddedNodesToParent) {
            activateBindingsOnContinuousNodeArray(renderedNodesArray, bindingContext);
            if (options['afterRender'])
                options['afterRender'](renderedNodesArray, bindingContext['$data']);  
        }

        return renderedNodesArray;
    }

    ko.renderTemplate = function (template, dataOrBindingContext, options, targetNodeOrNodeArray, renderMode) {
        options = options || {};
        if ((options['templateEngine'] || _templateEngine) == undefined)
            throw new Error("Set a template engine before calling renderTemplate");
        renderMode = renderMode || "replaceChildren";

        if (targetNodeOrNodeArray) {
            var subscription = ko.dependentObservable( // So the DOM is automatically updated when any dependency changes
                function () {
                    // Ensure we've got a proper binding context to work with
                    var bindingContext = (dataOrBindingContext && (dataOrBindingContext instanceof ko.bindingContext))
                        ? dataOrBindingContext
                        : new ko.bindingContext(ko.utils.unwrapObservable(dataOrBindingContext));

                    // Support selecting template as a function of the data being rendered
                    var templateName = typeof(template) == 'function' ? template(bindingContext['$data']) : template; 

                    var renderedNodesArray = executeTemplate(targetNodeOrNodeArray, renderMode, templateName, bindingContext, options);
                    if (renderMode == "replaceNode") {
                        targetNodeOrNodeArray = renderedNodesArray;
                        if (subscription)
                            subscription.replaceDisposalNodes(targetNodeOrNodeArray);
                    }
                    }
            ).addDisposalNodes(targetNodeOrNodeArray);
            return subscription;
        } else {
            // We don't yet have a DOM node to evaluate, so use a memo and render the template later when there is a DOM node
            return ko.memoization.memoize(function (domNode) {
                ko.renderTemplate(template, dataOrBindingContext, options, domNode, "replaceNode");
            });
        }
    };

    ko.renderTemplateForEach = function (template, arrayOrObservableArray, options, targetNode, parentBindingContext) {   
        var lastContext, lastArrayValue;
        var createInnerBindingContext = function(arrayValue) {
            lastArrayValue = arrayValue;
            return (lastContext = parentBindingContext['createChildContext'](ko.utils.unwrapObservable(arrayValue)));
        };

        // This will be called whenever setDomNodeChildrenFromArrayMapping has added nodes to targetNode
        var activateBindingsCallback = function(arrayValue, addedNodesArray, subscription) {
            var bindingContext = (lastContext && arrayValue == lastArrayValue) ? lastContext : createInnerBindingContext(arrayValue);
            activateBindingsOnContinuousNodeArray(addedNodesArray, bindingContext, subscription);
            if (options['afterRender'])
                options['afterRender'](addedNodesArray, bindingContext['$data']);                                                
        };
         
        return ko.dependentObservable(function () {
            var unwrappedArray = ko.utils.unwrapObservable(arrayOrObservableArray) || [];
            if (typeof unwrappedArray.length == "undefined") // Coerce single value into array
                unwrappedArray = [unwrappedArray];

            // Filter out any entries marked as destroyed
            var filteredArray = ko.utils.arrayFilter(unwrappedArray, function(item) {
                return options['includeDestroyed'] || item === undefined || item === null || !ko.utils.unwrapObservable(item['_destroy']);
            });

            ko.utils.setDomNodeChildrenFromArrayMapping(targetNode, filteredArray, function (arrayValue) {
                // Support selecting template as a function of the data being rendered
                var templateName = typeof(template) == 'function' ? template(arrayValue) : template;
                return executeTemplate(null, "ignoreTargetNode", templateName, createInnerBindingContext(arrayValue), options);
            }, options, activateBindingsCallback);
            
        }).addDisposalNodes(targetNode);
    };

    var templateSubscriptionDomDataKey = ko.utils.domData.nextKey();
    function disposeOldSubscriptionAndStoreNewOne(element, newSubscription) {
        var oldSubscription = ko.domDataGet(element, templateSubscriptionDomDataKey);
        if (oldSubscription && (typeof(oldSubscription.dispose) == 'function'))
            oldSubscription.dispose();
        ko.domDataSet(element, templateSubscriptionDomDataKey, newSubscription);
    }
    
    ko.bindingHandlers['template'] = {
        'flags': bindingFlags_contentBind | bindingFlags_contentSet | bindingFlags_canUseVirtual,
        'init': function(element, valueAccessor) {
            // Support anonymous templates
            var bindingValue = ko.utils.unwrapObservable(valueAccessor());
            if ((typeof bindingValue != "string") && (!bindingValue['name']) && (element.nodeType == 1 || element.nodeType == 8)) {
                // It's an anonymous template - store the element contents, then clear the element
                var templateNodes = ko.virtualElements.childNodes(element),
                    container = ko.utils.moveNodesToContainerElement(templateNodes); // This also removes the nodes from their current parent
                new ko.templateSources.anonymousTemplate(element)['nodes'](container);
            }
        },
        'update': function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            var bindingValue = ko.utils.unwrapObservable(valueAccessor());
            var shouldDisplay = true;
            
            if (typeof bindingValue == "string") {
                bindingValue = {'name': bindingValue};
            } else {
                // Support "if"/"ifnot" conditions
                if ('if' in bindingValue)
                    shouldDisplay = shouldDisplay && ko.utils.unwrapObservable(bindingValue['if']);
                if ('ifnot' in bindingValue)
                    shouldDisplay = shouldDisplay && !ko.utils.unwrapObservable(bindingValue['ifnot']);
            }    
            var template = bindingValue['name'] || element;
            
            var templateSubscription = null;
            
            if ('foreach' in bindingValue) {
                // Render once for each data point (treating data set as empty if shouldDisplay==false)
                var dataArray = (shouldDisplay && bindingValue['foreach']) || [];
                templateSubscription = ko.renderTemplateForEach(template, dataArray, /* options: */ bindingValue, element, bindingContext);
            } else {
                if (shouldDisplay) {
                    // Render once for this single data point (or use the viewModel if no data was provided)
                    var innerBindingContext = ('data' in bindingValue)
                        ? bindingContext['createChildContext'](bindingValue['data'])    // Given an explitit 'data' value, we create a child binding context for it
                        : bindingContext;                                                                       // Given no explicit 'data' value, we retain the same binding context
                    templateSubscription = ko.renderTemplate(template, innerBindingContext, /* options: */ bindingValue, element);
                } else
                    ko.virtualElements.emptyNode(element);
            }
            
            // It only makes sense to have a single template subscription per element (otherwise which one should have its output displayed?)
            disposeOldSubscriptionAndStoreNewOne(element, templateSubscription);
        }
    };

    // Anonymous templates can't be rewritten. Give a nice error message if you try to do it.
    ko.templateRewriting.bindingRewriteValidators['template'] = function(bindingValue) {
        var parsedBindingValue = ko.bindingExpressionRewriting.parseObjectLiteral(bindingValue);

        if ((parsedBindingValue.length == 1) && parsedBindingValue[0]['unknown'])
            return null; // It looks like a string literal, not an object literal, so treat it as a named template (which is allowed for rewriting)

        if (ko.bindingExpressionRewriting.keyValueArrayContainsKey(parsedBindingValue, "name"))
            return null; // Named templates can be rewritten, so return "no error"
        return "This template engine does not support anonymous templates nested within its templates";
    };
})();

ko.exportSymbol('setTemplateEngine', ko.setTemplateEngine);
ko.exportSymbol('renderTemplate', ko.renderTemplate);
