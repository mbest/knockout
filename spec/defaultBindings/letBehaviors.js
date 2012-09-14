describe('Binding: Let', {
    before_each: JSSpec.prepareTestNode,

    'Should be able to add custom properties that will be available to all child contexts': function() {
        testNode.innerHTML = "<div data-bind=\"let: { '$customProp': 'my value' }\"><div data-bind='with: true'><div data-bind='text: $customProp'></div></div></div>";
        ko.applyBindings(null, testNode);
        value_of(testNode).should_contain_text("my value");
    },

    'Should update all child contexts when custom properties are updated': function() {
        var observable = ko.observable(1);
        testNode.innerHTML = "<div data-bind='let: { prop1 : prop()*2 }'><div data-bind='text: prop1'></div></div>";
        ko.applyBindings({prop: observable}, testNode);
        value_of(testNode).should_contain_text("2");

        // change observable
        observable(2);
        value_of(testNode).should_contain_text("4");
    },

    'Should update all custom properties when the parent context is updated': function() {
        testNode.innerHTML = "<div data-bind='let: {obj1: $data}'><span data-bind='text:obj1.prop1'></span><span data-bind='text:prop2'></span></div>";
        var vm = ko.observable({prop1: "First ", prop2: "view model"});
        ko.applyBindings(vm, testNode);
        value_of(testNode).should_contain_text("First view model");

        // change view model to new object
        vm({prop1: "Second view ", prop2: "model"});
        value_of(testNode).should_contain_text("Second view model");

        // change it again
        vm({prop1: "Third view model", prop2: ""});
        value_of(testNode).should_contain_text("Third view model");
    }
});
