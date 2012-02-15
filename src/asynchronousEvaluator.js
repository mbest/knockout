ko.asynchronousEvaluator = (function() {
    var evaluatorHandler, evaluatorsArray = [];

    function processEvaluators() {
        // New items might be added to evaluatorsArray during this loop
        // So always check evaluatorsArray.length
        for (var i = 0; i < evaluatorsArray.length; i++) {
            evaluatorsArray[i]();
        }
        evaluatorsArray = [];
        evaluatorHandler = undefined;
    }

    function addEvaluator(evaluator) {
        // Only add a callback if it's not already there
        if (ko.utils.arrayIndexOf(evaluatorsArray, evaluator) >= 0)
            return;
        evaluatorsArray.push(evaluator);
        if (!evaluatorHandler)
            evaluatorHandler = ko.setImmediate(processEvaluators);
    }

    return {
        add: addEvaluator
    };
})();
