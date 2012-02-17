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
        for (var i = start || 0; i < evaluatorsArray.length; i++) {
            if (!start)
                indexProcessing = i;
            evaluatorsArray[i]();
        }
        if (start) {
            // Remove only items we've just processed (shorten array to *start* items)
            evaluatorsArray.splice(start, evaluatorsArray.length);
        } else {
            // Clear array and handler to indicate that we're finished 
            evaluatorsArray = [];
            indexProcessing = evaluatorHandler = undefined;
        }
    }

    var tasks = { 
        processImmediate: function(evaluator, object, args) {
            pushTaskState();
            try {
                return evaluator.apply(object, args);
            } finally {
                popTaskState();
            }
        },
    
        processDelayed: function(evaluator, distinct) {
            if ((distinct || distinct === undefined) && ko.utils.arrayIndexOf(evaluatorsArray, evaluator, indexProcessing) >= 0) {
                // Don't add evaluator if distinct is set (or missing) and evaluator is already in list
                return;
            }
            evaluatorsArray.push(evaluator);
            if (!taskStack.length && indexProcessing === undefined && !evaluatorHandler) {
                evaluatorHandler = window[setImmediate](processEvaluators);
            }
        },
    
        makeProcessedEvaluator: function(evaluator) {
            return function() {
                return tasks.processImmediate(evaluator, this, arguments);
            }
        }
    };
    ko.evaluateAsynchronously = function(evaluator) {
        return window[setImmediate](tasks.makeProcessedEvaluator(evaluator));
    }

    return ko.exportProperties(tasks,
         'processImmediate', tasks.processImmediate,
         'processDelayed', tasks.processDelayed,
         'makeProcessedEvaluator', tasks.makeProcessedEvaluator
    );
})();
ko.exportSymbol('evaluateAsynchronously', ko.evaluateAsynchronously);
ko.exportSymbol('tasks', ko.tasks);
