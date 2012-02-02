
ko.utils.domNodeDisposal = new (function () {
    var domDataKey = "__ko_domNodeDisposal__" + (new Date).getTime();
    var cleanableNodeTypes = { 1: true, 8: true, 9: true };       // Element, Comment, Document
    var cleanableNodeTypesWithDescendants = { 1: true, 9: true }; // Element, Document

    function getDisposeCallbacksCollection(node, createIfNotFound) {
        var allDisposeCallbacks = ko.utils.domData.get(node, domDataKey);
        if ((allDisposeCallbacks === undefined) && createIfNotFound) {
            allDisposeCallbacks = [];
            ko.utils.domData.set(node, domDataKey, allDisposeCallbacks);
        }
        return allDisposeCallbacks;
    }
    function destroyCallbacksCollection(node) {
        ko.utils.domData.set(node, domDataKey, undefined);
    }

    function cleanSingleNode(node) {
        // Run all the dispose callbacks
        var callbacks = getDisposeCallbacksCollection(node, false);
        if (callbacks) {
            callbacks = callbacks.slice(0); // Clone, as the array may be modified during iteration (typically, callbacks will remove themselves)
            for (var i = 0; i < callbacks.length; i++)
                callbacks[i](node);
        }

        // Also erase the DOM data
        ko.utils.domData.clear(node);

        // Special support for jQuery here because it's so commonly used.
        // Many jQuery plugins (including jquery.tmpl) store data using jQuery's equivalent of domData
        // so notify it to tear down any resources associated with the node & descendants here.
        if ((typeof jQuery == "function") && (typeof jQuery['cleanData'] == "function"))
            jQuery['cleanData']([node]);

        // Also clear any immediate-child comment nodes, as these wouldn't have been found by
        // node.getElementsByTagName("*") in cleanNode() (comment nodes aren't elements)
        if (cleanableNodeTypesWithDescendants[node.nodeType])
            cleanImmediateCommentTypeChildren(node);
    }

    function cleanImmediateCommentTypeChildren(nodeWithChildren) {
        var child, nextChild = nodeWithChildren.firstChild;
        while (child = nextChild) {
            nextChild = child.nextSibling;
            if (child.nodeType === 8)
                cleanSingleNode(child);
        }
    }

    function newDisposeCallback(nodeOrNodes, disposeCallback, disposeWhen) {
        var nodes = [];
        function addNode(node) {
            if (node.nodeType !== 3) {
                nodes.push(node);
                getDisposeCallbacksCollection(node, true).push(cleanNodeCallback);
            }
        }
        function cleanNodeCallback(node) {
            ko.utils.arrayRemoveItem(nodes, node);
            if (!nodes.length)
                disposeCallback();
        }
        function addNodeOrNodes(nodeOrNodes) {
            nodeOrNodes.nodeType ? addNode(nodeOrNodes) : ko.utils.arrayForEach(nodeOrNodes, addNode);
        }
        function deleteNode(node) {
            ko.utils.arrayRemoveItem(nodes, node);
            var callbacksCollection = getDisposeCallbacksCollection(node, false);
            if (callbacksCollection) {
                ko.utils.arrayRemoveItem(callbacksCollection, cleanNodeCallback);
                if (!callbacksCollection.length)
                    destroyCallbacksCollection(node);
            }
        }
        function deleteAll() {
            while (nodes.length)
                deleteNode(nodes[0]);
        }
        function dispose() {
            deleteAll();
            disposeCallback();
        }
        function shouldDispose() {
            return !ko.utils.arrayFirst(nodes, ko.utils.domNodeIsAttachedToDocument) || (disposeWhen && disposeWhen());
        }

        if (typeof disposeCallback != "function")
            throw new Error("Callback must be a function");
        if (nodeOrNodes)
            addNodeOrNodes(nodeOrNodes);

        return {
            addNodeOrNodes: addNodeOrNodes,
            deleteNode: deleteNode,
            deleteAll: deleteAll,
            dispose: dispose,
            shouldDispose: shouldDispose
        };
    };

    return {
        addDisposeCallback : newDisposeCallback,

        cleanNode : function(node) {
            // First clean this node, where applicable
            if (cleanableNodeTypes[node.nodeType]) {
                cleanSingleNode(node);

                // ... then its descendants, where applicable
                if (cleanableNodeTypesWithDescendants[node.nodeType]) {
                    // Clone the descendants list in case it changes during iteration
                    var descendants = [];
                    ko.utils.arrayPushAll(descendants, node.getElementsByTagName("*"));
                    for (var i = 0, j = descendants.length; i < j; i++)
                        cleanSingleNode(descendants[i]);
                }
            }
        },

        removeNode : function(node) {
            ko.cleanNode(node);
            if (node.parentNode)
                node.parentNode.removeChild(node);
        }
    }
})();
ko.cleanNode = ko.utils.domNodeDisposal.cleanNode; // Shorthand name for convenience
ko.removeNode = ko.utils.domNodeDisposal.removeNode; // Shorthand name for convenience
ko.exportSymbol('cleanNode', ko.cleanNode);
ko.exportSymbol('removeNode', ko.removeNode);
