var savedHandlers;
function resetBindingHandlers() {
    if (savedHandlers)
        ko.bindingHandlers = savedHandlers;
    savedHandlers = ko.utils.extend({}, ko.bindingHandlers);
}

describe('Expression Rewriting', {
    before_each: resetBindingHandlers,

    'Should be able to parse simple object literals': function() {
        var result = ko.expressionRewriting.parseObjectLiteral("a: 1, b: 2, \"quotedKey\": 3, 'aposQuotedKey': 4");
        value_of(result.length).should_be(4);
        value_of(result[0][0]).should_be("a");
        value_of(result[0][1]).should_be("1");
        value_of(result[1][0]).should_be("b");
        value_of(result[1][1]).should_be("2");
        value_of(result[2][0]).should_be("quotedKey");
        value_of(result[2][1]).should_be("3");
        value_of(result[3][0]).should_be("aposQuotedKey");
        value_of(result[3][1]).should_be("4");
    },

    'Should ignore any outer braces': function() {
        var result = ko.expressionRewriting.parseObjectLiteral("{a: 1}");
        value_of(result.length).should_be(1);
        value_of(result[0][0]).should_be("a");
        value_of(result[0][1]).should_be("1");
    },

    'Should be able to parse object literals containing string literals': function() {
        var result = ko.expressionRewriting.parseObjectLiteral("a: \"comma, colon: brace{ bracket[ apos' escapedQuot\\\" end\", b: 'escapedApos\\\' brace} bracket] quot\"'");
        value_of(result.length).should_be(2);
        value_of(result[0][0]).should_be("a");
        value_of(result[0][1]).should_be("\"comma, colon: brace{ bracket[ apos' escapedQuot\\\" end\"");
        value_of(result[1][0]).should_be("b");
        value_of(result[1][1]).should_be("'escapedApos\\\' brace} bracket] quot\"'");
    },

    'Should be able to parse object literals containing child objects, arrays, function literals, and newlines': function() {
        // The parsing may or may not keep unnecessary spaces. So to avoid confusion, avoid unnecessary spaces.
        var result = ko.expressionRewriting.parseObjectLiteral(
            "myObject:{someChild:{},someChildArray:[1,2,3],\"quotedChildProp\":'string value'},\n"
          + "someFn:function(a,b,c){var regex=/}/;var str='/})({';return{};},"
          + "myArray:[{},function(){},\"my'Str\",'my\"Str']"
        );
        value_of(result.length).should_be(3);
        value_of(result[0][0]).should_be("myObject");
        value_of(result[0][1]).should_be("{someChild:{},someChildArray:[1,2,3],\"quotedChildProp\":'string value'}");
        value_of(result[1][0]).should_be("someFn");
        value_of(result[1][1]).should_be("function(a,b,c){var regex=/}/;var str='/})({';return{};}");
        value_of(result[2][0]).should_be("myArray");
        value_of(result[2][1]).should_be("[{},function(){},\"my'Str\",'my\"Str']");
    },

    'Should be able to cope with malformed syntax (things that aren\'t key-value pairs)': function() {
        var result = ko.expressionRewriting.parseObjectLiteral("malformed1, 'mal:formed2', good:3, { malformed: 4 }, good5:5");
        value_of(result.length).should_be(5);
        value_of(result[0][0]).should_be("malformed1");
        value_of(result[1][0]).should_be("mal:formed2");
        value_of(result[2][0]).should_be("good");
        value_of(result[2][1]).should_be("3");
        value_of(result[4][0]).should_be("good5");
        value_of(result[4][1]).should_be("5");
        // There's not really a good 'should' value for "{ malformed: 4 }", so don't check
    },

    'Should ensure all keys are wrapped in quotes': function() {
        var rewritten = ko.expressionRewriting.preProcessBindings("a: 1, 'b': 2, \"c\": 3");
        value_of(rewritten).should_be("'a':1,'b':2,'c':3");
    },

    'Should convert keys without values to key:true': function() {
        ko.bindingHandlers.b = { flags:bindingFlags_noValue };
        var rewritten = ko.expressionRewriting.preProcessBindings("a: 1, b");
        var parsedRewritten = eval("({" + rewritten + "})");
        value_of(parsedRewritten.a).should_be(1);
        value_of(parsedRewritten.b).should_be(true);
    },

    'Should allow binding to modify value through "preprocess" method': function() {
        // create binding that has a default value of false
        ko.bindingHandlers.b = {
            preprocess: function(value) {
                return value ? value : "false";
            }
        };
        var rewritten = ko.expressionRewriting.preProcessBindings("a: 1, b");
        var parsedRewritten = eval("({" + rewritten + "})");
        value_of(parsedRewritten.a).should_be(1);
        value_of(parsedRewritten.b).should_be(false);
    },

    'Should allow binding to add/replace bindings through "preprocess" method\'s "addBinding" callback': function() {
        ko.bindingHandlers.b = {
            preprocess: function(value, key, addBinding) {
                addBinding("a"+key, value);
            }
        };
        var rewritten = ko.expressionRewriting.preProcessBindings("a: 1, b: 2");
        var parsedRewritten = eval("({" + rewritten + "})");
        value_of(parsedRewritten.a).should_be(1);
        value_of(parsedRewritten.b).should_be(undefined);
        value_of(parsedRewritten.ab).should_be(2);
    },

    'Bindings added by "preprocess" should be at the root level': function() {
        ko.bindingHandlers.b = {
            flags: ko.bindingFlags.twoLevel,
            preprocess: function(value, key, addBinding) {
                addBinding("a"+key, value);
                return '' + (+value + 1);
            }
        };
        var rewritten = ko.expressionRewriting.preProcessBindings("a: 1, b: {a: 2}");
        var parsedRewritten = eval("({" + rewritten + "})");
        value_of(parsedRewritten.a).should_be(1);
        value_of(parsedRewritten.b).should_be(undefined);
        value_of(parsedRewritten['b.a']).should_be(3);
        value_of(parsedRewritten['ab.a']).should_be(2);
    },

    'Should be able to chain "preprocess" calls when one adds a binding for another': function() {
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
        value_of(parsedRewritten.a).should_be(2);
        value_of(parsedRewritten.b).should_be(undefined);
        value_of(parsedRewritten['a.b']).should_be(3);
    },

    'Should convert values to property accessors': function () {
        var h = ko.bindingHandlers;
        h.a = h.b = h.c = h.d = h.e = h.f = h.g = h.h = h.i = h.j = { flags: ko.bindingFlags.twoWay };
        var rewritten = ko.expressionRewriting.preProcessBindings(
            'a : 1, b : firstName, c : function() { return "returnValue"; }, ' +
            'd: firstName+lastName, e: boss.firstName, f: boss . lastName, ' +
            'g: getAssitant(), h: getAssitant().firstName, i: getAssitant("[dummy]")[ "lastName" ], ' +
            'j: boss.firstName + boss.lastName'
        );
        var assistant = { firstName: "john", lastName: "english" };
        var model = {
            firstName: "bob", lastName: "smith",
            boss: { firstName: "rick", lastName: "martin" },
            getAssitant: function() { return assistant }
        };
        with (model) {
            var parsed = eval("({" + rewritten + "})");
            // test values of property
            value_of(parsed.a).should_be(1);
            value_of(parsed.b).should_be("bob");
            value_of(parsed.c()).should_be("returnValue");
            value_of(parsed.d).should_be("bobsmith");
            value_of(parsed.e).should_be("rick");
            value_of(parsed.f).should_be("martin");
            value_of(parsed.g()).should_be(assistant);
            value_of(parsed.h()).should_be("john");
            value_of(parsed.i()).should_be("english");

            // test that only writable expressions are set up for writing
            // 'j' matches due to the simple checking for trailing property accessor
            value_of(parsed._ko_property_writers).should_have_own_properties(['b','e','f','h','i','j']);

            // make sure writing to them works
            parsed._ko_property_writers.b("bob2");
            value_of(model.firstName).should_be("bob2");
            parsed._ko_property_writers.e("rick2");
            value_of(model.boss.firstName).should_be("rick2");
            parsed._ko_property_writers.f("martin2");
            value_of(model.boss.lastName).should_be("martin2");
            parsed._ko_property_writers.h("john2");
            value_of(assistant.firstName).should_be("john2");
            parsed._ko_property_writers.i("english2");
            value_of(assistant.lastName).should_be("english2");

            // make sure writing to 'j' doesn't error or actually change anything
            parsed._ko_property_writers.j("nothing at all");
            value_of(model.boss.firstName).should_be("rick2");
            value_of(model.boss.lastName).should_be("martin2");
        }
    },

    'Should convert a variety of values to property accessors': function () {
        ko.bindingHandlers.b = { flags: ko.bindingFlags.twoWay | ko.bindingFlags.twoLevel };
        var rewritten = ko.expressionRewriting.preProcessBindings('b.a: prop1, b.b: obj2.prop2, b.c: obj2["prop2"], b.d: getObj().prop2');

        var model = { prop1: "bob", obj2: { prop2: "jones" }, getObj: function() { return this.obj2 } };
        with (model) {
            var parsedRewritten = eval("({" + rewritten + "})");
            value_of(parsedRewritten['b.a']).should_be("bob");
            value_of(parsedRewritten['b.b']).should_be("jones");
            value_of(parsedRewritten['b.c']).should_be("jones");
            value_of(parsedRewritten['b.d']()).should_be("jones");
            var accessor = function(key) { return parsedRewritten[key]; };

            // update simple property
            ko.expressionRewriting.writeValueToProperty(null, accessor, 'b.a', "stan");
            value_of(model.prop1).should_be("stan");

            // update sub-property (two methods)
            ko.expressionRewriting.writeValueToProperty(null, accessor, 'b.b', "smith");
            value_of(model.obj2.prop2).should_be("smith");
            ko.expressionRewriting.writeValueToProperty(null, accessor, 'b.c', "sloan");
            value_of(model.obj2.prop2).should_be("sloan");

            // update property of object returned by a function
            ko.expressionRewriting.writeValueToProperty(null, accessor, 'b.d', "smart");
            value_of(model.obj2.prop2).should_be("smart");
        }
    },

    'Should be able to eval rewritten literals that contain unquoted keywords as keys': function() {
        var rewritten = ko.expressionRewriting.preProcessBindings("while: true");
        value_of(rewritten).should_be("'while':true");
        var evaluated = eval("({" + rewritten + "})");
        value_of(evaluated['while']).should_be(true);
    },

    'Should be able to eval two-level bindings mixed with one-level bindings': function() {
        ko.bindingHandlers.a = { flags: ko.bindingFlags.twoLevel | ko.bindingFlags.twoWay };
        var rewritten = ko.expressionRewriting.preProcessBindings('a.f: firstName, b: false, a: {l: lastName}');

        var model = { firstName: "bob", lastName: "smith" };
        with (model) {
            var parsedRewritten = eval("({" + rewritten + "})");
            value_of(parsedRewritten['a.f']).should_be("bob");
            value_of(parsedRewritten['a.l']).should_be("smith");
            value_of(parsedRewritten.b).should_be(false);

            parsedRewritten._ko_property_writers['a.f']("bob2");
            value_of(model.firstName).should_be("bob2");
        }
    }
});
