describe('Binding preprocessing', function() {
    var savedHandlers;
    beforeEach(function () {
        if (savedHandlers)
            ko.bindingHandlers = savedHandlers;
        savedHandlers = ko.utils.extend({}, ko.bindingHandlers);
    });

    it('Should allow binding to modify value through "preprocess" method', function() {
        // create binding that has a default value of false
        ko.bindingHandlers.b = {
            preprocess: function(value) {
                return value ? value : "false";
            }
        };
        var rewritten = ko.expressionRewriting.preProcessBindings("a: 1, b");
        var parsedRewritten = eval("({" + rewritten + "})");
        expect(parsedRewritten.a).toEqual(1);
        expect(parsedRewritten.b).toEqual(false);
    });

    it('Should allow binding to add/replace bindings through "preprocess" method\'s "addBinding" callback', function() {
        ko.bindingHandlers.b = {
            preprocess: function(value, key, addBinding) {
                addBinding("a"+key, value);
            }
        };
        var rewritten = ko.expressionRewriting.preProcessBindings("a: 1, b: 2");
        var parsedRewritten = eval("({" + rewritten + "})");
        expect(parsedRewritten.a).toEqual(1);
        expect(parsedRewritten.b).toEqual(undefined);
        expect(parsedRewritten.ab).toEqual(2);
    });

    it('Bindings added by "preprocess" should be at the root level', function() {
        ko.bindingHandlers.b = {
            flags: ko.bindingFlags.twoLevel,
            preprocess: function(value, key, addBinding) {
                addBinding("a"+key, value);
                return '' + (+value + 1);
            }
        };
        var rewritten = ko.expressionRewriting.preProcessBindings("a: 1, b: {a: 2}");
        var parsedRewritten = eval("({" + rewritten + "})");
        expect(parsedRewritten.a).toEqual(1);
        expect(parsedRewritten.b).toEqual(undefined);
        expect(parsedRewritten['b.a']).toEqual(3);
        expect(parsedRewritten['ab.a']).toEqual(2);
    });

    it('Should be able to chain "preprocess" calls when one adds a binding for another', function() {
        // preprocess adds 1 to value
        ko.bindingHandlers.a = {
            flags: ko.bindingFlags.twoLevel,
            preprocess: function(value, key, addBinding) {
                return '' + (+value + 1);
            }
        };
        // preprocess converts b to a.b
        ko.bindingHandlers.b = {
            preprocess: function(value, key, addBinding) {
                addBinding("a.b", value);
            }
        };
        var rewritten = ko.expressionRewriting.preProcessBindings("a: 1, b: 2");
        var parsedRewritten = eval("({" + rewritten + "})");
        expect(parsedRewritten.a).toEqual(2);
        expect(parsedRewritten.b).toEqual(undefined);
        expect(parsedRewritten['a.b']).toEqual(3);
    });

});
