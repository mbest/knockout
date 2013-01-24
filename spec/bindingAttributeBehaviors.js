describe('Binding attribute syntax', function() {
    beforeEach: function () {
        ko.bindingProvider.instance.clearCache();
    });
    beforeEach(jasmine.prepareTestNode);

    it('applyBindings should accept no parameters and then act on document.body with undefined model', function() {
        var didInit = false;
        ko.bindingHandlers.test = {
            init: function (element, valueAccessor, allBindingsAccessor, viewModel) {
                expect(element.id).toEqual("testElement");
                expect(viewModel).toEqual(undefined);
                didInit = true;
            }
        };
        testNode.innerHTML = "<div id='testElement' data-bind='test:123'></div>";
        ko.applyBindings();
        expect(didInit).toEqual(true);

        // Just to avoid interfering with other specs:
        ko.utils.domData.clear(document.body);
    });

    it('applyBindings should accept one parameter and then act on document.body with parameter as model', function() {
        var didInit = false;
        var suppliedViewModel = {};
        ko.bindingHandlers.test = {
            init: function (element, valueAccessor, allBindingsAccessor, viewModel) {
                expect(element.id).toEqual("testElement");
                expect(viewModel).toEqual(suppliedViewModel);
                didInit = true;
            }
        };
        testNode.innerHTML = "<div id='testElement' data-bind='test:123'></div>";
        ko.applyBindings(suppliedViewModel);
        expect(didInit).toEqual(true);

        // Just to avoid interfering with other specs:
        ko.utils.domData.clear(document.body);
    });

    it('applyBindings should accept two parameters and then act on second param as DOM node with first param as model', function() {
        var didInit = false;
        var suppliedViewModel = {};
        ko.bindingHandlers.test = {
            init: function (element, valueAccessor, allBindingsAccessor, viewModel) {
                expect(element.id).toEqual("testElement");
                expect(viewModel).toEqual(suppliedViewModel);
                didInit = true;
            }
        };
        testNode.innerHTML = "<div id='testElement' data-bind='test:123'></div>";
        var shouldNotMatchNode = document.createElement("DIV");
        shouldNotMatchNode.innerHTML = "<div id='shouldNotMatchThisElement' data-bind='test:123'></div>";
        document.body.appendChild(shouldNotMatchNode);
        try {
            ko.applyBindings(suppliedViewModel, testNode);
            expect(didInit).toEqual(true);
        } finally {
            shouldNotMatchNode.parentNode.removeChild(shouldNotMatchNode);
        }
    });

    it('Should tolerate empty or only white-space binding strings', function() {
        testNode.innerHTML = "<div data-bind=''></div><div data-bind='   '></div>";
        ko.applyBindings(null, testNode); // No exception means success
    });

    it('Should tolerate whitespace and nonexistent handlers', function () {
        testNode.innerHTML = "<div data-bind=' nonexistentHandler : \"Hello\" '></div>";
        ko.applyBindings(null, testNode); // No exception means success
    });

    it('Should tolerate arbitrary literals as the values for a handler', function () {
        testNode.innerHTML = "<div data-bind='stringLiteral: \"hello\", numberLiteral: 123, boolLiteral: true, objectLiteral: {}, functionLiteral: function() { }'></div>";
        ko.applyBindings(null, testNode); // No exception means success
    });

    it('Should tolerate wacky IE conditional comments', function() {
        // Represents issue https://github.com/SteveSanderson/knockout/issues/186. Would fail on IE9, but work on earlier IE versions.
        testNode.innerHTML = "<div><!--[if IE]><!-->Hello<!--<![endif]--></div>";
        ko.applyBindings(null, testNode); // No exception means success
    });

    it('Should invoke registered handlers\' init() then update() methods passing binding data', function () {
        var methodsInvoked = [];
        ko.bindingHandlers.test = {
            init: function (element, valueAccessor, allBindingsAccessor) {
                methodsInvoked.push("init");
                expect(element.id).toEqual("testElement");
                expect(valueAccessor()).toEqual("Hello");
                expect(allBindingsAccessor().another).toEqual(123);
            },
            update: function (element, valueAccessor, allBindingsAccessor) {
                methodsInvoked.push("update");
                expect(element.id).toEqual("testElement");
                expect(valueAccessor()).toEqual("Hello");
                expect(allBindingsAccessor().another).toEqual(123);
            }
        }
        testNode.innerHTML = "<div id='testElement' data-bind='test:\"Hello\", another:123'></div>";
        ko.applyBindings(null, testNode);
        expect(methodsInvoked.length).toEqual(2);
        expect(methodsInvoked[0]).toEqual("init");
        expect(methodsInvoked[1]).toEqual("update");
    });

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

    it('Should be able to use $element in binding value', function() {
        testNode.innerHTML = "<div data-bind='text: $element.tagName'></div>";
        ko.applyBindings({}, testNode);
        expect(testNode).toContainText("DIV");
    });

    it('Should be able to use $context in binding value to refer to the context object', function() {
        testNode.innerHTML = "<div data-bind='text: $context.$data === $data'></div>";
        ko.applyBindings({}, testNode);
        expect(testNode).toContainText("true");
    });

    it('Should be able to refer to the bound object itself (at the root scope, the viewmodel) via $data', function() {
        testNode.innerHTML = "<div data-bind='text: $data.someProp'></div>";
        ko.applyBindings({ someProp: 'My prop value' }, testNode);
        expect(testNode).toContainText("My prop value");
    });

    it('Should be able to update bindings (including callbacks) using an observable view model', function() {
        testNode.innerHTML = "<input data-bind='value:someProp' />";
        var input = testNode.childNodes[0], vm = ko.observable({ someProp: 'My prop value' });
        ko.applyBindings(vm, input);

        toEqual(input.value).toEqual("My prop value");

        // a change to the input value should be written to the model
        input.value = "some user-entered value";
        ko.utils.triggerEvent(input, "change");
        toEqual(vm().someProp).toEqual("some user-entered value");

        // set the view-model to a new object
        vm({ someProp: ko.observable('My new prop value') });
        toEqual(input.value).toEqual("My new prop value");

        // a change to the input value should be written to the new model
        input.value = "some new user-entered value";
        ko.utils.triggerEvent(input, "change");
        toEqual(vm().someProp()).toEqual("some new user-entered value");

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
        toEqual(testNode).toContainText("First view model");

        // change view model to new object
        vm({obj1: {prop1: "Second view "}, prop2: "model"});
        toEqual(testNode).toContainText("Second view model");

        // change it again
        vm({obj1: {prop1: "Third view model"}, prop2: ""});
        toEqual(testNode).toContainText("Third view model");
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
        toEqual(testNode).toContainText("First view model");

        // ch ange view model to new object
        vm({obj1: {prop1: "Second view "}, prop2: "model"});
        toEqual(testNode).toContainText("Second view model");

        // change it again
        vm({obj1: {prop1: "Third view model"}, prop2: ""});
        toEqual(testNode).toContainText("Third view model");
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
        toEqual(lastBoundValueInit).toEqual("initial value");
        toEqual(lastBoundValueUpdate).toEqual("initial value");

        // update value of observable
        vm().myProp("second value");
        toEqual(lastBoundValueInit).toEqual("second value");
        toEqual(lastBoundValueUpdate).toEqual("second value");

        // update value of observable to another observable
        vm().myProp(ko.observable("third value"));
        toEqual(lastBoundValueInit).toEqual("third value");
        toEqual(lastBoundValueUpdate).toEqual("third value");

        // update view model with brand-new property
        vm({ myProp: function() {return "fourth value"; }});
        toEqual(lastBoundValueInit).toEqual("fourth value");
        toEqual(lastBoundValueUpdate).toEqual("fourth value");
    });

    it('Should be able to specify two-level bindings through a sub-object and through dot syntax', function() {
        var results = {}, firstName = ko.observable('bob'), lastName = ko.observable('smith');
        ko.bindingHandlers.twoLevelBinding = {
            flags: ko.bindingFlags.twoLevel,
            update: function(element, valueAccessor) {
                var value = valueAccessor();
                for (var prop in value) {
                    results[prop] = ko.utils.unwrapObservable(value[prop]);
                }
            }
        };
        testNode.innerHTML = "<div data-bind='twoLevelBinding: {first: firstName, full: firstName()+\" \"+lastName()}, twoLevelBinding.last: lastName'></div>";
        ko.applyBindings({ firstName: firstName, lastName: lastName }, testNode);
        toEqual(results.first).toEqual("bob");
        toEqual(results.last).toEqual("smith");
        toEqual(results.full).toEqual("bob smith");

        lastName('jones');
        toEqual(results.last).toEqual("jones");
        toEqual(results.full).toEqual("bob jones");
    });

    it('Value of \'this\' in call to event handler should be the function\'s object if option set', function() {
        ko.bindingHandlers.testEvent = {
            flags: ko.bindingFlags.eventHandler,
            init: function(element, valueAccessor) {
                valueAccessor()(); // call the function
            }
        };
        var eventCalls = 0, vm = {
            topLevelFunction: function() {
                toEqual(this).toEqual(vm);
                eventCalls++;
            },
            level2: {
                secondLevelFunction: function() {
                    toEqual(this).toEqual(vm.level2);
                    eventCalls++;
                }
            }
        };
        testNode.innerHTML = "<div data-bind='testEvent: topLevelFunction'></div><div data-bind='testEvent: level2.secondLevelFunction'></div>";
        ko.applyBindings(vm, testNode, {eventHandlersUseObjectForThis: true});
        toEqual(eventCalls).toEqual(2);
    });

    it('Should be able to leave off the value if a binding specifies it doesn\'t require one (will default to true)', function() {
        var initCalls = 0;
        ko.bindingHandlers.doesntRequireValue = {
            flags: ko.bindingFlags.noValue,
            init: function(element, valueAccessor) { if (valueAccessor()) initCalls++; }
        }
        testNode.innerHTML = "<div data-bind='doesntRequireValue, dummy: false'></div><div data-bind='doesntRequireValue: true, dummy: false'></div>";
        ko.applyBindings(null, testNode);
        toEqual(initCalls).toEqual(2);
    });

    it('Should not be able to leave off the value if a binding doesn\'t specify the noValue flag', function() {
        var initCalls = 0, didThrow = false;
        ko.bindingHandlers.doesRequireValue = {
            init: function(element, valueAccessor) { if (valueAccessor()) initCalls++; }
        }
        testNode.innerHTML = "<div data-bind='doesRequireValue, dummy: false'></div><div data-bind='doesRequireValue: true, dummy: false'></div>";

        try { ko.applyBindings(null, testNode) }
        catch(ex) { didThrow = true; toEqual(ex.message).toContain('Unable to parse bindings') }
        toEqual(didThrow).toEqual(true);
    });

    it('Bindings can signal that they control descendant bindings by setting contentBind flag', function() {
        ko.bindingHandlers.test = {
            flags: ko.bindingFlags.contentBind
        };
        testNode.innerHTML = "<div data-bind='test: true'>"
                           +     "<div data-bind='text: 123'>456</div>"
                           + "</div>"
                           + "<div data-bind='text: 123'>456</div>";
        ko.applyBindings(null, testNode);

        expect(testNode.childNodes[0].childNodes[0].innerHTML).toEqual("456");
        expect(testNode.childNodes[1].innerHTML).toEqual("123");
    });

    it('Should not be allowed to have multiple bindings on the same element that claim to control descendant bindings', function() {
        ko.bindingHandlers.test1 = {
            flags: ko.bindingFlags.contentBind
        };
        ko.bindingHandlers.test2 = ko.bindingHandlers.test1;
        testNode.innerHTML = "<div data-bind='test1: true, test2: true'></div>"
        var didThrow = false;

        try { ko.applyBindings(null, testNode) }
        catch(ex) { didThrow = true; expect(ex.message).toContain('Multiple bindings (test1 and test2) are trying to control descendant bindings of the same element.') }
        expect(didThrow).toEqual(true);
    });

    it('Binding should not be allowed to use \'controlsDescendantBindings\' style with independent bindings', function() {
        ko.bindingHandlers.test = {
            init: function() { return { controlsDescendantBindings : true } }
        };
        testNode.innerHTML = "<div data-bind='test: true'></div>"
        var didThrow = false;

        try { ko.applyBindings(null, testNode, {independentBindings: true}) }
        catch(ex) { didThrow = true; toEqual(ex.message).toContain('contentBind flag') }
        toEqual(didThrow).toEqual(true);
    });

    it('Binding should be allowed to use \'controlsDescendantBindings\' with standard bindings', function() {
        ko.bindingHandlers.test = {
            init: function() { return { controlsDescendantBindings : true } }
        };
        testNode.innerHTML = "<div data-bind='test: true'></div>"

        ko.applyBindings(null, testNode, {independentBindings: false});
        // shouldn't throw any error
    });

    it('Binding can use both \'controlsDescendantBindings\' and \'contentBind\' with independent bindings', function() {
        ko.bindingHandlers.test = {
            flags: ko.bindingFlags.contentBind,
            init: function() { return { controlsDescendantBindings : true } }
        };
        testNode.innerHTML = "<div data-bind='test: true'></div>"

        ko.applyBindings(null, testNode, {independentBindings: true});
        // shouldn't throw any error
    });

    it('Binding can use both \'controlsDescendantBindings\' and \'contentBind\' with standard bindings', function() {
        ko.bindingHandlers.test = {
            flags: ko.bindingFlags.contentBind,
            init: function() { return { controlsDescendantBindings : true } }
        };
        testNode.innerHTML = "<div data-bind='test: true'></div>"

        ko.applyBindings(null, testNode, {independentBindings: false});
        // shouldn't throw any error
    });

    it('Should use properties on the view model in preference to properties on the binding context', function() {
        testNode.innerHTML = "<div data-bind='text: $data.someProp'></div>";
        ko.applyBindings({ '$data': { someProp: 'Inner value'}, someProp: 'Outer value' }, testNode);
        expect(testNode).toContainText("Inner value");
    });

    it('Should be able to extend a binding context, adding new custom properties, without mutating the original binding context', function() {
        ko.bindingHandlers.addCustomProperty = {
            flags: ko.bindingFlags.contentBind,
            init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                ko.applyBindingsToDescendants(bindingContext.extend({ '$customProp': 'my value' }), element);
            }
        };
        testNode.innerHTML = "<div data-bind='with: sub'><div data-bind='addCustomProperty: true'><div data-bind='text: $customProp'></div></div></div>";
        var vm = { sub: {} };
        ko.applyBindings(vm, testNode);
        expect(testNode).toContainText("my value");
        expect(ko.contextFor(testNode.childNodes[0].childNodes[0].childNodes[0]).$customProp).toEqual("my value");
        expect(ko.contextFor(testNode.childNodes[0].childNodes[0]).$customProp).toEqual(undefined); // Should not affect original binding context

        // vale of $data and $parent should be unchanged in extended context
        expect(ko.contextFor(testNode.childNodes[0].childNodes[0].childNodes[0]).$data).toEqual(vm.sub);
        expect(ko.contextFor(testNode.childNodes[0].childNodes[0].childNodes[0]).$parent).toEqual(vm);
    });

    it('Binding contexts should inherit any custom properties from ancestor binding contexts', function() {
        ko.bindingHandlers.addCustomProperty = {
            flags: ko.bindingFlags.contentBind,
            init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                ko.applyBindingsToDescendants(bindingContext.extend({ '$customProp': 'my value' }), element);
            }
        };
        testNode.innerHTML = "<div data-bind='addCustomProperty: true'><div data-bind='with: true'><div data-bind='text: $customProp'></div></div></div>";
        ko.applyBindings(null, testNode);
        expect(testNode).toContainText("my value");
    });

    it('Should be able to retrieve the binding context associated with any node', function() {
        testNode.innerHTML = "<div><div data-bind='text: name'></div></div>";
        ko.applyBindings({ name: 'Bert' }, testNode.childNodes[0]);

        expect(testNode.childNodes[0].childNodes[0]).toContainText("Bert");

        // Can't get binding context for unbound nodes
        expect(ko.dataFor(testNode)).toEqual(undefined);
        expect(ko.contextFor(testNode)).toEqual(undefined);

        // Can get binding context for directly bound nodes
        expect(ko.dataFor(testNode.childNodes[0]).name).toEqual("Bert");
        expect(ko.contextFor(testNode.childNodes[0]).$data.name).toEqual("Bert");

        // Can get binding context for descendants of directly bound nodes
        expect(ko.dataFor(testNode.childNodes[0].childNodes[0]).name).toEqual("Bert");
        expect(ko.contextFor(testNode.childNodes[0].childNodes[0]).$data.name).toEqual("Bert");
    });

    it('Should not be allowed to use containerless binding syntax for bindings other than whitelisted ones', function() {
        testNode.innerHTML = "Hello <!-- ko visible: false -->Some text<!-- /ko --> Goodbye"
        var didThrow = false;
        try {
            ko.applyBindings(null, testNode);
        } catch(ex) {
            didThrow = true;
            expect(ex.message).toEqual("The binding 'visible' cannot be used with virtual elements");
        }
        expect(didThrow).toEqual(true);
    });

    it('Should be able to set a custom binding to use containerless binding using \'canUseVirtual\' flag', function() {
        var initCalls = 0;
        ko.bindingHandlers.test = {
            flags: ko.bindingFlags.canUseVirtual,
            init: function () { initCalls++; }
        };
        testNode.innerHTML = "Hello <!-- ko test: false -->Some text<!-- /ko --> Goodbye"
        ko.applyBindings(null, testNode);

        toEqual(initCalls).toEqual(1);
        toEqual(testNode).toContainText("Hello Some text Goodbye");
    });

    it('Should be able to set a custom binding to use containerless binding using \'allowedBindings\'', function() {
        var initCalls = 0;
        ko.bindingHandlers.test = { init: function () { initCalls++ } };
        ko.virtualElements.allowedBindings['test'] = true;

        testNode.innerHTML = "Hello <!-- ko test: false -->Some text<!-- /ko --> Goodbye";
        ko.applyBindings(null, testNode);

        expect(initCalls).toEqual(1);
        expect(testNode).toContainText("Hello Some text Goodbye");
    });

    it('Should be allowed to express containerless bindings with arbitrary internal whitespace and newlines', function() {
            testNode.innerHTML = "Hello <!-- ko\n" +
                             "    with\n" +
                             "      : \n "+
                             "        { \n" +
                             "           \tpersonName: 'Bert'\n" +
                             "        }\n" +
                             "   \t --><span data-bind='text: personName'></span><!-- \n" +
                             "     /ko \n" +
                             "-->, Goodbye";
        ko.applyBindings(null, testNode);
        expect(testNode).toContainText('Hello Bert, Goodbye');
    });

    it('Should be able to access virtual children in custom containerless binding', function() {
        var countNodes = 0;
        ko.bindingHandlers.test = {
            flags: ko.bindingFlags.canUseVirtual | ko.bindingFlags.contentUpdate,
            init: function (element, valueAccessor) {
                // Counts the number of virtual children, and overwrites the text contents of any text nodes
                for (var node = ko.virtualElements.firstChild(element); node; node = ko.virtualElements.nextSibling(node)) {
                    countNodes++;
                    if (node.nodeType === 3)
                        node.data = 'new text';
                }
            }
        };
        testNode.innerHTML = "Hello <!-- ko test: false -->Some text<!-- /ko --> Goodbye"
        ko.applyBindings(null, testNode);

        expect(countNodes).toEqual(1);
        expect(testNode).toContainText("Hello new text Goodbye");
    });

    it('Should only bind containerless binding once inside template', function() {
        var initCalls = 0;
        ko.bindingHandlers.test = {
            flags: ko.bindingFlags.canUseVirtual,
            init: function () { initCalls++; }
        };
        testNode.innerHTML = "Hello <!-- ko if: true --><!-- ko test: false -->Some text<!-- /ko --><!-- /ko --> Goodbye"
        ko.applyBindings(null, testNode);

        expect(initCalls).toEqual(1);
        expect(testNode).toContainText("Hello Some text Goodbye");
    });

    it('Bindings in containerless binding in templates should be bound only once', function() {
        delete ko.bindingHandlers.nonexistentHandler;
        var initCalls = 0;
        ko.bindingHandlers.test = { init: function () { initCalls++; } };
        testNode.innerHTML = "<div data-bind='template: {\"if\":true}'>xxx<!-- ko nonexistentHandler: true --><span data-bind='test: true'></span><!-- /ko --></div>";
        ko.applyBindings({}, testNode);
        toEqual(initCalls).toEqual(1);
    });

    it('Should automatically bind virtual descendants of containerless markers if no binding controlsDescendantBindings', function() {
          testNode.innerHTML = "Hello <!-- ko dummy: false --><span data-bind='text: \"WasBound\"'>Some text</span><!-- /ko --> Goodbye";
          ko.applyBindings(null, testNode);
          expect(testNode).toContainText("Hello WasBound Goodbye");
    });

    it('Should be able to set and access correct context in custom containerless binding', function() {
        ko.bindingHandlers.bindChildrenWithCustomContext = {
            flags: ko.bindingFlags.canUseVirtual | ko.bindingFlags.contentBind,
            init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                var innerContext = bindingContext.createChildContext({ myCustomData: 123 });
                ko.applyBindingsToDescendants(innerContext, element);
            }
        };

        testNode.innerHTML = "Hello <!-- ko bindChildrenWithCustomContext: true --><div>Some text</div><!-- /ko --> Goodbye"
        ko.applyBindings(null, testNode);

        expect(ko.dataFor(testNode.childNodes[2]).myCustomData).toEqual(123);
    });

    it('Should be able to set and access correct context in nested containerless binding', function() {
        delete ko.bindingHandlers.nonexistentHandler;
        ko.bindingHandlers.bindChildrenWithCustomContext = {
            flags: ko.bindingFlags.contentBind,
            init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                var innerContext = bindingContext.createChildContext({ myCustomData: 123 });
                ko.applyBindingsToDescendants(innerContext, element);
            }
        };

        testNode.innerHTML = "Hello <div data-bind='bindChildrenWithCustomContext: true'><!-- ko nonexistentHandler: 123 --><div>Some text</div><!-- /ko --></div> Goodbye"
        ko.applyBindings(null, testNode);

        expect(ko.dataFor(testNode.childNodes[1].childNodes[0]).myCustomData).toEqual(123);
        expect(ko.dataFor(testNode.childNodes[1].childNodes[1]).myCustomData).toEqual(123);
    });

    it('Should be able to access custom context variables in child context', function() {
        ko.bindingHandlers.bindChildrenWithCustomContext = {
            flags: ko.bindingFlags.contentBind,
            init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                var innerContext = bindingContext.createChildContext({ myCustomData: 123 });
                innerContext.customValue = 'xyz';
                ko.applyBindingsToDescendants(innerContext, element);
            }
        };

        testNode.innerHTML = "Hello <div data-bind='bindChildrenWithCustomContext: true'><!-- ko with: myCustomData --><div>Some text</div><!-- /ko --></div> Goodbye"
        ko.applyBindings(null, testNode);

        expect(ko.contextFor(testNode.childNodes[1].childNodes[0]).customValue).toEqual('xyz');
        expect(ko.dataFor(testNode.childNodes[1].childNodes[1])).toEqual(123);
        expect(ko.contextFor(testNode.childNodes[1].childNodes[1]).$parent.myCustomData).toEqual(123);
        expect(ko.contextFor(testNode.childNodes[1].childNodes[1]).$parentContext.customValue).toEqual('xyz');
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
        toEqual(hasUpdatedSecondBinding).toEqual(true);
    });

    it('Should be able to set and use binding handlers with x.y syntax', function() {
        var initCalls = 0;
        ko.bindingHandlers['a.b'] = {
            init: function(element, valueAccessor) { if (valueAccessor()) initCalls++; }
        };
        testNode.innerHTML = "<div data-bind='a.b: true'></div>";
        ko.applyBindings(null, testNode);
        toEqual(initCalls).toEqual(1);
    });

    it('Should be able to use x.y binding syntax to call \'x\' handler with \'y\' as object key', function() {
        // ensure that a.b and a.c don't exist
        delete ko.bindingHandlers['a.b'];
        delete ko.bindingHandlers['a.c'];

        var observable = ko.observable(), lastSubKey;
        ko.bindingHandlers['a'] = {
            update: function(element, valueAccessor) {
                var value = valueAccessor();
                for (var key in value)
                    if (ko.utils.unwrapObservable(value[key]))
                        lastSubKey = key;
            }
        };
        testNode.innerHTML = "<div data-bind='a.b: true, a.c: myObservable'></div>";
        ko.applyBindings({ myObservable: observable }, testNode);
        toEqual(lastSubKey).toEqual("b");

        // update observable to true so a.c binding gets updated
        observable(true);
        toEqual(lastSubKey).toEqual("c");
    });

    it('Should be able to define a custom handler for x.y binding syntax', function() {
        // ensure that a.b and a.c don't exist
        delete ko.bindingHandlers['a.b'];
        delete ko.bindingHandlers['a.c'];

        var observable = ko.observable(), lastSubKey;
        ko.bindingHandlers['a'] = {
            makeSubkeyHandler: function(baseKey, subKey) {
                return {
                    update: function(element, valueAccessor) {
                        if (ko.utils.unwrapObservable(valueAccessor()))
                            lastSubKey = subKey;
                    }
                };
            }
        };
        testNode.innerHTML = "<div data-bind='a.b: true, a.c: myObservable'></div>";
        ko.applyBindings({ myObservable: observable }, testNode);
        toEqual(lastSubKey).toEqual("b");

        // update observable to true so a.c binding gets updated
        observable(true);
        toEqual(lastSubKey).toEqual("c");
    });

    it('Should be able to use x.y binding syntax in virtual elements if \'x\' binding supports it', function() {
        delete ko.bindingHandlers['a.b'];   // ensure that a.b doesn't exist
        var lastSubKey;
        ko.bindingHandlers['a'] = {
            update: function(element, valueAccessor) {
                var value = valueAccessor();
                for (var key in value)
                    if (ko.utils.unwrapObservable(value[key]))
                        lastSubKey = key;
            }
        };
        ko.virtualElements.allowedBindings.a = true;

        testNode.innerHTML = "x <!-- ko a.b: true --><!--/ko-->";
        ko.applyBindings(null, testNode);
        toEqual(lastSubKey).toEqual("b");
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
        toEqual(observable.getSubscriptionsCount()).toEqual(0);
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
        toEqual(updateCount1).toEqual(1);
        toEqual(updateCount2).toEqual(1);

        // update the observable and check that only the first binding was updated
        observable('B');
        toEqual(updateCount1).toEqual(2);
        toEqual(updateCount2).toEqual(1);
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
        toEqual(updateCount1).toEqual(1);
        toEqual(updateCount2).toEqual(1);

        // update the observable and check that both bindings were updated
        observable('B');
        toEqual(updateCount1).toEqual(2);
        toEqual(updateCount2).toEqual(2);
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
        toEqual(updateCount1).toEqual(1);    // update happened inside inner dependentObservable so count isn't updated
        toEqual(updateCount2).toEqual(2);
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
        toEqual(updateCount1).toEqual(2);
        toEqual(updateCount2).toEqual(2);
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
        toEqual(countUpdates).toEqual(1);
        observable(3);
        toEqual(countUpdates).toEqual(2);

        // reset
        countUpdates = 0;
        ko.cleanNode(testNode);
        ko.bindingProvider.instance.clearCache();

        // independent mode: should not update
        ko.applyBindings({ myObservable: observable }, testNode, {independentBindings: true});
        toEqual(countUpdates).toEqual(1);
        observable(2);
        toEqual(countUpdates).toEqual(1);
    });

    // TODO - This is a spec that succeeds in base Knockout, but fails with this update
    /*it('Should access latest value from extra binding when normal binding is updated', function() {
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
        toEqual(updateValue).toEqual("first value");
        vm.myNonObservable = "second value";
        observable.notifySubscribers();
        toEqual(updateValue).toEqual("second value");
    });*/

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
        catch(ex) { didThrow = true; toEqual(ex.message).toContain('recursive') }
        toEqual(didThrow).toEqual(true);
    });

    it('Should not be able to set dependencies that conflict with the order set by flags', function() {
        ko.bindingHandlers.test1 = { flags: ko.bindingFlags.contentSet };
        ko.bindingHandlers.test2 = { flags: ko.bindingFlags.contentUpdate };

        testNode.innerHTML = "<div data-bind='test1: true, test2: true, needs: {test1: \"test2\"}'></div>";

        var didThrow = false;
        try { ko.applyBindings(null, testNode) }
        catch(ex) { didThrow = true; toEqual(ex.message).toContain('ordering') }
        toEqual(didThrow).toEqual(true);
    });

    it('Changing type of binding handler won\'t clear binding cache, but cache can be cleared by calling clearCache', function() {
        var vm = ko.observable(1), updateCalls = 0, didThrow = false;
        ko.bindingHandlers.sometimesRequiresValue = {
            flags: ko.bindingFlags.noValue,
            update: function() { updateCalls++; }
        }
        testNode.innerHTML = "<div data-bind='sometimesRequiresValue'></div>";
        // first time works fine
        ko.applyBindings(vm, testNode, {independentBindings: false});
        toEqual(updateCalls).toEqual(1);

        // change type of handler; it will still work because of cache
        delete ko.bindingHandlers.sometimesRequiresValue.flags;
        vm(2);      // forces reparsing of binding values (but cache will kick in)
        toEqual(updateCalls).toEqual(2);

        // now clear the cache; reparsing will fail
        ko.bindingProvider.instance.clearCache();
        try { vm(3); }
        catch(ex) { didThrow = true; toEqual(ex.message).toContain('Unable to parse bindings') }
        toEqual(didThrow).toEqual(true);
        toEqual(updateCalls).toEqual(2);
    });
});
