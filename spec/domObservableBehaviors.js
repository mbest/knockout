function prepareTestNode() {
    ko.bindingProvider.instance.clearCache();
    var existingNode = document.getElementById("testNode");
    if (existingNode != null)
        ko.cleanAndRemoveNode(existingNode);
    testNode = document.createElement("div");
    testNode.id = "testNode";
    document.body.appendChild(testNode);
}

describe('DOM Observable', {
    before_each: prepareTestNode,

    'Should be able to set arbitrary property values': function() {
        var obs1 = ko.domObservable(testNode, 'firstAttribute');
        obs1("first value");
        value_of(testNode["firstAttribute"]).should_be("first value");
        value_of(obs1()).should_be("first value");

        var obs2 = ko.domObservable(testNode, 'second-attribute');
        obs2(true);
        value_of(testNode["second-attribute"]).should_be(true);
        value_of(obs2()).should_be(true);
    },

    'Should be able to create multiple observable for the same property that update in sync': function() {
        var obs1 = ko.domObservable(testNode, 'firstAttribute');
        obs1("first value");
        value_of(testNode["firstAttribute"]).should_be("first value");
        value_of(obs1()).should_be("first value");

        var obs2 = ko.domObservable(testNode, 'firstAttribute');
        value_of(obs2()).should_be("first value");

        obs2(true);
        value_of(testNode["firstAttribute"]).should_be(true);
        value_of(obs1()).should_be(true);
    },

    'Should be able to control a checkbox\'s checked state': function () {
        testNode.innerHTML = "<input type='checkbox' />";
        var checkBox = testNode.childNodes[0];
        var myobservable = ko.domObservable(checkBox, 'checked');
        value_of(checkBox.checked).should_be(false);

        myobservable(true);
        value_of(checkBox.checked).should_be(true);
    },

    'Should update observable when the checkbox click event fires': function () {
        testNode.innerHTML = "<input type='checkbox' />";
        var checkBox = testNode.childNodes[0];
        var myobservable = ko.domObservable(checkBox, 'checked', 'click');

        ko.utils.triggerEvent(testNode.childNodes[0], "click");
        value_of(myobservable()).should_be(true);
    },

    'Should be able to change watched events for a dom observable': function () {
        testNode.innerHTML = "<input type='checkbox' />";
        var checkBox = testNode.childNodes[0],
            myobservable = ko.domObservable(checkBox, 'checked'),
            latestNotifiedValue = ko.observable(myobservable()),
            subscription = myobservable.subscribe(latestNotifiedValue);

        // initially it doesn't listen for changes; so the value stays the same
        ko.utils.triggerEvent(testNode.childNodes[0], "click");
        value_of(latestNotifiedValue()).should_be(false);

        // now modify it to listen for the click event
        myobservable(false);
        ko.domObservable(checkBox, 'checked', 'click');
        ko.utils.triggerEvent(testNode.childNodes[0], "click");
        value_of(latestNotifiedValue()).should_be(true);
    },

    'Should catch the text input\'s onchange and update value observable': function () {
        testNode.innerHTML = "<input />";
        var textBox = testNode.childNodes[0];
        var myobservable = ko.domObservable(textBox, 'value', ['change']);

        textBox.value = "some user-entered value";
        ko.utils.triggerEvent(textBox, "change");
        value_of(myobservable()).should_be("some user-entered value");
    },

    'Should assign an empty string as value if the observable value is null or undefined': function () {
        testNode.innerHTML = "<input />";
        var textBox = testNode.childNodes[0];
        var myobservable = ko.domObservable(textBox, 'value');
        value_of(textBox.value).should_be("");
        myobservable(null);
        value_of(textBox.value).should_be("");
        myobservable(undefined);
        value_of(textBox.value).should_be("");
    },

    'Test 1': function() {

    }
});
