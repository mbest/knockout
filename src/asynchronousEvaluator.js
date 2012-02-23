ko.tasks = (function() {
    var setImmediate = !!window['setImmediate'] ? 'setImmediate' : 'setTimeout';    // Use setImmediate function if available; otherwise use setTimeout
    var evaluatorHandler, evaluatorsArray = [], taskStack = [], indexProcessing;

    function pushTaskState() {
        taskStack.push(evaluatorsArray.length);
    }

    function popTaskState() {
        var originalLength = taskStack.pop();
        if (evaluatorsArray.length > originalLength)
            processEvaluators(originalLength);
    }

    function processEvaluators(start) {
        // New items might be added to evaluatorsArray during this loop
        // So always check evaluatorsArray.length
        try {
            for (var i = start || 0; i < evaluatorsArray.length; i++) {
                if (!start)
                    indexProcessing = i;
                var evaluator = evaluatorsArray[i].evaluator;
                evaluator();
            }
        } finally {
            if (start) {
                // Remove only items we've just processed (shorten array to *start* items)
                evaluatorsArray.splice(start, evaluatorsArray.length);
            } else {
                // Clear array and handler to indicate that we're finished
                evaluatorsArray = [];
                indexProcessing = evaluatorHandler = undefined;
            }
        }
    }

    // need to wrap function call because Firefox calls setTimeout callback with a parameter
    function processEvaluatorsCallback() {
        processEvaluators();
    }

    function isEvaluatorDuplicate(evaluator) {
        for (var i = indexProcessing || 0, j = evaluatorsArray.length; i < j; i++)
            if (evaluatorsArray[i].evaluator == evaluator)
                return true;
        return false;
    }

    var tasks = {
        processImmediate: function(evaluator, object, args) {
            pushTaskState();
            try {
                return evaluator.apply(object, args || []);
            } finally {
                popTaskState();
            }
        },

        processDelayed: function(evaluator, distinct, nodes) {
            if ((distinct || distinct === undefined) && isEvaluatorDuplicate(evaluator)) {
                // Don't add evaluator if distinct is set (or missing) and evaluator is already in list
                return;
            }
            evaluatorsArray.push({evaluator: evaluator, nodes: nodes});
            if (!taskStack.length && indexProcessing === undefined && !evaluatorHandler) {
                evaluatorHandler = window[setImmediate](processEvaluatorsCallback);
            }
        },

        makeProcessedCallback: function(evaluator) {
            return function() {
                return tasks.processImmediate(evaluator, this, arguments);
            }
        }
    };

    ko.processDeferredBindingUpdatesForNode = function(node) {
        for (var i = 0, j = evaluatorsArray.length; i < j; i++) {
            if (evaluatorsArray[i].nodes && ko.utils.arrayIndexOf(evaluatorsArray[i].nodes, node) != -1) {
                var evaluator = evaluatorsArray[i].evaluator;
                evaluator();
            }
        }
    };

    ko.processAllDeferredBindingUpdates = function(node) {
        for (var i = 0, j = evaluatorsArray.length; i < j; i++) {
            if (evaluatorsArray[i].nodes) {
                var evaluator = evaluatorsArray[i].evaluator;
                evaluator();
            }
        }
    };

    ko.evaluateAsynchronously = function(evaluator, timeout) {
        return setTimeout(tasks.makeProcessedCallback(evaluator), timeout);
    };

    return ko.exportProperties(tasks,
         'processImmediate', tasks.processImmediate,
         'processDelayed', tasks.processDelayed,
         'makeProcessedCallback', tasks.makeProcessedCallback
    );
})();
ko.exportSymbol('processDeferredBindingUpdatesForNode', ko.processDeferredBindingUpdatesForNode);
ko.exportSymbol('processAllDeferredBindingUpdates', ko.processAllDeferredBindingUpdates);
ko.exportSymbol('evaluateAsynchronously', ko.evaluateAsynchronously);
ko.exportSymbol('tasks', ko.tasks);
