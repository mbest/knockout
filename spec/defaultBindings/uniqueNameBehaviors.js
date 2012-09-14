describe('Binding: Unique Name', {
    before_each: prepareTestNode,

    'Should apply a different name to each element': function () {
        testNode.innerHTML = "<div data-bind='uniqueName: true'></div><div data-bind='uniqueName: true'></div>";
        ko.applyBindings({}, testNode);

        value_of(testNode.childNodes[0].name.length > 0).should_be(true);
        value_of(testNode.childNodes[1].name.length > 0).should_be(true);
        value_of(testNode.childNodes[0].name == testNode.childNodes[1].name).should_be(false);
    },

    'Should work without a value': function () {
        testNode.innerHTML = "<div data-bind='uniqueName'></div><div data-bind='uniqueName'></div>";
        ko.applyBindings({}, testNode);

        value_of(testNode.childNodes[0].name.length > 0).should_be(true);
        value_of(testNode.childNodes[1].name.length > 0).should_be(true);
        value_of(testNode.childNodes[0].name == testNode.childNodes[1].name).should_be(false);
    }
});
