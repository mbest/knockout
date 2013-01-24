
describe('DOM node disposal', function() {
    beforeEach(jasmine.prepareTestNode);

    it('Should be able to set arbitrary property values', function() {
        var obs1 = ko.domObservable(testNode, 'firstAttribute');
        obs1("first value");
        expect(testNode["firstAttribute"]).toEqual("first value");
        expect(obs1()).toEqual("first value");

        var obs2 = ko.domObservable(testNode, 'second-attribute');
        obs2(true);
        expect(testNode["second-attribute"]).toEqual(true);
        expect(obs2()).toEqual(true);
    });

    it('Should be able to create multiple observable for the same property that update in sync', function() {
        var obs1 = ko.domObservable(testNode, 'firstAttribute');
        obs1("first value");
        expect(testNode["firstAttribute"]).toEqual("first value");
        expect(obs1()).toEqual("first value");

        var obs2 = ko.domObservable(testNode, 'firstAttribute');
        expect(obs2()).toEqual("first value");

        obs2(true);
        expect(testNode["firstAttribute"]).toEqual(true);
        expect(obs1()).toEqual(true);
    });

    it('Should be able to control a checkbox\'s checked state', function () {
        testNode.innerHTML = "<input type='checkbox' />";
        var checkBox = testNode.childNodes[0];
        var myobservable = ko.domObservable(checkBox, 'checked');
        expect(checkBox.checked).toEqual(false);

        myobservable(true);
        expect(checkBox.checked).toEqual(true);
    });

    it('Should update observable when the checkbox click event fires', function () {
        testNode.innerHTML = "<input type='checkbox' />";
        var checkBox = testNode.childNodes[0];
        var myobservable = ko.domObservable(checkBox, 'checked', 'click');

        ko.utils.triggerEvent(testNode.childNodes[0], "click");
        expect(myobservable()).toEqual(true);
    });

    it('Should be able to change watched events for a dom observable', function () {
        testNode.innerHTML = "<input type='checkbox' />";
        var checkBox = testNode.childNodes[0],
            myobservable = ko.domObservable(checkBox, 'checked'),
            latestNotifiedValue = ko.observable(myobservable()),
            subscription = myobservable.subscribe(latestNotifiedValue);

        // initially it doesn't listen for changes; so the value stays the same
        ko.utils.triggerEvent(testNode.childNodes[0], "click");
        expect(latestNotifiedValue()).toEqual(false);

        // now modify it to listen for the click event
        myobservable(false);
        ko.domObservable(checkBox, 'checked', 'click');
        ko.utils.triggerEvent(testNode.childNodes[0], "click");
        expect(latestNotifiedValue()).toEqual(true);
    });

    it('Should catch the text input\'s onchange and update value observable', function () {
        testNode.innerHTML = "<input />";
        var textBox = testNode.childNodes[0];
        var myobservable = ko.domObservable(textBox, 'value', ['change']);

        textBox.value = "some user-entered value";
        ko.utils.triggerEvent(textBox, "change");
        expect(myobservable()).toEqual("some user-entered value");
    });

    it('Should assign an empty string as value if the observable value is null or undefined', function () {
        testNode.innerHTML = "<input />";
        var textBox = testNode.childNodes[0];
        var myobservable = ko.domObservable(textBox, 'value');
        expect(textBox.value).toEqual("");
        myobservable(null);
        expect(textBox.value).toEqual("");
        myobservable(undefined);
        expect(textBox.value).toEqual("");
    });
});
