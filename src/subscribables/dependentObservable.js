ko.dependentObservable = function (evaluatorFunctionOrOptions, evaluatorFunctionTarget, options) {
    var _latestValue,
        _hasBeenEvaluated = false,
        _isBeingEvaluated = false,
        _suppressDisposalUntilDisposeWhenReturnsFalse = false,
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
    if (typeof readFunction != "function")
        throw new Error("Pass a function that returns the value of the ko.computed");

    function addSubscriptionToDependency(subscribable, id) {
        if (!_subscriptionsToDependencies[id]) {
            _subscriptionsToDependencies[id] = subscribable.subscribe(evaluatePossiblyAsync);
            ++_dependenciesCount;
        }
    }

    function disposeAllSubscriptionsToDependencies() {
        ko.utils.objectForEach(_subscriptionsToDependencies, function (id, subscription) {
            subscription.dispose();
        });
        _subscriptionsToDependencies = {};
        _dependenciesCount = 0;
    }

    function evaluatePossiblyAsync() {
        var throttleEvaluationTimeout = dependentObservable['throttleEvaluation'];
        if (throttleEvaluationTimeout && throttleEvaluationTimeout >= 0) {
            clearTimeout(evaluationTimeoutInstance);
            evaluationTimeoutInstance = setTimeout(evaluateImmediate, throttleEvaluationTimeout);
        } else
            evaluateImmediate();
    }

    function evaluateImmediate() {
        if (_isBeingEvaluated) {
            // If the evaluation of a ko.computed causes side effects, it's possible that it will trigger its own re-evaluation.
            // This is not desirable (it's hard for a developer to realise a chain of dependencies might cause this, and they almost
            // certainly didn't intend infinite re-evaluations). So, for predictability, we simply prevent ko.computeds from causing
            // their own re-evaluation. Further discussion at https://github.com/SteveSanderson/knockout/pull/387
            return;
        }

        if (disposeWhen && disposeWhen()) {
            // See comment below about _suppressDisposalUntilDisposeWhenReturnsFalse
            if (!_suppressDisposalUntilDisposeWhenReturnsFalse) {
                dispose();
                _hasBeenEvaluated = true;
                return;
            }
        } else {
            // It just did return false, so we can stop suppressing now
            _suppressDisposalUntilDisposeWhenReturnsFalse = false;
        }

        _isBeingEvaluated = true;
        try {
            // Initially, we assume that none of the subscriptions are still being used (i.e., all are candidates for disposal).
            // Then, during evaluation, we cross off any that are in fact still being used.
            var disposalCandidates = _subscriptionsToDependencies, disposalCount = _dependenciesCount;
            ko.computedContext.begin({
                callback: function(subscribable, id) {
                    if (disposalCount && disposalCandidates[id]) {
                        // Don't want to dispose this subscription, as it's still being used
                        _subscriptionsToDependencies[id] = disposalCandidates[id];
                        ++_dependenciesCount;
                        disposalCandidates[id] = false;
                        --disposalCount;
                    } else {
                        // Brand new subscription - add it
                        addSubscriptionToDependency(subscribable, id);
                    }
                },
                target: dependentObservable,
                isInitial: !_dependenciesCount        // If we're evaluating when there are no previous dependencies, it must be the first time
            });

            _subscriptionsToDependencies = {};
            _dependenciesCount = 0;

            var newValue = evaluatorFunctionTarget ? readFunction.call(evaluatorFunctionTarget) : readFunction();

            // For each subscription no longer being used, remove it from the active subscriptions list and dispose it
            if (disposalCount) {
                ko.utils.objectForEach(disposalCandidates, function(id, toDispose) {
                    if (toDispose) {
                        toDispose.dispose();
                    }
                });
            }

            _hasBeenEvaluated = true;

            if (!dependentObservable['equalityComparer'] || !dependentObservable['equalityComparer'](_latestValue, newValue)) {
                dependentObservable["notifySubscribers"](_latestValue, "beforeChange");

                _latestValue = newValue;
                if (DEBUG) dependentObservable._latestValue = _latestValue;
                dependentObservable["notifySubscribers"](_latestValue);
            }
        } finally {
            ko.computedContext.end();
            _isBeingEvaluated = false;
        }

        if (!_dependenciesCount)
            dispose();
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
            if (!_hasBeenEvaluated)
                evaluateImmediate();
            ko.computedContext.registerDependency(dependentObservable);
            return _latestValue;
        }
    }

    function peek() {
        if (!_hasBeenEvaluated)
            evaluateImmediate();
        return _latestValue;
    }

    function isActive() {
        return !_hasBeenEvaluated || _dependenciesCount > 0;
    }

    // By here, "options" is always non-null
    var writeFunction = options["write"],
        disposeWhenNodeIsRemoved = options["disposeWhenNodeIsRemoved"] || options.disposeWhenNodeIsRemoved || null,
        disposeWhenOption = options["disposeWhen"] || options.disposeWhen,
        disposeWhen = disposeWhenOption,
        dispose = disposeAllSubscriptionsToDependencies,
        _subscriptionsToDependencies = {},
        _dependenciesCount = 0,
        evaluationTimeoutInstance = null;

    if (!evaluatorFunctionTarget)
        evaluatorFunctionTarget = options["owner"];

    dependentObservable.peek = peek;
    dependentObservable.getDependenciesCount = function () { return _dependenciesCount; };
    dependentObservable.hasDependency = function (subscribable) { return !!_subscriptionsToDependencies[subscribable._id]; };
    dependentObservable.hasWriteFunction = typeof options["write"] === "function";
    dependentObservable.dispose = function () { dispose(); };
    dependentObservable.isActive = isActive;

    ko.subscribable.call(dependentObservable);
    ko.utils.extend(dependentObservable, ko.dependentObservable['fn']);

    ko.exportProperty(dependentObservable, 'peek', dependentObservable.peek);
    ko.exportProperty(dependentObservable, 'dispose', dependentObservable.dispose);
    ko.exportProperty(dependentObservable, 'isActive', dependentObservable.isActive);
    ko.exportProperty(dependentObservable, 'getDependenciesCount', dependentObservable.getDependenciesCount);
    ko.exportProperty(dependentObservable, 'hasDependency', dependentObservable.hasDependency);

    // Add a "disposeWhen" callback that, on each evaluation, disposes if the node was removed without using ko.removeNode.
    if (disposeWhenNodeIsRemoved) {
        // Since this computed is associated with a DOM node, and we don't want to dispose the computed
        // until the DOM node is *removed* from the document (as opposed to never having been in the document),
        // we'll prevent disposal until "disposeWhen" first returns false.
        _suppressDisposalUntilDisposeWhenReturnsFalse = true;

        // Only watch for the node's disposal if the value really is a node. It might not be,
        // e.g., { disposeWhenNodeIsRemoved: true } can be used to opt into the "only dispose
        // after first false result" behaviour even if there's no specific node to watch. This
        // technique is intended for KO's internal use only and shouldn't be documented or used
        // by application code, as it's likely to change in a future version of KO.
        if (disposeWhenNodeIsRemoved.nodeType) {
            disposeWhen = function () {
                return !ko.utils.domNodeIsAttachedToDocument(disposeWhenNodeIsRemoved) || (disposeWhenOption && disposeWhenOption());
            };
        }
    }

    // Evaluate, unless deferEvaluation is true
    if (options['deferEvaluation'] !== true)
        evaluateImmediate();

    // Attach a DOM node disposal callback so that the computed will be proactively disposed as soon as the node is
    // removed using ko.removeNode. But skip if isActive is false (there will never be any dependencies to dispose).
    if (disposeWhenNodeIsRemoved && isActive()) {
        dispose = function() {
            ko.utils.domNodeDisposal.removeDisposeCallback(disposeWhenNodeIsRemoved, dispose);
            disposeAllSubscriptionsToDependencies();
        };
        ko.utils.domNodeDisposal.addDisposeCallback(disposeWhenNodeIsRemoved, dispose);
    }

    return dependentObservable;
};

ko.isComputed = function(instance) {
    return ko.hasPrototype(instance, ko.dependentObservable);
};

var protoProp = ko.observable.protoProperty; // == "__ko_proto__"
ko.dependentObservable[protoProp] = ko.observable;

ko.dependentObservable['fn'] = {
    "equalityComparer": valuesArePrimitiveAndEqual
};
ko.dependentObservable['fn'][protoProp] = ko.dependentObservable;

ko.exportSymbol('dependentObservable', ko.dependentObservable);
ko.exportSymbol('computed', ko.dependentObservable); // Make "ko.computed" an alias for "ko.dependentObservable"
ko.exportSymbol('isComputed', ko.isComputed);
