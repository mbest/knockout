describe('Binding attribute syntax', {
    before_each: function () {
        var existingNode = document.getElementById("testNode");
        if (existingNode != null)
            existingNode.parentNode.removeChild(existingNode);
        testNode = document.createElement("div");
        testNode.id = "testNode";
        document.body.appendChild(testNode);
    },
    
    'applyBindings should accept no parameters and then act on document.body with undefined model': function() {
        var didInit = false;
        ko.bindingHandlers.test = {
            init: function (element, valueAccessor, allBindingsAccessor, viewModel) {
                value_of(element.id).should_be("testElement");
                value_of(viewModel).should_be(undefined);
                didInit = true;
            }
        };
        testNode.innerHTML = "<div id='testElement' data-bind='test:123'></div>";
        ko.applyBindings();
        value_of(didInit).should_be(true);

        // Just to avoid interfering with other specs:
        ko.utils.domData.clear(document.body);        
    },

    'applyBindings should accept one parameter and then act on document.body with parameter as model': function() {
        var didInit = false;
        var suppliedViewModel = {};
        ko.bindingHandlers.test = {
            init: function (element, valueAccessor, allBindingsAccessor, viewModel) {
                value_of(element.id).should_be("testElement");
                value_of(viewModel).should_be(suppliedViewModel);
                didInit = true;
            }
        };
        testNode.innerHTML = "<div id='testElement' data-bind='test:123'></div>";
        ko.applyBindings(suppliedViewModel);
        value_of(didInit).should_be(true);

        // Just to avoid interfering with other specs:
        ko.utils.domData.clear(document.body);
    },
    
    'applyBindings should accept two parameters and then act on second param as DOM node with first param as model': function() {
        var didInit = false;
        var suppliedViewModel = {};
        ko.bindingHandlers.test = {
            init: function (element, valueAccessor, allBindingsAccessor, viewModel) {
                value_of(element.id).should_be("testElement");
                value_of(viewModel).should_be(suppliedViewModel);
                didInit = true;
            }
        };
        testNode.innerHTML = "<div id='testElement' data-bind='test:123'></div>";
        var shouldNotMatchNode = document.createElement("DIV");
        shouldNotMatchNode.innerHTML = "<div id='shouldNotMatchThisElement' data-bind='test:123'></div>";
        document.body.appendChild(shouldNotMatchNode);
        try {
            ko.applyBindings(suppliedViewModel, testNode);
            value_of(didInit).should_be(true);    	
        } finally {
            shouldNotMatchNode.parentNode.removeChild(shouldNotMatchNode);
        }
    },

    'Should tolerate whitespace and nonexistent handlers': function () {
        testNode.innerHTML = "<div data-bind=' nonexistentHandler : \"Hello\" '></div>";
        ko.applyBindings(null, testNode); // No exception means success
    },

    'Should tolerate arbitrary literals as the values for a handler': function () {
        testNode.innerHTML = "<div data-bind='stringLiteral: \"hello\", numberLiteral: 123, boolLiteral: true, objectLiteral: {}, functionLiteral: function() { }'></div>";
        ko.applyBindings(null, testNode); // No exception means success
    },

    'Should tolerate wacky IE conditional comments': function() {
        // Represents issue https://github.com/SteveSanderson/knockout/issues/186. Would fail on IE9, but work on earlier IE versions.
        testNode.innerHTML = "<div><!--[if IE]><!-->Hello<!--<![endif]--></div>";
        ko.applyBindings(null, testNode); // No exception means success          
    },

    'Should invoke registered handlers\' init() then update() methods passing binding data': function () {
        var methodsInvoked = [];
        ko.bindingHandlers.test = {
            init: function (element, valueAccessor, allBindingsAccessor) {
                methodsInvoked.push("init");
                value_of(element.id).should_be("testElement");
                value_of(valueAccessor()).should_be("Hello");
                value_of(allBindingsAccessor().another).should_be(123);
            },
            update: function (element, valueAccessor, allBindingsAccessor) {
                methodsInvoked.push("update");
                value_of(element.id).should_be("testElement");
                value_of(valueAccessor()).should_be("Hello");
                value_of(allBindingsAccessor().another).should_be(123);
            }
        }
        testNode.innerHTML = "<div id='testElement' data-bind='test:\"Hello\", another:123'></div>";
        ko.applyBindings(null, testNode);
        value_of(methodsInvoked.length).should_be(2);
        value_of(methodsInvoked[0]).should_be("init");
        value_of(methodsInvoked[1]).should_be("update");
    },

    'If the binding handler depends on an observable, invokes the init handler once and the update handler whenever a new value is available': function () {
        var observable = new ko.observable();
        var initPassedValues = [], updatePassedValues = [];
        ko.bindingHandlers.test = {
            init: function (element, valueAccessor) { initPassedValues.push(valueAccessor()()); },
            update: function (element, valueAccessor) { updatePassedValues.push(valueAccessor()()); }
        };
        testNode.innerHTML = "<div data-bind='test: myObservable'></div>";

        ko.applyBindings({ myObservable: observable }, testNode);
        value_of(initPassedValues.length).should_be(1);
        value_of(updatePassedValues.length).should_be(1);
        value_of(initPassedValues[0]).should_be(undefined);
        value_of(updatePassedValues[0]).should_be(undefined);

        observable("A");
        value_of(initPassedValues.length).should_be(1);
        value_of(updatePassedValues.length).should_be(2);
        value_of(updatePassedValues[1]).should_be("A");
    },

    'If the associated DOM element was removed by KO, handler subscriptions are disposed immediately': function () {
        var observable = new ko.observable("A");
        ko.bindingHandlers.anyHandler = {
            update: function (element, valueAccessor) { valueAccessor(); }
        };
        testNode.innerHTML = "<div data-bind='anyHandler: myObservable()'></div>";
        ko.applyBindings({ myObservable: observable }, testNode);
        
        value_of(observable.getSubscriptionsCount()).should_be(1);

        ko.cleanAndRemoveNode(testNode);

        value_of(observable.getSubscriptionsCount()).should_be(0);
    },

    'If the associated DOM element was removed independently of KO, handler subscriptions are disposed on the next evaluation': function () {
        var observable = new ko.observable("A");
        ko.bindingHandlers.anyHandler = {
            update: function (element, valueAccessor) { valueAccessor(); }
        };
        testNode.innerHTML = "<div data-bind='anyHandler: myObservable()'></div>";
        ko.applyBindings({ myObservable: observable }, testNode);
        
        value_of(observable.getSubscriptionsCount()).should_be(1);
        
        testNode.parentNode.removeChild(testNode);
        observable("B"); // Force re-evaluation
        
        value_of(observable.getSubscriptionsCount()).should_be(0);
    },

    'If the binding attribute involves an observable, re-invokes the bindings if the observable notifies a change': function () {
        var observable = new ko.observable({ message: "hello" });
        var passedValues = [];
        ko.bindingHandlers.test = { update: function (element, valueAccessor) { passedValues.push(valueAccessor()); } };
        testNode.innerHTML = "<div data-bind='test: myObservable().message'></div>";

        ko.applyBindings({ myObservable: observable }, testNode);
        value_of(passedValues.length).should_be(1);
        value_of(passedValues[0]).should_be("hello");

        observable({ message: "goodbye" });
        value_of(passedValues.length).should_be(2);
        value_of(passedValues[1]).should_be("goodbye");
    },
    
    'Should be able to refer to the bound object itself (at the root scope, the viewmodel) via $data': function() {
        testNode.innerHTML = "<div data-bind='text: $data.someProp'></div>";
        ko.applyBindings({ someProp: 'My prop value' }, testNode);
        value_of(testNode).should_contain_text("My prop value");
    },

    'Should be able to update bindings (including callbacks) using an observable view model': function() {
        testNode.innerHTML = "<input data-bind='value:someProp' />";
        var input = testNode.childNodes[0], vm = ko.observable({ someProp: 'My prop value' });
        ko.applyBindings(vm, input);

        value_of(input.value).should_be("My prop value");

        // a change to the input value should be written to the model
        input.value = "some user-entered value";
        ko.utils.triggerEvent(input, "change");
        value_of(vm().someProp).should_be("some user-entered value");

        // set the view-model to a new object
        vm({ someProp: ko.observable('My new prop value') });
        value_of(input.value).should_be("My new prop value");

        // a change to the input value should be written to the new model
        input.value = "some new user-entered value";
        ko.utils.triggerEvent(input, "change");
        value_of(vm().someProp()).should_be("some new user-entered value");

        // clear the element and the view-model (shouldn't be any errors)
        testNode.innerHTML = "";
        vm(null);
    },

    'Updates to an observable view model should update all child contexts (uncluding values copied from the parent)': function() {
        ko.bindingHandlers.setChildContext = {
            flags: ko.bindingFlags.contentBind,
            init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                ko.applyBindingsToDescendants(
                    bindingContext.createChildContext(function() { return ko.utils.unwrapObservable(valueAccessor()) }), 
                    element, true);
            }
        };
        
        testNode.innerHTML = "<div data-bind='setChildContext:obj1'><span data-bind='text:prop1'></span><span data-bind='text:$root.prop2'></span></div>";
        var vm = ko.observable({obj1: {prop1: "First "}, prop2: "view model"});
        ko.applyBindings(vm, testNode);
        value_of(testNode).should_contain_text("First view model");

        // change view model to new object
        vm({obj1: {prop1: "Second view "}, prop2: "model"});
        value_of(testNode).should_contain_text("Second view model");

        // change it again
        vm({obj1: {prop1: "Third view model"}, prop2: ""});
        value_of(testNode).should_contain_text("Third view model");
    },

    'Should be able to get all updates to observables in both init and update': function() {
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
        value_of(lastBoundValueInit).should_be("initial value");
        value_of(lastBoundValueUpdate).should_be("initial value");

        // update value of observable
        vm().myProp("second value");
        value_of(lastBoundValueInit).should_be("second value");
        value_of(lastBoundValueUpdate).should_be("second value");
        
        // update value of observable to another observable
        vm().myProp(ko.observable("third value"));
        value_of(lastBoundValueInit).should_be("third value");
        value_of(lastBoundValueUpdate).should_be("third value");

        // update view model with brand-new property
        vm({ myProp: function() {return "fourth value"; }});
        value_of(lastBoundValueInit).should_be("fourth value");
        value_of(lastBoundValueUpdate).should_be("fourth value");
    },

    'Should be able to specify two-level bindings through a sub-object and through dot syntax': function() {
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
        value_of(results.first).should_be("bob");
        value_of(results.last).should_be("smith");
        value_of(results.full).should_be("bob smith");

        lastName('jones');
        value_of(results.last).should_be("jones");
        value_of(results.full).should_be("bob jones");
    },

    'Value of \'this\' in call to event handler should be the function\'s object if option set': function() {
        ko.bindingHandlers.testEvent = {
            flags: ko.bindingFlags.eventHandler,
            init: function(element, valueAccessor) {
                valueAccessor()(); // call the function
            }
        };
        var eventCalls = 0, vm = {
            topLevelFunction: function() {
                value_of(this).should_be(vm);
                eventCalls++;
            },
            level2: {
                secondLevelFunction: function() {
                    value_of(this).should_be(vm.level2);
                    eventCalls++;
                }
            }
        };
        testNode.innerHTML = "<div data-bind='testEvent: topLevelFunction'></div><div data-bind='testEvent: level2.secondLevelFunction'></div>";
        ko.applyBindings(vm, testNode, {eventHandlersUseObjectForThis: true});
        value_of(eventCalls).should_be(2);
    },

    'Should be able to leave off the value if a binding specifies it doesn\'t require one (will default to true)': function() {
        var initCalls = 0;
        ko.bindingHandlers.doesntRequireValue = {
            flags: ko.bindingFlags.noValue,
            init: function(element, valueAccessor) { if (valueAccessor()) initCalls++; }
        }
        testNode.innerHTML = "<div data-bind='doesntRequireValue, dummy: false'></div><div data-bind='doesntRequireValue: true, dummy: false'></div>";
        ko.applyBindings(null, testNode);
        value_of(initCalls).should_be(2);
    },

    'Should not be able to leave off the value if a binding doesn\'t specify the noValue flag': function() {
        var initCalls = 0, didThrow = false;
        ko.bindingHandlers.doesRequireValue = {
            init: function(element, valueAccessor) { if (valueAccessor()) initCalls++; }
        }
        testNode.innerHTML = "<div data-bind='doesRequireValue, dummy: false'></div><div data-bind='doesRequireValue: true, dummy: false'></div>";

        try { ko.applyBindings(null, testNode) }
        catch(ex) { didThrow = true; value_of(ex.message).should_contain('Unable to parse bindings') }
        value_of(didThrow).should_be(true);
    },

    'Bindings can signal that they control descendant bindings by setting contentBind flag': function() {
        ko.bindingHandlers.test = {
            flags: ko.bindingFlags.contentBind
        };
        testNode.innerHTML = "<div data-bind='test: true'>"
                           +     "<div data-bind='text: 123'>456</div>"
                           + "</div>"
                           + "<div data-bind='text: 123'>456</div>";
        ko.applyBindings(null, testNode);
        
        value_of(testNode.childNodes[0].childNodes[0].innerHTML).should_be("456");
        value_of(testNode.childNodes[1].innerHTML).should_be("123");
    },
    
    'Should not be allowed to have multiple bindings on the same element that claim to control descendant bindings': function() {
        ko.bindingHandlers.test1 = {
            flags: ko.bindingFlags.contentBind
        };
        ko.bindingHandlers.test2 = ko.bindingHandlers.test1;
        testNode.innerHTML = "<div data-bind='test1: true, test2: true'></div>"
        var didThrow = false;
        
        try { ko.applyBindings(null, testNode) }
        catch(ex) { didThrow = true; value_of(ex.message).should_contain('Multiple bindings (test1 and test2) are trying to control descendant bindings of the same element.') }
        value_of(didThrow).should_be(true);
    },
    
    'Binding should not be allowed to use \'controlsDescendantBindings\' style with independent bindings': function() {
        ko.bindingHandlers.test = {  
            init: function() { return { controlsDescendantBindings : true } }
        };
        testNode.innerHTML = "<div data-bind='test: true'></div>"
        var didThrow = false;
        
        try { ko.applyBindings(null, testNode, {independentBindings: true}) }
        catch(ex) { didThrow = true; value_of(ex.message).should_contain('contentBind flag') }
        value_of(didThrow).should_be(true);
    },
    
    'Binding should be allowed to use \'controlsDescendantBindings\' with standard bindings': function() {
        ko.bindingHandlers.test = {  
            init: function() { return { controlsDescendantBindings : true } }
        };
        testNode.innerHTML = "<div data-bind='test: true'></div>"
        
        ko.applyBindings(null, testNode);
        // shouldn't throw any error
    },
    
    'Binding can use both \'controlsDescendantBindings\' and \'contentBind\' with independent bindings': function() {
        ko.bindingHandlers.test = {  
            flags: ko.bindingFlags.contentBind,
            init: function() { return { controlsDescendantBindings : true } }
        };
        testNode.innerHTML = "<div data-bind='test: true'></div>"
        
        ko.applyBindings(null, testNode, {independentBindings: true});
        // shouldn't throw any error
    },
    
    'Binding can use both \'controlsDescendantBindings\' and \'contentBind\' with standard bindings': function() {
        ko.bindingHandlers.test = {  
            flags: ko.bindingFlags.contentBind,
            init: function() { return { controlsDescendantBindings : true } }
        };
        testNode.innerHTML = "<div data-bind='test: true'></div>"
        
        ko.applyBindings(null, testNode);
        // shouldn't throw any error
    },
    
    'Should use properties on the view model in preference to properties on the binding context': function() {
        testNode.innerHTML = "<div data-bind='text: $data.someProp'></div>";
        ko.applyBindings({ '$data': { someProp: 'Inner value'}, someProp: 'Outer value' }, testNode);
        value_of(testNode).should_contain_text("Inner value");
    },

    'Should be able to extend a binding context, adding new custom properties, without mutating the original binding context': function() {
        ko.bindingHandlers.addCustomProperty = {
            flags: ko.bindingFlags.contentBind,
            init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                ko.applyBindingsToDescendants(bindingContext.extend({ '$customProp': 'my value' }), element);
            }
        };
        testNode.innerHTML = "<div data-bind='with: sub'><div data-bind='addCustomProperty: true'><div data-bind='text: $customProp'></div></div></div>";
        var vm = { sub: {} };
        ko.applyBindings(vm, testNode);
        value_of(testNode).should_contain_text("my value");
        value_of(ko.contextFor(testNode.childNodes[0].childNodes[0].childNodes[0]).$customProp).should_be("my value");
        value_of(ko.contextFor(testNode.childNodes[0].childNodes[0]).$customProp).should_be(undefined); // Should not affect original binding context

        // vale of $data and $parent should be unchanged in extended context
        value_of(ko.contextFor(testNode.childNodes[0].childNodes[0].childNodes[0]).$data).should_be(vm.sub);
        value_of(ko.contextFor(testNode.childNodes[0].childNodes[0].childNodes[0]).$parent).should_be(vm);
    },

    'Binding contexts should inherit any custom properties from ancestor binding contexts': function() {
        ko.bindingHandlers.addCustomProperty = {
            flags: ko.bindingFlags.contentBind,
            init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                ko.applyBindingsToDescendants(bindingContext.extend({ '$customProp': 'my value' }), element);
            }
        };
        testNode.innerHTML = "<div data-bind='addCustomProperty: true'><div data-bind='with: true'><div data-bind='text: $customProp'></div></div></div>";
        ko.applyBindings(null, testNode);
        value_of(testNode).should_contain_text("my value");
    },
    
    'Should be able to retrieve the binding context associated with any node': function() {
        testNode.innerHTML = "<div><div data-bind='text: name'></div></div>";
        ko.applyBindings({ name: 'Bert' }, testNode.childNodes[0]);

        value_of(testNode.childNodes[0].childNodes[0]).should_contain_text("Bert");

        // Can't get binding context for unbound nodes
        value_of(ko.dataFor(testNode)).should_be(undefined);
        value_of(ko.contextFor(testNode)).should_be(undefined);

        // Can get binding context for directly bound nodes
        value_of(ko.dataFor(testNode.childNodes[0]).name).should_be("Bert");
        value_of(ko.contextFor(testNode.childNodes[0]).$data.name).should_be("Bert");

        // Can get binding context for descendants of directly bound nodes
        value_of(ko.dataFor(testNode.childNodes[0].childNodes[0]).name).should_be("Bert");
        value_of(ko.contextFor(testNode.childNodes[0].childNodes[0]).$data.name).should_be("Bert");
    },
    
    'Should not be allowed to use containerless binding syntax for bindings other than whitelisted ones': function() {
        testNode.innerHTML = "Hello <!-- ko visible: false -->Some text<!-- /ko --> Goodbye"
        var didThrow = false;
        try {
            ko.applyBindings(null, testNode);
        } catch(ex) {
            didThrow = true;
            value_of(ex.message).should_be("The binding 'visible' cannot be used with virtual elements");
        }
        value_of(didThrow).should_be(true);
    },
    
    'Should be able to set a custom binding to use containerless binding using \'canUseVirtual\' flag': function() {
        var initCalls = 0;
        ko.bindingHandlers.test = {
            flags: ko.bindingFlags.canUseVirtual,
            init: function () { initCalls++; }
        };
        testNode.innerHTML = "Hello <!-- ko test: false -->Some text<!-- /ko --> Goodbye"
        ko.applyBindings(null, testNode);

        value_of(initCalls).should_be(1);
        value_of(testNode).should_contain_text("Hello Some text Goodbye");
    },
    
    'Should be able to set a custom binding to use containerless binding using \'allowedBindings\'': function() {
        var initCalls = 0;
        ko.bindingHandlers.test = { init: function () { initCalls++ } };
        ko.virtualElements.allowedBindings['test'] = true;

        testNode.innerHTML = "Hello <!-- ko test: false -->Some text<!-- /ko --> Goodbye"
        ko.applyBindings(null, testNode);

        value_of(initCalls).should_be(1);
        value_of(testNode).should_contain_text("Hello Some text Goodbye");
    },
    
    'Should be able to access virtual children in custom containerless binding': function() {
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

        value_of(countNodes).should_be(1);
        value_of(testNode).should_contain_text("Hello new text Goodbye");
    },
    
    'Should only bind containerless binding once inside template': function() {
        var initCalls = 0;
        ko.bindingHandlers.test = {
            flags: ko.bindingFlags.canUseVirtual,
            init: function () { initCalls++; }
        };
        testNode.innerHTML = "Hello <!-- if: true --><!-- ko test: false -->Some text<!-- /ko --><!-- /ko --> Goodbye"
        ko.applyBindings(null, testNode);

        value_of(initCalls).should_be(1);
        value_of(testNode).should_contain_text("Hello Some text Goodbye");
    },

    'Bindings in containerless binding in templates should be bound only once': function() {
        delete ko.bindingHandlers.nonexistentHandler;
        var initCalls = 0;
        ko.bindingHandlers.test = { init: function () { initCalls++; } };
        testNode.innerHTML = "<div data-bind='template: {\"if\":true}'>xxx<!-- ko nonexistentHandler: true --><span data-bind='test: true'></span><!-- /ko --></div>";
        ko.applyBindings({}, testNode);
        value_of(initCalls).should_be(1);
    },

    'Should automatically bind virtual descendants of containerless markers if no binding controlsDescendantBindings': function() {
          testNode.innerHTML = "Hello <!-- ko dummy: false --><span data-bind='text: \"WasBound\"'>Some text</span><!-- /ko --> Goodbye";
          ko.applyBindings(null, testNode);
          value_of(testNode).should_contain_text("Hello WasBound Goodbye");
    },
    
    'Should be able to set and access correct context in custom containerless binding': function() {
        ko.bindingHandlers.bindChildrenWithCustomContext = {
            flags: ko.bindingFlags.canUseVirtual | ko.bindingFlags.contentBind,
            init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                var innerContext = bindingContext.createChildContext({ myCustomData: 123 });
                ko.applyBindingsToDescendants(innerContext, element);
            }
        };

        testNode.innerHTML = "Hello <!-- ko bindChildrenWithCustomContext: true --><div>Some text</div><!-- /ko --> Goodbye"
        ko.applyBindings(null, testNode);

        value_of(ko.dataFor(testNode.childNodes[2]).myCustomData).should_be(123);
    },
    
    'Should be able to set and access correct context in nested containerless binding': function() {
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

        value_of(ko.dataFor(testNode.childNodes[1].childNodes[0]).myCustomData).should_be(123);
        value_of(ko.dataFor(testNode.childNodes[1].childNodes[1]).myCustomData).should_be(123);
    },
    
    'Should be able to access custom context variables in child context': function() {
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

        value_of(ko.contextFor(testNode.childNodes[1].childNodes[0]).customValue).should_be('xyz');
        value_of(ko.dataFor(testNode.childNodes[1].childNodes[1])).should_be(123);
        value_of(ko.contextFor(testNode.childNodes[1].childNodes[1]).$parent.myCustomData).should_be(123);
        value_of(ko.contextFor(testNode.childNodes[1].childNodes[1]).$parentContext.customValue).should_be('xyz');
    },
    
    'Should not reinvoke init for notifications triggered during first evaluation': function () {
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
        value_of(initCalls).should_be(1);
    },

    'Should not run update before init, even if an associated observable is updated by a different binding before init': function() {
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
        value_of(hasUpdatedSecondBinding).should_be(true);
    },

    'Should not subscribe to observables accessed in init function if binding are run independently': function() {
        var observable = ko.observable('A');
        ko.bindingHandlers.test = {
            init: function(element, valueAccessor) {
                var value = valueAccessor();
                value();
            }
        }
        testNode.innerHTML = "<div data-bind='if: true'><div data-bind='test: myObservable'></div></div>";

        ko.applyBindings({ myObservable: observable }, testNode, {independentBindings: true});
        value_of(observable.getSubscriptionsCount()).should_be(0);
    },

    'Should not run updates for all bindings if only one needs to run if binding are run independently': function() {
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
        value_of(updateCount1).should_be(1);
        value_of(updateCount2).should_be(1);

        // update the observable and check that only the first binding was updated
        observable('B');
        value_of(updateCount1).should_be(2);
        value_of(updateCount2).should_be(1);
    },

    'Update to a dependency should also update the dependent binding (independent mode)': function() {
        var observable = ko.observable('A'), updateCount1 = 0, updateCount2 = 0;
        ko.bindingHandlers.test1 = {
            update: function(element, valueAccessor) {
                valueAccessor()();  // access value to create a subscription
                updateCount1++;
            }
        };
        ko.bindingHandlers.test2 = {
            dependencies: 'test1',
            update: function() {
                updateCount2++;
            }
        };
        testNode.innerHTML = "<div data-bind='test1: myObservable, test2: true'></div>";

        ko.applyBindings({ myObservable: observable }, testNode, {independentBindings: true});
        value_of(updateCount1).should_be(1);
        value_of(updateCount2).should_be(1);

        // update the observable and check that both bindings were updated
        observable('B');
        value_of(updateCount1).should_be(2);
        value_of(updateCount2).should_be(2);
    },

    'Binding should be able to return a subscribable value so dependent bindings can be updated (independent mode)': function() {
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
            dependencies: 'test1',
            update: function() {
                updateCount2++;
            }
        };
        testNode.innerHTML = "<div data-bind='test1: myObservable, test2: true'></div>";

        ko.applyBindings({ myObservable: observable }, testNode, {independentBindings: true});
        observable('B');
        value_of(updateCount1).should_be(1);    // update happened inside inner dependentObservable so count isn't updated
        value_of(updateCount2).should_be(2);
    },

    'Binding should be able to return a subscribable value from \'init\' so dependent bindings can be updated (independent mode)': function() {
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
            dependencies: 'test1',
            update: function() {
                updateCount2++;
            }
        };
        testNode.innerHTML = "<div data-bind='test1: myObservable, test2: true'></div>";

        ko.applyBindings({ myObservable: observable }, testNode, {independentBindings: true});
        observable('B');
        value_of(updateCount1).should_be(2);
        value_of(updateCount2).should_be(2);
    },

    'Should update all bindings if a extra binding unwraps an observable (only in dependent mode)': function() {
        delete ko.bindingHandlers.nonexistentHandler;
        var countUpdates = 0, observable = ko.observable(1);
        ko.bindingHandlers.existentHandler = {
            update: function() { countUpdates++; }
        }
        testNode.innerHTML = "<div data-bind='existentHandler: true, nonexistentHandler: myObservable()'></div>";

        // dependent mode: should update
        ko.applyBindings({ myObservable: observable }, testNode);
        value_of(countUpdates).should_be(1);
        observable(3);
        value_of(countUpdates).should_be(2);

        // reset
        countUpdates = 0;
        ko.cleanNode(testNode);
        ko.bindingProvider.instance.clearCache();

        // independent mode: should not update
        ko.applyBindings({ myObservable: observable }, testNode, {independentBindings: true});
        value_of(countUpdates).should_be(1);
        observable(2);
        value_of(countUpdates).should_be(1);
    },

    // TODO - This is a spec that succeeds in base Knockout, but fails with this update
    /*'Should access latest value from extra binding when normal binding is updated': function() {
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
        value_of(updateValue).should_be("first value");
        vm.myNonObservable = "second value";
        observable.notifySubscribers();
        value_of(updateValue).should_be("second value");
    },*/

    'Should process bindings in a certain order based on their type and dependencies': function() {
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

        testNode.innerHTML = "<div data-bind='test5: true, test4: true, test3: true, test2: true, test1: true, dependencies: {test2: \"test1\", test5: \"test4\"}'></div>";

        ko.applyBindings(null, testNode);
    },
    
    'Should not be able to set recursive dependencies': function() {
        ko.bindingHandlers.test1 = { };
        ko.bindingHandlers.test2 = { };

        testNode.innerHTML = "<div data-bind='test1: true, test2: true, dependencies: {test2: \"test1\", test1: \"test2\"}'></div>";

        var didThrow = false;
        try { ko.applyBindings(null, testNode) }
        catch(ex) { didThrow = true; value_of(ex.message).should_contain('recursive') }
        value_of(didThrow).should_be(true);
    },

    'Should not be able to set dependencies that conflict with the order set by flags': function() {
        ko.bindingHandlers.test1 = { flags: ko.bindingFlags.contentSet };
        ko.bindingHandlers.test2 = { flags: ko.bindingFlags.contentUpdate };

        testNode.innerHTML = "<div data-bind='test1: true, test2: true, dependencies: {test1: \"test2\"}'></div>";

        var didThrow = false;
        try { ko.applyBindings(null, testNode) }
        catch(ex) { didThrow = true; value_of(ex.message).should_contain('ordering') }
        value_of(didThrow).should_be(true);
    },

    'Changing type of binding handler won\'t clear binding cache, but cache can be cleared by calling clearCache': function() {
        var vm = ko.observable(1), updateCalls = 0, didThrow = false;
        ko.bindingHandlers.sometimesRequiresValue = { 
            flags: ko.bindingFlags.noValue,
            update: function() { updateCalls++; }
        }
        testNode.innerHTML = "<div data-bind='sometimesRequiresValue'></div>";
        // first time works fine
        ko.applyBindings(vm, testNode);
        value_of(updateCalls).should_be(1);
        
        // change type of handler; it will still work because of cache
        delete ko.bindingHandlers.sometimesRequiresValue.flags;
        vm(2);      // forces reparsing of binding values (but cache will kick in)
        value_of(updateCalls).should_be(2);

        // now clear the cache; reparsing will fail
        ko.bindingProvider.instance.clearCache();
        try { vm(3); }
        catch(ex) { didThrow = true; value_of(ex.message).should_contain('Unable to parse bindings') }
        value_of(didThrow).should_be(true);
        value_of(updateCalls).should_be(2);
    }
});