describe('Binding dependencies', function() {
    beforeEach(function () {
        ko.bindingProvider.instance.clearCache();
    });
    beforeEach(jasmine.prepareTestNode);

    it('If the binding handler depends on an observable, invokes the init handler once and the update handler whenever a new value is available', function () {
        var observable = new ko.observable();
        var initPassedValues = [], updatePassedValues = [];
        ko.bindingHandlers.test = {
            init: function (element, valueAccessor) { initPassedValues.push(valueAccessor()()); },
            update: function (element, valueAccessor) { updatePassedValues.push(valueAccessor()()); }
        };
        testNode.innerHTML = "<div data-bind='test: myObservable'></div>";

        ko.applyBindings({ myObservable: observable }, testNode);
        expect(initPassedValues.length).toEqual(1);
        expect(updatePassedValues.length).toEqual(1);
        expect(initPassedValues[0]).toEqual(undefined);
        expect(updatePassedValues[0]).toEqual(undefined);

        observable("A");
        expect(initPassedValues.length).toEqual(1);
        expect(updatePassedValues.length).toEqual(2);
        expect(updatePassedValues[1]).toEqual("A");
    });

    it('If the associated DOM element was removed by KO, handler subscriptions are disposed immediately', function () {
        var observable = new ko.observable("A");
        ko.bindingHandlers.anyHandler = {
            update: function (element, valueAccessor) { valueAccessor(); }
        };
        testNode.innerHTML = "<div data-bind='anyHandler: myObservable()'></div>";
        ko.applyBindings({ myObservable: observable }, testNode);

        expect(observable.getSubscriptionsCount()).toEqual(1);

        ko.cleanAndRemoveNode(testNode);

        expect(observable.getSubscriptionsCount()).toEqual(0);
    });

    it('If the associated DOM element was removed independently of KO, handler subscriptions are disposed on the next evaluation', function () {
        var observable = new ko.observable("A");
        ko.bindingHandlers.anyHandler = {
            update: function (element, valueAccessor) { valueAccessor(); }
        };
        testNode.innerHTML = "<div data-bind='anyHandler: myObservable()'></div>";
        ko.applyBindings({ myObservable: observable }, testNode);

        expect(observable.getSubscriptionsCount()).toEqual(1);

        testNode.parentNode.removeChild(testNode);
        observable("B"); // Force re-evaluation

        expect(observable.getSubscriptionsCount()).toEqual(0);
    });

    it('If the binding attribute involves an observable, re-invokes the bindings if the observable notifies a change', function () {
        var observable = new ko.observable({ message: "hello" });
        var passedValues = [];
        ko.bindingHandlers.test = { update: function (element, valueAccessor) { passedValues.push(valueAccessor()); } };
        testNode.innerHTML = "<div data-bind='test: myObservable().message'></div>";

        ko.applyBindings({ myObservable: observable }, testNode);
        expect(passedValues.length).toEqual(1);
        expect(passedValues[0]).toEqual("hello");

        observable({ message: "goodbye" });
        expect(passedValues.length).toEqual(2);
        expect(passedValues[1]).toEqual("goodbye");
    });

    it('Should be able to update bindings (including callbacks) using an observable view model', function() {
        testNode.innerHTML = "<input data-bind='value:someProp' />";
        var input = testNode.childNodes[0], vm = ko.observable({ someProp: 'My prop value' });
        ko.applyBindings(vm, input);

        expect(input.value).toEqual("My prop value");

        // a change to the input value should be written to the model
        input.value = "some user-entered value";
        ko.utils.triggerEvent(input, "change");
        expect(vm().someProp).toEqual("some user-entered value");

        // set the view-model to a new object
        vm({ someProp: ko.observable('My new prop value') });
        expect(input.value).toEqual("My new prop value");

        // a change to the input value should be written to the new model
        input.value = "some new user-entered value";
        ko.utils.triggerEvent(input, "change");
        expect(vm().someProp()).toEqual("some new user-entered value");

        // clear the element and the view-model (shouldn't be any errors)
        testNode.innerHTML = "";
        vm(null);
    });

    it('Updates to an observable view model should update all child contexts (uncluding values copied from the parent)', function() {
        ko.bindingHandlers.setChildContext = {
            flags: ko.bindingFlags.contentBind,
            init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                ko.applyBindingsToDescendants(
                    bindingContext.createChildContext(function() { return ko.utils.unwrapObservable(valueAccessor()) }),
                    element);
            }
        };

        testNode.innerHTML = "<div data-bind='setChildContext:obj1'><span data-bind='text:prop1'></span><span data-bind='text:$root.prop2'></span></div>";
        var vm = ko.observable({obj1: {prop1: "First "}, prop2: "view model"});
        ko.applyBindings(vm, testNode);
        expect(testNode).toContainText("First view model");

        // change view model to new object
        vm({obj1: {prop1: "Second view "}, prop2: "model"});
        expect(testNode).toContainText("Second view model");

        // change it again
        vm({obj1: {prop1: "Third view model"}, prop2: ""});
        expect(testNode).toContainText("Third view model");
    });

    it('Updates to an observable view model should update all extended contexts (uncluding values copied from the parent)', function() {
        ko.bindingHandlers.withProperties = {
            flags: ko.bindingFlags.contentBind,
            init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                var innerBindingContext = bindingContext.extend(valueAccessor);
                ko.applyBindingsToDescendants(innerBindingContext, element);
            }
        };

        testNode.innerHTML = "<div data-bind='withProperties: obj1'><span data-bind='text:prop1'></span><span data-bind='text:prop2'></span></div>";
        var vm = ko.observable({obj1: {prop1: "First "}, prop2: "view model"});
        ko.applyBindings(vm, testNode);
        expect(testNode).toContainText("First view model");

        // ch ange view model to new object
        vm({obj1: {prop1: "Second view "}, prop2: "model"});
        expect(testNode).toContainText("Second view model");

        // change it again
        vm({obj1: {prop1: "Third view model"}, prop2: ""});
        expect(testNode).toContainText("Third view model");
    });

    it('Should be able to get all updates to observables in both init and update', function() {
        var lastBoundValueInit, lastBoundValueUpdate;
        ko.bindingHandlers.testInit = {
            init: function(element, valueAccessor) {
                ko.dependentObservable(function() {
                    lastBoundValueInit = ko.utils.unwrapObservable(valueAccessor());
                });
            }
        };
        ko.bindingHandlers.testUpdate = {
            update: function(element, valueAccessor) {
                lastBoundValueUpdate = ko.utils.unwrapObservable(valueAccessor());
            }
        };
        testNode.innerHTML = "<div data-bind='testInit: myProp()'></div><div data-bind='testUpdate: myProp()'></div>";
        var vm = ko.observable({ myProp: ko.observable("initial value") });
        ko.applyBindings(vm, testNode);
        expect(lastBoundValueInit).toEqual("initial value");
        expect(lastBoundValueUpdate).toEqual("initial value");

        // update value of observable
        vm().myProp("second value");
        expect(lastBoundValueInit).toEqual("second value");
        expect(lastBoundValueUpdate).toEqual("second value");

        // update value of observable to another observable
        vm().myProp(ko.observable("third value"));
        expect(lastBoundValueInit).toEqual("third value");
        expect(lastBoundValueUpdate).toEqual("third value");

        // update view model with brand-new property
        vm({ myProp: function() {return "fourth value"; }});
        expect(lastBoundValueInit).toEqual("fourth value");
        expect(lastBoundValueUpdate).toEqual("fourth value");
    });

    it('Should not reinvoke init for notifications triggered during first evaluation', function () {
        var observable = ko.observable('A');
        var initCalls = 0;
        ko.bindingHandlers.test = {
            init: function (element, valueAccessor) {
                initCalls++;

                var value = valueAccessor();

                // Read the observable (to set up a dependency on it), and then also write to it (to trigger re-eval of bindings)
                // This logic probably wouldn't be in init but might be indirectly invoked by init
                value();
                value('B');
            }
        };
        testNode.innerHTML = "<div data-bind='test: myObservable'></div>";

        ko.applyBindings({ myObservable: observable }, testNode);
        expect(initCalls).toEqual(1);
    });

    it('Should not run update before init, even if an associated observable is updated by a different binding before init', function() {
        // Represents the "theoretical issue" posed by Ryan in comments on https://github.com/SteveSanderson/knockout/pull/193

        var observable = ko.observable('A'), hasInittedSecondBinding = false, hasUpdatedSecondBinding = false;
        ko.bindingHandlers.test1 = {
            init: function(element, valueAccessor) {
                // Read the observable (to set up a dependency on it), and then also write to it (to trigger re-eval of bindings)
                // This logic probably wouldn't be in init but might be indirectly invoked by init
                var value = valueAccessor();
                value();
                value('B');
            }
        }
        ko.bindingHandlers.test2 = {
            init: function() {
                hasInittedSecondBinding = true;
            },
            update: function() {
                if (!hasInittedSecondBinding)
                    throw new Error("Called 'update' before 'init'");
                hasUpdatedSecondBinding = true;
            }
        }
        testNode.innerHTML = "<div data-bind='test1: myObservable, test2: true'></div>";

        ko.applyBindings({ myObservable: observable }, testNode);
        expect(hasUpdatedSecondBinding).toEqual(true);
    });

    it('Should not subscribe to observables accessed in init function if binding are run independently', function() {
        var observable = ko.observable('A');
        ko.bindingHandlers.test = {
            init: function(element, valueAccessor) {
                var value = valueAccessor();
                value();
            }
        }
        testNode.innerHTML = "<div data-bind='if: true'><div data-bind='test: myObservable'></div></div>";

        ko.applyBindings({ myObservable: observable }, testNode, {independentBindings: true});
        expect(observable.getSubscriptionsCount()).toEqual(0);
    });

    it('Should not run updates for all bindings if only one needs to run if binding are run independently', function() {
        var observable = ko.observable('A'), updateCount1 = 0, updateCount2 = 0;
        ko.bindingHandlers.test1 = {
            update: function(element, valueAccessor) {
                valueAccessor()();  // access value to create a subscription
                updateCount1++;
            }
        };
        ko.bindingHandlers.test2 = {
            update: function() {
                updateCount2++;
            }
        };
        testNode.innerHTML = "<div data-bind='test1: myObservable, test2: true'></div>";

        ko.applyBindings({ myObservable: observable }, testNode, {independentBindings: true});
        expect(updateCount1).toEqual(1);
        expect(updateCount2).toEqual(1);

        // update the observable and check that only the first binding was updated
        observable('B');
        expect(updateCount1).toEqual(2);
        expect(updateCount2).toEqual(1);
    });

    it('Update to an independent (needed) binding should also update the dependent binding (independent mode)', function() {
        var observable = ko.observable('A'), updateCount1 = 0, updateCount2 = 0;
        ko.bindingHandlers.test1 = {
            update: function(element, valueAccessor) {
                valueAccessor()();  // access value to create a subscription
                updateCount1++;
            }
        };
        ko.bindingHandlers.test2 = {
            needs: 'test1',
            update: function() {
                updateCount2++;
            }
        };
        testNode.innerHTML = "<div data-bind='test1: myObservable, test2: true'></div>";

        ko.applyBindings({ myObservable: observable }, testNode, {independentBindings: true});
        expect(updateCount1).toEqual(1);
        expect(updateCount2).toEqual(1);

        // update the observable and check that both bindings were updated
        observable('B');
        expect(updateCount1).toEqual(2);
        expect(updateCount2).toEqual(2);
    });

    it('Binding should be able to return a subscribable value so dependent bindings can be updated (independent mode)', function() {
        var observable = ko.observable('A'), updateCount1 = 0, updateCount2 = 0;
        ko.bindingHandlers.test1 = {
            update: function(element, valueAccessor) {
                updateCount1++;
                return ko.dependentObservable(function() {
                    valueAccessor()();  // access value to create a subscription
                }, null, {disposeWhenNodeIsRemoved: element});
            }
        };
        ko.bindingHandlers.test2 = {
            needs: 'test1',
            update: function() {
                updateCount2++;
            }
        };
        testNode.innerHTML = "<div data-bind='test1: myObservable, test2: true'></div>";

        ko.applyBindings({ myObservable: observable }, testNode, {independentBindings: true});
        observable('B');
        expect(updateCount1).toEqual(1);    // update happened inside inner dependentObservable so count isn't updated
        expect(updateCount2).toEqual(2);
    });

    it('Binding should be able to return a subscribable value from \'init\' so dependent bindings can be updated (independent mode)', function() {
        var observable = ko.observable('A'), updateCount1 = 0, updateCount2 = 0;
        ko.bindingHandlers.test1 = {
            init: function(element, valueAccessor) {
                return { subscribable: ko.dependentObservable(function() {
                    updateCount1++;
                    valueAccessor()();  // access value to create a subscription
                }, null, {disposeWhenNodeIsRemoved: element}) };
            }
        };
        ko.bindingHandlers.test2 = {
            needs: 'test1',
            update: function() {
                updateCount2++;
            }
        };
        testNode.innerHTML = "<div data-bind='test1: myObservable, test2: true'></div>";

        ko.applyBindings({ myObservable: observable }, testNode, {independentBindings: true});
        observable('B');
        expect(updateCount1).toEqual(2);
        expect(updateCount2).toEqual(2);
    });

    it('Should update all bindings if a extra binding unwraps an observable (only in dependent mode)', function() {
        delete ko.bindingHandlers.nonexistentHandler;
        var countUpdates = 0, observable = ko.observable(1);
        ko.bindingHandlers.existentHandler = {
            update: function() { countUpdates++; }
        }
        testNode.innerHTML = "<div data-bind='existentHandler: true, nonexistentHandler: myObservable()'></div>";

        // dependent mode: should update
        ko.applyBindings({ myObservable: observable }, testNode, {independentBindings: false});
        expect(countUpdates).toEqual(1);
        observable(3);
        expect(countUpdates).toEqual(2);

        // reset
        countUpdates = 0;
        ko.cleanNode(testNode);
        ko.bindingProvider.instance.clearCache();

        // independent mode: should not update
        ko.applyBindings({ myObservable: observable }, testNode, {independentBindings: true});
        expect(countUpdates).toEqual(1);
        observable(2);
        expect(countUpdates).toEqual(1);
    });

    // TODO - This is a spec that succeeds in base Knockout, but fails with this update
    xit('Should access latest value from extra binding when normal binding is updated', function() {
        delete ko.bindingHandlers.nonexistentHandler;
        var observable = ko.observable(), updateValue;
        var vm = {myObservable: observable, myNonObservable: "first value"};
        ko.bindingHandlers.existentHandler = {
            update: function(element, valueAccessor, allBindingsAccessor) {
                valueAccessor()();  // create dependency
                updateValue = allBindingsAccessor().nonexistentHandler;
            }
        }
        testNode.innerHTML = "<div data-bind='existentHandler: myObservable, nonexistentHandler: myNonObservable'></div>";

        ko.applyBindings(vm, testNode);
        expect(updateValue).toEqual("first value");
        vm.myNonObservable = "second value";
        observable.notifySubscribers();
        expect(updateValue).toEqual("second value");
    });

    it('Should process bindings in a certain order based on their type and dependencies', function() {
        var lastBindingIndex = 0;
        function checkOrder(bindingIndex) {
            if (bindingIndex < lastBindingIndex)
                throw new Error("handler " + bindingIndex + " called after " + lastBindingIndex);
            lastBindingIndex = bindingIndex;
        }
        ko.bindingHandlers.test1 = { flags: 0, update: function() { checkOrder(1); } };
        ko.bindingHandlers.test2 = { flags: ko.bindingFlags.contentSet, update: function() { checkOrder(2); } };
        ko.bindingHandlers.test3 = { flags: ko.bindingFlags.contentBind, update: function() { checkOrder(3); } };
        ko.bindingHandlers.test4 = { flags: ko.bindingFlags.contentUpdate, update: function() { checkOrder(4); } };
        ko.bindingHandlers.test5 = { update: function() { checkOrder(5); } };

        testNode.innerHTML = "<div data-bind='test5: true, test4: true, test3: true, test2: true, test1: true, needs: {test2: \"test1\", test5: \"test4\"}'></div>";

        ko.applyBindings(null, testNode);
    });

    it('Should not be able to set recursive dependencies', function() {
        ko.bindingHandlers.test1 = { };
        ko.bindingHandlers.test2 = { };

        testNode.innerHTML = "<div data-bind='test1: true, test2: true, needs: {test2: \"test1\", test1: \"test2\"}'></div>";

        var didThrow = false;
        try { ko.applyBindings(null, testNode) }
        catch(ex) { didThrow = true; expect(ex.message).toContain('recursive') }
        expect(didThrow).toEqual(true);
    });

    it('Should not be able to set dependencies that conflict with the order set by flags', function() {
        ko.bindingHandlers.test1 = { flags: ko.bindingFlags.contentSet };
        ko.bindingHandlers.test2 = { flags: ko.bindingFlags.contentUpdate };

        testNode.innerHTML = "<div data-bind='test1: true, test2: true, needs: {test1: \"test2\"}'></div>";

        var didThrow = false;
        try { ko.applyBindings(null, testNode) }
        catch(ex) { didThrow = true; expect(ex.message).toContain('ordering') }
        expect(didThrow).toEqual(true);
    });
});

