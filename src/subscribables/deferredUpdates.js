ko.tasks = (function () {
    // Use setImmediate functions if available; otherwise use setTimeout
    var setTimeout, clearTimeout;
    if (window.setImmediate) {
        setTimeout = 'setImmediate';
        clearTimeout = 'clearImmediate';
    } else {
        setTimeout = 'setTimeout';
        clearTimeout = 'clearTimeout';
    }

    var evaluatorHandler, taskQueueHead = {}, taskQueueEnd = taskQueueHead, contextStack = [], processingItem, contextStart = taskQueueHead;

    // Begin a new task context. Any tasks that are scheduled during this context will be processed when the context ends
    function startTaskContext() {
        // Save the previous context start in the stack
        contextStack.push(contextStart);
        // Set the new context start to the current task length: any newly scheduled tasks are part of the current context
        contextStart = taskQueueEnd;
    }

    // End the current task context and process any scheduled tasks
    function endTaskContext() {
        try {
            // Process any tasks that were scheduled within this context
            if (contextStart._next)
                processTasks(contextStart);
        } finally {
            // Move back into the previous context
            contextStart = contextStack.pop() || taskQueueHead;
        }
    }

    function processTasks(start) {
        var countProcessed = 0, countMarks = 0;

        // Add a mark to the end of the queue; each one marks the end of a logical group of tasks
        // and the number of these groups is limited to prevent unchecked recursion.
        taskQueueEnd = taskQueueEnd._next = { _mark: true };

        try {
            for (var item = start; item = item._next; ) {
                processingItem = item;
                if (item._mark) {
                    // When we encounter a mark, increment the mark counter and append a new mark to the queue
                    if (item._next) {
                        if (++countMarks >= 5000)
                            throw Error("'Too much recursion' after processing " + countProcessed + " tasks.");
                        taskQueueEnd = taskQueueEnd._next = { _mark: true };
                    }
                } else if (!item._done) {
                    item._done = true;
                    item._func.apply(item['object'], item['args'] || []);
                    ++countProcessed;
                }
            }
        } finally {
            if (start !== taskQueueHead) {
                // Remove the items we've just processed
                start._next = null;
                taskQueueEnd = start;
            } else {
                // Clear the queue, stack and handler
                contextStack = [];
                taskQueueHead._next = null;
                contextStart = taskQueueEnd = taskQueueHead;

                if (evaluatorHandler)
                    window[clearTimeout](evaluatorHandler);
                evaluatorHandler = undefined;
            }
            processingItem = undefined;
        }
        return countProcessed;
    }

    function processAllTasks() {
        // Don't process all tasks if already processing tasks
        if (!processingItem) {
            return processTasks(taskQueueHead);
        }
    }

    function clearDuplicate(evaluator) {
        for (var link = processingItem || contextStart, item; item = link._next; link = item)
            if (item._func === evaluator && !item._done) {
                // remove the item from the queue
                link._next = item._next;
                if (!link._next)
                    taskQueueEnd = link;
                return true;
            }
        return false;
    }

    var tasks = {
        processImmediate: function (evaluator, object, args) {
            startTaskContext();
            try {
                return evaluator.apply(object, args || []);
            } finally {
                endTaskContext();
            }
        },

        processDelayed: function (evaluator, distinct, options) {
            if (arguments.length == 2 && typeof distinct == 'object' ) {
                options = distinct;
                distinct = options.distinct;
            }
            var foundDup = (distinct || distinct === undefined) && clearDuplicate(evaluator);

            var item = options || {};
            item._func = evaluator;

            taskQueueEnd._next = item;
            taskQueueEnd = item;

            if (!contextStack.length && !evaluatorHandler) {
                evaluatorHandler = window[setTimeout](processAllTasks);
            }
            return !foundDup;
        },

        makeProcessedCallback: function (evaluator) {
            return function () {
                return tasks.processImmediate(evaluator, this, arguments);
            }
        }
    };

    ko.processAllDeferredBindingUpdates = function () {
        for (var item = taskQueueHead; item = item._next; ) {
            if (item['node'] && !item._done) {
                item._done = true;
                item._func.call();
            }
        }
    };

    ko.processAllDeferredBindingUpdates = ko.processAllDeferredUpdates = processAllTasks;

    ko.evaluateAsynchronously = function (evaluator, timeout) {
        return setTimeout(tasks.makeProcessedCallback(evaluator), timeout);
    };

    return tasks;
})();

ko.exportSymbol('tasks', ko.tasks);
ko.exportSymbol('tasks.processImmediate', ko.tasks.processImmediate);
ko.exportSymbol('tasks.processDelayed', ko.tasks.processDelayed);
ko.exportSymbol('tasks.makeProcessedCallback', ko.tasks.makeProcessedCallback);

ko.exportSymbol('processAllDeferredBindingUpdates', ko.processAllDeferredBindingUpdates);
ko.exportSymbol('processAllDeferredUpdates', ko.processAllDeferredUpdates);
ko.exportSymbol('evaluateAsynchronously', ko.evaluateAsynchronously);

/*
 * Add deferred extender
 */
ko.extenders.deferred = function(target, value) {
    target._deferUpdates = value;
    if (value) {
        target['limit'](deferFunction);
    }
};

function deferFunction(callback) {
    return function (target) {
        if (target._deferUpdates) {
            // TODO: figure out if this is a binding computed
            ko.tasks.processDelayed(callback);

            target['notifySubscribers'](undefined, 'dirty');
        } else {
            callback();
        }
    };
}
