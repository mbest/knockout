
(function () {
    // Objective:
    // * Given an input array, a container DOM node, and a function from array elements to arrays of DOM nodes,
    //   map the array elements to arrays of DOM nodes, concatenate together all these arrays, and use them to populate the container DOM node
    // * Next time we're given the same combination of things (with the array possibly having mutated), update the container DOM node
    //   so that its children is again the concatenation of the mappings of the array elements, but don't re-map any array elements that we
    //   previously mapped - retain those nodes, and just insert/delete other ones

    // "callbackAfterAddingNodes" will be invoked after any "mapping"-generated nodes are inserted into the container node
    // You can use this, for example, to activate bindings on those nodes.

    function fixUpVirtualElements(contiguousNodeArray) {
        // Remove any initial nodes that aren't in the document
        while (contiguousNodeArray.length && !ko.utils.domNodeIsAttachedToDocument(contiguousNodeArray[0]))
            contiguousNodeArray.splice(0, 1);

        // Ensures that contiguousNodeArray really *is* an array of contiguous siblings, even if some of the interior
        // ones have changed since your array was first built (e.g., because your array contains virtual elements, and
        // their virtual children changed when binding was applied to them).
        // This is needed so that we can reliably remove or update the nodes corresponding to a given array item
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
            subscription.addDisposalNodes(fixUpVirtualElements(mappedNodes));
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
                ko.utils.replaceDomNodes(fixUpVirtualElements(mappedNodes), newMappedNodes);
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
        var nodesToDelete = [];
        var newMappingResultIndex = 0;
        var nodesAdded = [];
        var insertAfterNode = null;
        for (var i = 0, editScriptItem; editScriptItem = editScript[i]; i++) {
            switch (editScriptItem['status']) {
                case "retained":
                    // Just keep the information - don't touch the nodes
                    var dataToRetain = lastMappingResult[lastMappingResultIndex++];
                    dataToRetain.indexObservable(newMappingResultIndex++);
                    newMappingResult.push(dataToRetain);
                    if (dataToRetain.domNodes.length > 0)
                        insertAfterNode = dataToRetain.domNodes[dataToRetain.domNodes.length - 1];
                    break;

                case "deleted":
                    if (editScriptItem['moved'] === undefined) {
                        var mapData = lastMappingResult[lastMappingResultIndex];

                        // Stop tracking changes to the mapping for these nodes
                        if (mapData.dependentObservable)
                            mapData.dependentObservable.dispose();

                        // Queue these nodes for later removal
                        ko.utils.arrayForEach(fixUpVirtualElements(mapData.domNodes), function (node) {
                            nodesToDelete.push({
                              _element: node,
                              _index: i,
                              _value: editScriptItem['value']
                            });
                            insertAfterNode = node;
                        });
                    }
                    ++lastMappingResultIndex;
                    break;

                case "added":
                    var mappedNodes, movingNodes, valueToMap;
                    if (editScriptItem['moved'] !== undefined) {
                        var dataToRetain = lastMappingResult[editScriptItem['moved']];
                        dataToRetain.indexObservable(newMappingResultIndex++);
                        mappedNodes = fixUpVirtualElements(dataToRetain.domNodes);
                        movingNodes = true;
                        newMappingResult.push(dataToRetain);
                    } else {
                        var indexObservable = ko.observable(newMappingResultIndex++);
                        var mapData = mapNodeAndRefreshWhenChanged(domNode, mapping, valueToMap = editScriptItem['value'], callbackAfterAddingNodes, indexObservable);
                        mappedNodes = mapData.mappedNodes;
                        movingNodes = false;

                        // On the first evaluation, insert the nodes at the current insertion point
                        newMappingResult.push({
                            arrayEntry: valueToMap,
                            domNodes: mappedNodes,
                            dependentObservable: mapData.dependentObservable,
                            indexObservable: indexObservable
                        });
                    }
                    for (var nodeIndex = 0, nodeIndexMax = mappedNodes.length; nodeIndex < nodeIndexMax; nodeIndex++) {
                        var node = mappedNodes[nodeIndex];
                        if (!movingNodes) {
                            nodesAdded.push({
                              _element: node,
                              _index: i,
                              _value: valueToMap
                            });
                        }
                        if (insertAfterNode == null) {
                            // Insert "node" (the newly-created node) as domNode's first child
                            ko.virtualElements.prepend(domNode, node);
                        } else {
                            // Insert "node" into "domNode" immediately after "insertAfterNode"
                            ko.virtualElements.insertAfter(domNode, node, insertAfterNode);
                        }
                        insertAfterNode = node;
                    }
                    if (!movingNodes)
                        callbackAfterAddingNodes(valueToMap, mappedNodes, indexObservable, mapData.dependentObservable);
                    break;
            }
        }

        ko.utils.arrayForEach(nodesToDelete, function (node) { ko.cleanNode(node._element) });

        var invokedBeforeRemoveCallback = false;
        if (!isFirstExecution) {
            if (options['afterAdd']) {
                for (var i = 0; i < nodesAdded.length; i++)
                    options['afterAdd'](nodesAdded[i]._element, nodesAdded[i]._index, nodesAdded[i]._value);
            }
            if (options['beforeRemove']) {
                for (var i = 0; i < nodesToDelete.length; i++)
                    options['beforeRemove'](nodesToDelete[i]._element, nodesToDelete[i]._index, nodesToDelete[i]._value);
                invokedBeforeRemoveCallback = true;
            }
        }
        if (!invokedBeforeRemoveCallback && nodesToDelete.length) {
            var commonParent = nodesToDelete[0]._element.parentNode;
            if (commonParent) {
                for (var i = 0; i < nodesToDelete.length; i++)
                    commonParent.removeChild(nodesToDelete[i]._element);
            }
        }

        // Store a copy of the array items we just considered so we can difference it next time
        ko.domDataSet(domNode, lastMappingResultDomDataKey, newMappingResult);
    }
})();

ko.exportSymbol('utils.setDomNodeChildrenFromArrayMapping', ko.utils.setDomNodeChildrenFromArrayMapping);
