describe('Binding attribute syntax', function() {
    beforeEach(function () {
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
        testNode.innerHTML = "<div data-bind='stringLiteral: \"hello\", numberLiteral: 123, boolLiteralTrue: true, boolLiteralFalse: false, objectLiteral: {}, functionLiteral: function() { }, nullLiteral: null, undefinedLiteral: undefined'></div>";
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
        expect(results.first).toEqual("bob");
        expect(results.last).toEqual("smith");
        expect(results.full).toEqual("bob smith");

        lastName('jones');
        expect(results.last).toEqual("jones");
        expect(results.full).toEqual("bob jones");
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
                expect(this).toEqual(vm);
                eventCalls++;
            },
            level2: {
                secondLevelFunction: function() {
                    expect(this).toEqual(vm.level2);
                    eventCalls++;
                }
            }
        };
        testNode.innerHTML = "<div data-bind='testEvent: topLevelFunction'></div><div data-bind='testEvent: level2.secondLevelFunction'></div>";
        ko.applyBindings(vm, testNode, {eventHandlersUseObjectForThis: true});
        expect(eventCalls).toEqual(2);
    });

    it('Should be able to leave off the value if a binding specifies it doesn\'t require one (will default to true)', function() {
        var initCalls = 0;
        ko.bindingHandlers.doesntRequireValue = {
            flags: ko.bindingFlags.noValue,
            init: function(element, valueAccessor) { if (valueAccessor()) initCalls++; }
        }
        testNode.innerHTML = "<div data-bind='doesntRequireValue, dummy: false'></div><div data-bind='doesntRequireValue: true, dummy: false'></div>";
        ko.applyBindings(null, testNode);
        expect(initCalls).toEqual(2);
    });

    it('Should not be able to leave off the value if a binding doesn\'t specify the noValue flag', function() {
        var initCalls = 0, didThrow = false;
        ko.bindingHandlers.doesRequireValue = {
            init: function(element, valueAccessor) { if (valueAccessor()) initCalls++; }
        }
        testNode.innerHTML = "<div data-bind='doesRequireValue, dummy: false'></div><div data-bind='doesRequireValue: true, dummy: false'></div>";

        try { ko.applyBindings(null, testNode) }
        catch(ex) { didThrow = true; expect(ex.message).toContain('Unable to parse bindings') }
        expect(didThrow).toEqual(true);
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
        catch(ex) { didThrow = true; expect(ex.message).toContain('contentBind flag') }
        expect(didThrow).toEqual(true);
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

        expect(initCalls).toEqual(1);
        expect(testNode).toContainText("Hello Some text Goodbye");
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
        expect(initCalls).toEqual(1);
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

    it('Should be able to set and use binding handlers with x.y syntax', function() {
        var initCalls = 0;
        ko.bindingHandlers['a.b'] = {
            init: function(element, valueAccessor) { if (valueAccessor()) initCalls++; }
        };
        testNode.innerHTML = "<div data-bind='a.b: true'></div>";
        ko.applyBindings(null, testNode);
        expect(initCalls).toEqual(1);
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
        expect(lastSubKey).toEqual("b");

        // update observable to true so a.c binding gets updated
        observable(true);
        expect(lastSubKey).toEqual("c");
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
        expect(lastSubKey).toEqual("b");

        // update observable to true so a.c binding gets updated
        observable(true);
        expect(lastSubKey).toEqual("c");
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
        expect(lastSubKey).toEqual("b");
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
        expect(updateCalls).toEqual(1);

        // change type of handler; it will still work because of cache
        delete ko.bindingHandlers.sometimesRequiresValue.flags;
        vm(2);      // forces reparsing of binding values (but cache will kick in)
        expect(updateCalls).toEqual(2);

        // now clear the cache; reparsing will fail
        ko.bindingProvider.instance.clearCache();
        try { vm(3); }
        catch(ex) { didThrow = true; expect(ex.message).toContain('Unable to parse bindings') }
        expect(didThrow).toEqual(true);
        expect(updateCalls).toEqual(2);
    });

    it('Should not allow multiple applyBindings calls for the same element', function() {
        testNode.innerHTML = "<div data-bind='text: \"Some Text\"'></div>";

        // First call is fine
        ko.applyBindings({}, testNode);

        // Second call throws an error
        var didThrow = false;
        try { ko.applyBindings({}, testNode); }
        catch (ex) {
            didThrow = true;
            expect(ex.message).toEqual("You cannot apply bindings multiple times to the same element.");
        }
        if (!didThrow)
            throw new Error("Did not prevent multiple applyBindings calls");
    });

    it('Should allow multiple applyBindings calls for the same element if cleanNode is used', function() {
        testNode.innerHTML = "<div data-bind='text: \"Some Text\"'></div>";

        // First call
        ko.applyBindings({}, testNode);

        // cleanNode called before second call
        ko.cleanNode(testNode);
        ko.applyBindings({}, testNode);
        // Should not throw any errors
    });

    it('Should allow multiple applyBindings calls for the same element if subsequent call provides a binding', function() {
        testNode.innerHTML = "<div data-bind='text: \"Some Text\"'></div>";

        // First call uses data-bind
        ko.applyBindings({}, testNode);

        // Second call provides a binding
        ko.applyBindingsToNode(testNode, { visible: false }, {});
        // Should not throw any errors
    });

    it('Should allow multiple applyBindings calls for the same element if initial call provides a binding', function() {
        testNode.innerHTML = "<div data-bind='text: \"Some Text\"'></div>";

        // First call provides a binding
        ko.applyBindingsToNode(testNode, { visible: false }, {});

        // Second call uses data-bind
        ko.applyBindings({}, testNode);
        // Should not throw any errors
    });
});

