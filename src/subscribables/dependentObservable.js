ko.computed = ko.dependentObservable = function (evaluatorFunctionOrOptions, evaluatorFunctionTarget, options) {
    var _latestValue,
        _needsEvaluation = true,
        _isBeingEvaluated = false,
        _suppressDisposalUntilDisposeWhenReturnsFalse = false,
        _isDisposed = false,
        readFunction = evaluatorFunctionOrOptions,
        pure = false,
        isSleeping = false;

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

    function addDependencyTracking(id, subscription) {
        dependencyTracking[id] = subscription;
        subscription._order = dependenciesCount++;
    }

    function haveDependenciesChanged() {
        for (var id in dependencyTracking) {
            if (dependencyTracking.hasOwnProperty(id)) {
                if (dependencyTracking[id]._target.hasChanged(dependencyTracking[id]._version)) {
                    return true;
                }
            }
        }
        return false;
    }

    function disposeComputed() {
        if (!isSleeping && dependencyTracking) {
            ko.utils.objectForEach(dependencyTracking, function (id, subscription) {
                subscription.dispose();
            });
        }
        dependencyTracking = null;
        dependenciesCount = 0;
        _isDisposed = true;
        _needsEvaluation = false;
        isSleeping = false;
    }

    function evaluatePossiblyAsync() {
        var throttleEvaluationTimeout = dependentObservable['throttleEvaluation'];
        if (throttleEvaluationTimeout && throttleEvaluationTimeout >= 0) {
            clearTimeout(evaluationTimeoutInstance);
            evaluationTimeoutInstance = setTimeout(function () {
                evaluateImmediate();
            }, throttleEvaluationTimeout);
        } else if (dependentObservable._evalRateLimited) {
            dependentObservable._evalRateLimited();
        } else {
            evaluateImmediate();
        }
    }

    function evaluateImmediate(suppressChangeNotification) {
        if (_isBeingEvaluated) {
            if (pure) {
                throw Error("A 'pure' computed must not be called recursively");
            }
            // If the evaluation of a ko.computed causes side effects, it's possible that it will trigger its own re-evaluation.
            // This is not desirable (it's hard for a developer to realise a chain of dependencies might cause this, and they almost
            // certainly didn't intend infinite re-evaluations). So, for predictability, we simply prevent ko.computeds from causing
            // their own re-evaluation. Further discussion at https://github.com/SteveSanderson/knockout/pull/387
            return;
        }

        // Do not evaluate (and possibly capture new dependencies) if disposed
        if (_isDisposed) {
            return;
        }

        if (disposeWhen && disposeWhen()) {
            // See comment below about _suppressDisposalUntilDisposeWhenReturnsFalse
            if (!_suppressDisposalUntilDisposeWhenReturnsFalse) {
                dispose();
                return;
            }
        } else {
            // It just did return false, so we can stop suppressing now
            _suppressDisposalUntilDisposeWhenReturnsFalse = false;
        }

        // Check if any dependencies have changed
        if (pure && suppressChangeNotification && dependenciesCount && !haveDependenciesChanged()) {
            _needsEvaluation = false;
            return;
        }

        _isBeingEvaluated = true;

        try {
            if (isSleeping) {
                ko.dependencyDetection.begin({
                    callback: function (subscribable, id) {
                        if (!_isDisposed && !dependencyTracking[id]) {
                            addDependencyTracking(id, { _target: subscribable, _version: subscribable.getVersion() });
                        }
                    },
                    computed: dependentObservable,
                    isInitial: undefined
                });
            } else {
                // Initially, we assume that none of the subscriptions are still being used (i.e., all are candidates for disposal).
                // Then, during evaluation, we cross off any that are in fact still being used.
                var disposalCandidates = dependencyTracking, disposalCount = dependenciesCount;
                ko.dependencyDetection.begin({
                    callback: function(subscribable, id) {
                        if (!_isDisposed && !dependencyTracking[id]) {
                            var subscription;
                            if (disposalCount && disposalCandidates[id]) {
                                // Don't want to dispose this subscription, as it's still being used
                                subscription = disposalCandidates[id];
                                delete disposalCandidates[id];
                                --disposalCount;
                            } else {
                                // Brand new subscription - add it
                                subscription = subscribable.subscribe(evaluatePossiblyAsync);
                            }
                            addDependencyTracking(id, subscription);
                            if (pure) {
                                subscription._version = subscribable.getVersion();
                            }
                        }
                    },
                    computed: dependentObservable,
                    isInitial: pure ? undefined : !dependenciesCount        // If we're evaluating when there are no previous dependencies, it must be the first time
                });
            }
            dependencyTracking = {};
            dependenciesCount = 0;

            try {
                var newValue = evaluatorFunctionTarget ? readFunction.call(evaluatorFunctionTarget) : readFunction();

            } finally {
                ko.dependencyDetection.end();

                if (disposalCount) {
                    // For each subscription no longer being used, remove it from the active subscriptions list and dispose it
                    ko.utils.objectForEach(disposalCandidates, function(id, toDispose) {
                        toDispose.dispose();
                    });
                }

                _needsEvaluation = false;
            }

            if (dependentObservable.isDifferent(_latestValue, newValue)) {
                if (!isSleeping) {
                    dependentObservable["notifySubscribers"](_latestValue, "beforeChange");
                }

                _latestValue = newValue;
                if (DEBUG) dependentObservable._latestValue = _latestValue;
                dependentObservable.incrementVersion();

                if (!isSleeping && !suppressChangeNotification) {
                    dependentObservable["notifySubscribers"](_latestValue);
                }
            }
        } finally {
            _isBeingEvaluated = false;
        }

        if (!dependenciesCount)
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
            if (isSleeping || _needsEvaluation)
                evaluateImmediate(true /* suppressChangeNotification */);
            ko.dependencyDetection.registerDependency(dependentObservable);
            return _latestValue;
        }
    }

    function peek() {
        // Peek won't re-evaluate, except while the computed is sleeping or to get the initial value when "deferEvaluation" is set.
        // Those are the only times that both of these conditions will be satisfied.
        if (isSleeping || (_needsEvaluation && !dependenciesCount))
            evaluateImmediate(true /* suppressChangeNotification */);
        return _latestValue;
    }

    function isActive() {
        return _needsEvaluation || dependenciesCount > 0;
    }

    // By here, "options" is always non-null
    var writeFunction = options["write"],
        disposeWhenNodeIsRemoved = options["disposeWhenNodeIsRemoved"] || options.disposeWhenNodeIsRemoved || null,
        disposeWhenOption = options["disposeWhen"] || options.disposeWhen,
        disposeWhen = disposeWhenOption,
        dispose = disposeComputed,
        dependencyTracking = {},
        dependenciesCount = 0,
        evaluationTimeoutInstance = null;

    if (!evaluatorFunctionTarget)
        evaluatorFunctionTarget = options["owner"];

    ko.subscribable.call(dependentObservable);
    ko.utils.setPrototypeOfOrExtend(dependentObservable, ko.dependentObservable['fn']);

    dependentObservable.peek = peek;
    dependentObservable.getDependenciesCount = function () { return dependenciesCount; };
    dependentObservable.hasWriteFunction = typeof options["write"] === "function";
    dependentObservable.dispose = function () { dispose(); };
    dependentObservable.isActive = isActive;

    // Replace the limit function with one that delays evaluation as well.
    var originalLimit = dependentObservable.limit;
    dependentObservable.limit = function(limitFunction) {
        originalLimit.call(dependentObservable, limitFunction);
        dependentObservable._evalRateLimited = function() {
            dependentObservable._rateLimitedBeforeChange(_latestValue);

            _needsEvaluation = true;    // Mark as dirty

            // Pass the observable to the rate-limit code, which will access it when
            // it's time to do the notification.
            dependentObservable._rateLimitedChange(dependentObservable);
        }
    };

    if (options['pure']) {
        pure = true;
        isSleeping = true;     // Starts off sleeping; will awake on the first subscription

        dependentObservable.beforeSubscriptionAdd = function () {
            // If asleep, wake up the computed and evaluate to save the current value.
            if (isSleeping) {
                if (dependenciesCount) {
                    // First put the dependencies in order
                    var dependeciesOrdered = [];
                    ko.utils.objectForEach(dependencyTracking, function (id, dependency) {
                        dependeciesOrdered[dependency._order] = dependency;
                        dependency._id = id;
                    });
                    // Next, subscribe to each one
                    ko.utils.arrayForEach(dependeciesOrdered, function(dependency) {
                        var subscription = dependency._target.subscribe(evaluatePossiblyAsync);
                        subscription._version = dependency._version;
                        subscription._order = dependency._order;
                        dependencyTracking[dependency._id] = subscription;
                    });
                }
                isSleeping = false;
                evaluateImmediate(true /* suppressChangeNotification */);
            }
        };

        dependentObservable.afterSubscriptionRemove = function () {
            // When the last subscription is disposed, put the computed to sleep by disposing
            // all subscriptions to its dependencies.
            if (!dependentObservable.getSubscriptionsCount()) {
                ko.utils.objectForEach(dependencyTracking, function (id, subscription) {
                    dependencyTracking[id] = { _target: subscription._target, _version: subscription._version, _order: subscription._order };
                    subscription.dispose();
                });
                isSleeping = true;
            }
        };

        // Because a pure computed is not automatically updated while it is sleeping, we can't
        // simply check the version number. Instead, if the version hasn't changed, we call
        // evaluateImmediate first, which will check if any of the dependencies have changed
        // and conditionally re-evaluate the computed observable.
        dependentObservable._originalHasChanged = dependentObservable.hasChanged;
        dependentObservable.hasChanged = function(versionToCheck) {
            if (!dependentObservable._originalHasChanged(versionToCheck)) {
                if (isSleeping) {
                    evaluateImmediate();
                    return dependentObservable._originalHasChanged(versionToCheck);
                } else {
                    return false;
                }
            }
            return true;
        };
    } else if (options['deferEvaluation']) {
        // This will force a computed with deferEvaluation to evaluate when the first subscriptions is registered.
        dependentObservable.beforeSubscriptionAdd = function () {
            peek();
            delete dependentObservable.beforeSubscriptionAdd;
        };
    }

    ko.exportProperty(dependentObservable, 'peek', dependentObservable.peek);
    ko.exportProperty(dependentObservable, 'dispose', dependentObservable.dispose);
    ko.exportProperty(dependentObservable, 'isActive', dependentObservable.isActive);
    ko.exportProperty(dependentObservable, 'getDependenciesCount', dependentObservable.getDependenciesCount);

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

    // Evaluate, unless sleeping or deferEvaluation is true
    if (!isSleeping && !options['deferEvaluation'])
        evaluateImmediate();

    // Attach a DOM node disposal callback so that the computed will be proactively disposed as soon as the node is
    // removed using ko.removeNode. But skip if isActive is false (there will never be any dependencies to dispose).
    if (disposeWhenNodeIsRemoved && isActive() && disposeWhenNodeIsRemoved.nodeType) {
        dispose = function() {
            ko.utils.domNodeDisposal.removeDisposeCallback(disposeWhenNodeIsRemoved, dispose);
            disposeComputed();
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

// Note that for browsers that don't support proto assignment, the
// inheritance chain is created manually in the ko.dependentObservable constructor
if (ko.utils.canSetPrototype) {
    ko.utils.setPrototypeOf(ko.dependentObservable['fn'], ko.subscribable['fn']);
}

ko.exportSymbol('dependentObservable', ko.dependentObservable);
ko.exportSymbol('computed', ko.dependentObservable); // Make "ko.computed" an alias for "ko.dependentObservable"
ko.exportSymbol('isComputed', ko.isComputed);

ko.pureComputed = function (evaluatorFunctionOrOptions, evaluatorFunctionTarget) {
    if (typeof evaluatorFunctionOrOptions === 'function') {
        return ko.computed(evaluatorFunctionOrOptions, evaluatorFunctionTarget, {'pure':true});
    } else {
        evaluatorFunctionOrOptions = ko.utils.extend({}, evaluatorFunctionOrOptions);   // make a copy of the parameter object
        evaluatorFunctionOrOptions['pure'] = true;
        return ko.computed(evaluatorFunctionOrOptions, evaluatorFunctionTarget);
    }
}
ko.exportSymbol('pureComputed', ko.pureComputed);
