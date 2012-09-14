describe('Binding: With Light', {
    before_each: prepareTestNode,

    'Should leave descendant nodes in the document (and bind them in the context of the supplied value) if the value is truey': function() {
        testNode.innerHTML = "<div data-bind='withlight: someItem'><span data-bind='text: existentChildProp'></span></div>";
        value_of(testNode.childNodes.length).should_be(1);
        ko.applyBindings({ someItem: { existentChildProp: 'Child prop value' } }, testNode);
        value_of(testNode.childNodes[0].childNodes.length).should_be(1);
        value_of(testNode.childNodes[0].childNodes[0]).should_contain_text("Child prop value");
    },

    'Should not bind the same elements more than once even if the supplied value notifies a change': function() {
        var countedClicks = 0;
        var someItem = ko.observable({
            childProp: ko.observable('Hello'),
            handleClick: function() { countedClicks++ }
        });

        testNode.innerHTML = "<div data-bind='withlight: someItem'><span data-bind='text: childProp, click: handleClick'></span></div>";
        ko.applyBindings({ someItem: someItem }, testNode);

        // Initial state is one subscriber, one click handler
        value_of(testNode.childNodes[0].childNodes[0]).should_contain_text("Hello");
        value_of(someItem().childProp.getSubscriptionsCount()).should_be(1);
        ko.utils.triggerEvent(testNode.childNodes[0].childNodes[0], "click");
        value_of(countedClicks).should_be(1);

        // Force "update" binding handler to fire, then check we still have one subscriber...
        someItem.valueHasMutated();
        value_of(someItem().childProp.getSubscriptionsCount()).should_be(1);

        // ... and one click handler
        countedClicks = 0;
        ko.utils.triggerEvent(testNode.childNodes[0].childNodes[0], "click");
        value_of(countedClicks).should_be(1);
    },

    'Should be able to access parent binding context via $parent': function() {
        testNode.innerHTML = "<div data-bind='withlight: someItem'><span data-bind='text: $parent.parentProp'></span></div>";
        ko.applyBindings({ someItem: { }, parentProp: 'Parent prop value' }, testNode);
        value_of(testNode.childNodes[0].childNodes[0]).should_contain_text("Parent prop value");
    },

    'Should be able to access all parent binding contexts via $parents, and root context via $root': function() {
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
        value_of(finalContainer.childNodes[0]).should_contain_text("bottom");
        value_of(finalContainer.childNodes[1]).should_contain_text("middle");
        value_of(finalContainer.childNodes[2]).should_contain_text("top");
        value_of(finalContainer.childNodes[3]).should_contain_text("outer");
        value_of(finalContainer.childNodes[4]).should_contain_text("outer");

        // Also check that, when we later retrieve the binding contexts, we get consistent results
        value_of(ko.contextFor(testNode).$data.name).should_be("outer");
        value_of(ko.contextFor(testNode.childNodes[0]).$data.name).should_be("outer");
        value_of(ko.contextFor(testNode.childNodes[0].childNodes[0]).$data.name).should_be("top");
        value_of(ko.contextFor(testNode.childNodes[0].childNodes[0].childNodes[0]).$data.name).should_be("middle");
        value_of(ko.contextFor(testNode.childNodes[0].childNodes[0].childNodes[0].childNodes[0]).$data.name).should_be("bottom");
        var firstSpan = testNode.childNodes[0].childNodes[0].childNodes[0].childNodes[0];
        value_of(firstSpan.tagName).should_be("SPAN");
        value_of(ko.contextFor(firstSpan).$data.name).should_be("bottom");
        value_of(ko.contextFor(firstSpan).$root.name).should_be("outer");
        value_of(ko.contextFor(firstSpan).$parents[1].name).should_be("top");
    },

    'Should be able to define a \"withlight\" region using a containerless binding': function() {
        var someitem = ko.observable({someItem: 'first value'});
        testNode.innerHTML = "xxx <!-- ko withlight: someitem --><span data-bind=\"text: someItem\"></span><!-- /ko -->";
        ko.applyBindings({ someitem: someitem }, testNode);

        value_of(testNode).should_contain_text("xxx first value");

        someitem({ someItem: 'second value' });
        value_of(testNode).should_contain_text("xxx second value");
    },

    'Should be able to use \"withlight\" within an observable top-level view model': function() {
        var vm = ko.observable({someitem: ko.observable({someItem: 'first value'})});
        testNode.innerHTML = "xxx <!-- ko withlight: someitem --><span data-bind=\"text: someItem\"></span><!-- /ko -->";
        ko.applyBindings(vm, testNode);

        value_of(testNode).should_contain_text("xxx first value");

        vm({someitem: ko.observable({ someItem: 'second value' })});
        value_of(testNode).should_contain_text("xxx second value");
    },

    'Should be able to nest a containerless template within \"withlight\"': function() {
        testNode.innerHTML = "<div data-bind='withlight: someitem'>text" +
            "<!-- ko foreach: childprop --><span data-bind='text: $data'></span><!-- /ko --></div>";

        var childprop = ko.observableArray([]);
        var someitem = ko.observable({childprop: childprop});
        var viewModel = {someitem: someitem};
        ko.applyBindings(viewModel, testNode);

        // First it's not there (by template)
        var container = testNode.childNodes[0];
        value_of(container).should_contain_html("text<!-- ko foreach: childprop --><!-- /ko -->");

        // Then it's there
        childprop.push('me')
        value_of(container).should_contain_html("text<!-- ko foreach: childprop --><span data-bind=\"text: $data\">me</span><!-- /ko -->");

        // Then there's a second one
        childprop.push('me2')
        value_of(container).should_contain_html("text<!-- ko foreach: childprop --><span data-bind=\"text: $data\">me</span><span data-bind=\"text: $data\">me2</span><!-- /ko -->");

        // Then it changes
        someitem({childprop: ['notme']});
        container = testNode.childNodes[0];
        value_of(container).should_contain_html("text<!-- ko foreach: childprop --><span data-bind=\"text: $data\">notme</span><!-- /ko -->");
    },

    'Should be able to specify child context model name via option': function() {
        testNode.innerHTML = "<div data-bind='withlight: someItem, as:\"$me\"'><span data-bind='text: $me.myProp'></span></div>";
        ko.applyBindings({ someItem: { myProp: 'Sub prop value' }, myProp: 'Parent prop value' }, testNode);
        value_of(testNode.childNodes[0].childNodes[0]).should_contain_text("Sub prop value");
    },

    'Should be able to specify child context model name via parsed syntax': function() {
        testNode.innerHTML = "<div data-bind='withlight: someItem as $me'><span data-bind='text: $me.myProp'></span></div>";
        ko.applyBindings({ someItem: { myProp: 'Sub prop value' }, myProp: 'Parent prop value' }, testNode);
        value_of(testNode.childNodes[0].childNodes[0]).should_contain_text("Sub prop value");
    }
});
