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
        throw new Error("Pass a function that returns the value of the ko.computed");

    var writeFunction = options["write"];
    if (!evaluatorFunctionTarget)
        evaluatorFunctionTarget = options["owner"];

    var _subscriptionsToDependencies = [];
    function disposeAllSubscriptionsToDependencies() {
        ko.utils.arrayForEach(_subscriptionsToDependencies, function (subscription) {
            subscription.dispose();
        });
        _subscriptionsToDependencies = [];
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


    var disposeWhen, isBeingEvaluated;
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
                    _subscriptionsToDependencies.push(subscribable.subscribe(evaluatePossiblyAsync)); // Brand new subscription - add it
            });

            var newValue = readFunction.call(evaluatorFunctionTarget);

            // For each subscription no longer being used, remove it from the active subscriptions list and dispose it
            for (var i = disposalCandidates.length - 1; i >= 0; i--) {
                if (disposalCandidates[i])
                    _subscriptionsToDependencies.splice(i, 1)[0].dispose();
            }

            dependentObservable["notifySubscribers"](_latestValue, "beforeChange");
            _latestValue = newValue;
        } finally {
            ko.dependencyDetection.end();
        }

        dependentObservable["notifySubscribers"](_latestValue);
        _needsEvaluation = _isBeingEvaluated = false;
    }

    function evaluateInitial() {
        _isBeingEvaluated = true;
        try {
            ko.dependencyDetection.begin(function(subscribable) {
                _subscriptionsToDependencies.push(subscribable.subscribe(evaluatePossiblyAsync));
            });
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
            throw new Error("Cannot write a value to a ko.computed unless you specify a 'write' option. If you wish to read the current value, don't pass any parameters.");
        }
    }

    function get() {
        // Reading the value
        if (_needsEvaluation)
            evaluateImmediate();
        ko.dependencyDetection.registerDependency(dependentObservable);
        return _latestValue;
    }

    var disposer;
    function addDisposalNodes(nodeOrNodes) {
        if (nodeOrNodes) {
            if (!disposer)
                disposer = ko.utils.domNodeDisposal.addDisposeCallback(null, disposeAllSubscriptionsToDependencies, disposeWhen);
            disposer.addNodeOrNodes(nodeOrNodes);
            dependentObservable.dispose = disposer.dispose;
            disposeWhen = disposer.shouldDispose;
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

    dependentObservable.getDependenciesCount = function () { return _subscriptionsToDependencies.length; };
    dependentObservable.hasWriteFunction = typeof options["write"] === "function";
    dependentObservable.addDisposalNodes = addDisposalNodes;
    dependentObservable.replaceDisposalNodes = replaceDisposalNodes;

    dependentObservable.dispose = disposeAllSubscriptionsToDependencies;
    disposeWhen = options.disposeWhen || options["disposeWhen"];

    // addDisposalNodes might replace the disposeWhen and dependentObservable.dispose functions
    // So it needs to be called after they've been initialized with their default values.
    addDisposalNodes(options.disposalNodes || options["disposeWhenNodeIsRemoved"]);

    ko.subscribable.call(dependentObservable);
    ko.utils.extend(dependentObservable, ko.dependentObservable['fn']);

    ko.exportProperty(dependentObservable, 'dispose', dependentObservable.dispose);
    ko.exportProperty(dependentObservable, 'getDependenciesCount', dependentObservable.getDependenciesCount);
    ko.exportProperty(dependentObservable, 'addDisposalNodes', dependentObservable.addDisposalNodes);
    ko.exportProperty(dependentObservable, 'replaceDisposalNodes', dependentObservable.replaceDisposalNodes);

    return dependentObservable;
};

ko.dependentObservable['fn'] = {
    __ko_proto__: ko.dependentObservable
};

ko.dependentObservable.__ko_proto__ = ko.observable;

ko.exportSymbol('dependentObservable', ko.dependentObservable);
ko.exportSymbol('computed', ko.dependentObservable); // Make "ko.computed" an alias for "ko.dependentObservable"