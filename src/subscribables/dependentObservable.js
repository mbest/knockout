ko.dependentObservable = function (evaluatorFunctionOrOptions, evaluatorFunctionTarget, options) {
    var _latestValue,
        _needsEvaluation = true,
        _isBeingEvaluated = false,
        readFunction = evaluatorFunctionOrOptions,
        _subscriptionsToDependencies = [];

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
    if (!evaluatorFunctionTarget)
        evaluatorFunctionTarget = options["owner"];

    if (typeof readFunction != "function")
        throw new Error("Pass a function that returns the value of the ko.computed");

    function addSubscriptionToDependency(subscribable) {
        _subscriptionsToDependencies.push(subscribable.subscribe(evaluatePossiblyAsync));
    }

    function disposeAllSubscriptionsToDependencies() {
        ko.utils.arrayForEach(_subscriptionsToDependencies, function (subscription) {
            subscription.dispose();
        });
        _subscriptionsToDependencies = [];
        _needsEvaluation = false;
    }

    function evaluatePossiblyAsync() {
        _needsEvaluation = true;
        var throttleEvaluationTimeout = dependentObservable['throttleEvaluation'];
        if (throttleEvaluationTimeout && throttleEvaluationTimeout >= 0) {
            clearTimeout(evaluationTimeoutInstance);
            evaluationTimeoutInstance = setTimeout(evaluateImmediate, throttleEvaluationTimeout);
        } else
            evaluateImmediate();
    }

    function evaluateImmediate() {
        if (_isBeingEvaluated || !_needsEvaluation) {
            // If the evaluation of a ko.computed causes side effects, it's possible that it will trigger its own re-evaluation.
            // This is not desirable (it's hard for a developer to realise a chain of dependencies might cause this, and they almost
            // certainly didn't intend infinite re-evaluations). So, for predictability, we simply prevent ko.computeds from causing
            // their own re-evaluation. Further discussion at https://github.com/SteveSanderson/knockout/pull/387
            return;
        }

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
                    addSubscriptionToDependency(subscribable); // Brand new subscription - add it
            });

            var newValue = readFunction.call(evaluatorFunctionTarget);

            // For each subscription no longer being used, remove it from the active subscriptions list and dispose it
            for (var i = disposalCandidates.length - 1; i >= 0; i--) {
                if (disposalCandidates[i])
                    _subscriptionsToDependencies.splice(i, 1)[0].dispose();
            }
            _needsEvaluation = false;

            dependentObservable["notifySubscribers"](_latestValue, "beforeChange");
            _latestValue = newValue;
            if (DEBUG) dependentObservable._latestValue = _latestValue;
        } finally {
            ko.dependencyDetection.end();
        }

        dependentObservable["notifySubscribers"](_latestValue);
        _isBeingEvaluated = false;

        if (!_subscriptionsToDependencies.length)
            dependentObservable.dispose();
    }

    function evaluateInitial() {
        _isBeingEvaluated = true;
        try {
            ko.dependencyDetection.begin(addSubscriptionToDependency);
            _latestValue = readFunction.call(evaluatorFunctionTarget);
            if (DEBUG) dependentObservable._latestValue = _latestValue;
        } finally {
            ko.dependencyDetection.end();
        }
        _needsEvaluation = _isBeingEvaluated = false;
    }

    function dependentObservable() {
        if (arguments.length > 0) {
            if (typeof writeFunction === "function") {
                // Writing a value
                writeFunction.apply(evaluatorFunctionTarget, arguments);
            } else {
                throw new Error("Cannot write a value to a ko.computed unless you specify a 'write' option. If you wish to read the current value, don't pass any parameters.");
            }
            return this; // Permits chained assignments
        } else {
            // Reading the value
            if (_needsEvaluation)
                evaluateImmediate();
            ko.dependencyDetection.registerDependency(dependentObservable);
            return _latestValue;
        }
    }

    // Evaluate, unless deferEvaluation is true, unless returnValueIfNoDependencies is true
    if (options['deferEvaluation'] !== true || options.returnValueIfNoDependencies)
        evaluateInitial();

    // just return the value if returnValueIfNoDependencies is true and there are no dependencies
    if (options.returnValueIfNoDependencies && !_subscriptionsToDependencies.length)
        return _latestValue;

    function peek() {
        if (_needsEvaluation)
            evaluateImmediate();
        return _latestValue;
    }

    function isActive() {
        return _needsEvaluation || _subscriptionsToDependencies.length > 0;
    }

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

    var writeFunction = options["write"],
        disposeWhen = options.disposeWhen || options["disposeWhen"],
        evaluationTimeoutInstance = null,
        disposer, disposalNodes = [];

    ko.utils.extendInternal(dependentObservable, {
        peek:                   peek,
        hasWriteFunction:       typeof writeFunction === "function",
        getDependenciesCount:   function () { return _subscriptionsToDependencies.length; },
        addDisposalNodes:       addDisposalNodes,
        replaceDisposalNodes:   replaceDisposalNodes,
        getDisposalNodesCount:  function() { return disposalNodes.length; },
        dispose:                disposeAllSubscriptionsToDependencies,
        isActive:               isActive
    });

    // addDisposalNodes might replace the disposeWhen and dependentObservable.dispose functions
    // So it needs to be called after they've been initialized with their default values.
    // Skip if isActive is false (there will never be any dependencies to dispose).
    if (isActive())
        addDisposalNodes(options.disposalNodes || options["disposeWhenNodeIsRemoved"]);

    ko.subscribable.call(dependentObservable);
    ko.utils.extendInternal(dependentObservable, ko.dependentObservable['fn']);

    return ko.exportProperties(dependentObservable,
        'peek', dependentObservable.peek,
        'dispose', dependentObservable.dispose,
        'getDependenciesCount', dependentObservable.getDependenciesCount,
        'addDisposalNodes', dependentObservable.addDisposalNodes,
        'replaceDisposalNodes', dependentObservable.replaceDisposalNodes,
        'getDisposalNodesCount', dependentObservable.getDisposalNodesCount,
        'isActive', dependentObservable.isActive
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
