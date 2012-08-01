
(function () {
    // Objective:
    // * Given an input array, a container DOM node, and a function from array elements to arrays of DOM nodes,
    //   map the array elements to arrays of DOM nodes, concatenate together all these arrays, and use them to populate the container DOM node
    // * Next time we're given the same combination of things (with the array possibly having mutated), update the container DOM node
    //   so that its children is again the concatenation of the mappings of the array elements, but don't re-map any array elements that we
    //   previously mapped - retain those nodes, and just insert/delete other ones

    // "callbackAfterAddingNodes" will be invoked after any "mapping"-generated nodes are inserted into the container node
    // You can use this, for example, to activate bindings on those nodes.

    function fixUpNodesToBeRemoved(contiguousNodeArray) {
        // Before deleting or replacing a set of nodes that were previously outputted by the "map" function, we have to reconcile
        // them against what is in the DOM right now. It may be that some of the nodes have already been removed from the document,
        // or that new nodes might have been inserted in the middle, for example by a binding. Also, there may previously have been
        // leading comment nodes (created by rewritten string-based templates) that have since been removed during binding.
        // So, this function translates the old "map" output array into its best guess of what set of current DOM nodes should be removed.
        //
        // Rules:
        //   [A] Any leading nodes that aren't in the document any more should be ignored
        //       These most likely correspond to memoization nodes that were already removed during binding
        //       See https://github.com/SteveSanderson/knockout/pull/440
        //   [B] We want to output a contiguous series of nodes that are still in the document. So, ignore any nodes that
        //       have already been removed, and include any nodes that have been inserted among the previous collection

        // Rule [A]
        while (contiguousNodeArray.length && !ko.utils.domNodeIsAttachedToDocument(contiguousNodeArray[0]))
            contiguousNodeArray.splice(0, 1);

        // Rule [B]
        if (contiguousNodeArray.length > 1) {
            // Build up the actual new contiguous node set
            var current = contiguousNodeArray[0], last = contiguousNodeArray[contiguousNodeArray.length - 1], newContiguousSet = [current];
            while (current !== last) {
                current = current.nextSibling;
                if (!current) // Won't happen, except if the developer has manually removed some DOM elements (then we're in an undefined scenario)
                    return;
                newContiguousSet.push(current);
            }

            // ... then mutate the input array to match this.
            // (The following line replaces the contents of contiguousNodeArray with newContiguousSet)
            Array.prototype.splice.apply(contiguousNodeArray, [0, contiguousNodeArray.length].concat(newContiguousSet));
        }
        return contiguousNodeArray;
    }

    function defaultCallbackAfterAddingNodes(value, mappedNodes, index, subscription) {
        if (subscription) {
            subscription.addDisposalNodes(fixUpNodesToBeRemoved(mappedNodes));
        }
    }

    function wrapCallbackAfterAddingNodes(originalCallback) {
        return originalCallback
            ? function(value, mappedNodes, index, subscription) {
                originalCallback(value, mappedNodes, index);
                defaultCallbackAfterAddingNodes(value, mappedNodes, index, subscription);
            }
            : defaultCallbackAfterAddingNodes;
    }

    function mapNodeAndRefreshWhenChanged(containerNode, mapping, valueToMap, callbackAfterAddingNodes, index) {
        // Map this array value inside a dependentObservable so we re-map when any dependency changes
        var mappedNodes;
        var dependentObservable = ko.utils.possiblyWrap(function() {
            var newMappedNodes = mapping(valueToMap, index) || [];
            if (!mappedNodes) {
                // On first evaluation, we'll just return the DOM nodes
                mappedNodes = newMappedNodes;
            } else {
                // On subsequent evaluations, just replace the previously-inserted DOM nodes
                dependentObservable.replaceDisposalNodes();    // must clear before calling replaceDomNodes
                ko.utils.replaceDomNodes(fixUpNodesToBeRemoved(mappedNodes), newMappedNodes);
                callbackAfterAddingNodes(valueToMap, newMappedNodes, index, dependentObservable);

                // Replace the contents of the mappedNodes array, thereby updating the record
                // of which nodes would be deleted if valueToMap was itself later removed
                mappedNodes.splice(0, mappedNodes.length);
                ko.utils.arrayPushAll(mappedNodes, newMappedNodes);
            }
        });
        return { mappedNodes : mappedNodes, dependentObservable : dependentObservable };
    }

    var lastMappingResultDomDataKey = ko.utils.domData.nextKey();

    ko.utils.setDomNodeChildrenFromArrayMapping = function (domNode, array, mapping, options, callbackAfterAddingNodes) {
        // Compare the provided array against the previous one
        array = array || [];
        options = options || {};
        callbackAfterAddingNodes = wrapCallbackAfterAddingNodes(callbackAfterAddingNodes);
        var isFirstExecution = ko.domDataGet(domNode, lastMappingResultDomDataKey) === undefined;
        var lastMappingResult = ko.domDataGet(domNode, lastMappingResultDomDataKey) || [];
        var lastArray = ko.utils.arrayMap(lastMappingResult, function (x) { return x.arrayEntry; });
        var editScript = ko.utils.compareArrays(lastArray, array);

        // Build the new mapping result
        var newMappingResult = [];
        var lastMappingResultIndex = 0;
        var newMappingResultIndex = 0;
        var nodesToDelete = [];
        var nodesToAdd = [];
        var newNodes = [];
        var afterMoveNodes = [];
        var afterAddNodes = [];

        function itemMovedOrRetained(editScriptIndex, oldPosition, valueToMap) {
            var mapData = lastMappingResult[oldPosition],
                newPosition = newMappingResultIndex++;

            // Since updating the index might change the nodes, do so before calling fixUpNodesToBeRemoved
            mapData.indexObservable(newPosition);
            var mappedNodes = fixUpNodesToBeRemoved(mapData.domNodes);
            newMappingResult.push(mapData);
            newNodes.push.apply(newNodes, mappedNodes);

            if (newPosition !== oldPosition) {
                ko.utils.arrayForEach(mappedNodes, function (node) {
                    if (options['beforeMove'])
                        options['beforeMove'](node, editScriptIndex, valueToMap);
                    afterMoveNodes.push([node, editScriptIndex, valueToMap]);
                });
            }
        }

        for (var i = 0, editScriptItem; editScriptItem = editScript[i]; i++) {
            switch (editScriptItem['status']) {
                case "retained":
                    itemMovedOrRetained(i, lastMappingResultIndex++, editScriptItem['value']);
                    break;

                case "deleted":
                    if (editScriptItem['moved'] === undefined) {
                        var mapData = lastMappingResult[lastMappingResultIndex];

                        // Stop tracking changes to the mapping for these nodes
                        if (mapData.dependentObservable)
                            mapData.dependentObservable.dispose();

                        // Queue these nodes for later removal
                        ko.utils.arrayForEach(fixUpNodesToBeRemoved(mapData.domNodes), function (node) {
                            ko.cleanNode(node);
                            if (options['beforeRemove']) {
                                options['beforeRemove'](node, i, editScriptItem['value']);
                                newNodes.push(node);
                            } else {
                                nodesToDelete.push(node);
                            }
                        });
                    }
                    ++lastMappingResultIndex;
                    break;

                case "added":
                    var valueToMap = editScriptItem['value'];
                    if (editScriptItem['moved'] !== undefined) {
                        itemMovedOrRetained(i, editScriptItem['moved'], valueToMap);
                        break;
                    }
                    var indexObservable = ko.observable(newMappingResultIndex++);
                    var mapData = mapNodeAndRefreshWhenChanged(domNode, mapping, valueToMap, callbackAfterAddingNodes, indexObservable);
                    var mappedNodes = mapData.mappedNodes;
                    newMappingResult.push(mapData = {
                        arrayEntry: valueToMap,
                        domNodes: mappedNodes,
                        dependentObservable: mapData.dependentObservable,
                        indexObservable: indexObservable
                    });
                    nodesToAdd.push(mapData);
                    newNodes.push.apply(newNodes, mappedNodes);
                    if (!isFirstExecution) {
                        for (var nodeIndex = 0, nodeIndexMax = mappedNodes.length; nodeIndex < nodeIndexMax; nodeIndex++) {
                            afterAddNodes.push([mappedNodes[nodeIndex], i, valueToMap]);
                        }
                    }
                    break;
            }
        }

        // First remove nodes for deleted items (unless there was a beforeRemove callback)
        for (var i = 0, node; node = nodesToDelete[i]; i++) {
            if (node.parentNode)
                node.parentNode.removeChild(node);
        }

        // Next add/reorder the remaining nodes (will include deleted items if there's a beforeRemove callback)
        for (var i = 0, lastNode, node; node = newNodes[i]; lastNode = node, i++) {
            if (!lastNode) {
                // Insert "node" (the newly-created node) as domNode's first child
                ko.virtualElements.prepend(domNode, node);
            } else {
                // Insert "node" into "domNode" immediately after "lastNode"
                ko.virtualElements.insertAfter(domNode, node, lastNode);
            }
        }

        // Run the callbacks for newly added nodes (for example, to apply bindings, etc.)
        for (var i = 0, mapData; mapData = nodesToAdd[i]; i++) {
            callbackAfterAddingNodes(mapData.arrayEntry, mapData.domNodes, mapData.indexObservable, mapData.dependentObservable);
        }

        // Run the callbacks for moved or added nodes (only after the first execution)
        function afterCallback(name, items) {
            if (options[name])
                for (var i = 0, itemArgs; itemArgs = items[i]; i++)
                    options[name].apply(this, itemArgs);
        }
        afterCallback('afterMove', afterMoveNodes);
        afterCallback('afterAdd', afterAddNodes);

        // Store a copy of the array items we just considered so we can difference it next time
        ko.domDataSet(domNode, lastMappingResultDomDataKey, newMappingResult);
    }
})();

ko.exportSymbol('utils.setDomNodeChildrenFromArrayMapping', ko.utils.setDomNodeChildrenFromArrayMapping);
