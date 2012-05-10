ko.dependentObservable = function (evaluatorFunctionOrOptions, evaluatorFunctionTarget, options) {
    var _latestValue,
        _needsEvaluation = true,
        _isBeingEvaluated = false,
        readFunction = evaluatorFunctionOrOptions,
        writeFunction = options["write"],
        _subscriptionsToDependencies = [],
        evaluationTimeoutInstance = null;

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

    if (!evaluatorFunctionTarget)
        evaluatorFunctionTarget = options["owner"];

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

    function addDependency(subscribable) {
        _subscriptionsToDependencies.push(subscribable.subscribe(evaluatePossiblyAsync));
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
                    addDependency(subscribable); // Brand new subscription - add it
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
    }

    function evaluateInitial() {
        _isBeingEvaluated = true;
        try {
            ko.dependencyDetection.begin(addDependency);
            _latestValue = readFunction.call(evaluatorFunctionTarget);
            if (DEBUG) dependentObservable._latestValue = _latestValue;
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

    // Evaluate, unless deferEvaluation is true, unless returnValueIfNoDependencies is true
    if (options['deferEvaluation'] !== true || options.returnValueIfNoDependencies)
        evaluateInitial();

    // just return the value if returnValueIfNoDependencies is true and there are no dependencies
    if (options.returnValueIfNoDependencies && !_subscriptionsToDependencies.length)
        return _latestValue;

    var dispose = disposeAllSubscriptionsToDependencies;

    // Build "disposeWhenNodeIsRemoved" and "disposeWhenNodeIsRemovedCallback" option values
    // (Note: "disposeWhenNodeIsRemoved" option both proactively disposes as soon as the node is removed using ko.removeNode(),
    // plus adds a "disposeWhen" callback that, on each evaluation, disposes if the node was removed by some other means.)
    var disposeWhenNodeIsRemoved = (typeof options["disposeWhenNodeIsRemoved"] == "object") ? options["disposeWhenNodeIsRemoved"] : null;
    var disposeWhen = options["disposeWhen"] || function() { return false; };
    if (disposeWhenNodeIsRemoved) {
        dispose = function() {
            ko.utils.domNodeDisposal.removeDisposeCallback(disposeWhenNodeIsRemoved, arguments.callee);
            disposeAllSubscriptionsToDependencies();
        };
        ko.utils.domNodeDisposal.addDisposeCallback(disposeWhenNodeIsRemoved, dispose);
        var existingDisposeWhenFunction = disposeWhen;
        disposeWhen = function () {
            return !ko.utils.domNodeIsAttachedToDocument(disposeWhenNodeIsRemoved) || existingDisposeWhenFunction();
        }
    }
    dependentObservable.getDependenciesCount = function () { return _subscriptionsToDependencies.length; };
    dependentObservable.hasWriteFunction = typeof options["write"] === "function";
    dependentObservable.dispose = function () { dispose(); };

    ko.subscribable.call(dependentObservable);
    ko.utils.extend(dependentObservable, ko.dependentObservable['fn']);

    ko.exportProperty(dependentObservable, 'dispose', dependentObservable.dispose);
    ko.exportProperty(dependentObservable, 'getDependenciesCount', dependentObservable.getDependenciesCount);

    return dependentObservable;
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
