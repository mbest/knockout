
describe('Binding Expression Rewriting', {

    'Should be able to parse simple object literals': function() {
        var result = ko.bindingExpressionRewriting.parseObjectLiteral("a: 1, b: 2, \"quotedKey\": 3, 'aposQuotedKey': 4");
        value_of(result.length).should_be(4);
        value_of(result[0].key).should_be("a");
        value_of(result[0].value).should_be("1");
        value_of(result[1].key).should_be("b");
        value_of(result[1].value).should_be("2");
        value_of(result[2].key).should_be("quotedKey");
        value_of(result[2].value).should_be("3");
        value_of(result[3].key).should_be("aposQuotedKey");
        value_of(result[3].value).should_be("4");
    },

    'Should ignore any outer braces': function() {
        var result = ko.bindingExpressionRewriting.parseObjectLiteral("{a: 1}");
        value_of(result.length).should_be(1);
        value_of(result[0].key).should_be("a");
        value_of(result[0].value).should_be("1");
    },

    'Should be able to parse object literals containing string literals': function() {
        var result = ko.bindingExpressionRewriting.parseObjectLiteral("a: \"comma, colon: brace{ bracket[ apos' escapedQuot\\\" end\", b: 'escapedApos\\\' brace} bracket] quot\"'");
        value_of(result.length).should_be(2);
        value_of(result[0].key).should_be("a");
        value_of(result[0].value).should_be("\"comma, colon: brace{ bracket[ apos' escapedQuot\\\" end\"");
        value_of(result[1].key).should_be("b");
        value_of(result[1].value).should_be("'escapedApos\\\' brace} bracket] quot\"'");
    },

    'Should be able to parse object literals containing child objects, arrays, function literals, and newlines': function() {
        // The parsing may or may not keep unnecessary spaces. So to avoid confusion, avoid unnecessary spaces. 
        var result = ko.bindingExpressionRewriting.parseObjectLiteral(
            "myObject:{someChild:{},someChildArray:[1,2,3],\"quotedChildProp\":'string value'},\n"
          + "someFn:function(a,b,c){var regex=/}/;var str='/})({';return{};},"
          + "myArray:[{},function(){},\"my'Str\",'my\"Str']"
        );
        value_of(result.length).should_be(3);
        value_of(result[0].key).should_be("myObject");
        value_of(result[0].value).should_be("{someChild:{},someChildArray:[1,2,3],\"quotedChildProp\":'string value'}");
        value_of(result[1].key).should_be("someFn");
        value_of(result[1].value).should_be("function(a,b,c){var regex=/}/;var str='/})({';return{};}");
        value_of(result[2].key).should_be("myArray");
        value_of(result[2].value).should_be("[{},function(){},\"my'Str\",'my\"Str']");
    },

    'Should be able to cope with malformed syntax (things that aren\'t key-value pairs)': function() {
        var result = ko.bindingExpressionRewriting.parseObjectLiteral("malformed1, 'mal:formed2', good:3, { malformed: 4 }, good5:5");
        value_of(result.length).should_be(5);
        value_of(result[0].key).should_be("malformed1");
        value_of(result[1].key).should_be("mal:formed2");
        value_of(result[2].key).should_be("good");
        value_of(result[2].value).should_be("3");
        value_of(result[4].key).should_be("good5");
        value_of(result[4].value).should_be("5");
        // There's not really a good 'should' value for "{ malformed: 4 }", so don't check
    },

    'Should ensure all keys are wrapped in quotes': function() {
        var rewritten = ko.bindingExpressionRewriting.insertPropertyAccessors("a: 1, 'b': 2, \"c\": 3");
        value_of(rewritten).should_be("'a':1,'b':2,'c':3");
    },

    'Should convert keys without values to key:true': function() {
        ko.bindingHandlers['b'] = { flags:bindingFlags_noValue };
        var rewritten = ko.bindingExpressionRewriting.insertPropertyAccessors("a: 1, b");
        var parsedRewritten = eval("({" + rewritten + "})");
        value_of(parsedRewritten.a).should_be(1);
        value_of(parsedRewritten.b).should_be(true);
        delete ko.bindingHandlers['b'];
    },

    'Should convert values to property accessors': function () {
        ko.bindingHandlers.b = { flags: ko.bindingFlags.twoWay };
        var rewritten = ko.bindingExpressionRewriting.insertPropertyAccessors('a : 1, "b" : firstName, c : function() { return "returnValue"; }');

        var model = { firstName: "bob", lastName: "smith" };
        with (model) {
            var parsedRewritten = eval("({" + rewritten + "})");
            value_of(parsedRewritten.a).should_be(1);
            value_of(parsedRewritten.b).should_be("bob");
            value_of(parsedRewritten.c()).should_be("returnValue");

            parsedRewritten._ko_property_writers.b("bob2");
            value_of(model.firstName).should_be("bob2");
        }
        delete ko.bindingHandlers.b;
    },

    'Should convert a variety of values to property accessors': function () {
        ko.bindingHandlers.b = { flags: ko.bindingFlags.twoWay | ko.bindingFlags.twoLevel };
        var rewritten = ko.bindingExpressionRewriting.insertPropertyAccessors('b.a: prop1, b.b: obj2.prop2, b.c: obj2["prop2"], b.d: getObj().prop2');

        var model = { prop1: "bob", obj2: { prop2: "jones" }, getObj: function() { return this.obj2 } };
        with (model) {
            var parsedRewritten = eval("({" + rewritten + "})");
            value_of(parsedRewritten['b.a']).should_be("bob");
            value_of(parsedRewritten['b.b']).should_be("jones");
            value_of(parsedRewritten['b.c']).should_be("jones");
            var accessor = function(key) { return parsedRewritten[key]; };

            // update simple property
            ko.bindingExpressionRewriting.writeValueToProperty(null, accessor, 'b.a', "stan");
            value_of(model.prop1).should_be("stan");

            // update sub-property (two methods)
            ko.bindingExpressionRewriting.writeValueToProperty(null, accessor, 'b.b', "smith");
            value_of(model.obj2.prop2).should_be("smith");
            ko.bindingExpressionRewriting.writeValueToProperty(null, accessor, 'b.c', "sloan");
            value_of(model.obj2.prop2).should_be("sloan");

            // update property of object returned by a function (won't update)
            ko.bindingExpressionRewriting.writeValueToProperty(null, accessor, 'b.d', "smart");
            value_of(model.obj2.prop2).should_be("sloan");
        }
        delete ko.bindingHandlers.b;
    },

    'Should be able to eval rewritten literals that contain unquoted keywords as keys': function() {
        var rewritten = ko.bindingExpressionRewriting.insertPropertyAccessors("while: true");
        value_of(rewritten).should_be("'while':true");
        var evaluated = eval("({" + rewritten + "})");
        value_of(evaluated['while']).should_be(true);
    },

    'Should be able to eval two-level bindings mixed with one-level bindings': function() {
        ko.bindingHandlers.a = { flags: ko.bindingFlags.twoLevel | ko.bindingFlags.twoWay };
        var rewritten = ko.bindingExpressionRewriting.insertPropertyAccessors('a.f: firstName, b: false, a: {l: lastName}');

        var model = { firstName: "bob", lastName: "smith" };
        with (model) {
            var parsedRewritten = eval("({" + rewritten + "})");
            value_of(parsedRewritten['a.f']).should_be("bob");
            value_of(parsedRewritten['a.l']).should_be("smith");
            value_of(parsedRewritten.b).should_be(false);

            parsedRewritten._ko_property_writers['a.f']("bob2");
            value_of(model.firstName).should_be("bob2");
        }
        delete ko.bindingHandlers.a;
    }
});