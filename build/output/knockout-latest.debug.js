// Knockout JavaScript library v2.1.0pre+mbest/smart-binding/beta.3+GilesBradshaw/BindingProviderConfiguration
// (c) Steven Sanderson - http://knockoutjs.com/
// License: MIT (http://www.opensource.org/licenses/mit-license.php)

(function(){
var DEBUG=true;
(function(window,document,navigator,undefined){function ko_throw(e){throw Error(e)} 
(function(factory) {
    // Support three module loading scenarios
    if (typeof require === 'function' && typeof exports === 'object' && typeof module === 'object') {
        // [1] CommonJS/Node.js
        var target = module['exports'] || exports; // module.exports is for Node.js
        factory(target);
    } else if (typeof define === 'function' && define['amd']) {
        // [2] AMD anonymous module
        define(['exports'], factory);
    } else {
        // [3] No module loader (plain <script> tag) - put directly in global namespace
        factory(window['ko'] = {});
    }
})(function(koExports){
// Internally, all KO objects are attached to koExports (even the non-exported ones whose names will be minified by the closure compiler).
// In the future, the following "ko" variable may be made distinct from "koExports" so that private objects are not externally reachable.
var ko = typeof koExports !== 'undefined' ? koExports : {};
// Google Closure Compiler helpers (used only to make the minified file smaller)
ko.exportSymbol = function(koPath, object) {
	var tokens = koPath.split(".");
	
	// In the future, "ko" may become distinct from "koExports" (so that non-exported objects are not reachable)
	// At that point, "target" would be set to: (typeof koExports !== "undefined" ? koExports : ko)
	var target = ko;

	for (var i = 0; i < tokens.length - 1; i++)
		target = target[tokens[i]];
	target[tokens[tokens.length - 1]] = object;
};
ko.exportProperty = function(owner, publicName, object) {
  owner[publicName] = object;
};
ko.exportProperties = function(owner /*name, object, name, object ...*/) {
    for (var i=1, a=arguments, n=a.length-1; i < n; i += 2) {
        owner[a[i]] = a[i+1];
    }
    return owner;
};
ko.version = "2.1.0pre+mbest/smart-binding/beta.3+GilesBradshaw/BindingProviderConfiguration";

ko.exportSymbol('version', ko.version);
ko.utils = (function () {
    var stringTrimRegex = /^(\s|\u00A0)+|(\s|\u00A0)+$/g;
    
    // Represent the known event types in a compact way, then at runtime transform it into a hash with event name as key (for fast lookup)
    var knownEvents = {}, knownEventTypesByEventName = {};
    var keyEventTypeName = /Firefox\/2/i.test(navigator.userAgent) ? 'KeyboardEvent' : 'UIEvents';
    knownEvents[keyEventTypeName] = ['keyup', 'keydown', 'keypress'];
    knownEvents['MouseEvents'] = ['click', 'dblclick', 'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave'];        
    for (var eventType in knownEvents) {
        var knownEventsForType = knownEvents[eventType];
        if (knownEventsForType.length) {
            for (var i = 0, j = knownEventsForType.length; i < j; i++)
                knownEventTypesByEventName[knownEventsForType[i]] = eventType;
        }
    }

    // Detect IE versions for bug workarounds (uses IE conditionals, not UA string, for robustness)
    var ieVersion = (function() {
        var version = 3, div = document.createElement('div'), iElems = div.getElementsByTagName('i');
        
        // Keep constructing conditional HTML blocks until we hit one that resolves to an empty fragment
        while (
            div.innerHTML = '<!--[if gt IE ' + (++version) + ']><i></i><![endif]-->',
            iElems[0]
        ) {};
        return version > 4 ? version : undefined;        
    }());
    var isIe6 = ieVersion === 6,
        isIe7 = ieVersion === 7;

    function isClickOnCheckableElement(element, eventType) {
        if ((element.tagName != "INPUT") || !element.type) return false;
        if (eventType.toLowerCase() != "click") return false;
        var inputType = element.type.toLowerCase();
        return (inputType == "checkbox") || (inputType == "radio");
    }

    var utils = {
        fieldsIncludedWithJsonPost: ['authenticity_token', /^__RequestVerificationToken(_.*)?$/],
        
        arrayForEach: function (array, action) {
            for (var i = 0, j = array.length; i < j; i++)
                action(array[i]);
        },

        arrayIndexOf: function (array, item) {
            if (typeof Array.prototype.indexOf == "function")
                return Array.prototype.indexOf.call(array, item);
            for (var i = 0, j = array.length; i < j; i++)
                if (array[i] === item)
                    return i;
            return -1;
        },

        arrayFirst: function (array, predicate, predicateOwner) {
            for (var i = 0, j = array.length; i < j; i++)
                if (predicate.call(predicateOwner, array[i]))
                    return array[i];
            return null;
        },

        arrayRemoveItem: function (array, itemToRemove) {
            var index = utils.arrayIndexOf(array, itemToRemove);
            if (index >= 0)
                array.splice(index, 1);
        },

        arrayGetDistinctValues: function (array) {
            array = array || [];
            var result = [];
            for (var i = 0, j = array.length; i < j; i++) {
                if (utils.arrayIndexOf(result, array[i]) < 0)
                    result.push(array[i]);
            }
            return result;
        },        

        arrayMap: function (array, mapping) {
            array = array || [];
            var result = [];
            for (var i = 0, j = array.length; i < j; i++)
                result.push(mapping(array[i]));
            return result;
        },

        arrayFilter: function (array, predicate) {
            array = array || [];
            var result = [];
            for (var i = 0, j = array.length; i < j; i++)
                if (predicate(array[i]))
                    result.push(array[i]);
            return result;
        },
        
        arrayPushAll: function (array, valuesToPush) {
            if (valuesToPush instanceof Array)
                array.push.apply(array, valuesToPush);
            else
                for (var i = 0, j = valuesToPush.length; i < j; i++) 
                    array.push(valuesToPush[i]);	
            return array;
        },

        extendInternal: function (target, source) {
            for(var prop in source) {
                if(source.hasOwnProperty(prop)) {
                    target[prop] = source[prop];
                }
            }
            return target;
        },

        objectMap: function(source, mapping) {
            var target = {};
            for(var prop in source) {
                if(source.hasOwnProperty(prop)) {
                    target[prop] = mapping(source[prop]);
                }
            }
            return target;
        },

        emptyDomNode: function (domNode) {
            while (domNode.firstChild) {
                ko.cleanAndRemoveNode(domNode.firstChild);
            }
        },

        moveNodesToContainerElement: function(nodes) {
            // Ensure it's a real array, as we're about to reparent the nodes and
            // we don't want the underlying collection to change while we're doing that.
            var nodesArray = utils.makeArray(nodes);

            var container = document.createElement('div');
            for (var i = 0, j = nodesArray.length; i < j; i++)
                container.appendChild(nodesArray[i]);
            return container;
        },

        setDomNodeChildren: function (domNode, childNodes) {
            utils.emptyDomNode(domNode);
            if (childNodes) {
                for (var i = 0, j = childNodes.length; i < j; i++)
                    domNode.appendChild(childNodes[i]);
            }
        },

        replaceDomNodes: function (nodeToReplaceOrNodeArray, newNodesArray) {
            var nodesToReplaceArray = nodeToReplaceOrNodeArray.nodeType ? [nodeToReplaceOrNodeArray] : nodeToReplaceOrNodeArray;
            if (nodesToReplaceArray.length > 0) {
                var insertionPoint = nodesToReplaceArray[0];
                var parent = insertionPoint.parentNode;
                for (var i = 0, j = newNodesArray.length; i < j; i++)
                    parent.insertBefore(newNodesArray[i], insertionPoint);
                for (var i = 0, j = nodesToReplaceArray.length; i < j; i++) {
                    ko.cleanAndRemoveNode(nodesToReplaceArray[i]);
                }
            }
        },

        setOptionNodeSelectionState: function (optionNode, isSelected) {
            // IE6 sometimes throws "unknown error" if you try to write to .selected directly, whereas Firefox struggles with setAttribute. Pick one based on browser.
            if (navigator.userAgent.indexOf("MSIE 6") >= 0)
                optionNode.setAttribute("selected", isSelected);
            else
                optionNode.selected = isSelected;
        },
        
        stringTrim: function (string) {
            return (string || "").replace(stringTrimRegex, "");
        },

        stringTokenize: function (string, delimiter) {
            var result = [];
            var tokens = (string || "").split(delimiter);
            for (var i = 0, j = tokens.length; i < j; i++) {
                var trimmed = utils.stringTrim(tokens[i]);
                if (trimmed !== "")
                    result.push(trimmed);
            }
            return result;
        },
        
        stringStartsWith: function (string, startsWith) {        	
            string = string || "";
            if (startsWith.length > string.length)
                return false;
            return string.substring(0, startsWith.length) === startsWith;
        },

        buildEvalWithinScopeFunction: function (expression, scopeLevels) {
            // Build the source for a function that evaluates "expression"
            // For each scope variable, add an extra level of "with" nesting
            // Example result: with(sc[1]) { with(sc[0]) { return (expression) } }
            var functionBody = "return (" + expression + ")";
            for (var i = 0; i < scopeLevels; i++) {
                functionBody = "with(sc[" + i + "]) { " + functionBody + " } ";
            }
            return new Function("sc", functionBody);
        },

        domNodeIsContainedBy: function (node, containedByNode) {
            if (containedByNode.compareDocumentPosition)
                return (containedByNode.compareDocumentPosition(node) & 16) == 16;
            while (node != null) {
                if (node == containedByNode)
                    return true;
                node = node.parentNode;
            }
            return false;
        },

        domNodeIsAttachedToDocument: function (node) {
            return utils.domNodeIsContainedBy(node, document);
        },

        registerEventHandler: function (element, eventType, handler) {
            if (typeof jQuery != "undefined") {
                if (isClickOnCheckableElement(element, eventType)) {
                    // For click events on checkboxes, jQuery interferes with the event handling in an awkward way:
                    // it toggles the element checked state *after* the click event handlers run, whereas native
                    // click events toggle the checked state *before* the event handler. 
                    // Fix this by intecepting the handler and applying the correct checkedness before it runs.            	
                    var originalHandler = handler;
                    handler = function(event, eventData) {
                        var jQuerySuppliedCheckedState = this.checked;
                        if (eventData)
                            this.checked = eventData.checkedStateBeforeEvent !== true;
                        originalHandler.call(this, event);
                        this.checked = jQuerySuppliedCheckedState; // Restore the state jQuery applied
                    };                	
                }
                jQuery(element)['bind'](eventType, handler);
            } else if (typeof element.addEventListener == "function")
                element.addEventListener(eventType, handler, false);
            else if (typeof element.attachEvent != "undefined")
                element.attachEvent("on" + eventType, function (event) {
                    handler.call(element, event);
                });
            else
                ko_throw("Browser doesn't support addEventListener or attachEvent");
        },

        triggerEvent: function (element, eventType) {
            if (!(element && element.nodeType))
                ko_throw("element must be a DOM node when calling triggerEvent");

            if (typeof jQuery != "undefined") {
                var eventData = [];
                if (isClickOnCheckableElement(element, eventType)) {
                    // Work around the jQuery "click events on checkboxes" issue described above by storing the original checked state before triggering the handler
                    eventData.push({ checkedStateBeforeEvent: element.checked });
                }
                jQuery(element)['trigger'](eventType, eventData);
            } else if (typeof document.createEvent == "function") {
                if (typeof element.dispatchEvent == "function") {
                    var eventCategory = knownEventTypesByEventName[eventType] || "HTMLEvents";
                    var event = document.createEvent(eventCategory);
                    event.initEvent(eventType, true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, element);
                    element.dispatchEvent(event);
                }
                else
                    ko_throw("The supplied element doesn't support dispatchEvent");
            } else if (typeof element.fireEvent != "undefined") {
                // Unlike other browsers, IE doesn't change the checked state of checkboxes/radiobuttons when you trigger their "click" event
                // so to make it consistent, we'll do it manually here
                if (eventType == "click") {
                    if ((element.tagName == "INPUT") && ((element.type.toLowerCase() == "checkbox") || (element.type.toLowerCase() == "radio")))
                        element.checked = element.checked !== true;
                }
                element.fireEvent("on" + eventType);
            }
            else
                ko_throw("Browser doesn't support triggering events");
        },

        unwrapObservable: function (value) {
            return ko.isObservable(value) ? value() : value;
        },

        possiblyWrap: function(readFunction, nodeOrNodes) {
            return ko.dependentObservable(readFunction, null,
                { returnValueIfNoDependencies: true, disposalNodes: nodeOrNodes });
        },

        toggleDomNodeCssClass: function (node, className, shouldHaveClass) {
            var currentClassNames = (node.className || "").split(/\s+/);
            var hasClass = utils.arrayIndexOf(currentClassNames, className) >= 0;

            if (shouldHaveClass && !hasClass) {
                node.className += (currentClassNames[0] ? " " : "") + className;
            } else if (hasClass && !shouldHaveClass) {
                var newClassName = "";
                for (var i = 0; i < currentClassNames.length; i++)
                    if (currentClassNames[i] != className)
                        newClassName += currentClassNames[i] + " ";
                node.className = utils.stringTrim(newClassName);
            }
        },

        ensureSelectElementIsRenderedCorrectly: function(selectElement) {
            // Workaround for IE9 rendering bug - it doesn't reliably display all the text in dynamically-added select boxes unless you force it to re-render by updating the width.
            // (See https://github.com/SteveSanderson/knockout/issues/312, http://stackoverflow.com/questions/5908494/select-only-shows-first-char-of-selected-option)
            if (ieVersion >= 9) {
                var originalWidth = selectElement.style.width;
                selectElement.style.width = 0;
                selectElement.style.width = originalWidth;
            }
        },

        range: function (min, max) {
            min = utils.unwrapObservable(min);
            max = utils.unwrapObservable(max);
            var result = [];
            for (var i = min; i <= max; i++)
                result.push(i);
            return result;
        },
        
        makeArray: function(arrayLikeObject) {
            var result = [];
            for (var i = 0, j = arrayLikeObject.length; i < j; i++) {
                result.push(arrayLikeObject[i]);
            };
            return result;
        },
        
        isIe6 : isIe6,
        isIe7 : isIe7,
        ieVersion : ieVersion,

        getFormFields: function(form, fieldName) {
            var fields = utils.makeArray(form.getElementsByTagName("INPUT")).concat(utils.makeArray(form.getElementsByTagName("TEXTAREA")));
            var isMatchingField = (typeof fieldName == 'string') 
                ? function(field) { return field.name === fieldName }
                : function(field) { return fieldName.test(field.name) }; // Treat fieldName as regex or object containing predicate
            var matches = [];
            for (var i = fields.length - 1; i >= 0; i--) {
                if (isMatchingField(fields[i]))
                    matches.push(fields[i]);
            };
            return matches;
        },
        
        parseJson: function (jsonString) {
            if (typeof jsonString == "string") {
                jsonString = utils.stringTrim(jsonString);
                if (jsonString) {
                    if (window.JSON && window.JSON.parse) // Use native parsing where available
                        return window.JSON.parse(jsonString);
                    return (new Function("return " + jsonString))(); // Fallback on less safe parsing for older browsers
                }
            }	
            return null;
        },

        stringifyJson: function (data, replacer, space) {   // replacer and space are optional 
            if ((typeof JSON == "undefined") || (typeof JSON.stringify == "undefined"))
                ko_throw("Cannot find JSON.stringify(). Some browsers (e.g., IE < 8) don't support it natively, but you can overcome this by adding a script reference to json2.js, downloadable from http://www.json.org/json2.js");
            return JSON.stringify(utils.unwrapObservable(data), replacer, space);
        },

        postJson: function (urlOrForm, data, options) {
            options = options || {};
            var params = options['params'] || {};
            var includeFields = options['includeFields'] || this.fieldsIncludedWithJsonPost;
            var url = urlOrForm;
            
            // If we were given a form, use its 'action' URL and pick out any requested field values 	
            if((typeof urlOrForm == 'object') && (urlOrForm.tagName == "FORM")) {
                var originalForm = urlOrForm;
                url = originalForm.action;
                for (var i = includeFields.length - 1; i >= 0; i--) {
                    var fields = utils.getFormFields(originalForm, includeFields[i]);
                    for (var j = fields.length - 1; j >= 0; j--)        				
                        params[fields[j].name] = fields[j].value;
                }
            }        	
            
            data = utils.unwrapObservable(data);
            var form = document.createElement("FORM");
            form.style.display = "none";
            form.action = url;
            form.method = "post";
            for (var key in data) {
                var input = document.createElement("INPUT");
                input.name = key;
                input.value = utils.stringifyJson(utils.unwrapObservable(data[key]));
                form.appendChild(input);
            }
            for (var key in params) {
                var input = document.createElement("INPUT");
                input.name = key;
                input.value = params[key];
                form.appendChild(input);
            }            
            document.body.appendChild(form);
            options['submitter'] ? options['submitter'](form) : form.submit();
            setTimeout(function () { form.parentNode.removeChild(form); });
        }
    };

    return ko.exportProperties(utils,
        'arrayForEach', utils.arrayForEach,
        'arrayFirst', utils.arrayFirst,
        'arrayFilter', utils.arrayFilter,
        'arrayGetDistinctValues', utils.arrayGetDistinctValues,
        'arrayIndexOf', utils.arrayIndexOf,
        'arrayMap', utils.arrayMap,
        'arrayPushAll', utils.arrayPushAll,
        'arrayRemoveItem', utils.arrayRemoveItem,
        'extend', utils.extendInternal,
        'fieldsIncludedWithJsonPost', utils.fieldsIncludedWithJsonPost,
        'getFormFields', utils.getFormFields,
        'postJson', utils.postJson,
        'parseJson', utils.parseJson,
        'registerEventHandler', utils.registerEventHandler,
        'stringifyJson', utils.stringifyJson,
        'range', utils.range,
        'toggleDomNodeCssClass', utils.toggleDomNodeCssClass,
        'triggerEvent', utils.triggerEvent,
        'unwrapObservable', utils.unwrapObservable
    );
})();

ko.exportSymbol('utils', ko.utils);

if (!Function.prototype['bind']) {
    // Function.prototype.bind is a standard part of ECMAScript 5th Edition (December 2009, http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-262.pdf)
    // In case the browser doesn't implement it natively, provide a JavaScript implementation. This implementation is based on the one in prototype.js
    Function.prototype['bind'] = function (object) {
        var originalFunction = this, args = Array.prototype.slice.call(arguments), object = args.shift();
        return function () {
            return originalFunction.apply(object, args.concat(Array.prototype.slice.call(arguments)));
        }; 
    };
}

ko.utils.domData = new (function () {
    var uniqueId = 0;
    var dataStoreKeyExpandoPropertyName = "__ko__" + (new Date).getTime();
    var dataStore = {};

    function getData(node, key) {
        var allDataForNode = getAll(node, false);
        return allDataForNode === undefined ? undefined : allDataForNode[key];
    }

    function setData(node, key, value) {
        if (value === undefined) {
            // Make sure we don't actually create a new domData key if we are actually deleting a value
            if (getAll(node, false) === undefined)
                return;
        }
        var allDataForNode = getAll(node, true);
        allDataForNode[key] = value;
    }

    function getAll(node, createIfNotFound) {
        var dataStoreKey = node[dataStoreKeyExpandoPropertyName];
        var hasExistingDataStore = dataStoreKey && (dataStoreKey !== "null");
        if (!hasExistingDataStore) {
            if (!createIfNotFound)
                return undefined;
            dataStoreKey = node[dataStoreKeyExpandoPropertyName] = "ko" + uniqueId++;
            dataStore[dataStoreKey] = {};
        }
        return dataStore[dataStoreKey];
    }

    function clear(node) {
        var dataStoreKey = node[dataStoreKeyExpandoPropertyName];
        if (dataStoreKey) {
            delete dataStore[dataStoreKey];
            node[dataStoreKeyExpandoPropertyName] = null;
        }
    }
    
    function nextKey() {
        return uniqueId++;
    }

    // add shortcuts
    ko.domDataGet = getData;
    ko.domDataSet = setData;

    return {
        get: getData,
        set: setData,
        clear: clear,
        nextKey: nextKey
    };
})();
ko.exportSymbol('utils.domData', ko.utils.domData);
ko.exportSymbol('utils.domData.clear', ko.utils.domData.clear); // Exporting only so specs can clear up after themselves fully
ko.utils.domNodeDisposal = new (function () {
    var domDataKey = ko.utils.domData.nextKey();
    var cleanableNodeTypes = { 1: true, 8: true, 9: true };       // Element, Comment, Document
    var cleanableNodeTypesWithDescendants = { 1: true, 9: true }; // Element, Document

    function getDisposeCallbacksCollection(node, createIfNotFound) {
        var allDisposeCallbacks = ko.domDataGet(node, domDataKey);
        if ((allDisposeCallbacks === undefined) && createIfNotFound) {
            allDisposeCallbacks = [];
            ko.domDataSet(node, domDataKey, allDisposeCallbacks);
        }
        return allDisposeCallbacks;
    }
    function destroyCallbacksCollection(node) {
        ko.domDataSet(node, domDataKey, undefined);
    }
    
    function cleanSingleNode(node, onlyDispose) {
        // Run all the dispose callbacks
        var callbacks = getDisposeCallbacksCollection(node, false);
        if (callbacks) {
            callbacks = callbacks.slice(0); // Clone, as the array may be modified during iteration (typically, callbacks will remove themselves)
            for (var i = 0; i < callbacks.length; i++)
                callbacks[i](node);
            if (onlyDispose)
                destroyCallbacksCollection(node);
        }
        
        if (!onlyDispose) {
            // Also erase the DOM data
            ko.utils.domData.clear(node);
        
            // Special support for jQuery here because it's so commonly used.
            // Many jQuery plugins (including jquery.tmpl) store data using jQuery's equivalent of domData
            // so notify it to tear down any resources associated with the node & descendants here.
            if ((typeof jQuery == "function") && (typeof jQuery['cleanData'] == "function"))
                jQuery['cleanData']([node]);
        }

        // Also clear any immediate-child comment nodes, as these wouldn't have been found by
        // node.getElementsByTagName("*") in cleanNode() (comment nodes aren't elements)
        if (cleanableNodeTypesWithDescendants[node.nodeType])
            cleanImmediateCommentTypeChildren(node, onlyDispose);
    }

    function cleanImmediateCommentTypeChildren(nodeWithChildren, onlyDispose) {
        var child, nextChild = nodeWithChildren.firstChild;
        while (child = nextChild) {
            nextChild = child.nextSibling;
            if (child.nodeType === 8)
                cleanSingleNode(child, onlyDispose);
        }
    }

    function addDisposeCallback(nodeOrNodes, disposeCallback, disposeWhen) {
        var nodes = [];
        function addNode(node) {
            if (node.nodeType !== 3) {
                nodes.push(node);
                getDisposeCallbacksCollection(node, true).push(cleanNodeCallback);
            }
        }
        function nodeIsDisposed(node) {
            ko.utils.arrayRemoveItem(nodes, node);
            if (!nodes.length)
                disposeCallback();
        }
        function cleanNodeCallback(node, deleteNodeIfMatchingDispose) {
            if (!deleteNodeIfMatchingDispose)
                nodeIsDisposed(node);
            else if (deleteNodeIfMatchingDispose == disposeCallback)
                deleteNode(node);
        }
        function addNodeOrNodes(nodeOrNodes) {
            nodeOrNodes.nodeType
                ? addNode(nodeOrNodes)
                : ko.utils.arrayForEach(nodeOrNodes, addNode);
        }
        function deleteNode(node) {
            var callbacksCollection = getDisposeCallbacksCollection(node, false);
            if (callbacksCollection) {
                ko.utils.arrayRemoveItem(callbacksCollection, cleanNodeCallback);
                if (!callbacksCollection.length)
                    destroyCallbacksCollection(node);
            }
            ko.utils.arrayRemoveItem(nodes, node);
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
        function getNodes() {
            return nodes;
        }
        function getNodesCount() {
            return nodes.length;
        }

        if (typeof disposeCallback != "function")
            ko_throw("Callback must be a function");
        if (nodeOrNodes)
            addNodeOrNodes(nodeOrNodes);

        return {
            addNodeOrNodes: addNodeOrNodes,
            deleteNode: deleteNode,
            deleteAll: deleteAll,
            dispose: dispose,
            shouldDispose: shouldDispose,
            getNodes: getNodes,
            getNodesCount: getNodesCount
        };
    }

    function removeDisposeCallback(node, disposeCallback) {
        var callbacksCollection = getDisposeCallbacksCollection(node, false);
        if (callbacksCollection)
            ko.utils.arrayForEach(callbacksCollection, function(cleanNodeCallback) {
                cleanNodeCallback(node, disposeCallback);
            });
    }

    function cleanOrDisposeNode(node, onlyDispose) {
        // First clean this node, where applicable
        if (cleanableNodeTypes[node.nodeType]) {
            cleanSingleNode(node, onlyDispose);
            
            // ... then its descendants, where applicable
            if (cleanableNodeTypesWithDescendants[node.nodeType]) {
                // Clone the descendants list in case it changes during iteration
                var descendants = [];
                ko.utils.arrayPushAll(descendants, node.getElementsByTagName("*"));
                for (var i = 0, j = descendants.length; i < j; i++)
                    cleanSingleNode(descendants[i], onlyDispose);
            }
        }
    }
    
    function disposeNode(node) {
        cleanOrDisposeNode(node, true);
    }

    function cleanAndRemoveNode(node) {
        cleanOrDisposeNode(node);
        if (node.parentNode)
            node.parentNode.removeChild(node);
    }

    ko.cleanNode = cleanOrDisposeNode;
    ko.cleanAndRemoveNode = cleanAndRemoveNode;
    ko.disposeNode = disposeNode;

    var domNodeDisposal = {
        addDisposeCallback : addDisposeCallback,
        removeDisposeCallback : removeDisposeCallback
    };

    return ko.exportProperties(domNodeDisposal, 
        'addDisposeCallback', domNodeDisposal.addDisposeCallback,
        'removeDisposeCallback', domNodeDisposal.removeDisposeCallback
    );
})();
ko.exportSymbol('cleanNode', ko.cleanNode);
ko.exportSymbol('cleanAndRemoveNode', ko.cleanAndRemoveNode);
ko.exportSymbol('removeNode', ko.cleanAndRemoveNode);       // exported for compatibility
ko.exportSymbol('utils.domNodeDisposal', ko.utils.domNodeDisposal);
(function () {
    var leadingCommentRegex = /^(\s*)<!--(.*?)-->/;

    function simpleHtmlParse(html) {
        // Based on jQuery's "clean" function, but only accounting for table-related elements.
        // If you have referenced jQuery, this won't be used anyway - KO will use jQuery's "clean" function directly

        // Note that there's still an issue in IE < 9 whereby it will discard comment nodes that are the first child of
        // a descendant node. For example: "<div><!-- mycomment -->abc</div>" will get parsed as "<div>abc</div>"
        // This won't affect anyone who has referenced jQuery, and there's always the workaround of inserting a dummy node
        // (possibly a text node) in front of the comment. So, KO does not attempt to workaround this IE issue automatically at present.
        
        // Trim whitespace, otherwise indexOf won't work as expected
        var tags = ko.utils.stringTrim(html).toLowerCase(), div = document.createElement("div");

        // Finds the first match from the left column, and returns the corresponding "wrap" data from the right column
        var wrap = tags.match(/^<(thead|tbody|tfoot)/)              && [1, "<table>", "</table>"] ||
                   !tags.indexOf("<tr")                             && [2, "<table><tbody>", "</tbody></table>"] ||
                   (!tags.indexOf("<td") || !tags.indexOf("<th"))   && [3, "<table><tbody><tr>", "</tr></tbody></table>"] ||
                   /* anything else */                                 [0, "", ""];

        // Go to html and back, then peel off extra wrappers
        // Note that we always prefix with some dummy text, because otherwise, IE<9 will strip out leading comment nodes in descendants. Total madness.
        var markup = "ignored<div>" + wrap[1] + html + wrap[2] + "</div>";
        if (typeof window['innerShiv'] == "function") {
            div.appendChild(window['innerShiv'](markup));
        } else {
            div.innerHTML = markup;
        }

        // Move to the right depth
        while (wrap[0]--)
            div = div.lastChild;

        return ko.utils.makeArray(div.lastChild.childNodes);
    }

    function jQueryHtmlParse(html) {
        var elems = jQuery['clean']([html]);

        // As of jQuery 1.7.1, jQuery parses the HTML by appending it to some dummy parent nodes held in an in-memory document fragment.
        // Unfortunately, it never clears the dummy parent nodes from the document fragment, so it leaks memory over time.
        // Fix this by finding the top-most dummy parent element, and detaching it from its owner fragment.
        if (elems && elems[0]) {
            // Find the top-most parent element that's a direct child of a document fragment
            var elem = elems[0];
            while (elem.parentNode && elem.parentNode.nodeType !== 11 /* i.e., DocumentFragment */)
                elem = elem.parentNode;
            // ... then detach it
            if (elem.parentNode)
                elem.parentNode.removeChild(elem);
        }
        
        return elems;
    }
    
    ko.utils.parseHtmlFragment = function(html) {
        return typeof jQuery != 'undefined' ? jQueryHtmlParse(html)   // As below, benefit from jQuery's optimisations where possible
                                            : simpleHtmlParse(html);  // ... otherwise, this simple logic will do in most common cases.
    };
    
    ko.utils.setHtml = function(node, html) {
        ko.utils.emptyDomNode(node);
        
        if ((html !== null) && (html !== undefined)) {
            if (typeof html != 'string')
                html = html.toString();
            
            // jQuery contains a lot of sophisticated code to parse arbitrary HTML fragments,
            // for example <tr> elements which are not normally allowed to exist on their own.
            // If you've referenced jQuery we'll use that rather than duplicating its code.
            if (typeof jQuery != 'undefined') {
                jQuery(node)['html'](html);
            } else {
                // ... otherwise, use KO's own parsing logic.
                var parsedNodes = ko.utils.parseHtmlFragment(html);
                for (var i = 0; i < parsedNodes.length; i++)
                    node.appendChild(parsedNodes[i]);
            }            
        }    	
    };
})();

ko.exportSymbol('utils.parseHtmlFragment', ko.utils.parseHtmlFragment);
ko.exportSymbol('utils.setHtml', ko.utils.setHtml);

ko.memoization = (function () {
    var memos = {};

    function randomMax8HexChars() {
        return (((1 + Math.random()) * 0x100000000) | 0).toString(16).substring(1);
    }
    function generateRandomId() {
        return randomMax8HexChars() + randomMax8HexChars();
    }
    function findMemoNodes(rootNode, appendToArray) {
        if (!rootNode)
            return;
        if (rootNode.nodeType == 8) {
            var memoId = ko.memoization.parseMemoText(rootNode.nodeValue);
            if (memoId != null)
                appendToArray.push({ domNode: rootNode, memoId: memoId });
        } else if (rootNode.nodeType == 1) {
            for (var i = 0, childNodes = rootNode.childNodes, j = childNodes.length; i < j; i++)
                findMemoNodes(childNodes[i], appendToArray);
        }
    }

    var memoization = {
        memoize: function (callback) {
            if (typeof callback != "function")
                ko_throw("You can only pass a function to ko.memoization.memoize()");
            var memoId = generateRandomId();
            memos[memoId] = callback;
            return "<!--[ko_memo:" + memoId + "]-->";
        },

        unmemoize: function (memoId, callbackParams) {
            var callback = memos[memoId];
            if (callback === undefined)
                ko_throw("Couldn't find any memo with ID " + memoId + ". Perhaps it's already been unmemoized.");
            try {
                callback.apply(null, callbackParams || []);
                return true;
            }
            finally { delete memos[memoId]; }
        },

        unmemoizeDomNodeAndDescendants: function (domNode, extraCallbackParamsArray) {
            var memos = [];
            findMemoNodes(domNode, memos);
            for (var i = 0, j = memos.length; i < j; i++) {
                var node = memos[i].domNode;
                var combinedParams = [node];
                if (extraCallbackParamsArray)
                    ko.utils.arrayPushAll(combinedParams, extraCallbackParamsArray);
                memoization.unmemoize(memos[i].memoId, combinedParams);
                node.nodeValue = ""; // Neuter this node so we don't try to unmemoize it again
                if (node.parentNode)
                    node.parentNode.removeChild(node); // If possible, erase it totally (not always possible - someone else might just hold a reference to it then call unmemoizeDomNodeAndDescendants again)
            }
        },

        parseMemoText: function (memoText) {
            var match = memoText.match(/^\[ko_memo\:(.*?)\]$/);
            return match ? match[1] : null;
        }
    };

    return ko.exportProperties(memoization,
        'memoize', memoization.memoize,
        'unmemoize', memoization.unmemoize,
        'parseMemoText', memoization.parseMemoText,
        'unmemoizeDomNodeAndDescendants', memoization.unmemoizeDomNodeAndDescendants
    );
})();

ko.exportSymbol('memoization', ko.memoization);
ko.extenders = {
    'throttle': function(target, timeout) {
        // Throttling means two things:
    
        if (ko.isWriteableObservable(target)) {
            // (1) For writable targets (observables, or writable dependent observables), we throttle *writes*
            //     so the target cannot change value synchronously or faster than a certain rate
            var writeTimeoutInstance = null;
            return ko.dependentObservable({
                'read': target,
                'write': function(value) {
                    clearTimeout(writeTimeoutInstance);
                    writeTimeoutInstance = setTimeout(function() {
                        target(value);
                    }, timeout);
                }
            });
        } else {
            // (2) For dependent observables, we throttle *evaluations* so that, no matter how fast its dependencies
            //     notify updates, the target doesn't re-evaluate (and hence doesn't notify) faster than a certain rate
            target['throttleEvaluation'] = timeout;
        }
        return target;
    },

    'notify': function(target, notifyWhen) {
        target["equalityComparer"] = notifyWhen == "always" 
            ? function() { return false } // Treat all values as not equal
            : ko.observable["fn"]["equalityComparer"];
        return target;
    }
};

function applyExtenders(requestedExtenders) {
    var target = this;
    if (requestedExtenders) {
        for (var key in requestedExtenders) {
            var extenderHandler = ko.extenders[key];
            if (typeof extenderHandler == 'function') {
                target = extenderHandler(target, requestedExtenders[key]);
            }
        }
    }
    return target;
}

ko.exportSymbol('extenders', ko.extenders);

ko.subscription = function (target, callback, disposeCallback) {
    this.target = target;
    this.callback = callback;
    this.disposeCallback = disposeCallback;
    ko.exportProperty(this, 'dispose', this.dispose);
};
ko.subscription.prototype.dispose = function () {
    this.isDisposed = true;
    this.disposeCallback();
};

ko.subscribable = function () {
    this._subscriptions = {};

    ko.utils.extendInternal(this, ko.subscribable['fn']);
    ko.exportProperties(this, 
        'subscribe', this.subscribe,
        'extend', this.extend,
        'getSubscriptionsCount', this.getSubscriptionsCount
    );
}

var defaultEvent = "change";

ko.subscribable['fn'] = {
    subscribe: function (callback, callbackTarget, event) {
        event = event || defaultEvent;
        var self = this, boundCallback = callbackTarget ? callback.bind(callbackTarget) : callback;

        var subscription = new ko.subscription(self, boundCallback, function () {
            ko.utils.arrayRemoveItem(self._subscriptions[event], subscription);
        });

        if (!self._subscriptions[event])
            self._subscriptions[event] = [];
        self._subscriptions[event].push(subscription);
        return subscription;
    },

    "notifySubscribers": function (valueToNotify, event) {
        event = event || defaultEvent;
        if (this._subscriptions[event]) {
            ko.utils.arrayForEach(this._subscriptions[event].slice(0), function (subscription) {
                // In case a subscription was disposed during the arrayForEach cycle, check
                // for isDisposed on each subscription before invoking its callback
                if (subscription && (subscription.isDisposed !== true))
                    subscription.callback(valueToNotify);
            });
        }
    },

    getSubscriptionsCount: function () {
        var total = 0;
        for (var eventName in this._subscriptions) {
            if (this._subscriptions.hasOwnProperty(eventName))
                total += this._subscriptions[eventName].length;
        }
        return total;
    },
    
    extend: applyExtenders
};


ko.isSubscribable = function (instance) {
    return typeof instance.subscribe == "function" && typeof instance["notifySubscribers"] == "function";
};

ko.exportSymbol('subscribable', ko.subscribable);
ko.exportSymbol('isSubscribable', ko.isSubscribable);

ko.dependencyDetection = (function () {
    var _frames = [];

    return {
        begin: function (callback) {
            _frames.push({ callback: callback, distinctDependencies:[] });
        },

        end: function () {
            _frames.pop();
        },

        registerDependency: function (subscribable) {
            if (!ko.isSubscribable(subscribable))
                ko_throw("Only subscribable things can act as dependencies");
            if (_frames.length > 0) {
                var topFrame = _frames[_frames.length - 1];
                if (!topFrame || ko.utils.arrayIndexOf(topFrame.distinctDependencies, subscribable) >= 0)
                    return;
                topFrame.distinctDependencies.push(subscribable);
                topFrame.callback(subscribable);
            }
        },

        ignore: function(callback) {
            try {
                _frames.push(null);
                return callback();
            } finally {
                _frames.pop();
            }
        }
    };
})();

ko.exportSymbol('ignoreDependencies', ko.ignoreDependencies = ko.dependencyDetection.ignore);
var primitiveTypes = { 'undefined':true, 'boolean':true, 'number':true, 'string':true };

ko.observable = function (initialValue) {
    var _latestValue = initialValue;

    function observable() {
        if (arguments.length > 0) {
            // Write            
            
            // Ignore writes if the value hasn't changed
            if ((!observable['equalityComparer']) || !observable['equalityComparer'](_latestValue, arguments[0])) {
                observable.valueWillMutate();
                _latestValue = arguments[0];
                if (DEBUG) observable._latestValue = _latestValue;
                observable.valueHasMutated();
            }
            return this; // Permits chained assignments
        }
        else {
            // Read
            ko.dependencyDetection.registerDependency(observable); // The caller only needs to be notified of changes if they did a "read" operation
            return _latestValue;
        }
    }
    if (DEBUG) observable._latestValue = _latestValue;
    ko.subscribable.call(observable);
    observable.valueHasMutated = function () { observable["notifySubscribers"](_latestValue); }
    observable.valueWillMutate = function () { observable["notifySubscribers"](_latestValue, "beforeChange"); }
    ko.utils.extendInternal(observable, ko.observable['fn']);

    return ko.exportProperties(observable, 
        "valueHasMutated", observable.valueHasMutated,
        "valueWillMutate", observable.valueWillMutate
    );
}

ko.observable['fn'] = {
    "equalityComparer": function valuesArePrimitiveAndEqual(a, b) {
        var oldValueIsPrimitive = (a === null) || (typeof(a) in primitiveTypes);
        return oldValueIsPrimitive ? (a === b) : false;
    }
};

var protoProperty = ko.observable.protoProperty = "__ko_proto__";
ko.observable['fn'][protoProperty] = ko.observable;

ko.hasPrototype = function(instance, prototype) {
    if ((instance === null) || (instance === undefined) || (instance[protoProperty] === undefined)) return false;
    if (instance[protoProperty] === prototype) return true;
    return ko.hasPrototype(instance[protoProperty], prototype); // Walk the prototype chain 
};

ko.isObservable = function (instance) {
    return ko.hasPrototype(instance, ko.observable);
}
ko.isWriteableObservable = function (instance) {
    // Observable
    if ((typeof instance == "function") && instance[protoProperty] === ko.observable)
        return true;
    // Writeable dependent observable
    if ((typeof instance == "function") && (instance[protoProperty] === ko.dependentObservable) && (instance.hasWriteFunction))
        return true;
    // Anything else
    return false;
}


ko.exportSymbol('observable', ko.observable);
ko.exportSymbol('isObservable', ko.isObservable);
ko.exportSymbol('isWriteableObservable', ko.isWriteableObservable);
ko.observableArray = function (initialValues) {
    if (arguments.length == 0) {
        // Zero-parameter constructor initializes to empty array
        initialValues = [];
    }
    if ((initialValues !== null) && (initialValues !== undefined) && !('length' in initialValues))
        ko_throw("The argument passed when initializing an observable array must be an array, or null, or undefined.");
        
    var result = ko.observable(initialValues);
    ko.utils.extendInternal(result, ko.observableArray['fn']);
    return result;
}

ko.observableArray['fn'] = {
    'remove': function (valueOrPredicate) {
        var underlyingArray = this();
        var removedValues = [];
        var predicate = typeof valueOrPredicate == "function" ? valueOrPredicate : function (value) { return value === valueOrPredicate; };
        for (var i = 0; i < underlyingArray.length; i++) {
            var value = underlyingArray[i];
            if (predicate(value)) {
                if (removedValues.length === 0) {
                    this.valueWillMutate();
                }
                removedValues.push(value);
                underlyingArray.splice(i, 1);
                i--;
            }
        }
        if (removedValues.length) {
            this.valueHasMutated();
        }
        return removedValues;
    },

    'removeAll': function (arrayOfValues) {
        // If you passed zero args, we remove everything
        if (arrayOfValues === undefined) {
            var underlyingArray = this();
            var allValues = underlyingArray.slice(0);
            this.valueWillMutate();
            underlyingArray.splice(0, underlyingArray.length);
            this.valueHasMutated();
            return allValues;
        }
        // If you passed an arg, we interpret it as an array of entries to remove
        if (!arrayOfValues)
            return [];
        return this['remove'](function (value) {
            return ko.utils.arrayIndexOf(arrayOfValues, value) >= 0;
        });
    },
    
    'destroy': function (valueOrPredicate) {
        var underlyingArray = this();
        var predicate = typeof valueOrPredicate == "function" ? valueOrPredicate : function (value) { return value === valueOrPredicate; };
        this.valueWillMutate();
        for (var i = underlyingArray.length - 1; i >= 0; i--) {
            var value = underlyingArray[i];
            if (predicate(value))
                underlyingArray[i]["_destroy"] = true;
        }
        this.valueHasMutated();
    },
        
    'destroyAll': function (arrayOfValues) {
        // If you passed zero args, we destroy everything
        if (arrayOfValues === undefined)
            return this['destroy'](function() { return true });
                
        // If you passed an arg, we interpret it as an array of entries to destroy
        if (!arrayOfValues)
            return [];
        return this['destroy'](function (value) {
            return ko.utils.arrayIndexOf(arrayOfValues, value) >= 0;
        });             
    },

    'indexOf': function (item) {
        var underlyingArray = this();
        return ko.utils.arrayIndexOf(underlyingArray, item);
    },
    
    'replace': function(oldItem, newItem) {
        var index = this['indexOf'](oldItem);
        if (index >= 0) {
            this.valueWillMutate();
            this()[index] = newItem;
            this.valueHasMutated();
        }
    }    
}

// Populate ko.observableArray.fn with read/write functions from native arrays
ko.utils.arrayForEach(["pop", "push", "reverse", "shift", "sort", "splice", "unshift"], function (methodName) {
    ko.observableArray['fn'][methodName] = function () { 
        var underlyingArray = this();
        this.valueWillMutate();
        var methodCallResult = underlyingArray[methodName].apply(underlyingArray, arguments);
        this.valueHasMutated();
        return methodCallResult;
    };
});

// Populate ko.observableArray.fn with read-only functions from native arrays
ko.utils.arrayForEach(["slice"], function (methodName) {
    ko.observableArray['fn'][methodName] = function () {
        var underlyingArray = this();
        return underlyingArray[methodName].apply(underlyingArray, arguments);
    };
});

ko.exportSymbol('observableArray', ko.observableArray);
ko.dependentObservable = function (evaluatorFunctionOrOptions, evaluatorFunctionTarget, options) {
    var _latestValue,
        _needsEvaluation = true,
        _isBeingEvaluated = false,
        readFunction = evaluatorFunctionOrOptions;

    if (readFunction && typeof readFunction == "object") {
        // Single-parameter syntax - everything is on this "options" param
        options = readFunction;
        readFunction = options["read"];
    } else {
        // Multi-parameter syntax - construct the options according to the params passed
        options = options || {};
        if (!readFunction)
            readFunction = options["read"];
    }
    // By here, "options" is always non-null
    if (typeof readFunction != "function")
        ko_throw("Pass a function that returns the value of the ko.computed");

    var writeFunction = options["write"];
    if (!evaluatorFunctionTarget)
        evaluatorFunctionTarget = options["owner"];

    var _subscriptionsToDependencies = [];
    function disposeAllSubscriptionsToDependencies() {
        ko.utils.arrayForEach(_subscriptionsToDependencies, function (subscription) {
            subscription.dispose();
        });
        _subscriptionsToDependencies = [];
        _needsEvaluation = false;
    }


    var evaluationTimeoutInstance = null;
    function evaluatePossiblyAsync() {
        _needsEvaluation = true;
        var throttleEvaluationTimeout = dependentObservable['throttleEvaluation'];
        if (throttleEvaluationTimeout && throttleEvaluationTimeout >= 0) {
            clearTimeout(evaluationTimeoutInstance);
            evaluationTimeoutInstance = setTimeout(evaluateImmediate, throttleEvaluationTimeout);
        } else
            evaluateImmediate();
    }

    function addDependency(subscribable) {
        _subscriptionsToDependencies.push(subscribable.subscribe(evaluatePossiblyAsync));
    }

    function evaluateImmediate() {
        if (_isBeingEvaluated || !_needsEvaluation)
            return;

        // disposeWhen won't be set until after initial evaluation
        if (disposeWhen && disposeWhen()) {
            dependentObservable.dispose();
            return;
        }

        _isBeingEvaluated = true;
        try {
            // Initially, we assume that none of the subscriptions are still being used (i.e., all are candidates for disposal). 
            // Then, during evaluation, we cross off any that are in fact still being used.
            var disposalCandidates = ko.utils.arrayMap(_subscriptionsToDependencies, function(item) {return item.target;});

            ko.dependencyDetection.begin(function(subscribable) {
                var inOld;
                if ((inOld = ko.utils.arrayIndexOf(disposalCandidates, subscribable)) >= 0)
                    disposalCandidates[inOld] = undefined; // Don't want to dispose this subscription, as it's still being used
                else
                    addDependency(subscribable); // Brand new subscription - add it
            });

            var newValue = readFunction.call(evaluatorFunctionTarget);

            // For each subscription no longer being used, remove it from the active subscriptions list and dispose it
            for (var i = disposalCandidates.length - 1; i >= 0; i--) {
                if (disposalCandidates[i])
                    _subscriptionsToDependencies.splice(i, 1)[0].dispose();
            }

            dependentObservable["notifySubscribers"](_latestValue, "beforeChange");
            _latestValue = newValue;
            if (DEBUG) dependentObservable._latestValue = _latestValue;
            _needsEvaluation = false;
        } finally {
            ko.dependencyDetection.end();
        }

        dependentObservable["notifySubscribers"](_latestValue);
        _isBeingEvaluated = false;
    }

    function evaluateInitial() {
        _isBeingEvaluated = true;
        try {
            ko.dependencyDetection.begin(addDependency);
            _latestValue = readFunction.call(evaluatorFunctionTarget);
        } finally {
            ko.dependencyDetection.end();
        }
        _needsEvaluation = _isBeingEvaluated = false;
    }

    function dependentObservable() {
        if (arguments.length > 0) {
            set.apply(dependentObservable, arguments);
        } else {
            return get();
        }
    }
    
    function set() {
        if (typeof writeFunction === "function") {
            // Writing a value
            writeFunction.apply(evaluatorFunctionTarget, arguments);
        } else {
            ko_throw("Cannot write a value to a ko.computed unless you specify a 'write' option. If you wish to read the current value, don't pass any parameters.");
        }
    }

    function get() {
        // Reading the value
        if (_needsEvaluation)
            evaluateImmediate();
        ko.dependencyDetection.registerDependency(dependentObservable);
        return _latestValue;
    }

    var disposer, disposalNodes = [];
    function addDisposalNodes(nodeOrNodes) {
        if (nodeOrNodes) {
            if (!disposer)
                disposer = ko.utils.domNodeDisposal.addDisposeCallback(null, disposeAllSubscriptionsToDependencies, disposeWhen);
            disposer.addNodeOrNodes(nodeOrNodes);
            dependentObservable.dispose = disposer.dispose;
            disposeWhen = disposer.shouldDispose;
            disposalNodes = disposer.getNodes();
        }
        return dependentObservable;
    }
    function replaceDisposalNodes(nodeOrNodes) {
        if (disposer)
            disposer.deleteAll();
        return addDisposalNodes(nodeOrNodes);
    }

    // Evaluate, unless deferEvaluation is true, unless returnValueIfNoDependencies is true
    if (options['deferEvaluation'] !== true || options.returnValueIfNoDependencies)
        evaluateInitial();

    // just return the value if returnValueIfNoDependencies is true and there are no dependencies
    if (options.returnValueIfNoDependencies && !_subscriptionsToDependencies.length)
        return _latestValue;

    ko.utils.extendInternal(dependentObservable, {
        hasWriteFunction:       typeof writeFunction === "function",
        getDependenciesCount:   function () { return _subscriptionsToDependencies.length; },
        addDisposalNodes:       addDisposalNodes,
        replaceDisposalNodes:   replaceDisposalNodes,
        getDisposalNodesCount:  function() { return disposalNodes.length; },
        dispose:                disposeAllSubscriptionsToDependencies
    });

    var disposeWhen = options.disposeWhen || options["disposeWhen"];

    // addDisposalNodes might replace the disposeWhen and dependentObservable.dispose functions
    // So it needs to be called after they've been initialized with their default values.
    addDisposalNodes(options.disposalNodes || options["disposeWhenNodeIsRemoved"]);

    ko.subscribable.call(dependentObservable);
    ko.utils.extendInternal(dependentObservable, ko.dependentObservable['fn']);

    return ko.exportProperties(dependentObservable, 
        'dispose', dependentObservable.dispose,
        'getDependenciesCount', dependentObservable.getDependenciesCount,
        'addDisposalNodes', dependentObservable.addDisposalNodes,
        'replaceDisposalNodes', dependentObservable.replaceDisposalNodes,
        'getDisposalNodesCount', dependentObservable.getDisposalNodesCount
    );
};

ko.isComputed = function(instance) {
    return ko.hasPrototype(instance, ko.dependentObservable);
};

var protoProp = ko.observable.protoProperty; // == "__ko_proto__"
ko.dependentObservable[protoProp] = ko.observable;

ko.dependentObservable['fn'] = {};
ko.dependentObservable['fn'][protoProp] = ko.dependentObservable;

ko.exportSymbol('dependentObservable', ko.dependentObservable);
ko.exportSymbol('computed', ko.dependentObservable); // Make "ko.computed" an alias for "ko.dependentObservable"
ko.exportSymbol('isComputed', ko.isComputed);
(function() {    
    var maxNestedObservableDepth = 10; // Escape the (unlikely) pathalogical case where an observable's current value is itself (or similar reference cycle)
    
    ko.toJS = function(rootObject) {
        if (arguments.length == 0)
            ko_throw("When calling ko.toJS, pass the object you want to convert.");
        
        // We just unwrap everything at every level in the object graph
        return mapJsObjectGraph(rootObject, function(valueToMap) {
            // Loop because an observable's value might in turn be another observable wrapper
            for (var i = 0; ko.isObservable(valueToMap) && (i < maxNestedObservableDepth); i++)
                valueToMap = valueToMap();
            return valueToMap;
        });
    };

    ko.toJSON = function(rootObject, replacer, space) {     // replacer and space are optional
        var plainJavaScriptObject = ko.toJS(rootObject);
        return ko.utils.stringifyJson(plainJavaScriptObject, replacer, space);
    };
    
    function mapJsObjectGraph(rootObject, mapInputCallback, visitedObjects) {
        visitedObjects = visitedObjects || new objectLookup();
        
        rootObject = mapInputCallback(rootObject);
        var canHaveProperties = (typeof rootObject == "object") && (rootObject !== null) && (rootObject !== undefined) && (!(rootObject instanceof Date));
        if (!canHaveProperties)
            return rootObject;
            
        var outputProperties = rootObject instanceof Array ? [] : {};
        visitedObjects.save(rootObject, outputProperties);            
        
        visitPropertiesOrArrayEntries(rootObject, function(indexer) {
            var propertyValue = mapInputCallback(rootObject[indexer]);
            
            switch (typeof propertyValue) {
                case "boolean":
                case "number":
                case "string":
                case "function":
                    outputProperties[indexer] = propertyValue;
                    break;
                case "object":
                case "undefined":				
                    var previouslyMappedValue = visitedObjects.get(propertyValue);
                    outputProperties[indexer] = (previouslyMappedValue !== undefined)
                        ? previouslyMappedValue
                        : mapJsObjectGraph(propertyValue, mapInputCallback, visitedObjects);
                    break;							
            }
        });
        
        return outputProperties;
    }
    
    function visitPropertiesOrArrayEntries(rootObject, visitorCallback) {
        if (rootObject instanceof Array) {
            for (var i = 0; i < rootObject.length; i++)
                visitorCallback(i);
            
            // For arrays, also respect toJSON property for custom mappings (fixes #278)
            if (typeof rootObject['toJSON'] == 'function')
                visitorCallback('toJSON');
        } else {
            for (var propertyName in rootObject)
                visitorCallback(propertyName);
        }
    };    
    
    function objectLookup() {
        var keys = [];
        var values = [];
        this.save = function(key, value) {
            var existingIndex = ko.utils.arrayIndexOf(keys, key);
            if (existingIndex >= 0)
                values[existingIndex] = value;
            else {
                keys.push(key);
                values.push(value);	
            }				
        };
        this.get = function(key) {
            var existingIndex = ko.utils.arrayIndexOf(keys, key);
            return (existingIndex >= 0) ? values[existingIndex] : undefined;
        };
    };
})();

ko.exportSymbol('toJS', ko.toJS);
ko.exportSymbol('toJSON', ko.toJSON);ko.selectExtensions = (function () {
    var hasDomDataExpandoProperty = '__ko__hasDomDataOptionValue__';

    // Normally, SELECT elements and their OPTIONs can only take value of type 'string' (because the values
    // are stored on DOM attributes). ko.selectExtensions provides a way for SELECTs/OPTIONs to have values
    // that are arbitrary objects. This is very convenient when implementing things like cascading dropdowns.
    var selectExtensions = {
        readValue : function(element) {
            if (element.tagName == 'OPTION') {
                if (element[hasDomDataExpandoProperty] === true)
                    return ko.domDataGet(element, ko.bindingHandlers.options.optionValueDomDataKey);
                return element.getAttribute("value");
            } else if (element.tagName == 'SELECT')
                return element.selectedIndex >= 0 ? selectExtensions.readValue(element.options[element.selectedIndex]) : undefined;
            else
                return element.value;
        },
        
        writeValue: function(element, value) {
            if (element.tagName == 'OPTION') {
                switch(typeof value) {
                    case "string":
                        ko.domDataSet(element, ko.bindingHandlers.options.optionValueDomDataKey, undefined);
                        if (hasDomDataExpandoProperty in element) { // IE <= 8 throws errors if you delete non-existent properties from a DOM node
                            delete element[hasDomDataExpandoProperty];
                        }
                        element.value = value;                                   
                        break;
                    default:
                        // Store arbitrary object using DomData
                        ko.domDataSet(element, ko.bindingHandlers.options.optionValueDomDataKey, value);
                        element[hasDomDataExpandoProperty] = true;

                        // Special treatment of numbers is just for backward compatibility. KO 1.2.1 wrote numerical values to element.value.
                        element.value = typeof value === "number" ? value : "";
                        break;
                }			
            } else if (element.tagName == 'SELECT') {
                for (var i = element.options.length - 1; i >= 0; i--) {
                    if (selectExtensions.readValue(element.options[i]) == value) {
                        element.selectedIndex = i;
                        break;
                    }
                }
            } else {
                if ((value === null) || (value === undefined))
                    value = "";
                element.value = value;
            }
        }
    };        

    return ko.exportProperties(selectExtensions,
        'readValue', selectExtensions.readValue,
        'writeValue', selectExtensions.writeValue
    );
})();

ko.exportSymbol('selectExtensions', ko.selectExtensions);

ko.bindingExpressionRewriting = (function () {
    var restoreCapturedTokensRegex = /\@ko_token_(\d+)\@/g;
    var javaScriptAssignmentTarget = /^[\_$a-z][\_$a-z0-9]*(\[.*?\])*(\.[\_$a-z][\_$a-z0-9]*(\[.*?\])*)*$/i;
    var javaScriptReservedWords = ["true", "false", "null"];

    function restoreTokens(string, tokens) {
        var prevValue = null;
        while (string != prevValue) { // Keep restoring tokens until it no longer makes a difference (they may be nested)
            prevValue = string;
            string = string.replace(restoreCapturedTokensRegex, function (match, tokenIndex) {
                return tokens[tokenIndex];
            });
        }
        return ko.utils.stringTrim(string);
    }

    function isWriteableValue(expression) {
        if (ko.utils.arrayIndexOf(javaScriptReservedWords, expression) >= 0)
            return false;
        return expression.match(javaScriptAssignmentTarget) !== null;
    }

    function isFunctionLiteral(expression) {
        // match function literal, which must start with function end with }
        return expression.match(/^\(*function\s*\(.*}\)*$/) !== null;
    }

    function isPossiblyUnwrappedObservable(expression) {
        // match parentheses in the expression, but ignore initial parentheses
        return expression.match(/[^(]+\(/) !== null;
    }

    function stripQuotes(key) {
        switch (key.length && key.charAt(0)) {
            case "'":
            case '"':
                return key.substring(1, key.length - 1);
            default:
                return key;
        }

    }

    function ensureQuoted(key) {
        return "'" + key + "'";
    }

    return {
        parseObjectLiteral: function(objectLiteralString) {
            // A full tokeniser+lexer would add too much weight to this library, so here's a simple parser
            // that is sufficient just to split an object literal string into a set of top-level key-value pairs

            var str = ko.utils.stringTrim(objectLiteralString);
            if (str.length < 3)
                return [];
            if (str.charAt(0) === "{")// Ignore any braces surrounding the whole object literal
                str = str.substring(1, str.length - 1);

            // Pull out any string literals and regex literals
            var tokens = [];
            var tokenStart = null, tokenEndChar;
            for (var position = 0; position < str.length; position++) {
                var c = str.charAt(position);
                if (tokenStart === null) {
                    switch (c) {
                        case '"':
                        case "'":
                        case "/":
                            tokenStart = position;
                            tokenEndChar = c;
                            break;
                    }
                } else if ((c == tokenEndChar) && (str.charAt(position - 1) !== "\\")) {
                    var token = str.substring(tokenStart, position + 1);
                    tokens.push(token);
                    var replacement = "@ko_token_" + (tokens.length - 1) + "@";
                    str = str.substring(0, tokenStart) + replacement + str.substring(position + 1);
                    position -= (token.length - replacement.length);
                    tokenStart = null;
                }
            }

            // Next pull out balanced paren, brace, and bracket blocks
            tokenStart = null;
            tokenEndChar = null;
            var tokenDepth = 0, tokenStartChar = null;
            for (var position = 0; position < str.length; position++) {
                var c = str.charAt(position);
                if (tokenStart === null) {
                    switch (c) {
                        case "{": tokenStart = position; tokenStartChar = c;
                                  tokenEndChar = "}";
                                  break;
                        case "(": tokenStart = position; tokenStartChar = c;
                                  tokenEndChar = ")";
                                  break;
                        case "[": tokenStart = position; tokenStartChar = c;
                                  tokenEndChar = "]";
                                  break;
                    }
                }

                if (c === tokenStartChar)
                    tokenDepth++;
                else if (c === tokenEndChar) {
                    tokenDepth--;
                    if (tokenDepth === 0) {
                        var token = str.substring(tokenStart, position + 1);
                        tokens.push(token);
                        var replacement = "@ko_token_" + (tokens.length - 1) + "@";
                        str = str.substring(0, tokenStart) + replacement + str.substring(position + 1);
                        position -= (token.length - replacement.length);
                        tokenStart = null;                            
                    }
                }
            }

            // Now we can safely split on commas to get the key/value pairs
            var result = [];
            var keyValuePairs = str.split(",");
            for (var i = 0, j = keyValuePairs.length; i < j; i++) {
                var pair = keyValuePairs[i];
                var colonPos = pair.indexOf(":");
                if ((colonPos > 0) && (colonPos < pair.length - 1)) {
                    var key = pair.substring(0, colonPos);
                    var value = pair.substring(colonPos + 1);
                    result.push({ 'key': stripQuotes(restoreTokens(key, tokens)), 'value': restoreTokens(value, tokens) });
                } else {
                    result.push({ 'unknown': stripQuotes(restoreTokens(pair, tokens)) });
                }
            }
            return result;            
        },

        insertPropertyAccessors: function (objectLiteralStringOrKeyValueArray, bindingOptions) {
            bindingOptions = bindingOptions || {};
            var resultStrings = [], propertyAccessorResultStrings = [],
                eventHandlersUseObjectForThis = bindingOptions['eventHandlersUseObjectForThis'],
                independentBindings = bindingOptions['independentBindings'];

            function insertPropertyAccessorsHelper(objectLiteralStringOrKeyValueArray, parentBinding, parentBindingKey) {
                var keyValueArray = typeof objectLiteralStringOrKeyValueArray === "string"
                    ? ko.bindingExpressionRewriting.parseObjectLiteral(objectLiteralStringOrKeyValueArray)
                    : objectLiteralStringOrKeyValueArray;
                var keyValueEntry;
                for (var i = 0; keyValueEntry = keyValueArray[i]; i++) {
                    if (keyValueEntry['key']) {
                        var key = keyValueEntry['key'], val = keyValueEntry['value'],
                            quotedKey = ensureQuoted(parentBindingKey ? parentBindingKey+'.'+key : key),
                            binding = parentBinding || ko.getBindingHandler(key),
                            canWrap = binding || independentBindings;
                        if (!parentBinding && binding && (binding['flags'] & bindingFlags_twoLevel) && val.charAt(0) === "{") {
                            // Handle two-level binding specified as "binding: {key: value}" by parsing inner
                            // object and converting to "binding.key: value"
                            insertPropertyAccessorsHelper(val, binding, key);
                        } else {
                            if (!isFunctionLiteral(val)) {
                                if (binding && isWriteableValue(val)) {
                                    if (eventHandlersUseObjectForThis && binding['flags'] & bindingFlags_eventHandler) {
                                        // call function literal in an anonymous function so that it is called
                                        // with appropriate "this" value
                                        val = 'function(_x,_y,_z){(' + val + ')(_x,_y,_z);}';
                                    }
                                    else if (binding['flags'] & bindingFlags_twoWay) {
                                        // for two-way bindings, provide a write method in case the value
                                        // isn't a writable observable
                                        propertyAccessorResultStrings.push(quotedKey + ":function(_z){" + val + "=_z;}");
                                    }
                                }
                                if (canWrap && isPossiblyUnwrappedObservable(val)) {
                                    // Try to prevent observables from being accessed when parsing a binding;
                                    // Instead they will be "unwrapped" within the context of the specific binding handler
                                    val = 'ko.bindingValueWrap(function(){return ' + val + '})';
                                }
                            }
                            resultStrings.push(quotedKey + ":" + val);
                        }
                    } else if (keyValueEntry['unknown']) {
                        // Check if the 'unknown' entry matches a binding handler that can used without a value
                        // and include it with a value of 'true'
                        var key = keyValueEntry['unknown'], binding = ko.bindingHandlers[key];
                        if (binding && (binding['flags'] & bindingFlags_noValue))
                            resultStrings.push(ensureQuoted(key)+ ":true");
                        else
                            resultStrings.push(key);
                    }
                }
            }
            insertPropertyAccessorsHelper(objectLiteralStringOrKeyValueArray);

            var combinedResult = resultStrings.join(",");
            if (propertyAccessorResultStrings.length > 0) {
                var allPropertyAccessors = propertyAccessorResultStrings.join(",");
                combinedResult = combinedResult + ",'_ko_property_writers':{" + allPropertyAccessors + "}";
            }

            return combinedResult;
        },

        keyValueArrayContainsKey: function(keyValueArray, key) {
            for (var i = 0; i < keyValueArray.length; i++)
                if (keyValueArray[i]['key'] == key)
                    return true;
            return false;
        },

        writeValueToProperty: function(allBindingsAccessor, key, value) {
            var propWriters = allBindingsAccessor('_ko_property_writers');
            if (propWriters && propWriters[key])
                propWriters[key](value);
        }
    };
})();
ko.virtualElements = (function() {
    // "Virtual elements" is an abstraction on top of the usual DOM API which understands the notion that comment nodes
    // may be used to represent hierarchy (in addition to the DOM's natural hierarchy). 
    // If you call the DOM-manipulating functions on ko.virtualElements, you will be able to read and write the state 
    // of that virtual hierarchy
    // 
    // The point of all this is to support containerless templates (e.g., <!-- ko foreach:someCollection -->blah<!-- /ko -->)
    // without having to scatter special cases all over the binding and templating code.

    // IE 9 cannot reliably read the "nodeValue" property of a comment node (see https://github.com/SteveSanderson/knockout/issues/186)
    // but it does give them a nonstandard alternative property called "text" that it can read reliably. Other browsers don't have that property.
    // So, use node.text where available, and node.nodeValue elsewhere
    var commentNodesHaveTextProperty = document.createComment("test").text === "<!--test-->";
    var startCommentRegex = function (bindingProvider) {
        return commentNodesHaveTextProperty ? new RegExp("^<!--\\s*" + ko.bindingProvider.configuration(bindingProvider).virtualElementTag + "\\s+(.*\\:.*)\\s*-->$") : new RegExp("^\\s*" + ko.bindingProvider.configuration(bindingProvider).virtualElementTag + "\\s+(.*\\:.*)\\s*$");
    };

    var endCommentRegex = function (bindingProvider) {
        return commentNodesHaveTextProperty ? new RegExp("^<!--\\s*\\/" + ko.bindingProvider.configuration(bindingProvider).virtualElementTag + "\\s*-->$") : new RegExp("^\\s*\\/" + ko.bindingProvider.configuration(bindingProvider).virtualElementTag + "\\s*$");
    };
    var htmlTagsWithOptionallyClosingChildren = { 'ul': true, 'ol': true };


    function isStartComment(node) {
        return (node.nodeType == 8) && (commentNodesHaveTextProperty ? node.text : node.nodeValue).match(startCommentRegex());
    }

    function isEndComment(node) {
        return (node.nodeType == 8) && (commentNodesHaveTextProperty ? node.text : node.nodeValue).match(endCommentRegex());
    }


    function getVirtualChildren(startComment, allowUnbalanced) {
        var currentNode = startComment;
        var depth = 1;
        var children = [];
        while (currentNode = currentNode.nextSibling) {
            if (isEndComment(currentNode)) {
                depth--;
                if (depth === 0)
                    return children;
            }

            children.push(currentNode);

            if (isStartComment(currentNode))
                depth++;
        }
        if (!allowUnbalanced)
            ko_throw("Cannot find closing comment tag to match: " + startComment.nodeValue);
        return null;
    }

    function getMatchingEndComment(startComment, allowUnbalanced) {
        var allVirtualChildren = getVirtualChildren(startComment, allowUnbalanced);
        if (allVirtualChildren) {
            if (allVirtualChildren.length > 0)
                return allVirtualChildren[allVirtualChildren.length - 1].nextSibling;
            return startComment.nextSibling;
        } else
            return null; // Must have no matching end comment, and allowUnbalanced is true
    }

    function getUnbalancedChildTags(node) {
        // e.g., from <div>OK</div><!-- ko blah --><span>Another</span>, returns: <!-- ko blah --><span>Another</span>
        //       from <div>OK</div><!-- /ko --><!-- /ko -->,             returns: <!-- /ko --><!-- /ko -->
        var childNode = node.firstChild, captureRemaining = null;
        if (childNode) {
            do {
                if (captureRemaining)                   // We already hit an unbalanced node and are now just scooping up all subsequent nodes
                    captureRemaining.push(childNode);
                else if (isStartComment(childNode)) {
                    var matchingEndComment = getMatchingEndComment(childNode, /* allowUnbalanced: */ true);
                    if (matchingEndComment)             // It's a balanced tag, so skip immediately to the end of this virtual set
                        childNode = matchingEndComment;
                    else
                        captureRemaining = [childNode]; // It's unbalanced, so start capturing from this point
                } else if (isEndComment(childNode)) {
                    captureRemaining = [childNode];     // It's unbalanced (if it wasn't, we'd have skipped over it already), so start capturing
                }
            } while (childNode = childNode.nextSibling);
        }
        return captureRemaining;
    }

    var virtualElements = {
        allowedBindings: {},

        childNodes: function(node) {
            return isStartComment(node) ? getVirtualChildren(node) : node.childNodes;
        },

        emptyNode: function(node) {
            if (!isStartComment(node))
                ko.utils.emptyDomNode(node);
            else {
                var virtualChildren = virtualElements.childNodes(node);
                for (var i = 0, j = virtualChildren.length; i < j; i++)
                    ko.cleanAndRemoveNode(virtualChildren[i]);
            }
        },

        setDomNodeChildren: function(node, childNodes) {
            if (!isStartComment(node))
                ko.utils.setDomNodeChildren(node, childNodes);
            else {
                virtualElements.emptyNode(node);
                var endCommentNode = node.nextSibling; // Must be the next sibling, as we just emptied the children
                for (var i = 0, j = childNodes.length; i < j; i++)
                    endCommentNode.parentNode.insertBefore(childNodes[i], endCommentNode);
            }
        },

        prepend: function(containerNode, nodeToPrepend) {
            if (!isStartComment(containerNode)) {
                if (containerNode.firstChild)
                    containerNode.insertBefore(nodeToPrepend, containerNode.firstChild);
                else
                    containerNode.appendChild(nodeToPrepend);                           
            } else {
                // Start comments must always have a parent and at least one following sibling (the end comment)
                containerNode.parentNode.insertBefore(nodeToPrepend, containerNode.nextSibling);
            }
        },

        insertAfter: function(containerNode, nodeToInsert, insertAfterNode) {
            if (!isStartComment(containerNode)) {
                // Insert after insertion point
                if (insertAfterNode.nextSibling)
                    containerNode.insertBefore(nodeToInsert, insertAfterNode.nextSibling);
                else
                    containerNode.appendChild(nodeToInsert);    
            } else {
                // Children of start comments must always have a parent and at least one following sibling (the end comment)
                containerNode.parentNode.insertBefore(nodeToInsert, insertAfterNode.nextSibling);
            }                           
        },

        firstChild: function(node) {
            if (!isStartComment(node))
                return node.firstChild;
            if (!node.nextSibling || isEndComment(node.nextSibling))
                return null;
            return node.nextSibling;
        },

        nextSibling: function(node) {
            if (isStartComment(node))
                node = getMatchingEndComment(node);
            if (node.nextSibling && isEndComment(node.nextSibling))
                return null;
            return node.nextSibling;
        },

        virtualNodeBindingValue: function(node) {
            var regexMatch = isStartComment(node);
            return regexMatch ? regexMatch[1] : null;               
        },

        normaliseVirtualElementDomStructure: function(elementVerified) {
            // Workaround for https://github.com/SteveSanderson/knockout/issues/155 
            // (IE <= 8 or IE 9 quirks mode parses your HTML weirdly, treating closing </li> tags as if they don't exist, thereby moving comment nodes
            // that are direct descendants of <ul> into the preceding <li>)
            if (!htmlTagsWithOptionallyClosingChildren[elementVerified.tagName.toLowerCase()])
                return;
            
            // Scan immediate children to see if they contain unbalanced comment tags. If they do, those comment tags
            // must be intended to appear *after* that child, so move them there.
            var childNode = elementVerified.firstChild;
            if (childNode) {
                do {
                    if (childNode.nodeType === 1) {
                        var unbalancedTags = getUnbalancedChildTags(childNode);
                        if (unbalancedTags) {
                            // Fix up the DOM by moving the unbalanced tags to where they most likely were intended to be placed - *after* the child
                            var nodeToInsertBefore = childNode.nextSibling;
                            for (var i = 0; i < unbalancedTags.length; i++) {
                                if (nodeToInsertBefore)
                                    elementVerified.insertBefore(unbalancedTags[i], nodeToInsertBefore);
                                else
                                    elementVerified.appendChild(unbalancedTags[i]);
                            }
                        }
                    }
                } while (childNode = childNode.nextSibling);
            }
        }  
    };

    return ko.exportProperties(virtualElements, 
        'allowedBindings', virtualElements.allowedBindings,
        'emptyNode', virtualElements.emptyNode,
        //'firstChild', virtualElements.firstChild,     // firstChild is not minified
        'insertAfter', virtualElements.insertAfter,
        //'nextSibling', virtualElements.nextSibling,   // nextSibling is not minified
        'prepend', virtualElements.prepend,
        'setDomNodeChildren', virtualElements.setDomNodeChildren
    );
})();

ko.exportSymbol('virtualElements', ko.virtualElements);
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
                ko_throw("Unable to parse bindings.\nMessage: " + ex + ";\nBindings value: " + bindingsString);
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
/** @const */ var bindingFlags_twoWay=01;
/** @const */ var bindingFlags_eventHandler=02;
/** @const */ var bindingFlags_twoLevel=04;
/** @const */ var bindingFlags_contentSet=010;
/** @const */ var bindingFlags_contentBind=020;
/** @const */ var bindingFlags_contentUpdate=040;
/** @const */ var bindingFlags_canUseVirtual=0100;
/** @const */ var bindingFlags_noValue=0200;

// Internal flag for bindings used by the binding system itself
/** @const */ var bindingFlags_builtIn=01000;

(function () {
    ko.bindingFlags = {
        'twoWay': bindingFlags_twoWay,
            // Two-way bindings initialliy write to the DOM from the model,
            // but also will update the model property if the DOM changes
        'eventHandler': bindingFlags_eventHandler,
            // Event handler bindings call the given function in response to an event
        'contentBind': bindingFlags_contentBind,
            // Content-bind bindings are responsible for binding (or not) their contents
        'contentSet': bindingFlags_contentSet,
            // Content-set bindings erase or set their contents
        'contentUpdate': bindingFlags_contentUpdate,
            // Content-update bindings modify their contents after the content nodes bindings have run
        'noValue': bindingFlags_noValue,
            // No-value bindings don't require a value (default value is true)
        'twoLevel': bindingFlags_twoLevel,
            // Two-level bindings are like {attr.href: value} or {attr: {href: value}}
        'canUseVirtual': bindingFlags_canUseVirtual
            // Virtual element bindings can be used in comments: <!-- ko if: value --><!-- /ko -->
    };

    ko.checkBindingFlags = function(binding, flagsSet, flagsUnset) {
        return (!flagsSet || (binding['flags'] & flagsSet)) && !(binding['flags'] & flagsUnset);
    };

    ko.bindingHandlers = {};

    // Accepts either a data value or a value accessor function; note that an observable qualifies as a value accessor function
    ko.bindingContext = function(dataItemOrValueAccessor, parent, options) {
        var self = this, isFunc = typeof(dataItemOrValueAccessor) == "function";
        self._subscribable = ko.utils.possiblyWrap(parent ?
            function() {
                var oldSubscribable = self._subscribable;   // save previous subscribable value
                // copy $root, $options, and any custom properties from parent binding context
                ko.utils.extendInternal(self, parent);
                self._subscribable = oldSubscribable;       // restore subscribable value
                if (parent._subscribable)
                    ko.dependencyDetection.registerDependency(parent._subscribable);
                // set our properties
                ko.utils.extendInternal(self['$options'], options);
                self['$parentContext'] = parent;
                self['$parents'] = parent['$parents'].slice(0);
                self['$parents'].unshift(self['$parent'] = parent['$data']);
                self['$data'] = isFunc ? dataItemOrValueAccessor() : dataItemOrValueAccessor;
            } :
            function() {
                self['$options'] = options || {};
                self['$parents'] = [];
                self['$root'] = self['$data'] = isFunc ? dataItemOrValueAccessor() : dataItemOrValueAccessor;
            }
        );
    }
    ko.bindingContext.prototype['createChildContext'] = function (dataItemOrValueAccessor) {
        return new ko.bindingContext(dataItemOrValueAccessor, this);
    };
    ko.bindingContext.prototype['extend'] = function(properties) {
        var clone = new ko.bindingContext(this['$data'], this);
        return ko.utils.extendInternal(clone, properties);
    };

    function getTwoLevelBindingData(bindingKey) {
        var dotPos = bindingKey.indexOf(".");
        if (dotPos > 0) {
            var realKey = bindingKey.substring(0, dotPos), binding = ko.bindingHandlers[realKey];
            if (binding) {
                if (!(binding['flags'] & bindingFlags_twoLevel))
                    ko_throw(realKey + " does not support two-level binding");
                return {
                    key: realKey,
                    subKey: bindingKey.substring(dotPos + 1),
                    handler: binding
                };
            }
        }
        return {};
    }
    
    ko.getBindingHandler = function(bindingKey) {
        return ko.bindingHandlers[bindingKey] || getTwoLevelBindingData(bindingKey).handler;
    };

    ko.bindingValueWrap = function(valueFunction) {
        valueFunction.__ko_wraptest = ko.bindingValueWrap;
        return valueFunction;
    };

    function unwrapBindingValue(value) { 
        return (value && value.__ko_wraptest && value.__ko_wraptest === ko.bindingValueWrap) ? value() : value;
    };

    function applyBindingsToDescendantsInternal (bindingContext, elementOrVirtualElement, bindingContextsMayDifferFromDomParentElement) {
        var currentChild, nextInQueue = ko.virtualElements.firstChild(elementOrVirtualElement);
        while (currentChild = nextInQueue) {
            // Keep a record of the next child *before* applying bindings, in case the binding removes the current child from its position
            nextInQueue = ko.virtualElements.nextSibling(currentChild);
            applyBindingsToNodeAndDescendantsInternal(bindingContext, currentChild, bindingContextsMayDifferFromDomParentElement);
        }
    }

    var dependenciesName = 'dependencies', dependenciesBinding = { 'flags': bindingFlags_builtIn };
    function applyBindingsToNodeAndDescendantsInternal (bindingContext, node, bindingContextsMayDifferFromDomParentElement, bindingsToApply, dontBindDescendants) {
        var isElement = (node.nodeType === 1),
            hasBindings = bindingsToApply || ko.bindingProvider['instance']['nodeHasBindings'](node),
            independentBindings = bindingContext['$options']['independentBindings'];

        if (isElement) // Workaround IE <= 8 HTML parsing weirdness
            ko.virtualElements.normaliseVirtualElementDomStructure(node);

        // We only need to store the bindingContext at the root of the subtree where it applies
        // as all descendants will be able to find it by scanning up their ancestry
        if (bindingContextsMayDifferFromDomParentElement && (isElement || hasBindings))
            ko.storedBindingContextForNode(node, bindingContext);

        if (!hasBindings) {
            if (!dontBindDescendants) {
                // We're recursing automatically into (real or virtual) child nodes without changing binding contexts. So,
                //  * For children of a *real* element, the binding context is certainly the same as on their DOM .parentNode,
                //    hence bindingContextsMayDifferFromDomParentElement is false
                //  * For children of a *virtual* element, we can't be sure. Evaluating .parentNode on those children may
                //    skip over any number of intermediate virtual elements, any of which might define a custom binding context,
                //    hence bindingContextsMayDifferFromDomParentElement is true
                applyBindingsToDescendantsInternal(bindingContext, node, /* bindingContextsMayDifferFromDomParentElement: */ !isElement);
            }
            return;
        }

        // Parse bindings; track observables so that the bindng are reparsed if needed
        var parsedBindings, extraBindings, viewModel = bindingContext['$data'];
        var bindingUpdater = ko.utils.possiblyWrap(function() {
            // Make sure dependencies binding is set correctly
            ko.bindingHandlers[dependenciesName] = dependenciesBinding;
            // Use evaluatedBindings if given, otherwise fall back on asking the bindings provider to give us some bindings
            var evaluatedBindings = (typeof bindingsToApply == "function") ? bindingsToApply() : bindingsToApply;
            parsedBindings = evaluatedBindings || ko.bindingProvider['instance']['getBindings'](node, bindingContext);
            extraBindings = {};

            if (parsedBindings && bindingContext._subscribable)
                ko.dependencyDetection.registerDependency(bindingContext._subscribable);
        }, node);

        // These functions make values accessible to bindings.
        function makeValueAccessor(fullKey, subKey) {
            return subKey
            ? function() {
                if (bindingUpdater)
                    bindingUpdater();
                var _z = {}; _z[subKey] = unwrapBindingValue(parsedBindings[fullKey]); return _z;
            }
            : function () {
                if (bindingUpdater)
                    bindingUpdater();
                return unwrapBindingValue(parsedBindings[fullKey]);
            };
        }
        function allBindingsAccessorIndependent(key) {
            return key ? unwrapBindingValue(parsedBindings[key]) : ko.utils.objectMap(extraBindings, unwrapBindingValue);
        }
        function allBindingsAccessorDependent(key) {
            return key ? parsedBindings[key] : parsedBindings;
        }

        // These functions let the user know something is wrong
        function validateThatBindingIsAllowedForVirtualElements(binding) {
            if (!isElement && !ko.virtualElements.allowedBindings[binding.key] && !(binding.flags & bindingFlags_canUseVirtual))
                ko_throw("The binding '" + binding.key + "' cannot be used with virtual elements");
        }
        function multiContentBindError(key1, key2) {
            ko_throw("Multiple bindings (" + key1 + " and " + key2 + ") are trying to control descendant bindings of the same element. You cannot use these bindings together on the same element.");
        }

        // These functions call the binding handler functions
        function initCaller(binding) {
            return function() {
                var handlerInitFn = binding.handler['init']; 
                var initResult = handlerInitFn(node, binding.valueAccessor, allBindingsAccessor, viewModel, bindingContext);
                // throw an error if binding handler is only using the old method of indicating that it controls binding descendants
                if (initResult && !(binding.flags & bindingFlags_contentBind) && initResult['controlsDescendantBindings']) {
                    if (independentBindings)
                        ko_throw(binding.key + " binding handler must be updated to use contentBind flag");
                    else if (bindings[contentBindBinding])
                        multiContentBindError(bindings[contentBindBinding].key, binding.key);
                    else
                        bindings[binding.order = contentBindBinding] = binding;
                }
                return (initResult && initResult['subscribable']);
            };
        }
        function updateCaller(binding) {
            return function() {
                // dependentBindings is set if we're running in independent mode. Go through each
                // and create a dependency on it's subscribable.
                if (binding.dependentBindings)
                    ko.utils.arrayForEach(binding.dependentBindings, function(dependentBinding) {
                        if (dependentBinding.subscribable)
                            ko.dependencyDetection.registerDependency(dependentBinding.subscribable);
                    });
                var handlerUpdateFn = binding.handler['update'];
                return handlerUpdateFn(node, binding.valueAccessor, allBindingsAccessor, viewModel, bindingContext);
            };
        }
        function callHandlersIndependent(binding) {
            // Observables accessed in init functions are not tracked
            if (runInits && binding.handler['init'])
                binding.subscribable = ko.dependencyDetection.ignore(initCaller(binding));
            // Observables accessed in update function are tracked
            if (binding.handler['update'])
                binding.subscribable = ko.utils.possiblyWrap(updateCaller(binding), node) || binding.subscribable;
        }
        function callHandlersDependent(binding) {
            if (binding.handler['update'])
                updateCaller(binding)();
        }
        function applyListedBindings(bindings) {
            ko.utils.arrayForEach(bindings, callHandlers);
        }

        var allBindingsAccessor = independentBindings ? allBindingsAccessorIndependent : allBindingsAccessorDependent,
            callHandlers = independentBindings ? callHandlersIndependent : callHandlersDependent,
            runInits = true,
            allBindings = [],
            bindings = [[], [], undefined, []];
        /** @const */ var unorderedBindings = 0;
        /** @const */ var contentSetBindings = 1;
        /** @const */ var contentBindBinding = 2;
        /** @const */ var contentUpdateBindings = 3;

        ko.utils.possiblyWrap(function() {
            if (runInits) {
                var bindingIndexes = {}, dependencies = parsedBindings[dependenciesName] || {}, 
                    lastIndex = unorderedBindings, thisIndex;

                // Get binding handlers, call init function if not in independent mode, and determine run order
                function pushBinding(bindingKey) {
                    if (bindingKey in bindingIndexes)
                        return allBindings[bindingIndexes[bindingKey]];

                    var handler = ko.bindingHandlers[bindingKey],
                        binding = handler ? { handler: handler, key: bindingKey } : getTwoLevelBindingData(bindingKey);

                    if (handler = binding.handler) {
                        binding.flags = handler['flags'];
                        validateThatBindingIsAllowedForVirtualElements(binding);
                        binding.valueAccessor = makeValueAccessor(bindingKey, binding.subKey);
                        binding.dependencies = [].concat(handler[dependenciesName] || [], dependencies[bindingKey] || []);

                        if (!independentBindings && handler['init'])
                            initCaller(binding)();

                        if (binding.flags & bindingFlags_contentBind) {
                            if (bindings[contentBindBinding])
                                multiContentBindError(bindings[contentBindBinding].key, binding.key);
                            bindings[binding.order = contentBindBinding] = binding;
                        } else {
                            binding.order = 
                                (binding.flags & bindingFlags_contentSet)
                                    ? contentSetBindings
                                : (binding.flags & bindingFlags_contentUpdate)
                                    ? contentUpdateBindings
                                    : unorderedBindings;
                        }

                        bindingIndexes[bindingKey] = -1;    // Allows for recursive dependencies check
                        var dependentBindings = [];
                        ko.utils.arrayForEach(binding.dependencies, function(dependencyKey) {
                            var dependentBinding,
                                dependencyError = "Binding " + bindingKey + " cannot depend on " + dependencyKey + ": ";
                            if (!(dependencyKey in parsedBindings) || !(dependentBinding = pushBinding(dependencyKey)))
                                ko_throw(dependencyError + "missing or recursive");
                            if (binding.order) {
                                if (dependentBinding.order > binding.order) {
                                    ko_throw(dependencyError + "conflicting ordering");
                                } else {
                                    var dependentOrder = binding.order == contentBindBinding ? contentBindBinding-1 : binding.order;
                                    dependentBinding.dependentOrder = dependentBinding.dependentOrder ? Math.min(dependentBinding.dependentOrder, dependentOrder) : dependentOrder;
                                }
                            } else if (dependentBinding.order) {
                                binding.order = dependentBinding.order;
                            }
                            dependentBindings.push(dependentBinding);
                        });
                        // Save the dependent bindings if we're running in independent mode.
                        if (independentBindings && dependentBindings[0])
                            binding.dependentBindings = dependentBindings;

                        bindingIndexes[bindingKey] = allBindings.length;
                        allBindings.push(binding);
                        return binding;
                    }
                    if (independentBindings)
                        extraBindings[bindingKey] = parsedBindings[bindingKey];
                }

                for (var bindingKey in parsedBindings) {
                    pushBinding(bindingKey);
                }

                // Organize bindings by run order
                for (var i=0, binding; binding = allBindings[i]; i++) {
                    if (binding.order == contentBindBinding) {
                        thisIndex = contentBindBinding + 1;
                    } else {
                        thisIndex = binding.order || binding.dependentOrder || lastIndex;
                        bindings[thisIndex].push(binding);
                    }
                    if (thisIndex > lastIndex)
                        lastIndex = thisIndex;
                }
            }

            // For backward compatibility: make sure all bindings are updated if binding is re-parsed
            if (!independentBindings && bindingUpdater)
                bindingUpdater();

            // Apply the bindings in the correct order
            applyListedBindings(bindings[unorderedBindings]);
            applyListedBindings(bindings[contentSetBindings]);
    
            if (bindings[contentBindBinding])
                callHandlers(bindings[contentBindBinding]);
            else if (!dontBindDescendants)
                applyBindingsToDescendantsInternal(bindingContext, node, /* bindingContextsMayDifferFromDomParentElement: */ !isElement);
    
            applyListedBindings(bindings[contentUpdateBindings]);
        }, node);

        // Don't want to call init function or bind descendents twice
        runInits = dontBindDescendants = false;        
    };

    var storedBindingContextDomDataKey = ko.utils.domData.nextKey();
    ko.storedBindingContextForNode = function (node, bindingContext) {
        if (arguments.length == 2) {
            ko.domDataSet(node, storedBindingContextDomDataKey, bindingContext);
            if (bindingContext._subscribable)
                bindingContext._subscribable.addDisposalNodes(node);
        }
        else
            return ko.domDataGet(node, storedBindingContextDomDataKey);
    }

    function getBindingContext(viewModelOrBindingContext, options) {
        return viewModelOrBindingContext && (viewModelOrBindingContext instanceof ko.bindingContext)
            ? viewModelOrBindingContext
            : new ko.bindingContext(viewModelOrBindingContext, null, options);
    }

    ko.applyBindingsToNode = function (node, bindings, viewModelOrBindingContext, shouldBindDescendants) {
        if (node.nodeType === 1) // If it's an element, workaround IE <= 8 HTML parsing weirdness
            ko.virtualElements.normaliseVirtualElementDomStructure(node);
        applyBindingsToNodeAndDescendantsInternal(getBindingContext(viewModelOrBindingContext), node, true, bindings, !shouldBindDescendants);
    };

    ko.applyBindingsToDescendants = function(viewModelOrBindingContext, rootNode) {
        if (rootNode.nodeType === 1 || rootNode.nodeType === 8)
            applyBindingsToDescendantsInternal(getBindingContext(viewModelOrBindingContext), rootNode, true);
    };

    ko.applyBindings = function (viewModelOrBindingContext, rootNode, options) {
        if (rootNode && (rootNode.nodeType !== 1) && (rootNode.nodeType !== 8))
            ko_throw("ko.applyBindings: first parameter should be your view model; second parameter should be a DOM node");
        rootNode = rootNode || window.document.body; // Make "rootNode" parameter optional

        applyBindingsToNodeAndDescendantsInternal(getBindingContext(viewModelOrBindingContext, options), rootNode, true);
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
    ko.exportSymbol('bindingFlags', ko.bindingFlags);
    ko.exportSymbol('bindingValueWrap', ko.bindingValueWrap);       // must be exported because it's used in binding parser (which uses eval)
    ko.exportSymbol('applyBindings', ko.applyBindings);
    ko.exportSymbol('applyBindingsToDescendants', ko.applyBindingsToDescendants);
    ko.exportSymbol('applyBindingsToNode', ko.applyBindingsToNode);
    ko.exportSymbol('contextFor', ko.contextFor);
    ko.exportSymbol('dataFor', ko.dataFor);
})();// For certain common events (currently just 'click'), allow a simplified data-binding syntax
// e.g. click:handler instead of the usual full-length event:{click:handler}
var eventHandlersWithShortcuts = ['click'];
ko.utils.arrayForEach(eventHandlersWithShortcuts, function(eventName) {
    ko.bindingHandlers[eventName] = {
        'flags': bindingFlags_eventHandler,
        'init': function(element, valueAccessor, allBindingsAccessor, viewModel) {
            var newValueAccessor = function () {
                var result = {};
                result[eventName] = valueAccessor();
                return result;
            };
            return ko.bindingHandlers['event']['init'].call(this, element, newValueAccessor, allBindingsAccessor, viewModel);
        }
    }	
});


ko.bindingHandlers['event'] = {
    'flags': bindingFlags_eventHandler | bindingFlags_twoLevel,
    'init' : function (element, valueAccessor, allBindingsAccessor, viewModel) {
        var eventsToHandle = valueAccessor() || {};
        for(var eventNameOutsideClosure in eventsToHandle) {
            (function() {
                var eventName = eventNameOutsideClosure; // Separate variable to be captured by event handler closure
                if (typeof eventName == "string") {
                    ko.utils.registerEventHandler(element, eventName, function (event) {
                        var handlerReturnValue;
                        var handlerFunction = valueAccessor()[eventName];
                        if (!handlerFunction)
                            return;

                        try { 
                            // Take all the event args, and prefix with the viewmodel
                            var argsForHandler = ko.utils.makeArray(arguments);
                            argsForHandler.unshift(viewModel);
                            handlerReturnValue = handlerFunction.apply(viewModel, argsForHandler);
                        } finally {
                            if (handlerReturnValue !== true) { // Normally we want to prevent default action. Developer can override this be explicitly returning true.
                                if (event.preventDefault)
                                    event.preventDefault();
                                else
                                    event.returnValue = false;
                            }
                        }
                        
                        var bubble = allBindingsAccessor(eventName + 'Bubble') !== false;
                        if (!bubble) {
                            event.cancelBubble = true;
                            if (event.stopPropagation)
                                event.stopPropagation();
                        }
                    });
                }
            })();
        }
    }
};

ko.bindingHandlers['submit'] = {
    'flags': bindingFlags_eventHandler,
    'init': function (element, valueAccessor, allBindingsAccessor, viewModel) {
        if (typeof valueAccessor() != "function")
            ko_throw("The value for a submit binding must be a function");
        ko.utils.registerEventHandler(element, "submit", function (event) {
            var handlerReturnValue;
            var value = valueAccessor();
            try { handlerReturnValue = value.call(viewModel, element); }
            finally {
                if (handlerReturnValue !== true) { // Normally we want to prevent default action. Developer can override this be explicitly returning true.
                    if (event.preventDefault)
                        event.preventDefault();
                    else
                        event.returnValue = false;
                }
            }
        });
    }
};

ko.bindingHandlers['visible'] = {
    'update': function (element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        var isCurrentlyVisible = !(element.style.display == "none");
        if (value && !isCurrentlyVisible)
            element.style.display = "";
        else if ((!value) && isCurrentlyVisible)
            element.style.display = "none";
    }
}

ko.bindingHandlers['enable'] = {
    'update': function (element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        if (value && element.disabled)
            element.removeAttribute("disabled");
        else if ((!value) && (!element.disabled))
            element.disabled = true;
    }
};

ko.bindingHandlers['disable'] = { 
    'update': function (element, valueAccessor) { 
        return ko.bindingHandlers['enable']['update'](element, function() { return !ko.utils.unwrapObservable(valueAccessor()) }); 		
    } 	
};

ko.bindingHandlers['value'] = {
    'flags': bindingFlags_twoWay | bindingFlags_contentUpdate,
    'init': function (element, valueAccessor, allBindingsAccessor) { 
        // Always catch "change" event; possibly other events too if asked
        var eventsToCatch = ["change"];
        var requestedEventsToCatch = allBindingsAccessor("valueUpdate");
        if (requestedEventsToCatch) {
            if (typeof requestedEventsToCatch == "string") // Allow both individual event names, and arrays of event names
                requestedEventsToCatch = [requestedEventsToCatch];
            ko.utils.arrayPushAll(eventsToCatch, requestedEventsToCatch);
            eventsToCatch = ko.utils.arrayGetDistinctValues(eventsToCatch);
        }
        
        ko.utils.arrayForEach(eventsToCatch, function(eventName) {
            // The syntax "after<eventname>" means "run the handler asynchronously after the event"
            // This is useful, for example, to catch "keydown" events after the browser has updated the control
            // (otherwise, ko.selectExtensions.readValue(this) will receive the control's value *before* the key event)
            var handleEventAsynchronously = false;
            if (ko.utils.stringStartsWith(eventName, "after")) {
                handleEventAsynchronously = true;
                eventName = eventName.substring("after".length);
            }
            var getEventHandler = handleEventAsynchronously ? function(handler) { return function() { setTimeout(handler) } }
                                                            : function(handler) { return handler };
            
            ko.utils.registerEventHandler(element, eventName, getEventHandler(function() {
                var modelValue = valueAccessor();
                var elementValue = ko.selectExtensions.readValue(element);
                if (ko.isWriteableObservable(modelValue))
                    modelValue(elementValue);
                else
                    ko.bindingExpressionRewriting.writeValueToProperty(allBindingsAccessor, 'value', elementValue);
            }));	    	
        });
    },
    'update': function (element, valueAccessor) {
        var newValue = ko.utils.unwrapObservable(valueAccessor());
        var elementValue = ko.selectExtensions.readValue(element);
        var valueHasChanged = (newValue != elementValue);
        
        // JavaScript's 0 == "" behavious is unfortunate here as it prevents writing 0 to an empty text box (loose equality suggests the values are the same). 
        // We don't want to do a strict equality comparison as that is more confusing for developers in certain cases, so we specifically special case 0 != "" here.
        if ((newValue === 0) && (elementValue !== 0) && (elementValue !== "0"))
            valueHasChanged = true;
        
        if (valueHasChanged) {
            var applyValueAction = function () { ko.selectExtensions.writeValue(element, newValue); };
            applyValueAction();

            // Workaround for IE6 bug: It won't reliably apply values to SELECT nodes during the same execution thread
            // right after you've changed the set of OPTION nodes on it. So for that node type, we'll schedule a second thread
            // to apply the value as well.
            var valueIsSelectOption = element.tagName == "SELECT";
            if (valueIsSelectOption) {
                // If you try to set a model value that can't be represented in an already-populated dropdown, reject that change,
                // because you're not allowed to have a model value that disagrees with a visible UI selection.
                if (newValue !== ko.selectExtensions.readValue(element))
                    ko.utils.triggerEvent(element, "change");
                else
                    setTimeout(applyValueAction);
            }
        }
    }
};

ko.bindingHandlers['options'] = {
    'flags': bindingFlags_contentBind | bindingFlags_contentSet,
    'update': function (element, valueAccessor, allBindingsAccessor) {
        if (element.tagName != "SELECT")
            ko_throw("options binding applies only to SELECT elements");

        var selectWasPreviouslyEmpty = element.length == 0;
        var previousSelectedValues = ko.utils.arrayMap(ko.utils.arrayFilter(element.childNodes, function (node) {
            return node.tagName && node.tagName == "OPTION" && node.selected;
        }), function (node) {
            return ko.selectExtensions.readValue(node) || node.innerText || node.textContent;
        });
        var previousScrollTop = element.scrollTop;

        var value = ko.utils.unwrapObservable(valueAccessor());
        var selectedValue = element.value;

        // Remove all existing <option>s. 
        // Need to use .remove() rather than .removeChild() for <option>s otherwise IE behaves oddly (https://github.com/SteveSanderson/knockout/issues/134)
        while (element.length > 0) {
            ko.cleanNode(element.options[0]);
            element.remove(0);
        }

        if (value) {
            var allBindings = allBindingsAccessor();
            if (typeof value.length != "number")
                value = [value];
            if (allBindings['optionsCaption']) {
                var option = document.createElement("OPTION");
                ko.utils.setHtml(option, allBindings['optionsCaption']);
                ko.selectExtensions.writeValue(option, undefined);
                element.appendChild(option);
            }
            for (var i = 0, j = value.length; i < j; i++) {
                var option = document.createElement("OPTION");
                
                // Apply a value to the option element
                var optionValue = typeof allBindings['optionsValue'] == "string" ? value[i][allBindings['optionsValue']] : value[i];
                optionValue = ko.utils.unwrapObservable(optionValue);
                ko.selectExtensions.writeValue(option, optionValue);
                
                // Apply some text to the option element
                var optionsTextValue = allBindings['optionsText'];
                var optionText;
                if (typeof optionsTextValue == "function")
                    optionText = optionsTextValue(value[i]); // Given a function; run it against the data value
                else if (typeof optionsTextValue == "string")
                    optionText = value[i][optionsTextValue]; // Given a string; treat it as a property name on the data value
                else
                    optionText = optionValue;				 // Given no optionsText arg; use the data value itself
                optionText = ko.utils.unwrapObservable(optionText);

                option.appendChild(document.createTextNode((optionText === null || optionText === undefined) ? "" : optionText));

                element.appendChild(option);
            }

            // IE6 doesn't like us to assign selection to OPTION nodes before they're added to the document.
            // That's why we first added them without selection. Now it's time to set the selection.
            var newOptions = element.getElementsByTagName("OPTION");
            var countSelectionsRetained = 0;
            for (var i = 0, j = newOptions.length; i < j; i++) {
                if (ko.utils.arrayIndexOf(previousSelectedValues, ko.selectExtensions.readValue(newOptions[i])) >= 0) {
                    ko.utils.setOptionNodeSelectionState(newOptions[i], true);
                    countSelectionsRetained++;
                }
            }
            element.scrollTop = previousScrollTop;

            if (countSelectionsRetained < previousSelectedValues.length)
                ko.utils.triggerEvent(element, "change");

            // Workaround for IE9 bug
            ko.utils.ensureSelectElementIsRenderedCorrectly(element);
        }
    }
};
ko.bindingHandlers['options'].optionValueDomDataKey = ko.utils.domData.nextKey();

ko.bindingHandlers['selectedOptions'] = {
    'flags': bindingFlags_twoWay | bindingFlags_contentUpdate,
    getSelectedValuesFromSelectNode: function (selectNode) {
        var result = [];
        var nodes = selectNode.childNodes;
        for (var i = 0, j = nodes.length; i < j; i++) {
            var node = nodes[i];
            if ((node.tagName == "OPTION") && node.selected)
                result.push(ko.selectExtensions.readValue(node));
            else if (node.tagName == "OPTGROUP") {
                var selectedValuesFromOptGroup = ko.bindingHandlers['selectedOptions'].getSelectedValuesFromSelectNode(node);
                Array.prototype.splice.apply(result, [result.length, 0].concat(selectedValuesFromOptGroup)); // Add new entries to existing 'result' instance
            }
        }
        return result;
    },
    'init': function (element, valueAccessor, allBindingsAccessor) {
        ko.utils.registerEventHandler(element, "change", function () { 
            var value = valueAccessor(), valueToWrite = ko.bindingHandlers['selectedOptions'].getSelectedValuesFromSelectNode(this);
            if (ko.isWriteableObservable(value))
                value(valueToWrite);
            else
                ko.bindingExpressionRewriting.writeValueToProperty(allBindingsAccessor, 'value', valueToWrite);
        });    	
    },
    'update': function (element, valueAccessor) {
        if (element.tagName != "SELECT")
            ko_throw("values binding applies only to SELECT elements");

        var newValue = ko.utils.unwrapObservable(valueAccessor());
        if (newValue && typeof newValue.length == "number") {
            var nodes = element.childNodes;
            for (var i = 0, j = nodes.length; i < j; i++) {
                var node = nodes[i];
                if (node.tagName == "OPTION")
                    ko.utils.setOptionNodeSelectionState(node, ko.utils.arrayIndexOf(newValue, ko.selectExtensions.readValue(node)) >= 0);
            }
        }
    }
};

ko.bindingHandlers['text'] = {
    'flags': bindingFlags_contentBind | bindingFlags_contentSet | bindingFlags_canUseVirtual,
    'init': function(element) {
        ko.virtualElements.setDomNodeChildren(element, [document.createTextNode("")]);
    },
    'update': function (element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        ko.virtualElements.firstChild(element).data = (value === null || value === undefined) ? "" : value;
    }
};

ko.bindingHandlers['html'] = {
    'flags': bindingFlags_contentBind | bindingFlags_contentSet,
    'update': function (element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        ko.utils.setHtml(element, value);
    }
};

ko.bindingHandlers['css'] = {
    'flags': bindingFlags_twoLevel,
    'update': function (element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor() || {});
        for (var className in value) {
            if (typeof className == "string") {
                var shouldHaveClass = ko.utils.unwrapObservable(value[className]);
                ko.utils.toggleDomNodeCssClass(element, className, shouldHaveClass);
            }
        }
    }
};

ko.bindingHandlers['style'] = {
    'flags': bindingFlags_twoLevel,
    'update': function (element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor() || {});
        for (var styleName in value) {
            if (typeof styleName == "string") {
                var styleValue = ko.utils.unwrapObservable(value[styleName]);
                element.style[styleName] = styleValue || ""; // Empty string removes the value, whereas null/undefined have no effect
            }
        }
    }
};

ko.bindingHandlers['uniqueName'] = {
    'flags': bindingFlags_noValue,
    'init': function (element, valueAccessor) {
        if (valueAccessor()) {
            element.name = "ko_unique_" + (++ko.bindingHandlers['uniqueName'].currentIndex);

            // Workaround IE 6/7 issue
            // - https://github.com/SteveSanderson/knockout/issues/197
            // - http://www.matts411.com/post/setting_the_name_attribute_in_ie_dom/
            if (ko.utils.isIe6 || ko.utils.isIe7)
                element.mergeAttributes(document.createElement("<input name='" + element.name + "'/>"), false);
        }
    }
};
ko.bindingHandlers['uniqueName'].currentIndex = 0;

ko.bindingHandlers['checked'] = {
    'flags': bindingFlags_twoWay,
    'init': function (element, valueAccessor, allBindingsAccessor) {
        var updateHandler = function() {            
            var valueToWrite;
            if (element.type == "checkbox") {
                valueToWrite = element.checked;
            } else if ((element.type == "radio") && (element.checked)) {
                valueToWrite = element.value;
            } else {
                return; // "checked" binding only responds to checkboxes and selected radio buttons
            }
            
            var modelValue = valueAccessor();                 
            if ((element.type == "checkbox") && (ko.utils.unwrapObservable(modelValue) instanceof Array)) {
                // For checkboxes bound to an array, we add/remove the checkbox value to that array
                // This works for both observable and non-observable arrays
                var existingEntryIndex = ko.utils.arrayIndexOf(ko.utils.unwrapObservable(modelValue), element.value);
                if (element.checked && (existingEntryIndex < 0))
                    modelValue.push(element.value);
                else if ((!element.checked) && (existingEntryIndex >= 0))
                    modelValue.splice(existingEntryIndex, 1);
            } else if (ko.isWriteableObservable(modelValue)) {            	
                if (modelValue() !== valueToWrite) { // Suppress repeated events when there's nothing new to notify (some browsers raise them)
                    modelValue(valueToWrite);
                }
            } else {
                ko.bindingExpressionRewriting.writeValueToProperty(allBindingsAccessor, 'checked', valueToWrite);
            }
        };
        ko.utils.registerEventHandler(element, "click", updateHandler);

        // IE 6 won't allow radio buttons to be selected unless they have a name
        if ((element.type == "radio") && !element.name)
            ko.bindingHandlers['uniqueName']['init'](element, function() { return true });
    },
    'update': function (element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        
        if (element.type == "checkbox") {        	
            if (value instanceof Array) {
                // When bound to an array, the checkbox being checked represents its value being present in that array
                element.checked = ko.utils.arrayIndexOf(value, element.value) >= 0;
            } else {
                // When bound to anything other value (not an array), the checkbox being checked represents the value being trueish
                element.checked = value;	
            }            
        } else if (element.type == "radio") {
            element.checked = (element.value == value);
        }
    }
};

var attrHtmlToJavascriptMap = { 'class': 'className', 'for': 'htmlFor' };
ko.bindingHandlers['attr'] = {
    'flags': bindingFlags_twoLevel,
    'update': function(element, valueAccessor, allBindingsAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor()) || {};
        for (var attrName in value) {
            if (typeof attrName == "string") {
                var attrValue = ko.utils.unwrapObservable(value[attrName]);

                // To cover cases like "attr: { checked:someProp }", we want to remove the attribute entirely 
                // when someProp is a "no value"-like value (strictly null, false, or undefined)
                // (because the absence of the "checked" attr is how to mark an element as not checked, etc.)                
                var toRemove = (attrValue === false) || (attrValue === null) || (attrValue === undefined);
                if (toRemove)
                    element.removeAttribute(attrName);

                // In IE <= 7 and IE8 Quirks Mode, you have to use the Javascript property name instead of the 
                // HTML attribute name for certain attributes. IE8 Standards Mode supports the correct behavior,
                // but instead of figuring out the mode, we'll just set the attribute through the Javascript 
                // property for IE <= 8.
                if (ko.utils.ieVersion <= 8 && attrName in attrHtmlToJavascriptMap) {
                    attrName = attrHtmlToJavascriptMap[attrName];
                    if (toRemove)
                        element.removeAttribute(attrName);
                    else
                        element[attrName] = attrValue;
                } else if (!toRemove) {
                    element.setAttribute(attrName, attrValue.toString());
                }
            }
        }
    }
};

ko.bindingHandlers['withlight'] = {
    'flags': bindingFlags_contentBind | bindingFlags_canUseVirtual,
    'init': function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var innerContext = bindingContext['createChildContext'](function() {
            return ko.utils.unwrapObservable(valueAccessor());
        });
        ko.applyBindingsToDescendants(innerContext, element, true);
    }
};

ko.bindingHandlers['hasfocus'] = {
    'flags': bindingFlags_twoWay,
    'init': function(element, valueAccessor, allBindingsAccessor) {
        var writeValue = function(valueToWrite) {
            var modelValue = valueAccessor();
            if (valueToWrite == ko.utils.unwrapObservable(modelValue))
                return;

            if (ko.isWriteableObservable(modelValue))
                modelValue(valueToWrite);
            else
                ko.bindingExpressionRewriting.writeValueToProperty(allBindingsAccessor, 'hasfocus', valueToWrite);
        };
        ko.utils.registerEventHandler(element, "focus", function() { writeValue(true) });
        ko.utils.registerEventHandler(element, "focusin", function() { writeValue(true) }); // For IE
        ko.utils.registerEventHandler(element, "blur",  function() { writeValue(false) });
        ko.utils.registerEventHandler(element, "focusout",  function() { writeValue(false) }); // For IE
    },
    'update': function(element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        value ? element.focus() : element.blur();
        ko.utils.triggerEvent(element, value ? "focusin" : "focusout"); // For IE, which doesn't reliably fire "focus" or "blur" events synchronously
    }
};

/*var withDomDataKey = ko.utils.domData.nextKey();
ko.bindingHandlers['withbroken'] = {
    'flags': bindingFlags_contentBind | bindingFlags_canUseVirtual,
    'update': function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var withData = ko.domDataGet(element, withDomDataKey) || {},
            isBound = withData.isBound, container = withData.container,
            dataValue = ko.utils.unwrapObservable(valueAccessor());

        if (!isBound && dataValue) {
            if (container)
                ko.virtualElements.setDomNodeChildren(element, ko.utils.makeArray(container.childNodes));
            var innerContext = bindingContext['createChildContext'](function() {
                return ko.utils.unwrapObservable(valueAccessor());
            });
            ko.applyBindingsToDescendants(innerContext, element, true);
            ko.domDataSet(element, withDomDataKey, {isBound: true});
        }
        else if (!dataValue && !container) {
            var nodeArray = ko.virtualElements.childNodes(element);
            if (isBound)
                ko.utils.arrayForEach(nodeArray, ko.disposeNode);
            container = ko.utils.moveNodesToContainerElement(nodeArray);
            ko.domDataSet(element, withDomDataKey, {container: container});
        }
    }
};*/

function templateBasedBinding(makeOptionsFunction) {
    function makeTemplateValueAccessor(valueAccessor) {
        return function() {
            var options = {'templateEngine': ko.nativeTemplateEngine.instance};
            makeOptionsFunction(valueAccessor(), options);
            return options;
        };
    }
    return {
        'flags': bindingFlags_contentBind | bindingFlags_canUseVirtual,
        'init': function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            return ko.bindingHandlers['template']['init'](element, makeTemplateValueAccessor(valueAccessor));
        },
        'update': function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            return ko.bindingHandlers['template']['update'](element, makeTemplateValueAccessor(valueAccessor), allBindingsAccessor, viewModel, bindingContext);
        }
    };
}

// "with: someExpression" is equivalent to "template: { if: someExpression, data: someExpression }"
ko.bindingHandlers['with'] = new templateBasedBinding( function(value, options) { options['if'] = value; options['data'] = value; });

// "if: someExpression" is equivalent to "template: { if: someExpression }"
ko.bindingHandlers['if'] = templateBasedBinding( function(value, options) { options['if'] = value; });

// "ifnot: someExpression" is equivalent to "template: { ifnot: someExpression }"
ko.bindingHandlers['ifnot'] = templateBasedBinding( function(value, options) { options['ifnot'] = value; });

// "foreach: someExpression" is equivalent to "template: { foreach: someExpression }"
// "foreach: { data: someExpression, afterAdd: myfn }" is equivalent to "template: { foreach: someExpression, afterAdd: myfn }"
ko.bindingHandlers['foreach'] = templateBasedBinding(
    function(value, options) {
        if ((!value) || typeof value.length == "number") {
            // If bindingValue is the array, just pass it on its own
            options['foreach'] = value;
        } else {
            // If bindingValue is a object with options, copy it and set foreach to the data value
            ko.utils.extendInternal(options, value);
            options['foreach'] = options['data'];
            delete options['name'];   // don't allow named templates
        }
    });
// If you want to make a custom template engine,
// 
// [1] Inherit from this class (like ko.nativeTemplateEngine does)
// [2] Override 'renderTemplateSource', supplying a function with this signature:
//
//        function (templateSource, bindingContext, options) {
//            // - templateSource.text() is the text of the template you should render
//            // - bindingContext.$data is the data you should pass into the template
//            //   - you might also want to make bindingContext.$parent, bindingContext.$parents, 
//            //     and bindingContext.$root available in the template too
//            // - options gives you access to any other properties set on "data-bind: { template: options }  (where data-bind is the configured binding attribute)"
//            //
//            // Return value: an array of DOM nodes
//        }
//
// [3] Override 'createJavaScriptEvaluatorBlock', supplying a function with this signature:
//
//        function (script) {
//            // Return value: Whatever syntax means "Evaluate the JavaScript statement 'script' and output the result"
//            //               For example, the jquery.tmpl template engine converts 'someScript' to '${ someScript }' 
//        }
//
//     This is only necessary if you want to allow binding attributes to reference arbitrary template variables.
//     If you don't want to allow that, you can set the property 'allowTemplateRewriting' to false (like ko.nativeTemplateEngine does)
//     and then you don't need to override 'createJavaScriptEvaluatorBlock'.

ko.templateEngine = function () { };

ko.utils.extendInternal(ko.templateEngine.prototype, {

'renderTemplateSource': function (templateSource, bindingContext, options) {
    ko_throw("Override renderTemplateSource");
},

'createJavaScriptEvaluatorBlock': function (script) {
    ko_throw("Override createJavaScriptEvaluatorBlock");
},

'makeTemplateSource': function(template) {
    // Named template
    if (typeof template == "string") {
        var elem = document.getElementById(template);
        if (!elem)
            ko_throw("Cannot find template with ID " + template);
        return new ko.templateSources.domElement(elem);
    } else if ((template.nodeType == 1) || (template.nodeType == 8)) {
        // Anonymous template
        return new ko.templateSources.anonymousTemplate(template);
    } else
        ko_throw("Unknown template type: " + template);
},

'renderTemplate': function (template, bindingContext, options) {
    var templateSource = this['makeTemplateSource'](template);
    return this['renderTemplateSource'](templateSource, bindingContext, options);
},

'isTemplateRewritten': function (template) {
    // Skip rewriting if requested
    if (this['allowTemplateRewriting'] === false)
        return true;
    
    // Perf optimisation - see below
    if (this.knownRewrittenTemplates && this.knownRewrittenTemplates[template])
        return true;
    
    return this['makeTemplateSource'](template)['data']("isRewritten");
},

'rewriteTemplate': function (template, rewriterCallback) {
    var templateSource = this['makeTemplateSource'](template);          
    var rewritten = rewriterCallback(templateSource['text']());
    templateSource['text'](rewritten);
    templateSource['data']("isRewritten", true);
    
    // Perf optimisation - for named templates, track which ones have been rewritten so we can
    // answer 'isTemplateRewritten' *without* having to use getElementById (which is slow on IE < 8)
    if (typeof template == "string") {
        this.knownRewrittenTemplates = this.knownRewrittenTemplates || {};
        this.knownRewrittenTemplates[template] = true;            
    }
}

});

ko.exportSymbol('templateEngine', ko.templateEngine);

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
                    ko_throw(possibleErrorMessage);
            } else {
                var binding = ko.getBindingHandler(key);
                // Don't rewrite bindings that bind their contents unless they also set their contents
                if (binding && ko.checkBindingFlags(binding, bindingFlags_contentBind, bindingFlags_contentSet))
                    ko_throw("This template engine does not support the '" + key + "' binding within its templates");
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
(function() { 
    // A template source represents a read/write way of accessing a template. This is to eliminate the need for template loading/saving
    // logic to be duplicated in every template engine (and means they can all work with anonymous templates, etc.)
    //
    // Two are provided by default:
    //  1. ko.templateSources.domElement       - reads/writes the text content of an arbitrary DOM element
    //  2. ko.templateSources.anonymousElement - uses ko.utils.domData to read/write text *associated* with the DOM element, but 
    //                                           without reading/writing the actual element text content, since it will be overwritten
    //                                           with the rendered template output.
    // You can implement your own template source if you want to fetch/store templates somewhere other than in DOM elements.
    // Template sources need to have the following functions:
    //   text() 			- returns the template text from your storage location
    //   text(value)		- writes the supplied template text to your storage location
    //   data(key)			- reads values stored using data(key, value) - see below
    //   data(key, value)	- associates "value" with this template and the key "key". Is used to store information like "isRewritten".
    //
    // Optionally, template sources can also have the following functions:
    //   nodes()            - returns a DOM element containing the nodes of this template, where available
    //   nodes(value)       - writes the given DOM element to your storage location
    // If a DOM element is available for a given template source, template engines are encouraged to use it in preference over text()
    // for improved speed. However, all templateSources must supply text() even if they don't supply nodes().
    //
    // Once you've implemented a templateSource, make your template engine use it by subclassing whatever template engine you were
    // using and overriding "makeTemplateSource" to return an instance of your custom template source.
    
    ko.templateSources = {};
    
    // ---- ko.templateSources.domElement -----
    
    ko.templateSources.domElement = function(element) {
        this.domElement = element;
    }
    
    ko.templateSources.domElement.prototype['text'] = function(/* valueToWrite */) {
        var tagName = this.domElement.tagName.toLowerCase(),
            elemProp = tagName == "script" ? "text" : tagName == "textarea" ? "value" : "innerHTML";
        if (arguments.length == 0) {
            return this.domElement[elemProp];
        } else {
            var valueToWrite = arguments[0];
            if (elemProp != "innerHTML")
                this.domElement[elemProp] = valueToWrite;
            else
                ko.utils.setHtml(this.domElement, valueToWrite);
        }
    };
    
    ko.templateSources.domElement.prototype['data'] = function(key /*, valueToWrite */) {
        if (arguments.length === 1) {
            return ko.domDataGet(this.domElement, "templateSourceData_" + key);
        } else {
            ko.domDataSet(this.domElement, "templateSourceData_" + key, arguments[1]);
        }
    };
    
    // ---- ko.templateSources.anonymousTemplate -----
    // Anonymous templates are normally saved/retrieved as DOM nodes through "nodes".
    // For compatibility, you can also read "text"; it will be serialized from the nodes on demand.
    // Writing to "text" is still supported, but then the template data will not be available as DOM nodes.

    var anonymousTemplatesDomDataKey = "__ko_anon_template__";
    ko.templateSources.anonymousTemplate = function(element) {		
        this.domElement = element;
    }
    ko.templateSources.anonymousTemplate.prototype = new ko.templateSources.domElement();
    ko.templateSources.anonymousTemplate.prototype['text'] = function(/* valueToWrite */) {
        if (arguments.length == 0) {
            var templateData = ko.domDataGet(this.domElement, anonymousTemplatesDomDataKey) || {};
            if (templateData.textData === undefined && templateData.containerData)
                templateData.textData = templateData.containerData.innerHTML;
            return templateData.textData;
        } else {
            var valueToWrite = arguments[0];
            ko.domDataSet(this.domElement, anonymousTemplatesDomDataKey, {textData: valueToWrite});
        }
    };
    ko.templateSources.domElement.prototype['nodes'] = function(/* valueToWrite */) {
        if (arguments.length == 0) {
            var templateData = ko.domDataGet(this.domElement, anonymousTemplatesDomDataKey) || {};
            return templateData.containerData;
        } else {
            var valueToWrite = arguments[0];
            ko.domDataSet(this.domElement, anonymousTemplatesDomDataKey, {containerData: valueToWrite});
        }
    };

    ko.exportSymbol('templateSources', ko.templateSources);
    ko.exportSymbol('templateSources.domElement', ko.templateSources.domElement);
    ko.exportSymbol('templateSources.anonymousTemplate', ko.templateSources.anonymousTemplate);
})();(function () {
    var _templateEngine;
    ko.setTemplateEngine = function (templateEngine) {
        if ((templateEngine != undefined) && !(templateEngine instanceof ko.templateEngine))
            ko_throw("templateEngine must inherit from ko.templateEngine");
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
            ko_throw("Template engine must return an array of DOM nodes");

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
                ko_throw("Unknown renderMode: " + renderMode);
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
            ko_throw("Set a template engine before calling renderTemplate");
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
                // It's an anonymous template - store the element contents and clear the element
                // But if the template is already stored, don't do anything (init must have been called on this element before)
                var templateSource = new ko.templateSources.anonymousTemplate(element);
                if (!templateSource['nodes']()) {
                    var templateNodes = ko.virtualElements.childNodes(element),
                        container = ko.utils.moveNodesToContainerElement(templateNodes); // This also removes the nodes from their current parent
                    templateSource['nodes'](container);
                }
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
            return templateSubscription;
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

(function () {
    // Simple calculation based on Levenshtein distance.
    function calculateEditDistanceMatrix(oldArray, newArray, maxAllowedDistance) {
        var distances = [];
        for (var i = 0; i <= newArray.length; i++)
            distances[i] = [];

        // Top row - transform old array into empty array via deletions
        for (var i = 0, j = Math.min(oldArray.length, maxAllowedDistance); i <= j; i++)
            distances[0][i] = i;

        // Left row - transform empty array into new array via additions
        for (var i = 1, j = Math.min(newArray.length, maxAllowedDistance); i <= j; i++) {
            distances[i][0] = i;
        }

        // Fill out the body of the array
        var oldIndex, oldIndexMax = oldArray.length, newIndex, newIndexMax = newArray.length;
        var distanceViaAddition, distanceViaDeletion;
        for (oldIndex = 1; oldIndex <= oldIndexMax; oldIndex++) {
            var newIndexMinForRow = Math.max(1, oldIndex - maxAllowedDistance);
            var newIndexMaxForRow = Math.min(newIndexMax, oldIndex + maxAllowedDistance);
            for (newIndex = newIndexMinForRow; newIndex <= newIndexMaxForRow; newIndex++) {
                if (oldArray[oldIndex - 1] === newArray[newIndex - 1])
                    distances[newIndex][oldIndex] = distances[newIndex - 1][oldIndex - 1];
                else {
                    var northDistance = distances[newIndex - 1][oldIndex] === undefined ? Number.MAX_VALUE : distances[newIndex - 1][oldIndex] + 1;
                    var westDistance = distances[newIndex][oldIndex - 1] === undefined ? Number.MAX_VALUE : distances[newIndex][oldIndex - 1] + 1;
                    distances[newIndex][oldIndex] = Math.min(northDistance, westDistance);
                }
            }
        }

        return distances;
    }

    function findEditScriptFromEditDistanceMatrix(editDistanceMatrix, oldArray, newArray) {
        var oldIndex = oldArray.length;
        var newIndex = newArray.length;
        var editScript = [];
        var maxDistance = editDistanceMatrix[newIndex][oldIndex];
        if (maxDistance === undefined)
            return null; // maxAllowedDistance must be too small
        while ((oldIndex > 0) || (newIndex > 0)) {
            var me = editDistanceMatrix[newIndex][oldIndex];
            var distanceViaAdd = (newIndex > 0) ? editDistanceMatrix[newIndex - 1][oldIndex] : maxDistance + 1;
            var distanceViaDelete = (oldIndex > 0) ? editDistanceMatrix[newIndex][oldIndex - 1] : maxDistance + 1;
            var distanceViaRetain = (newIndex > 0) && (oldIndex > 0) ? editDistanceMatrix[newIndex - 1][oldIndex - 1] : maxDistance + 1;
            if ((distanceViaAdd === undefined) || (distanceViaAdd < me - 1)) distanceViaAdd = maxDistance + 1;
            if ((distanceViaDelete === undefined) || (distanceViaDelete < me - 1)) distanceViaDelete = maxDistance + 1;
            if (distanceViaRetain < me - 1) distanceViaRetain = maxDistance + 1;

            if ((distanceViaAdd <= distanceViaDelete) && (distanceViaAdd < distanceViaRetain)) {
                editScript.push({ status: "added", value: newArray[newIndex - 1] });
                newIndex--;
            } else if ((distanceViaDelete < distanceViaAdd) && (distanceViaDelete < distanceViaRetain)) {
                editScript.push({ status: "deleted", value: oldArray[oldIndex - 1] });
                oldIndex--;
            } else {
                editScript.push({ status: "retained", value: oldArray[oldIndex - 1] });
                newIndex--;
                oldIndex--;
            }
        }
        return editScript.reverse();
    }

    ko.utils.compareArrays = function (oldArray, newArray, maxEditsToConsider) {
        if (maxEditsToConsider === undefined) {
            return ko.utils.compareArrays(oldArray, newArray, 1)                 // First consider likely case where there is at most one edit (very fast)
                || ko.utils.compareArrays(oldArray, newArray, 10)                // If that fails, account for a fair number of changes while still being fast
                || ko.utils.compareArrays(oldArray, newArray, Number.MAX_VALUE); // Ultimately give the right answer, even though it may take a long time
        } else {
            oldArray = oldArray || [];
            newArray = newArray || [];
            var editDistanceMatrix = calculateEditDistanceMatrix(oldArray, newArray, maxEditsToConsider);
            return findEditScriptFromEditDistanceMatrix(editDistanceMatrix, oldArray, newArray);
        }
    };    
})();

ko.exportSymbol('utils.compareArrays', ko.utils.compareArrays);

(function () {
    // Objective:
    // * Given an input array, a container DOM node, and a function from array elements to arrays of DOM nodes,
    //   map the array elements to arrays of DOM nodes, concatenate together all these arrays, and use them to populate the container DOM node
    // * Next time we're given the same combination of things (with the array possibly having mutated), update the container DOM node
    //   so that its children is again the concatenation of the mappings of the array elements, but don't re-map any array elements that we
    //   previously mapped - retain those nodes, and just insert/delete other ones

    // "callbackAfterAddingNodes" will be invoked after any "mapping"-generated nodes are inserted into the container node
    // You can use this, for example, to activate bindings on those nodes. Your function must also call
    // addDisposalNodes with the given mappedNodes and subscription.

    function fixUpVirtualElements(contiguousNodeArray) {
        // Ensures that contiguousNodeArray really *is* an array of contiguous siblings, even if some of the interior
        // ones have changed since your array was first built (e.g., because your array contains virtual elements, and
        // their virtual children changed when binding was applied to them).
        // This is needed so that we can reliably remove or update the nodes corresponding to a given array item

        if (contiguousNodeArray.length > 2) {
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
    }

    function defaultCallbackAfterAddingNodes(value, mappedNodes, subscription) {
        subscription.addDisposalNodes(mappedNodes);
    }

    function wrapCallbackAfterAddingNodes(originalCallback) {
        return originalCallback 
            ? function(value, mappedNodes, subscription) {
                originalCallback(value, mappedNodes, subscription);
                if (mappedNodes.length && !subscription.getDisposalNodesCount())
                    subscription.addDisposalNodes(mappedNodes);
            }
            : defaultCallbackAfterAddingNodes;
    }

    function mapNodeAndRefreshWhenChanged(containerNode, mapping, valueToMap, callbackAfterAddingNodes) {
        // Map this array value inside a dependentObservable so we re-map when any dependency changes
        var mappedNodes = [];
        var dependentObservable = ko.dependentObservable(function() {
            var newMappedNodes = mapping(valueToMap) || [];
            
            // On subsequent evaluations, just replace the previously-inserted DOM nodes
            if (mappedNodes.length > 0) {
                fixUpVirtualElements(mappedNodes);
                dependentObservable.replaceDisposalNodes();    // must clear before calling replaceDomNodes
                ko.utils.replaceDomNodes(mappedNodes, newMappedNodes);
                callbackAfterAddingNodes(valueToMap, newMappedNodes, dependentObservable);
            }
            
            // Replace the contents of the mappedNodes array, thereby updating the record
            // of which nodes would be deleted if valueToMap was itself later removed
            mappedNodes.splice(0, mappedNodes.length);
            ko.utils.arrayPushAll(mappedNodes, newMappedNodes);
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
        var nodesAdded = [];
        var insertAfterNode = null;
        for (var i = 0, j = editScript.length; i < j; i++) {
            switch (editScript[i].status) {
                case "retained":
                    // Just keep the information - don't touch the nodes
                    var dataToRetain = lastMappingResult[lastMappingResultIndex];
                    newMappingResult.push(dataToRetain);
                    if (dataToRetain.domNodes.length > 0)
                        insertAfterNode = dataToRetain.domNodes[dataToRetain.domNodes.length - 1];
                    lastMappingResultIndex++;
                    break;

                case "deleted":
                    // Stop tracking changes to the mapping for these nodes
                    lastMappingResult[lastMappingResultIndex].dependentObservable.dispose();
                
                    // Queue these nodes for later removal
                    fixUpVirtualElements(lastMappingResult[lastMappingResultIndex].domNodes);
                    ko.utils.arrayForEach(lastMappingResult[lastMappingResultIndex].domNodes, function (node) {
                        nodesToDelete.push({
                          element: node,
                          index: i,
                          value: editScript[i].value
                        });
                        insertAfterNode = node;
                    });
                    lastMappingResultIndex++;
                    break;

                case "added": 
                    var valueToMap = editScript[i].value;
                    var mapData = mapNodeAndRefreshWhenChanged(domNode, mapping, valueToMap, callbackAfterAddingNodes);
                    var mappedNodes = mapData.mappedNodes;
                    
                    // On the first evaluation, insert the nodes at the current insertion point
                    newMappingResult.push({ arrayEntry: editScript[i].value, domNodes: mappedNodes, dependentObservable: mapData.dependentObservable });
                    for (var nodeIndex = 0, nodeIndexMax = mappedNodes.length; nodeIndex < nodeIndexMax; nodeIndex++) {
                        var node = mappedNodes[nodeIndex];
                        nodesAdded.push({
                          element: node,
                          index: i,
                          value: editScript[i].value
                        });
                        if (insertAfterNode == null) {
                            // Insert "node" (the newly-created node) as domNode's first child
                            ko.virtualElements.prepend(domNode, node);
                        } else {
                            // Insert "node" into "domNode" immediately after "insertAfterNode"
                            ko.virtualElements.insertAfter(domNode, node, insertAfterNode);
                        }
                        insertAfterNode = node;
                    }
                    callbackAfterAddingNodes(valueToMap, mappedNodes, mapData.dependentObservable);
                    break;
            }
        }
        
        ko.utils.arrayForEach(nodesToDelete, function (node) { ko.cleanNode(node.element) });

        var invokedBeforeRemoveCallback = false;
        if (!isFirstExecution) {
            if (options['afterAdd']) {
                for (var i = 0; i < nodesAdded.length; i++)
                    options['afterAdd'](nodesAdded[i].element, nodesAdded[i].index, nodesAdded[i].value);
            }
            if (options['beforeRemove']) {
                for (var i = 0; i < nodesToDelete.length; i++)
                    options['beforeRemove'](nodesToDelete[i].element, nodesToDelete[i].index, nodesToDelete[i].value);
                invokedBeforeRemoveCallback = true;
            }
        }
        if (!invokedBeforeRemoveCallback)
            ko.utils.arrayForEach(nodesToDelete, function (node) {
                ko.cleanAndRemoveNode(node.element);
            });

        // Store a copy of the array items we just considered so we can difference it next time
        ko.domDataSet(domNode, lastMappingResultDomDataKey, newMappingResult);
    }
})();

ko.exportSymbol('utils.setDomNodeChildrenFromArrayMapping', ko.utils.setDomNodeChildrenFromArrayMapping);
ko.nativeTemplateEngine = function () {
    this['allowTemplateRewriting'] = false;
}

ko.nativeTemplateEngine.prototype = ko.utils.extendInternal(new ko.templateEngine(), {

'renderTemplateSource': function (templateSource, bindingContext, options) {
    var useNodesIfAvailable = !(ko.utils.ieVersion < 9), // IE<9 cloneNode doesn't work properly
        templateNodesFunc = useNodesIfAvailable ? templateSource['nodes'] : null,
        templateNodes = templateNodesFunc ? templateSource['nodes']() : null;

    if (templateNodes) {
        return ko.utils.makeArray(templateNodes.cloneNode(true).childNodes);
    } else {
        var templateText = templateSource['text']();
        return ko.utils.parseHtmlFragment(templateText);
    }
}

});

ko.nativeTemplateEngine.instance = new ko.nativeTemplateEngine();
ko.setTemplateEngine(ko.nativeTemplateEngine.instance);

ko.exportSymbol('nativeTemplateEngine', ko.nativeTemplateEngine);
(function() {
    ko.jqueryTmplTemplateEngine = function () {
        // Detect which version of jquery-tmpl you're using. Unfortunately jquery-tmpl 
        // doesn't expose a version number, so we have to infer it.
        // Note that as of Knockout 1.3, we only support jQuery.tmpl 1.0.0pre and later,
        // which KO internally refers to as version "2", so older versions are no longer detected.
        var jQueryTmplVersion = this.jQueryTmplVersion = (function() {      
            if ((typeof(jQuery) == "undefined") || !(jQuery['tmpl']))
                return 0;
            // Since it exposes no official version number, we use our own numbering system. To be updated as jquery-tmpl evolves.
            try {
                if (jQuery['tmpl']['tag']['tmpl']['open'].toString().indexOf('__') >= 0) {
                    // Since 1.0.0pre, custom tags should append markup to an array called "__"
                    return 2; // Final version of jquery.tmpl
                }        	
            } catch(ex) { /* Apparently not the version we were looking for */ }
            
            return 1; // Any older version that we don't support
        })();
        
        function ensureHasReferencedJQueryTemplates() {
            if (jQueryTmplVersion < 2)
                ko_throw("Your version of jQuery.tmpl is too old. Please upgrade to jQuery.tmpl 1.0.0pre or later.");
        }

        function executeTemplate(compiledTemplate, data, jQueryTemplateOptions) {
            return jQuery['tmpl'](compiledTemplate, data, jQueryTemplateOptions);
        }
        
        this['renderTemplateSource'] = function(templateSource, bindingContext, options) {
            options = options || {};
            ensureHasReferencedJQueryTemplates();
            
            // Ensure we have stored a precompiled version of this template (don't want to reparse on every render)
            var precompiled = templateSource['data']('precompiled');
            if (!precompiled) {
                var templateText = templateSource['text']() || "";
                // Wrap in "with($whatever.koBindingContext) { ... }"
                templateText = "{{ko_with $item.koBindingContext}}" + templateText + "{{/ko_with}}";

                precompiled = jQuery['template'](null, templateText);
                templateSource['data']('precompiled', precompiled);
            }
            
            var data = [bindingContext['$data']]; // Prewrap the data in an array to stop jquery.tmpl from trying to unwrap any arrays
            var jQueryTemplateOptions = jQuery['extend']({ 'koBindingContext': bindingContext }, options['templateOptions']);

            var resultNodes = executeTemplate(precompiled, data, jQueryTemplateOptions);
            resultNodes['appendTo'](document.createElement("div")); // Using "appendTo" forces jQuery/jQuery.tmpl to perform necessary cleanup work

            jQuery['fragments'] = {}; // Clear jQuery's fragment cache to avoid a memory leak after a large number of template renders
            return resultNodes;
        };
        
        this['createJavaScriptEvaluatorBlock'] = function(script) {
            return "{{ko_code ((function() { return " + script + " })()) }}";
        };
        
        this['addTemplate'] = function(templateName, templateMarkup) {
            document.write("<script type='text/html' id='" + templateName + "'>" + templateMarkup + "</script>");
        };
    
        if (jQueryTmplVersion > 0) {
            jQuery['tmpl']['tag']['ko_code'] = {
                open: "__.push($1 || '');"
            };
            jQuery['tmpl']['tag']['ko_with'] = {
                open: "with($1) {",
                close: "} "
            };
        }
    };
    
    ko.jqueryTmplTemplateEngine.prototype = new ko.templateEngine();
    
    // Use this one by default *only if jquery.tmpl is referenced*
    var jqueryTmplTemplateEngineInstance = new ko.jqueryTmplTemplateEngine();
    if (jqueryTmplTemplateEngineInstance.jQueryTmplVersion > 0)
        ko.setTemplateEngine(jqueryTmplTemplateEngineInstance);
    
    ko.exportSymbol('jqueryTmplTemplateEngine', ko.jqueryTmplTemplateEngine);
})();});
})(window,document,navigator); 
})();
