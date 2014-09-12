ko.tasks = (function () {
    var setTimeoutHandle,
        taskQueueHead = {},
        taskQueueEnd = taskQueueHead,
        processingHead,
        contextStack = [],
        contextHead = taskQueueHead;

    function startTaskContext() {
        // Save the previous context head in the stack and point the new context head to the current end of the queue.
        // Any new deferred tasks will be part of the current context to be processed when the context is ended.
        contextStack.push(contextHead);
        contextHead = taskQueueEnd;
    }

    function endTaskContext() {
        try {
            // Process any deferred tasks that were scheduled within this context
            if (contextHead._next) {
                processAll(contextHead);
            }
        } finally {
            // Reset the context back to the prior level
            contextHead = contextStack.pop() || taskQueueHead;
        }
    }

    function processAll(start) {
        var countProcessed = 0;
        try {
            var item = start;
            while (item = item._next) {
                processingHead = item;
                if (!item._done) {
                    item._done = true;
                    item._function.apply(item['object'], item['args'] || []);
                    ++countProcessed;
                }
            }
        } finally {
            processingHead = undefined;

            // Remove the items we've just processed from the queue
            start._next = null;
            taskQueueEnd = start;

            if (start === taskQueueHead) {
                // If we've just processed all tasks, reset the task context
                contextStack.length = 0;
                contextHead = taskQueueHead;

                // And clear the timer
                window.clearTimeout(setTimeoutHandle);
                setTimeoutHandle = undefined;
            }
        }

        return countProcessed;
    }

    function processAllTasks() {
        // If we're already in the middle of processing tasks, just ignore this call.
        if (processingHead) {
            return;
        }
        return processAll(taskQueueHead);
    }

    function clearDuplicate(func) {
        // Try to find a matching function in the queue (in the current context)
        for (var link = processingHead || contextHead, item; item = link._next; link = item) {
            if (item['distinct'] && item._function === func && !item._done) {
                // Remove the matching item from the queue
                link._next = item._next;
                if (!link._next)
                    taskQueueEnd = link;
                return true;
            }
        }
        return false;
    }

    var tasks = {
        defer: function (func, options) {
            var item = options || {},
                foundDuplicate = item['distinct'] && clearDuplicate(func);

            item._function = func;

            taskQueueEnd._next = item;
            taskQueueEnd = item;

            if (!contextStack.length && !setTimeoutHandle) {
                setTimeoutHandle = window.setTimeout(processAllTasks, 0);
            }
            return !foundDuplicate;
        },

        newContext: function (func, object, args) {
            startTaskContext();
            try {
                return func.apply(object, args || []);
            } finally {
                endTaskContext();
            }
        },

        inContext: function (func) {
            return function () {
                return tasks.newContext(func, this, arguments);
            }
        },

        processAll: processAllTasks
    };

    return tasks;
})();

ko.exportSymbol('tasks', ko.tasks);
ko.exportSymbol('tasks.defer', ko.tasks.defer);
ko.exportSymbol('tasks.newContext', ko.tasks.newContext);
ko.exportSymbol('tasks.inContext', ko.tasks.inContext);
ko.exportSymbol('tasks.processAll', ko.tasks.processAll);
