describe('Deferred Updates', function() {

    describe('Observable', function() {
        it('Should notify subscribers about only latest value', function () {
            var instance = new ko.observable().extend({deferred:true});
            var notifiedValues = [];
            instance.subscribe(function (value) {
                notifiedValues.push(value);
            });

            instance('A');
            instance('B');
            ko.processAllDeferredUpdates();

            expect(notifiedValues.length).toEqual(1);
            expect(notifiedValues[0]).toEqual('B');
        });
    });

    describe('Computed Observable', function() {
        it('Should get latest value when a deferred computed is dependent on another', function () {
            var underlyingObservable = new ko.observable(1);
            var computed1 = new ko.computed(function () { return underlyingObservable() + 1; }).extend({deferred:true});
            var computed2 = new ko.computed(function () { return computed1() + 1; }).extend({deferred:true});
            expect(computed2()).toEqual(3);

            underlyingObservable(11);
            expect(computed2()).toEqual(13);
        });

        it('Should invoke the read function (and trigger notifications) if the write function updates computed observables', function() {
            var observable = ko.observable();
            var computed = ko.computed({
                read: function() { return observable(); },
                write: function(value) { observable(value); }
            }).extend({deferred:true});
            var notifiedValue;
            computed.subscribe(function(value) {
                notifiedValue = value;
            });

            // Initially undefined
            expect(computed()).toEqual(undefined);
            expect(notifiedValue).toEqual(undefined);

            // Update computed and verify that correct notification happened
            computed("new value");
            expect(notifiedValue).toEqual("new value");
        });

        // don't run if disposed
    });

    describe('Observable Array change tracking', function() {
        it('Should provide correct changelist when multiple updates are merged into one notification', function() {
            var myArray = ko.observableArray(['Alpha', 'Beta']).extend({deferred:true}),
                changelist;

            myArray.subscribe(function(changes) {
                changelist = changes;
            }, null, 'arrayChange');

            myArray.push('Gamma');
            myArray.push('Delta');
            ko.processAllDeferredUpdates();
            expect(changelist).toEqual([
                { status : 'added', value : 'Gamma', index : 2 },
                { status : 'added', value : 'Delta', index : 3 }
            ]);

            changelist = undefined;
            myArray.shift();
            myArray.shift();
            ko.processAllDeferredUpdates();
            expect(changelist).toEqual([
                { status : 'deleted', value : 'Alpha', index : 0 },
                { status : 'deleted', value : 'Beta', index : 1 }
            ]);

            changelist = undefined;
            myArray.push('Epsilon');
            myArray.pop();
            ko.processAllDeferredUpdates();
            expect(changelist).toEqualOneOf([[], undefined]);
        });
    });

    describe('Recursive updates', function() {
        beforeEach(jasmine.prepareTestNode);

        it('Should be prevented for value binding on multiple select boxes', function() {

            testNode.innerHTML = "<select data-bind=\"options: ['abc','def','ghi'], value: x\"></select><select data-bind=\"options: ['xyz','uvw'], value: x\"></select>";
            var observable = ko.observable();
            expect(ko.tasks.makeProcessedCallback(function() {
                ko.applyBindings({ x: observable }, testNode);
            })).toThrowContaining('Too much recursion');
        });
    });

    describe("Bindings", function() {
        var testNode, origDeferUpdates;

        beforeEach(function() {
            testNode = document.createElement("div");
            testNode.id = "testNode";
            document.body.appendChild(testNode);
            jasmine.Clock.useMock();

            origDeferUpdates = ko.computed.deferUpdates;
            ko.computed.deferUpdates = true;
        });
        afterEach(function() {
            document.body.removeChild(testNode);
            ko.computed.deferUpdates = origDeferUpdates;
        });

        it("Should update bindings asynchronously", function() {
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

            // mutate; update should not be called yet
            observable("A");
            expect(updatePassedValues.length).toEqual(1);

            // mutate; update should not be called yet
            observable("B");
            expect(updatePassedValues.length).toEqual(1);

            jasmine.Clock.tick(100);
            // only the latest value should be used
            expect(initPassedValues.length).toEqual(1);
            expect(updatePassedValues.length).toEqual(2);
            expect(updatePassedValues[1]).toEqual("B");
        });

        it("Should update template asynchronously", function() {
            var observable = new ko.observable();
            var initPassedValues = [], updatePassedValues = [];
            ko.bindingHandlers.test = {
                init: function (element, valueAccessor) { initPassedValues.push(valueAccessor()); },
                update: function (element, valueAccessor) { updatePassedValues.push(valueAccessor()); }
            };
            testNode.innerHTML = "<div data-bind='template: {data: myObservable}'><div data-bind='test: $data'></div></div>";

            ko.applyBindings({ myObservable: observable }, testNode);

            expect(initPassedValues.length).toEqual(1);
            expect(updatePassedValues.length).toEqual(1);
            expect(initPassedValues[0]).toEqual(undefined);
            expect(updatePassedValues[0]).toEqual(undefined);

            // mutate; template should not re-evaluated yet
            observable("A");
            expect(initPassedValues.length).toEqual(1);
            expect(updatePassedValues.length).toEqual(1);

            // mutate again; template should not re-evaluated yet
            observable("B");
            expect(initPassedValues.length).toEqual(1);
            expect(updatePassedValues.length).toEqual(1);

            jasmine.Clock.tick(10);
            // only the latest value should be used
            expect(initPassedValues.length).toEqual(2);
            expect(updatePassedValues.length).toEqual(2);
            expect(updatePassedValues[1]).toEqual("B");
        });

        it("Should update 'foreach' items asynchronously", function() {
            var observable = new ko.observableArray(["A"]);
            var initPassedValues = [], updatePassedValues = [];
            ko.bindingHandlers.test = {
                init: function (element, valueAccessor) { initPassedValues.push(valueAccessor()); },
                update: function (element, valueAccessor) { updatePassedValues.push(valueAccessor()); }
            };
            testNode.innerHTML = "<div data-bind='foreach: {data: myObservables}'><div data-bind='test: $data'></div></div>";

            ko.applyBindings({ myObservables: observable }, testNode);

            expect(initPassedValues.length).toEqual(1);
            expect(updatePassedValues.length).toEqual(1);
            expect(initPassedValues[0]).toEqual("A");
            expect(updatePassedValues[0]).toEqual("A");

            // mutate; template should not re-evaluated yet
            observable(["B"]);
            expect(initPassedValues.length).toEqual(1);
            expect(updatePassedValues.length).toEqual(1);

            // mutate again; template should not re-evaluated yet
            observable(["C"]);
            expect(initPassedValues.length).toEqual(1);
            expect(updatePassedValues.length).toEqual(1);

            jasmine.Clock.tick(10);
            // only the latest value should be used
            expect(initPassedValues.length).toEqual(2);
            expect(updatePassedValues.length).toEqual(2);
            expect(initPassedValues[1]).toEqual("C");
            expect(updatePassedValues[1]).toEqual("C");
        });
    });
});
