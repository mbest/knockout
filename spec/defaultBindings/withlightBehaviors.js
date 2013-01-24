describe('Binding: With Light', function() {
    beforeEach(jasmine.prepareTestNode);

    it('Should leave descendant nodes in the document (and bind them in the context of the supplied value) if the value is truey', function() {
        testNode.innerHTML = "<div data-bind='withlight: someItem'><span data-bind='text: existentChildProp'></span></div>";
        expect(testNode.childNodes.length).toEqual(1);
        ko.applyBindings({ someItem: { existentChildProp: 'Child prop value' } }, testNode);
        expect(testNode.childNodes[0].childNodes.length).toEqual(1);
        expect(testNode.childNodes[0].childNodes[0]).toContainText("Child prop value");
    });

    it('Should not bind the same elements more than once even if the supplied value notifies a change', function() {
        var countedClicks = 0;
        var someItem = ko.observable({
            childProp: ko.observable('Hello'),
            handleClick: function() { countedClicks++ }
        });

        testNode.innerHTML = "<div data-bind='withlight: someItem'><span data-bind='text: childProp, click: handleClick'></span></div>";
        ko.applyBindings({ someItem: someItem }, testNode);

        // Initial state is one subscriber, one click handler
        expect(testNode.childNodes[0].childNodes[0]).toContainText("Hello");
        expect(someItem().childProp.getSubscriptionsCount()).toEqual(1);
        ko.utils.triggerEvent(testNode.childNodes[0].childNodes[0], "click");
        expect(countedClicks).toEqual(1);

        // Force "update" binding handler to fire, then check we still have one subscriber...
        someItem.valueHasMutated();
        expect(someItem().childProp.getSubscriptionsCount()).toEqual(1);

        // ... and one click handler
        countedClicks = 0;
        ko.utils.triggerEvent(testNode.childNodes[0].childNodes[0], "click");
        expect(countedClicks).toEqual(1);
    });

    it('Should be able to access parent binding context via $parent', function() {
        testNode.innerHTML = "<div data-bind='withlight: someItem'><span data-bind='text: $parent.parentProp'></span></div>";
        ko.applyBindings({ someItem: { }, parentProp: 'Parent prop value' }, testNode);
        expect(testNode.childNodes[0].childNodes[0]).toContainText("Parent prop value");
    });

    it('Should be able to access all parent binding contexts via $parents, and root context via $root', function() {
        testNode.innerHTML = "<div data-bind='withlight: topItem'>" +
                                "<div data-bind='withlight: middleItem'>" +
                                    "<div data-bind='withlight: bottomItem'>" +
                                        "<span data-bind='text: name'></span>" +
                                        "<span data-bind='text: $parent.name'></span>" +
                                        "<span data-bind='text: $parents[1].name'></span>" +
                                        "<span data-bind='text: $parents[2].name'></span>" +
                                        "<span data-bind='text: $root.name'></span>" +
                                    "</div>" +
                                "</div>" +
                              "</div>";
        ko.applyBindings({
            name: 'outer',
            topItem: {
                name: 'top',
                middleItem: {
                    name: 'middle',
                    bottomItem: {
                        name: "bottom"
                    }
                }
            }
        }, testNode);
        var finalContainer = testNode.childNodes[0].childNodes[0].childNodes[0];
        expect(finalContainer.childNodes[0]).toContainText("bottom");
        expect(finalContainer.childNodes[1]).toContainText("middle");
        expect(finalContainer.childNodes[2]).toContainText("top");
        expect(finalContainer.childNodes[3]).toContainText("outer");
        expect(finalContainer.childNodes[4]).toContainText("outer");

        // Also check that, when we later retrieve the binding contexts, we get consistent results
        expect(ko.contextFor(testNode).$data.name).toEqual("outer");
        expect(ko.contextFor(testNode.childNodes[0]).$data.name).toEqual("outer");
        expect(ko.contextFor(testNode.childNodes[0].childNodes[0]).$data.name).toEqual("top");
        expect(ko.contextFor(testNode.childNodes[0].childNodes[0].childNodes[0]).$data.name).toEqual("middle");
        expect(ko.contextFor(testNode.childNodes[0].childNodes[0].childNodes[0].childNodes[0]).$data.name).toEqual("bottom");
        var firstSpan = testNode.childNodes[0].childNodes[0].childNodes[0].childNodes[0];
        expect(firstSpan.tagName).toEqual("SPAN");
        expect(ko.contextFor(firstSpan).$data.name).toEqual("bottom");
        expect(ko.contextFor(firstSpan).$root.name).toEqual("outer");
        expect(ko.contextFor(firstSpan).$parents[1].name).toEqual("top");
    });

    it('Should be able to define a \"withlight\" region using a containerless binding', function() {
        var someitem = ko.observable({someItem: 'first value'});
        testNode.innerHTML = "xxx <!-- ko withlight: someitem --><span data-bind=\"text: someItem\"></span><!-- /ko -->";
        ko.applyBindings({ someitem: someitem }, testNode);

        expect(testNode).toContainText("xxx first value");

        someitem({ someItem: 'second value' });
        expect(testNode).toContainText("xxx second value");
    });

    it('Should be able to use \"withlight\" within an observable top-level view model', function() {
        var vm = ko.observable({someitem: ko.observable({someItem: 'first value'})});
        testNode.innerHTML = "xxx <!-- ko withlight: someitem --><span data-bind=\"text: someItem\"></span><!-- /ko -->";
        ko.applyBindings(vm, testNode);

        expect(testNode).toContainText("xxx first value");

        vm({someitem: ko.observable({ someItem: 'second value' })});
        expect(testNode).toContainText("xxx second value");
    });

    it('Should be able to nest a containerless template within \"withlight\"', function() {
        testNode.innerHTML = "<div data-bind='withlight: someitem'>text" +
            "<!-- ko foreach: childprop --><span data-bind='text: $data'></span><!-- /ko --></div>";

        var childprop = ko.observableArray([]);
        var someitem = ko.observable({childprop: childprop});
        var viewModel = {someitem: someitem};
        ko.applyBindings(viewModel, testNode);

        // First it's not there (by template)
        var container = testNode.childNodes[0];
        expect(container).toContainHtml("text<!-- ko foreach: childprop --><!-- /ko -->");

        // Then it's there
        childprop.push('me')
        expect(container).toContainHtml("text<!-- ko foreach: childprop --><span data-bind=\"text: $data\">me</span><!-- /ko -->");

        // Then there's a second one
        childprop.push('me2')
        expect(container).toContainHtml("text<!-- ko foreach: childprop --><span data-bind=\"text: $data\">me</span><span data-bind=\"text: $data\">me2</span><!-- /ko -->");

        // Then it changes
        someitem({childprop: ['notme']});
        container = testNode.childNodes[0];
        expect(container).toContainHtml("text<!-- ko foreach: childprop --><span data-bind=\"text: $data\">notme</span><!-- /ko -->");
    });

    it('Should be able to specify child context model name via option', function() {
        testNode.innerHTML = "<div data-bind='withlight: someItem, as:\"$me\"'><span data-bind='text: $me.myProp'></span></div>";
        ko.applyBindings({ someItem: { myProp: 'Sub prop value' }, myProp: 'Parent prop value' }, testNode);
        expect(testNode.childNodes[0].childNodes[0]).toContainText("Sub prop value");
    });

    it('Should be able to specify child context model name via parsed syntax', function() {
        testNode.innerHTML = "<div data-bind='withlight: someItem as $me'><span data-bind='text: $me.myProp'></span></div>";
        ko.applyBindings({ someItem: { myProp: 'Sub prop value' }, myProp: 'Parent prop value' }, testNode);
        expect(testNode.childNodes[0].childNodes[0]).toContainText("Sub prop value");
    });
});
